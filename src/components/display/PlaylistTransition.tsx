import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ListVideo } from 'lucide-react';

interface PlaylistTransitionProps {
  isTransitioning: boolean;
  playlistName?: string;
  onTransitionEnd?: () => void;
}

export function PlaylistTransition({ 
  isTransitioning, 
  playlistName,
  onTransitionEnd 
}: PlaylistTransitionProps) {
  const [phase, setPhase] = useState<'idle' | 'fade-in' | 'visible' | 'fade-out'>('idle');

  useEffect(() => {
    if (isTransitioning) {
      // Start fade in
      setPhase('fade-in');
      
      // Show for a moment
      const visibleTimer = setTimeout(() => {
        setPhase('visible');
      }, 300);

      // Start fade out
      const fadeOutTimer = setTimeout(() => {
        setPhase('fade-out');
      }, 1500);

      // Complete transition
      const completeTimer = setTimeout(() => {
        setPhase('idle');
        onTransitionEnd?.();
      }, 1800);

      return () => {
        clearTimeout(visibleTimer);
        clearTimeout(fadeOutTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isTransitioning, onTransitionEnd]);

  if (phase === 'idle') return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300",
        phase === 'fade-in' && "opacity-0 animate-[fade-in_0.3s_ease-out_forwards]",
        phase === 'visible' && "opacity-100",
        phase === 'fade-out' && "opacity-100 animate-[fade-out_0.3s_ease-out_forwards]"
      )}
    >
      <div 
        className={cn(
          "flex flex-col items-center gap-6 transition-all duration-500",
          phase === 'fade-in' && "scale-95 opacity-0",
          phase === 'visible' && "scale-100 opacity-100",
          phase === 'fade-out' && "scale-105 opacity-0"
        )}
        style={{
          transitionDelay: phase === 'fade-in' ? '150ms' : '0ms'
        }}
      >
        {/* Animated icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/20 border border-primary/40">
            <ListVideo className="h-12 w-12 text-primary animate-[scale-in_0.5s_ease-out]" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">
            Now switching to
          </p>
          <h2 className="text-2xl font-bold text-foreground">
            {playlistName || 'New Playlist'}
          </h2>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all ease-out"
            style={{
              width: phase === 'fade-in' ? '0%' : phase === 'visible' ? '70%' : '100%',
              transitionDuration: phase === 'visible' ? '1.2s' : '0.3s'
            }}
          />
        </div>
      </div>
    </div>
  );
}
