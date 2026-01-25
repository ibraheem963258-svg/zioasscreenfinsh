import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentItem, DisplaySettings } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set([0]));
  // Initialize displayOrder immediately to prevent black screen
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => 
    content.length > 0 ? content.map((_, i) => i) : []
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize display order based on playback settings
  useEffect(() => {
    if (content.length === 0) return;

    let order = content.map((_, i) => i);
    
    if (settings.playbackOrder === 'shuffle') {
      // Fisher-Yates shuffle
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    
    setDisplayOrder(order);
    setCurrentIndex(0);
    setNextIndex(order.length > 1 ? 1 : 0);
  }, [content, settings.playbackOrder]);

  // Preload next content
  useEffect(() => {
    if (displayOrder.length <= 1) return;
    
    const nextIdx = (currentIndex + 1) % displayOrder.length;
    const contentIdx = displayOrder[nextIdx];
    
    if (!loadedIndexes.has(contentIdx)) {
      const nextContent = content[contentIdx];
      if (nextContent) {
        if (nextContent.type === 'image') {
          const img = new Image();
          img.src = nextContent.url;
          img.onload = () => {
            setLoadedIndexes(prev => new Set([...prev, contentIdx]));
          };
        } else {
          // Video will preload via the hidden video element
          setLoadedIndexes(prev => new Set([...prev, contentIdx]));
        }
      }
    }
    
    setNextIndex(nextIdx);
  }, [currentIndex, displayOrder, content, loadedIndexes]);

  const goToNext = useCallback(() => {
    // IMPORTANT: displayOrder can be temporarily empty on the first render.
    // Never modulo by 0 (it produces NaN and can lead to a black screen).
    const orderLen = displayOrder.length || content.length;
    if (orderLen <= 1 || !isPlaying) return;

    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % orderLen);
      setIsTransitioning(false);
      onContentChange?.((currentIndex + 1) % orderLen);
    }, settings.transitionDuration);
  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying, currentIndex, onContentChange]);

  // Auto-advance slides
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;

    const order = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const currentContent = content[contentIdx];
    if (!currentContent) return;

    // Use content-specific duration or fall back to settings
    const duration = (currentContent.duration || settings.slideDuration) * 1000;

    const timer = setTimeout(goToNext, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, content, displayOrder, settings.slideDuration, goToNext, isPlaying]);

  // Handle video ended
  const handleVideoEnded = () => {
    if (content.length > 1) {
      goToNext();
    }
  };

  // Early return only if no content - displayOrder will be synced immediately
  if (content.length === 0) {
    return null;
  }
  
  // Ensure displayOrder is valid - fallback to sequential order
  const effectiveDisplayOrder = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);

  const contentIdx = effectiveDisplayOrder[currentIndex] ?? 0;
  const currentContent = content[contentIdx];
  const nextContentIdx = effectiveDisplayOrder[nextIndex] ?? 0;
  const nextContent = content[nextContentIdx];

  if (!currentContent) {
    // Fallback to first content if index is invalid
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

  const getScalingClass = () => {
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
  };

  const getTransitionClass = () => {
    switch (settings.transitionType) {
      case 'fade':
        return 'transition-opacity';
      case 'slide':
        return 'transition-transform';
      case 'crossfade':
        return 'transition-opacity';
      default:
        return '';
    }
  };

  const getTransitionStyle = () => {
    const duration = `${settings.transitionDuration}ms`;
    
    if (settings.transitionType === 'slide') {
      return {
        transitionDuration: duration,
        transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)',
      };
    }
    
    return {
      transitionDuration: duration,
      opacity: isTransitioning ? 0 : 1,
    };
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Current content */}
      <div 
        className={cn(
          "absolute inset-0",
          getTransitionClass()
        )}
        style={getTransitionStyle()}
      >
        {currentContent.type === 'image' ? (
          <img
            src={currentContent.url}
            alt={currentContent.name}
            className={cn("w-full h-full", getScalingClass())}
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
          />
        )}
      </div>

      {/* Preload next content (hidden) */}
      {nextContent && nextContent.id !== currentContent.id && (
        <div className="absolute inset-0 opacity-0 pointer-events-none">
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className="w-full h-full"
            />
          ) : (
            <video
              ref={nextVideoRef}
              src={nextContent.url}
              className="w-full h-full"
              preload="auto"
              muted
              playsInline
            />
          )}
        </div>
      )}

      {/* Crossfade overlay for smooth transitions */}
      {settings.transitionType === 'crossfade' && isTransitioning && nextContent && (
        <div 
          className="absolute inset-0 transition-opacity"
          style={{ 
            transitionDuration: `${settings.transitionDuration}ms`,
            opacity: isTransitioning ? 1 : 0,
          }}
        >
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className={cn("w-full h-full", getScalingClass())}
            />
          ) : (
            <video
              src={nextContent.url}
              className={cn("w-full h-full", getScalingClass())}
              autoPlay
              muted
              playsInline
            />
          )}
        </div>
      )}

      {/* Progress indicators */}
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
