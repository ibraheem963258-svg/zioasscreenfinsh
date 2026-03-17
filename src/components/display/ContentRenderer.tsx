/**
 * ======================================
 * Content Renderer — Zero-Egress Edition
 * ======================================
 *
 * CRITICAL ARCHITECTURE — why every decision matters for egress:
 *
 * 1. `key` on <video>: MUST be stable per content item ID.
 *    Using `key={currentContent.id}` was WRONG — when the content array gets a new
 *    reference (quickRefresh), React sees a new prop object and re-mounts the element,
 *    causing the browser to open a new 206 range request even if src hasn't changed.
 *    FIX: use `videoMountKey` which ONLY increments when the actual item ID changes.
 *
 * 2. `src` fallback: MUST NOT fall back to remote URL while blob is loading.
 *    `src={resolvedSrc || currentContent.url}` was WRONG — when resolvedSrc='' during
 *    the IndexedDB async lookup, the video briefly pointed to the remote URL.
 *    FIX: initialize resolvedSrc to remote URL synchronously in the effect, use only
 *    resolvedSrc in the JSX with no fallback.
 *
 * 3. `preload="none"` MUST be set explicitly on the <video> element.
 *    Samsung Tizen / LG WebOS default to 'auto' and will prefetch range chunks
 *    even from blob: URLs if preload is unset.
 *
 * 4. Watchdog MUST NEVER call video.load() or reassign video.src.
 *    Even blob: src reassignment causes the browser to re-open the stream.
 *    Recovery = video.play() ONLY.
 *
 * 5. Watchdog useEffect dep uses `videoMountKey` not `currentIndex`.
 *    This prevents the watchdog from being recreated on content-array refreshes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentItem, DisplaySettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getVideoBlobUrl, isIndexedDBSupported } from '@/hooks/useVideoCache';

interface ContentRendererProps {
  content:          ContentItem[];
  settings:         DisplaySettings;
  isPlaying:        boolean;
  onContentChange?: (index: number) => void;
}

export function ContentRenderer({
  content,
  settings,
  isPlaying,
  onContentChange,
}: ContentRendererProps) {

  // ---- indexes ----
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Guard: prevents double-fire from setTimeout + onEnded race condition
  const isTransitioningRef = useRef(false);

  // Track what URL is currently playing so content-array refreshes don't reset it
  const currentUrlRef = useRef<string>('');

  // Display order (for shuffle)
  const [displayOrder, setDisplayOrder] = useState<number[]>(() =>
    content.map((_, i) => i)
  );

  // IndexedDB blob URL cache — ref avoids re-renders that interrupt playback
  const cachedUrlsRef = useRef<Map<string, string>>(new Map());

  // ── resolvedSrcRef: the src COMMITTED to <video> at the start of each index.
  // NEVER updated mid-playback. Cache events update cachedUrlsRef only.
  const resolvedSrcRef = useRef<string>('');
  const [resolvedSrc, setResolvedSrc] = useState<string>('');

  // ── videoMountKey: ONLY increments when the content item ID actually changes.
  // This prevents React from re-mounting the video on quickRefresh content-array
  // reference changes, which would open a new 206 range request per heartbeat.
  const videoMountKeyRef  = useRef<number>(0);
  const lastMountedIdRef  = useRef<string>('');
  const [videoMountKey, setVideoMountKey] = useState<number>(0);

  // Video element ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Watchdog refs ──
  const lastCurrentTimeRef    = useRef<number>(-1);
  const stallCountRef         = useRef<number>(0);
  const WATCHDOG_INTERVAL_MS  = 5000;
  const MAX_STALL_BEFORE_SKIP = 3;

  // ---- Resolve src for CURRENT video when index changes ----
  useEffect(() => {
    if (content.length === 0) return;

    const order      = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex  = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const current    = content[contentIdx];

    if (!current || current.type !== 'video') return;

    // ── Update stable mount key ONLY when the actual video item ID changes.
    // Does NOT change when the content array gets a new reference (quickRefresh).
    if (lastMountedIdRef.current !== current.id) {
      lastMountedIdRef.current    = current.id;
      videoMountKeyRef.current   += 1;
      setVideoMountKey(videoMountKeyRef.current);
    }

    let cancelled = false;

    // 1. In-session Map hit → instant, zero egress, zero IndexedDB round-trip
    const sessionCached = cachedUrlsRef.current.get(current.url);
    if (sessionCached) {
      if (resolvedSrcRef.current !== sessionCached) {
        resolvedSrcRef.current = sessionCached;
        setResolvedSrc(sessionCached);
        console.log('[ContentRenderer] ✅ Playing from session cache:', current.url.split('/').pop());
      }
      return;
    }

    // ── KEY FIX: If video is already playing from a blob URL, do NOT reset to remote URL.
    // This prevents a new 206 stream every time the content array gets a new reference.
    if (resolvedSrcRef.current.startsWith('blob:')) {
      cachedUrlsRef.current.set(current.url, resolvedSrcRef.current);
      console.log('[ContentRenderer] 🔒 Blob already playing, skipping remote fallback:', current.url.split('/').pop());
      return;
    }

    if (!isIndexedDBSupported()) {
      // No IndexedDB — use remote URL directly
      resolvedSrcRef.current = current.url;
      setResolvedSrc(current.url);
      return;
    }

    // 2. Query IndexedDB FIRST — zero-egress path.
    //    We do NOT set remote URL here yet to avoid triggering a 206 range request
    //    before the blob lookup completes. The video element stays blank (<1s) until
    //    the blob is ready. If IndexedDB misses, we fall back to remote URL.
    const updatedAt = current.uploadedAt?.toISOString();

    // Set a loading sentinel so we don't re-enter this branch on re-render
    resolvedSrcRef.current = '__loading__';

    getVideoBlobUrl(current.url, updatedAt).then(blobUrl => {
      if (cancelled) return;

      const srcToUse = blobUrl !== current.url ? blobUrl : current.url;
      cachedUrlsRef.current.set(current.url, srcToUse);
      resolvedSrcRef.current = srcToUse;
      setResolvedSrc(srcToUse);

      if (blobUrl !== current.url) {
        console.log('[ContentRenderer] ✅ Playing from IndexedDB (zero egress):', current.url.split('/').pop());
      } else {
        console.log('[ContentRenderer] ⬇️ IndexedDB miss — falling back to remote URL:', current.url.split('/').pop());
      }
    }).catch((err) => {
      if (cancelled) return;
      // IndexedDB threw — safe fallback to remote URL.
      // ⚠️ WARNING: This WILL trigger a new download from Supabase Storage (egress).
      // This only happens when IndexedDB itself is broken/unavailable (e.g. storage quota exceeded,
      // browser denied IndexedDB, or Safari private mode). Under normal conditions this never fires.
      console.error('[ContentRenderer] 🚨 EGRESS WARNING — IndexedDB failed, falling back to remote URL:', current.url.split('/').pop(), err);
      resolvedSrcRef.current = current.url;
      setResolvedSrc(current.url);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, content, displayOrder]);

  // ---- Initialize / re-initialize display order ----
  useEffect(() => {
    if (content.length === 0) return;

    let order = content.map((_, i) => i);

    if (settings.playbackOrder === 'shuffle') {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    const currentUrl = currentUrlRef.current;
    let newCurrentIndex = 0;
    if (currentUrl) {
      const found = order.findIndex(idx => content[idx]?.url === currentUrl);
      if (found !== -1) newCurrentIndex = found;
    }

    setDisplayOrder(order);
    setCurrentIndex(newCurrentIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, settings.playbackOrder]);

  // ---- Core transition function ----
  const goToNext = useCallback(() => {
    const orderLen = displayOrder.length || content.length;
    if (orderLen <= 1 || !isPlaying) return;
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % orderLen;
        onContentChange?.(next);
        return next;
      });
      setIsTransitioning(false);
      setTimeout(() => { isTransitioningRef.current = false; }, 50);
    }, settings.transitionDuration);
  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying, onContentChange]);

  // ---- Auto-advance timer for images (and videos as fallback) ----
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;

    const order      = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex  = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const current    = content[contentIdx];

    if (!current) return;

    currentUrlRef.current = current.url;

    const isVideo       = current.type === 'video';
    const baseDuration  = (current.duration || settings.slideDuration) * 1000;
    const timerDuration = isVideo ? baseDuration + 2000 : baseDuration;

    const timer = setTimeout(goToNext, timerDuration);
    return () => clearTimeout(timer);
  }, [currentIndex, content, displayOrder, settings.slideDuration, goToNext, isPlaying]);

  // ---- Video ended: primary trigger for video transitions ----
  const handleVideoEnded = useCallback(() => {
    if (content.length > 1) {
      goToNext();
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  }, [content.length, goToNext]);

  // ---- Auto-resume if TV remote pauses the video ----
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePause = () => {
      setTimeout(() => {
        if (video.paused && isPlayingRef.current) {
          video.play().catch(console.error);
        }
      }, 150);
    };

    video.addEventListener('pause', handlePause);
    return () => video.removeEventListener('pause', handlePause);
  // Re-attach only when the video element is actually remounted (item ID changed)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoMountKey]);

  // ---- Video Watchdog — detects and recovers from stall/freeze ----
  // CRITICAL: NEVER call video.load() or reassign video.src inside this watchdog.
  // Even reassigning a blob: src causes the browser to re-open the stream and
  // can trigger a new 206 range request from Supabase Storage.
  // Recovery = video.play() ONLY.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    lastCurrentTimeRef.current = -1;
    stallCountRef.current      = 0;

    // Grace period: skip first 2 checks (~10s) while video is buffering/starting up
    let graceTicks = 2;

    const id = setInterval(() => {
      if (!video) return;
      if (video.ended || !isPlayingRef.current) return;

      if (graceTicks > 0) {
        graceTicks--;
        lastCurrentTimeRef.current = video.currentTime;
        return;
      }

      const prevTime      = lastCurrentTimeRef.current;
      const currTime      = video.currentTime;
      const timeStuck     = prevTime === currTime && !video.paused;
      const lowReadyState = !video.paused && !video.ended && video.readyState < 3;
      // Only flag stall if BOTH time is stuck AND buffer is depleted
      const isStalled     = timeStuck && lowReadyState;

      lastCurrentTimeRef.current = currTime;

      if (!isStalled) {
        stallCountRef.current = 0;
        return;
      }

      stallCountRef.current += 1;
      console.warn(
        `[Watchdog] ⚠️ Stall detected (attempt ${stallCountRef.current}/${MAX_STALL_BEFORE_SKIP})`,
        { timeStuck, lowReadyState, readyState: video.readyState, currentTime: currTime }
      );

      if (stallCountRef.current >= MAX_STALL_BEFORE_SKIP) {
        console.error('[Watchdog] ❌ Max stall retries — advancing to next item');
        stallCountRef.current = 0;
        goToNext();
        return;
      }

      // SAFE recovery: play() only — no src reassignment, no load()
      console.log('[Watchdog] 🔄 Recovery via play() only — zero network I/O');
      video.play().catch(err => console.warn('[Watchdog] play() failed:', err));

    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(id);
  // Dep on videoMountKey (not currentIndex) — watchdog only recreates on real item change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoMountKey, isPlaying, goToNext]);

  // ---- Scaling ----
  const scalingClass = (() => {
    switch (settings.contentScaling) {
      case 'fit':     return 'object-contain';
      case 'fill':    return 'object-cover';
      case 'stretch': return 'object-fill';
      default:        return 'object-cover';
    }
  })();

  // ---- Transition styles ----
  const getTransitionStyles = useCallback(() => {
    const duration = `${settings.transitionDuration}ms`;
    switch (settings.transitionType) {
      case 'slide':
        return {
          current: { transition: `transform ${duration} ease-in-out`, transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)' },
          next:    { transition: `transform ${duration} ease-in-out`, transform: isTransitioning ? 'translateX(0)'    : 'translateX(100%)' },
        };
      case 'crossfade':
        return {
          current: { transition: `opacity ${duration} ease-in-out`, opacity: isTransitioning ? 0 : 1 },
          next:    { transition: `opacity ${duration} ease-in-out`, opacity: isTransitioning ? 1 : 0 },
        };
      case 'fade':
      default:
        return {
          current: { transition: `opacity ${duration} ease-in-out`, opacity: isTransitioning ? 0 : 1 },
          next:    { opacity: 0 },
        };
    }
  }, [settings.transitionType, settings.transitionDuration, isTransitioning]);

  // ---- Guard: no content ----
  if (content.length === 0) return null;

  const effectiveOrder = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
  const contentIdx     = effectiveOrder[currentIndex] ?? 0;
  const currentContent = content[contentIdx];

  // Fallback if currentContent is somehow null
  if (!currentContent) {
    const fb = content[0];
    if (!fb) return null;
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {fb.type === 'image'
          ? <img src={fb.url} alt={fb.name} className="w-full h-full object-cover" />
          : <video
              src={fb.url}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              controls={false}
              disablePictureInPicture
              disableRemotePlayback
              style={{ pointerEvents: 'none' }}
            />
        }
      </div>
    );
  }

  const transitionStyles = getTransitionStyles();

  // ---- Next item index (for progress dots only — NOT preloaded) ----
  const nextIndex      = (currentIndex + 1) % effectiveOrder.length;
  const nextContentIdx = effectiveOrder[nextIndex] ?? 0;
  const nextContent    = content[nextContentIdx];

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">

      {/* ── Current Content ── */}
      <div className="absolute inset-0" style={transitionStyles.current}>
        {currentContent.type === 'image' ? (
          <img
            src={currentContent.url}
            alt={currentContent.name}
            className={cn('w-full h-full', scalingClass)}
            loading="eager"
          />
        ) : (
          // CRITICAL: videoMountKey is ONLY incremented when the content item ID changes.
          // Does NOT change on quickRefresh content-array reference updates.
          // preload="none" prevents Samsung Tizen / LG WebOS from auto-prefetching range chunks.
          <video
            key={videoMountKey}
            ref={videoRef}
            src={resolvedSrc}
            className={cn('w-full h-full', scalingClass)}
            autoPlay
            muted
            preload="none"
            loop={content.length === 1}
            playsInline
            controls={false}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onEnded={handleVideoEnded}
            onContextMenu={e => e.preventDefault()}
            onError={e => console.error('[Video] error:', (e.target as HTMLVideoElement).error)}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </div>

      {/* ── Next Content — shown only for slide/crossfade transitions ── */}
      {/* NOTE: We do NOT preload next video to avoid egress during current playback. */}
      {content.length > 1 && nextContent && nextContent.id !== currentContent.id &&
        (settings.transitionType === 'slide' || settings.transitionType === 'crossfade') && (
        <div className="absolute inset-0" style={transitionStyles.next}>
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className={cn('w-full h-full', scalingClass)}
              loading="lazy"
            />
          ) : (
            // Black frame placeholder — actual video starts after currentIndex advances
            <div className="w-full h-full bg-black" />
          )}
        </div>
      )}

      {/* ── Progress Dots ── */}
      {content.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {effectiveOrder.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/40'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
