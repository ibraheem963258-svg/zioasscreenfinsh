/**
 * ======================================
 * Content Renderer — Lag-Free + Watchdog Edition
 * ======================================
 *
 * Bug fixes preserved:
 *   1. Race condition: setTimeout + onEnded both calling goToNext → double transition
 *      Fix: isTransitioningRef guard — only ONE transition can be in-flight at a time
 *   2. Content refresh resets currentIndex to 0 mid-playback
 *      Fix: preserve current URL across content array updates via currentUrlRef
 *   3. nextVideoRef preload="auto" starving bandwidth from current video
 *      Fix: next-video element removed — only current video is loaded at a time
 *   4. Pause event listener re-attaches on every render
 *      Fix: attach once via ref, re-attach only on content-type switch
 *
 * Egress optimizations:
 *   5. All video URLs are cleaned of query-string cache-busters before caching
 *   6. Cache validation uses content.updatedAt (DB version) — no HEAD request needed
 *   7. Only the CURRENT video is resolved via IndexedDB; next video loads on-demand
 *      after the transition completes, preventing bandwidth race conditions
 *   8. In-flight deduplication in getVideoBlobUrl prevents concurrent duplicate downloads
 *
 * Video Watchdog (added for 20h+ runtime stability):
 *   9. Checks every 5 seconds that currentTime is advancing
 *  10. Detects stall/freeze: paused=false, ended=false, readyState<3 OR currentTime stuck
 *  11. On stall: reloads src and restarts playback without triggering a playlist transition
 *  12. Max 3 consecutive recovery attempts before advancing to next item (safety valve)
 *  13. Compatible with Samsung Smart TV (Tizen) and Android TV browsers
 *
 * Critical bug fix (v4) — "video canceled mid-playback":
 *  14. PROBLEM: When IndexedDB finishes caching a blob, setCachedUrlsVersion triggers a
 *      re-render. resolveUrl then returns the NEW blob URL, changing <video src> while
 *      the remote stream is active → browser cancels the in-flight request → readyState
 *      drops → Watchdog detects stall → recovery loop begins.
 *      FIX: resolvedSrcRef stores the src that was committed at the START of each index.
 *      cachedUrlsVersion changes NEVER update the video src mid-playback — the blob URL
 *      is only applied on the NEXT time this currentIndex is rendered (after a loop).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentItem, DisplaySettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getVideoBlobUrl, isIndexedDBSupported } from '@/hooks/useVideoCache';

interface ContentRendererProps {
  content:         ContentItem[];
  settings:        DisplaySettings;
  isPlaying:       boolean;
  onContentChange?: (index: number) => void;
}

export function ContentRenderer({
  content,
  settings,
  isPlaying,
  onContentChange,
}: ContentRendererProps) {

  // ---- indexes ----
  const [currentIndex, setCurrentIndex]     = useState(0);
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
  // This is the ONLY value used in the render. It is set once per currentIndex
  // change and NEVER updated by cache events — preventing mid-playback src swaps
  // that cause the browser to cancel the in-flight request (the "canceled" bug).
  const resolvedSrcRef = useRef<string>('');
  const [resolvedSrc, setResolvedSrc] = useState<string>('');

  // Video element refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Watchdog refs ──
  // Tracks last known currentTime to detect a "time stuck" stall
  const lastCurrentTimeRef   = useRef<number>(-1);
  // Counts consecutive stall detections to cap recovery attempts
  const stallCountRef        = useRef<number>(0);
  const WATCHDOG_INTERVAL_MS = 5000;  // check every 5 s
  const MAX_STALL_BEFORE_SKIP = 3;    // after 3 failed recoveries → skip to next item

  // ---- Resolve src for CURRENT video when index changes ----
  // Flow:
  //   a) Immediately set src to the remote URL so playback starts instantly.
  //   b) In the background, fetch/validate the blob from IndexedDB.
  //   c) Store the blob URL in cachedUrlsRef for the NEXT time this item plays.
  //   d) NEVER change resolvedSrc after playback has begun for this index.
  //      This prevents the "canceled" network request bug entirely.
  useEffect(() => {
    if (content.length === 0) return;

    const order      = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex  = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const current    = content[contentIdx];

    if (!current || current.type !== 'video') return;

    // Use blob URL from this session's cache if already resolved (zero egress)
    const cached = cachedUrlsRef.current.get(current.url);
    if (cached) {
      resolvedSrcRef.current = cached;
      setResolvedSrc(cached);
      console.log('[ContentRenderer] ✅ Playing from blob cache:', current.url.split('/').pop());
      return;
    }

    // Start with remote URL immediately — don't wait for download
    resolvedSrcRef.current = current.url;
    setResolvedSrc(current.url);

    // Background: cache the video for next playback cycle
    if (!isIndexedDBSupported()) return;
    const updatedAt = current.uploadedAt?.toISOString();
    getVideoBlobUrl(current.url, updatedAt).then(blobUrl => {
      if (blobUrl !== current.url) {
        // Store for NEXT time this item plays — do NOT interrupt current playback
        cachedUrlsRef.current.set(current.url, blobUrl);
        console.log('[ContentRenderer] 🗄️ Blob cached for next cycle:', current.url.split('/').pop());
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, content, displayOrder]);

  // ---- Initialize / re-initialize display order ----
  // When content array changes (soft refresh), try to preserve the currently-playing
  // item so the video doesn't restart from the beginning.
  useEffect(() => {
    if (content.length === 0) return;

    let order = content.map((_, i) => i);

    if (settings.playbackOrder === 'shuffle') {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    // Try to find the currently-playing item in the new content array
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
  // Uses a ref-based lock so it can NEVER fire twice simultaneously
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
      // Release lock AFTER state updates settle
      setTimeout(() => { isTransitioningRef.current = false; }, 50);
    }, settings.transitionDuration);
  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying, onContentChange]);

  // ---- Auto-advance timer for images (and videos as fallback) ----
  // For videos: onEnded is the primary trigger. setTimeout is only a safety fallback
  // and is blocked by the isTransitioningRef lock if onEnded already fired.
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;

    const order      = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex  = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const current    = content[contentIdx];

    if (!current) return;

    // Track what's currently playing (used for position-preservation on refresh)
    currentUrlRef.current = current.url;

    // For videos: rely on onEnded — only set a fallback timer (duration + 2s buffer)
    const isVideo     = current.type === 'video';
    const baseDuration = (current.duration || settings.slideDuration) * 1000;
    const timerDuration = isVideo ? baseDuration + 2000 : baseDuration;

    const timer = setTimeout(goToNext, timerDuration);
    return () => clearTimeout(timer);
  }, [currentIndex, content, displayOrder, settings.slideDuration, goToNext, isPlaying]);

  // ---- Video ended: primary trigger for video transitions ----
  const handleVideoEnded = useCallback(() => {
    if (content.length > 1) {
      goToNext();
    } else if (videoRef.current) {
      // Single video — just loop it
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  }, [content.length, goToNext]);

  // ---- Auto-resume if TV remote pauses the video ----
  // Attached directly to the element via ref — does NOT re-attach on every render
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
  // Re-attach only when the video element changes (i.e. content type switch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ---- Video Watchdog — detects and recovers from stall/freeze ----
  // Runs every 5 s while a video is playing.
  // Detects two types of stall:
  //   A) readyState < HAVE_FUTURE_DATA (< 3) — browser ran out of buffered data
  //   B) currentTime has not advanced in 5 s — "time stuck" freeze (the bug observed)
  // Recovery sequence:
  //   Attempt 1–2: reload src blob and call play()
  //   Attempt 3  : advance to next playlist item (prevents permanent black screen)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    // Reset tracking when the video source changes (new item starts)
    lastCurrentTimeRef.current = -1;
    stallCountRef.current      = 0;

    const id = setInterval(() => {
      if (!video) return;

      // Ignore if the video has naturally ended or is legitimately paused
      if (video.ended || !isPlayingRef.current) return;

      // Detect stall condition
      const timeStuck       = lastCurrentTimeRef.current === video.currentTime && !video.paused;
      const lowReadyState   = !video.paused && !video.ended && video.readyState < 3;
      const isStalled       = timeStuck || lowReadyState;

      lastCurrentTimeRef.current = video.currentTime;

      if (!isStalled) {
        // Healthy playback — reset stall counter
        stallCountRef.current = 0;
        return;
      }

      stallCountRef.current += 1;
      console.warn(
        `[Watchdog] ⚠️ Stall detected (attempt ${stallCountRef.current}/${MAX_STALL_BEFORE_SKIP})`,
        { timeStuck, lowReadyState, readyState: video.readyState, currentTime: video.currentTime }
      );

      if (stallCountRef.current >= MAX_STALL_BEFORE_SKIP) {
        // Failed multiple recovery attempts — skip to next item
        console.error('[Watchdog] ❌ Max stall retries reached — advancing to next item');
        stallCountRef.current = 0;
        goToNext();
        return;
      }

      // Recovery: reload source and restart
      const src = video.src;
      video.src = '';
      video.load();
      video.src = src;
      video.currentTime = 0;
      video.play().catch(err => console.warn('[Watchdog] play() after recovery failed:', err));

    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(id);
  // Re-create watchdog when video item changes or play state changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isPlaying, goToNext]);

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
          : <video src={fb.url} className="w-full h-full object-cover" autoPlay muted loop playsInline
              controls={false} disablePictureInPicture disableRemotePlayback style={{ pointerEvents: 'none' }} />
        }
      </div>
    );
  }

  const transitionStyles = getTransitionStyles();

  // ---- Next item index (for progress dots only — NOT preloaded) ----
  const nextIndex     = (currentIndex + 1) % effectiveOrder.length;
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
          <video
            key={currentContent.id}
            ref={videoRef}
            src={resolvedSrc || currentContent.url}
            className={cn('w-full h-full', scalingClass)}
            autoPlay
            muted
            // Never use loop when there are multiple items — onEnded handles transition
            loop={content.length === 1}
            playsInline
            controls={false}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onEnded={handleVideoEnded}
            onContextMenu={e => e.preventDefault()}
            onError={e => console.error('[Video] load error:', e)}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </div>

      {/* ── Next Content — shown only for slide/crossfade transitions ── */}
      {/* NOTE: We do NOT preload next video here to avoid egress during initial load.  */}
      {/* The next video blob is resolved on-demand in the useEffect above              */}
      {/* after currentIndex advances, so bandwidth is never split between two videos.  */}
      {content.length > 1 && nextContent && nextContent.id !== currentContent.id &&
        (settings.transitionType === 'slide' || settings.transitionType === 'crossfade') && (
        <div
          className="absolute inset-0"
          style={transitionStyles.next}
        >
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className={cn('w-full h-full', scalingClass)}
              loading="lazy"
            />
          ) : (
            // For video transitions, show a black frame — the actual video will start
            // playing after currentIndex advances and the blob URL is resolved
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
