import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { updateScreenStatus } from '@/lib/api';
import { getActivePlaylistForScreen, getEffectiveDisplaySettings } from '@/lib/api/index';
import { supabase } from '@/integrations/supabase/client';
import { Screen, ContentItem, Playlist, DisplaySettings } from '@/lib/types';
import { ContentRenderer } from '@/components/display/ContentRenderer';
import { LoadingScreen } from '@/components/display/LoadingScreen';
import { ErrorScreen } from '@/components/display/ErrorScreen';
import { IdleScreen } from '@/components/display/IdleScreen';
import { PausedScreen } from '@/components/display/PausedScreen';
import { PlaylistTransition } from '@/components/display/PlaylistTransition';
// Connection status component
function ConnectionStatus({ isOnline, isReconnecting }: { isOnline: boolean; isReconnecting: boolean }) {
  if (isOnline && !isReconnecting) return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border">
      {isReconnecting ? (
        <>
          <div className="w-3 h-3 bg-warning rounded-full animate-pulse" />
          <span className="text-sm text-warning">جاري إعادة الاتصال...</span>
        </>
      ) : (
        <>
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span className="text-sm text-destructive">غير متصل</span>
        </>
      )}
    </div>
  );
}

export default function Display() {
  const { slug } = useParams<{ slug: string }>();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isPlaylistTransitioning, setIsPlaylistTransitioning] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const pendingPlaylistRef = useRef<{ playlist: Playlist | null; content: ContentItem[] } | null>(null);
  const currentPlaylistIdRef = useRef<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep playlist ID ref in sync
  useEffect(() => {
    currentPlaylistIdRef.current = playlist?.id || null;
  }, [playlist?.id]);

  // Fetch screen and content data
  const fetchData = useCallback(async () => {
    if (!slug) return;

    try {
      // Get screen by slug
      const { data: screenData, error: screenError } = await supabase
        .from('screens')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (screenError) throw screenError;
      if (!screenData) {
        setScreen(null);
        setError('Screen not found');
        setIsLoading(false);
        return;
      }

      // Get group assignments
      const { data: groupAssignments } = await supabase
        .from('screen_group_assignments')
        .select('group_id')
        .eq('screen_id', screenData.id);

      const groupIds = groupAssignments?.map(a => a.group_id) || [];

      const screenObj: Screen = {
        id: screenData.id,
        name: screenData.name,
        slug: screenData.slug,
        branchId: screenData.branch_id,
        groupIds,
        orientation: screenData.orientation as 'landscape' | 'portrait',
        resolution: screenData.resolution,
        status: screenData.status as 'online' | 'offline' | 'idle',
        isPlaying: screenData.is_playing ?? true,
        lastHeartbeat: screenData.last_heartbeat ? new Date(screenData.last_heartbeat) : null,
        lastUpdated: new Date(screenData.updated_at),
        contentIds: [],
        currentPlaylistId: screenData.current_playlist_id,
      };

      setScreen(screenObj);
      setIsPlaying(screenObj.isPlaying);

      // Update screen status to online
      await updateScreenStatus(screenData.id, 'online');

      // Get active playlist and content
      const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screenData.id);
      setPlaylist(activePlaylist);
      setContent(playlistContent);

      // Update screen's current_playlist_id if there's an active playlist
      if (activePlaylist) {
        await supabase
          .from('screens')
          .update({ current_playlist_id: activePlaylist.id })
          .eq('id', screenData.id);
      }

      // Get effective display settings
      const effectiveSettings = await getEffectiveDisplaySettings(
        screenData.id,
        groupIds,
        screenData.branch_id
      );
      setSettings(effectiveSettings);
      
      // Reset reconnect attempts on successful fetch
      reconnectAttempts.current = 0;
      setIsReconnecting(false);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Online');
      setIsOnline(true);
      setIsReconnecting(true);
      // Retry fetching data
      fetchData().then(() => {
        setIsReconnecting(false);
        // Re-subscribe to realtime
        setupRealtimeSubscription();
      });
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  // Setup realtime subscription with reconnection logic
  const setupRealtimeSubscription = useCallback(() => {
    if (!screen?.id) return;

    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Fast content update function with smooth transition - uses ref for current playlist
    const quickRefresh = async (showTransition = true) => {
      try {
        console.log('Quick refresh triggered...');
        const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screen.id);
        
        // Check if playlist actually changed using ref (always current)
        const playlistChanged = activePlaylist?.id !== currentPlaylistIdRef.current;
        
        console.log('Playlist changed:', playlistChanged, 'New:', activePlaylist?.id, 'Current:', currentPlaylistIdRef.current);
        
        if (playlistChanged && showTransition && activePlaylist) {
          // Store pending data and show transition
          pendingPlaylistRef.current = { playlist: activePlaylist, content: playlistContent };
          setNewPlaylistName(activePlaylist.name);
          setIsPlaylistTransitioning(true);
        } else if (playlistChanged) {
          // No transition, update directly
          setPlaylist(activePlaylist);
          setContent(playlistContent);
        } else {
          // Same playlist, just update content (might have new items)
          setContent(playlistContent);
        }
      } catch (err) {
        console.error('Quick refresh failed:', err);
      }
    };

    const channel = supabase
      .channel(`display-${screen.id}-realtime-${Date.now()}`)
      // Screen updates (play/pause, status)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `id=eq.${screen.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setIsPlaying(updated.is_playing ?? true);
          // Quick refresh if playlist changed
          if (updated.current_playlist_id !== playlist?.id) {
            quickRefresh();
          }
        }
      )
      // Playlist changes - instant response
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlists',
        },
        (payload) => {
          console.log('Playlist changed:', payload);
          quickRefresh();
        }
      )
      // Playlist items changes - instant response
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_items',
        },
        (payload) => {
          console.log('Playlist items changed:', payload);
          quickRefresh();
        }
      )
      // Display settings changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'display_settings',
        },
        () => {
          fetchData();
        }
      )
      // Content changes - instant response  
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
        },
        (payload) => {
          console.log('Content changed:', payload);
          quickRefresh();
        }
      )
      .subscribe((status, err) => {
        console.log('Realtime subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
          setIsReconnecting(false);
        }
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime error:', err);
          handleReconnect();
        }
        
        if (status === 'CLOSED') {
          console.log('Channel closed, attempting reconnect...');
          handleReconnect();
        }
      });

    channelRef.current = channel;
  }, [screen?.id, fetchData]);

  // Reconnection handler with exponential backoff
  const handleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, reloading page...');
      window.location.reload();
      return;
    }

    setIsReconnecting(true);
    reconnectAttempts.current += 1;
    
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (navigator.onLine) {
        fetchData().then(() => {
          setupRealtimeSubscription();
        });
      } else {
        handleReconnect();
      }
    }, delay);
  }, [fetchData, setupRealtimeSubscription]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup realtime subscription when screen is loaded
  useEffect(() => {
    if (screen?.id) {
      setupRealtimeSubscription();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [screen?.id, setupRealtimeSubscription]);

  // Heartbeat mechanism with connection check
  useEffect(() => {
    if (!screen?.id) return;

    const heartbeat = async () => {
      if (!navigator.onLine) return;
      
      try {
        await updateScreenStatus(screen.id, 'online');
      } catch (err) {
        console.error('Heartbeat failed:', err);
        // If heartbeat fails, try to reconnect
        if (navigator.onLine) {
          handleReconnect();
        }
      }
    };

    // Send heartbeat every 30 seconds
    const interval = setInterval(heartbeat, 30000);

    return () => clearInterval(interval);
  }, [screen?.id, handleReconnect]);

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

  // Auto-refresh every 30 minutes for stability (instead of 5 minutes)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      window.location.reload();
    }, 30 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Visibility change handler - refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('Tab became visible, refreshing data...');
        fetchData().then(() => {
          setupRealtimeSubscription();
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchData, setupRealtimeSubscription]);

  // Handle playlist transition completion - MUST be before early returns
  const handleTransitionEnd = useCallback(() => {
    if (pendingPlaylistRef.current) {
      setPlaylist(pendingPlaylistRef.current.playlist);
      setContent(pendingPlaylistRef.current.content);
      pendingPlaylistRef.current = null;
    }
    setIsPlaylistTransitioning(false);
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Loading content..." />;
  }

  if (!screen) {
    return (
      <ErrorScreen
        title="Screen Not Found"
        message={`No screen found with slug: ${slug}`}
      />
    );
  }

  if (error && !content.length) {
    return (
      <ErrorScreen
        title="Error"
        message={error}
        showRetry
        onRetry={() => {
          setError(null);
          setIsLoading(true);
          fetchData();
        }}
      />
    );
  }

  if (!isPlaying) {
    return <PausedScreen screenName={screen.name} />;
  }

  if (!playlist || content.length === 0) {
    return <IdleScreen screenName={screen.name} />;
  }

  if (!settings) {
    return <LoadingScreen message="Loading settings..." />;
  }

  return (
    <div className="display-fullscreen">
      <ConnectionStatus isOnline={isOnline} isReconnecting={isReconnecting} />
      <PlaylistTransition 
        isTransitioning={isPlaylistTransitioning}
        playlistName={newPlaylistName}
        onTransitionEnd={handleTransitionEnd}
      />
      <ContentRenderer
        content={content}
        settings={settings}
        isPlaying={isPlaying}
      />
    </div>
  );
}