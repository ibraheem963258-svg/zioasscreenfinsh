/**
 * ======================================
 * Content Renderer — Lag-Free Edition
 * ======================================
 *
 * Bug fixes:
 *   1. Race condition: setTimeout + onEnded both calling goToNext → double transition
 *      Fix: isTransitioningRef guard — only ONE transition can be in-flight at a time
 *   2. content refresh resets currentIndex to 0 mid-playback
 *      Fix: preserve current URL across content array updates
 *   3. nextVideoRef preload="auto" starving bandwidth from current video
 *      Fix: preload="metadata" — only loads metadata, not full video
 *   4. pause event listener re-attaches on every render
 *      Fix: attach once via ref
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentItem, DisplaySettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getVideoBlobUrl, isIndexedDBSupported } from '@/hooks/useVideoCache';

interface ContentRendererProps {
  content: ContentItem[];
  settings: DisplaySettings;
  isPlaying: boolean;
  onContentChange?: (index: number) => void;
}

export function ContentRenderer({
  content,
  settings,
  isPlaying,
  onContentChange,
}: ContentRendererProps) {
  // ---- indexes ----
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Guard: prevents double-fire from setTimeout + onEnded race condition
  const isTransitioningRef = useRef(false);

  // Track what URL is currently playing so content-array refreshes don't reset it
  const currentUrlRef = useRef<string>('');

  // display order (for shuffle)
  const [displayOrder, setDisplayOrder] = useState<number[]>(() =>
    content.map((_, i) => i)
  );

  // IndexedDB blob URL cache — ref avoids re-renders that interrupt playback
  const cachedUrlsRef = useRef<Map<string, string>>(new Map());
  const [cachedUrlsVersion, setCachedUrlsVersion] = useState(0);

  // video element refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);

  // ---- Pre-resolve all video blob URLs in parallel before first render ----
  useEffect(() => {
    if (!isIndexedDBSupported()) return;
    const videos = content.filter(c => c.type === 'video');
    const uncached = videos.filter(v => !cachedUrlsRef.current.has(v.url));
    if (uncached.length === 0) return;

    Promise.all(
      uncached.map(async item => {
        const blob = await getVideoBlobUrl(item.url);
        return { original: item.url, blob };
      })
    ).then(results => {
      const updates = results.filter(r => r.blob !== r.original);
      if (updates.length > 0) {
        updates.forEach(r => cachedUrlsRef.current.set(r.original, r.blob));
        setCachedUrlsVersion(v => v + 1);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Resolve URL: return blob URL if cached, otherwise remote
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolveUrl = useCallback((url: string) => {
    return cachedUrlsRef.current.get(url) ?? url;
  }, [cachedUrlsVersion]);

  // ---- Initialize / re-initialize display order ----
  // IMPORTANT: when content array changes (soft refresh), try to preserve
  // the currently-playing item so the video doesn't restart.
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
    // so we don't jump back to index 0 on a soft refresh
    const currentUrl = currentUrlRef.current;
    let newCurrentIndex = 0;
    if (currentUrl) {
      const found = order.findIndex(idx => content[idx]?.url === currentUrl);
      if (found !== -1) newCurrentIndex = found;
    }

    setDisplayOrder(order);
    setCurrentIndex(newCurrentIndex);
    setNextIndex((newCurrentIndex + 1) % order.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, settings.playbackOrder]);

  // ---- Update nextIndex when currentIndex changes ----
  useEffect(() => {
    if (displayOrder.length <= 1) return;
    setNextIndex((currentIndex + 1) % displayOrder.length);
  }, [currentIndex, displayOrder.length]);

  // ---- Core transition function ----
  // Uses a ref-based lock so it can NEVER fire twice simultaneously
  const goToNext = useCallback(() => {
    const orderLen = displayOrder.length || content.length;
    if (orderLen <= 1 || !isPlaying) return;
    // LOCK — prevent race condition between setTimeout timer and onEnded event
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
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }, settings.transitionDuration);
  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying, onContentChange]);

  // ---- Auto-advance timer for images (and videos as fallback) ----
  // For videos: onEnded is the primary trigger. setTimeout is only a safety fallback
  // and is blocked by the isTransitioningRef lock if onEnded already fired.
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;

    const order = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const currentContent = content[contentIdx];

    if (!currentContent) return;

    // Track what's currently playing (used for position-preservation on refresh)
    currentUrlRef.current = currentContent.url;

    // For videos: rely on onEnded — only set a fallback timer (duration + 2s buffer)
    // This avoids the race condition where setTimeout fires just after onEnded
    const isVideo = currentContent.type === 'video';
    const baseDuration = (currentContent.duration || settings.slideDuration) * 1000;
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
  // Re-attach only when the video element itself changes (i.e. content type switch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ---- Next video: pause immediately after metadata loads ----
  const handleNextVideoLoaded = useCallback(() => {
    if (nextVideoRef.current) {
      nextVideoRef.current.pause();
      nextVideoRef.current.currentTime = 0;
    }
  }, []);

  // ---- Scaling ----
  const scalingClass = (() => {
    switch (settings.contentScaling) {
      case 'fit': return 'object-contain';
      case 'fill': return 'object-cover';
      case 'stretch': return 'object-fill';
      default: return 'object-cover';
    }
  })();

  // ---- Transition styles ----
  const getTransitionStyles = useCallback(() => {
    const duration = `${settings.transitionDuration}ms`;
    switch (settings.transitionType) {
      case 'slide':
        return {
          current: { transition: `transform ${duration} ease-in-out`, transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)' },
          next:    { transition: `transform ${duration} ease-in-out`, transform: isTransitioning ? 'translateX(0)' : 'translateX(100%)' },
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
  const contentIdx = effectiveOrder[currentIndex] ?? 0;
  const currentContent = content[contentIdx];
  const nextContentIdx = effectiveOrder[nextIndex] ?? 0;
  const nextContent = content[nextContentIdx];

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
            src={resolveUrl(currentContent.url)}
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

      {/* ── Next Content (pre-staged for smooth transition) ── */}
      {nextContent && nextContent.id !== currentContent.id && (
        <div
          className={cn('absolute inset-0', settings.transitionType === 'fade' && 'pointer-events-none')}
          style={transitionStyles.next}
        >
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className={cn('w-full h-full', scalingClass)}
              loading="eager"
            />
          ) : (
            <video
              key={`next-${nextContent.id}`}
              ref={nextVideoRef}
              src={resolveUrl(nextContent.url)}
              className={cn('w-full h-full', scalingClass)}
              // preload="metadata" — avoids stealing bandwidth from the currently-playing video
              preload="metadata"
              muted
              playsInline
              controls={false}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              disableRemotePlayback
              onLoadedData={handleNextVideoLoaded}
              onContextMenu={e => e.preventDefault()}
              style={{ pointerEvents: 'none' }}
            />
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
