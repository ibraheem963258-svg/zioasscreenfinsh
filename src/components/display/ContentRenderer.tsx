/**
 * ======================================
 * Enhanced Content Renderer Component
 * ======================================
 * 
 * Features:
 *   - Smooth transitions without black screen
 *   - Preloading of next content
 *   - Support for Fade, Slide, Crossfade
 *   - Audio and video continuity
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentItem, DisplaySettings } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ContentRendererProps {
  /** Content list for display */
  content: ContentItem[];
  /** Display settings */
  settings: DisplaySettings;
  /** Is playback active */
  isPlaying: boolean;
  /** Callback for content change */
  onContentChange?: (index: number) => void;
}

export function ContentRenderer({
  content,
  settings,
  isPlaying,
  onContentChange,
}: ContentRendererProps) {
  // Main States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Preload states
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set([0]));
  const [preloadedContent, setPreloadedContent] = useState<Map<number, boolean>>(new Map());
  
  // Display order (for shuffle)
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => 
    content.length > 0 ? content.map((_, i) => i) : []
  );

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Display Order
  useEffect(() => {
    if (content.length === 0) return;

    let order = content.map((_, i) => i);
    
    if (settings.playbackOrder === 'shuffle') {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    
    setDisplayOrder(order);
    setCurrentIndex(0);
    setNextIndex(order.length > 1 ? 1 : 0);
    
    setLoadedIndexes(new Set([0]));
    setPreloadedContent(new Map());
  }, [content, settings.playbackOrder]);

  // Preload Next Content
  useEffect(() => {
    if (displayOrder.length <= 1) return;
    
    const nextIdx = (currentIndex + 1) % displayOrder.length;
    const contentIdx = displayOrder[nextIdx];
    
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    
    if (!loadedIndexes.has(contentIdx)) {
      const nextContent = content[contentIdx];
      if (nextContent) {
        if (nextContent.type === 'image') {
          const img = new Image();
          img.src = nextContent.url;
          img.onload = () => {
            console.log(`Preloaded image: ${nextContent.name}`);
            setLoadedIndexes(prev => new Set([...prev, contentIdx]));
            setPreloadedContent(prev => new Map(prev).set(contentIdx, true));
          };
          img.onerror = () => {
            console.error(`Failed to preload image: ${nextContent.name}`);
          };
        } else if (nextContent.type === 'video') {
          setLoadedIndexes(prev => new Set([...prev, contentIdx]));
          setPreloadedContent(prev => new Map(prev).set(contentIdx, true));
        }
      }
    }
    
    setNextIndex(nextIdx);
  }, [currentIndex, displayOrder, content, loadedIndexes]);

  // Go to Next Content
  const goToNext = useCallback(() => {
    const orderLen = displayOrder.length || content.length;
    if (orderLen <= 1 || !isPlaying) return;

    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % orderLen;
        onContentChange?.(next);
        return next;
      });
      setIsTransitioning(false);
    }, settings.transitionDuration);
  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying, onContentChange]);

  // Auto-play and Transition
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;

    const order = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const currentContent = content[contentIdx];
    
    if (!currentContent) return;

    let duration: number;
    
    if (currentContent.type === 'video') {
      duration = (currentContent.duration || settings.slideDuration) * 1000;
    } else {
      duration = (currentContent.duration || settings.slideDuration) * 1000;
    }

    const timer = setTimeout(goToNext, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, content, displayOrder, settings.slideDuration, goToNext, isPlaying]);

  // Video Ended Handler
  const handleVideoEnded = useCallback(() => {
    if (content.length > 1) {
      goToNext();
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  }, [content.length, goToNext]);

  // Next Video Loaded Handler
  const handleNextVideoLoaded = useCallback(() => {
    if (nextVideoRef.current) {
      nextVideoRef.current.pause();
      nextVideoRef.current.currentTime = 0;
    }
  }, []);

  // Get Scaling Class
  const getScalingClass = useCallback(() => {
    switch (settings.contentScaling) {
      case 'fit':
        return 'object-contain';
      case 'fill':
        return 'object-cover';
      case 'stretch':
        return 'object-fill';
      default:
        return 'object-cover';
    }
  }, [settings.contentScaling]);

  // Get Transition Styles
  const getTransitionStyles = useCallback(() => {
    const duration = `${settings.transitionDuration}ms`;
    
    switch (settings.transitionType) {
      case 'slide':
        return {
          current: {
            transition: `transform ${duration} ease-in-out`,
            transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)',
          },
          next: {
            transition: `transform ${duration} ease-in-out`,
            transform: isTransitioning ? 'translateX(0)' : 'translateX(100%)',
          },
        };
      case 'crossfade':
        return {
          current: {
            transition: `opacity ${duration} ease-in-out`,
            opacity: isTransitioning ? 0 : 1,
          },
          next: {
            transition: `opacity ${duration} ease-in-out`,
            opacity: isTransitioning ? 1 : 0,
          },
        };
      case 'fade':
      default:
        return {
          current: {
            transition: `opacity ${duration} ease-in-out`,
            opacity: isTransitioning ? 0 : 1,
          },
          next: {
            opacity: 0,
          },
        };
    }
  }, [settings.transitionType, settings.transitionDuration, isTransitioning]);

  // Check for Content
  if (content.length === 0) {
    return null;
  }
  
  // Calculate Safe Indexes
  const effectiveDisplayOrder = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
  const contentIdx = effectiveDisplayOrder[currentIndex] ?? 0;
  const currentContent = content[contentIdx];
  const nextContentIdx = effectiveDisplayOrder[nextIndex] ?? 0;
  const nextContent = content[nextContentIdx];

  if (!currentContent) {
    const fallbackContent = content[0];
    if (!fallbackContent) return null;
    
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {fallbackContent.type === 'image' ? (
          <img
            src={fallbackContent.url}
            alt={fallbackContent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={fallbackContent.url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        )}
      </div>
    );
  }

  const transitionStyles = getTransitionStyles();

  // Main Render
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Current Content */}
      <div 
        className="absolute inset-0"
        style={transitionStyles.current}
      >
        {currentContent.type === 'image' ? (
          <img
            src={currentContent.url}
            alt={currentContent.name}
            className={cn("w-full h-full", getScalingClass())}
            loading="eager"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentContent.url}
            className={cn("w-full h-full", getScalingClass())}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            onError={(e) => console.error('Video load error:', e)}
          />
        )}
      </div>

      {/* Next Content (for smooth transition) */}
      {nextContent && nextContent.id !== currentContent.id && (
        <div 
          className={cn(
            "absolute inset-0",
            settings.transitionType === 'fade' && "pointer-events-none"
          )}
          style={transitionStyles.next}
        >
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className={cn("w-full h-full", getScalingClass())}
              loading="eager"
            />
          ) : (
            <video
              ref={nextVideoRef}
              src={nextContent.url}
              className={cn("w-full h-full", getScalingClass())}
              preload="auto"
              muted
              playsInline
              onLoadedData={handleNextVideoLoaded}
            />
          )}
        </div>
      )}

      {/* Hidden Preloading */}
      <div className="hidden">
        {content.slice(0, 3).map((item, idx) => (
          idx !== contentIdx && (
            item.type === 'image' ? (
              <img key={item.id} src={item.url} alt="" />
            ) : (
              <video key={item.id} src={item.url} preload="metadata" muted />
            )
          )
        ))}
      </div>

      {/* Progress Indicators */}
      {content.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {effectiveDisplayOrder.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                idx === currentIndex 
                  ? 'w-8 bg-white' 
                  : 'w-2 bg-white/40'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
