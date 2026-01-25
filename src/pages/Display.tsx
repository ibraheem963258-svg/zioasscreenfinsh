import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getScreenContent, updateScreenStatus } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { Screen, ContentItem } from '@/lib/types';

export default function Display() {
  const { slug } = useParams<{ slug: string }>();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  // Fetch screen and content
  useEffect(() => {
    const fetchContent = async () => {
      if (!slug) return;
      
      try {
        const { screen: screenData, content: contentData } = await getScreenContent(slug);
        setScreen(screenData);
        setContent(contentData);
        setIsPlaying(screenData?.isPlaying ?? true);
        
        // Update screen status to online
        if (screenData) {
          await updateScreenStatus(screenData.id, 'online');
        }
      } catch (err) {
        console.error('Error fetching content:', err);
        setError('Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();

    // Set up heartbeat to keep screen status online
    const heartbeatInterval = setInterval(async () => {
      if (screen) {
        try {
          await updateScreenStatus(screen.id, 'online');
        } catch (err) {
          console.error('Heartbeat failed:', err);
        }
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [slug]);

  // Subscribe to realtime updates for screen status and content changes
  useEffect(() => {
    if (!screen?.id) return;

    const refetchContent = async () => {
      if (!slug) return;
      try {
        const { screen: screenData, content: contentData } = await getScreenContent(slug);
        setScreen(screenData);
        setContent(contentData);
        setIsPlaying(screenData?.isPlaying ?? true);
        setCurrentIndex(0); // Reset to first slide when content changes
      } catch (err) {
        console.error('Error refetching content:', err);
      }
    };

    const channel = supabase
      .channel(`screen-realtime-${screen.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `id=eq.${screen.id}`,
        },
        (payload) => {
          const updatedScreen = payload.new as any;
          setIsPlaying(updatedScreen.is_playing ?? true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_assignments',
        },
        () => {
          // Refetch content when new assignments are added
          refetchContent();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'content_assignments',
        },
        () => {
          // Refetch content when assignments are deleted
          refetchContent();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content_assignments',
        },
        () => {
          // Refetch content when assignments are updated
          refetchContent();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
        },
        () => {
          // Refetch content when content is updated
          refetchContent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screen?.id, slug]);

  const nextSlide = useCallback(() => {
    if (content.length <= 1) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % content.length);
      setIsTransitioning(false);
    }, 1000);
  }, [content.length]);

  // Auto-advance slides (only when playing)
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;
    
    const currentContent = content[currentIndex];
    const duration = (currentContent?.duration || 10) * 1000;
    
    const timer = setTimeout(nextSlide, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, content, nextSlide, isPlaying]);

  // Auto-refresh every 5 minutes to get latest content
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      window.location.reload();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Enter fullscreen on load
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) {
        console.log('Fullscreen not available');
      }
    };

    const timer = setTimeout(enterFullscreen, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="display-fullscreen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="display-fullscreen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Screen Not Found</h1>
          <p className="text-xl opacity-80">No screen found with slug: {slug}</p>
        </div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="display-fullscreen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center text-white">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">{screen.name}</h1>
          <p className="text-lg opacity-60">No content assigned to this screen</p>
        </div>
      </div>
    );
  }

  // Show paused state
  if (!isPlaying) {
    return (
      <div className="display-fullscreen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center text-white">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">{screen.name}</h1>
          <p className="text-lg opacity-60">Content playback is paused</p>
        </div>
      </div>
    );
  }

  const currentContent = content[currentIndex];

  return (
    <div className="display-fullscreen">
      {/* Content */}
      <div 
        className={`absolute inset-0 content-transition ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {currentContent.type === 'image' ? (
          <img
            src={currentContent.url}
            alt={currentContent.name}
            className="w-full h-full object-cover"
            onError={() => setError('Failed to load image')}
          />
        ) : (
          <video
            src={currentContent.url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            onError={() => setError('Failed to load video')}
          />
        )}
      </div>

      {/* Progress indicators */}
      {content.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {content.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentIndex 
                  ? 'w-8 bg-white' 
                  : 'w-2 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white">
            <p className="text-xl">{error}</p>
            <p className="text-sm opacity-60 mt-2">Retrying...</p>
          </div>
        </div>
      )}
    </div>
  );
}
