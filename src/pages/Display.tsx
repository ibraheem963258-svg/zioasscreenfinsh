/**
 * ======================================
 * Display Page
 * ======================================
 * 
 * Features:
 *   - Display content on external screens (TV, Android TV, Smart TV)
 *   - Automatic fullscreen
 *   - Smart reconnection without reload
 *   - Real-time content updates
 */

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
import { useFullscreen } from '@/hooks/useFullscreen';
import { useReconnection, ConnectionStatus } from '@/hooks/useReconnection';

// ======================================
// Connection Status Component
// ======================================
function ConnectionStatusIndicator({ 
  status, 
  attempts 
}: { 
  status: ConnectionStatus; 
  attempts: number;
}) {
  if (status === 'connected') return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border">
      {status === 'reconnecting' && (
        <>
          <div className="w-3 h-3 bg-warning rounded-full animate-pulse" />
          <span className="text-sm text-warning">
            Reconnecting... ({attempts})
          </span>
        </>
      )}
      {status === 'disconnected' && (
        <>
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span className="text-sm text-destructive">Disconnected</span>
        </>
      )}
      {status === 'failed' && (
        <>
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span className="text-sm text-destructive">Connection failed - Reloading</span>
        </>
      )}
    </div>
  );
}

// ======================================
// Main Component
// ======================================
export default function Display() {
  const { slug } = useParams<{ slug: string }>();
  
  // Main States
  const [screen, setScreen] = useState<Screen | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playlist Transition States
  const [isPlaylistTransitioning, setIsPlaylistTransitioning] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const pendingPlaylistRef = useRef<{ playlist: Playlist | null; content: ContentItem[] } | null>(null);
  const currentPlaylistIdRef = useRef<string | null>(null);
  
  // Channel Refs
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Track the last known force_refresh_at to detect NEW refresh commands only
  const lastForceRefreshRef = useRef<string | null>(null);

  // Custom Hooks
  const { enterFullscreen } = useFullscreen();

  // Sync Playlist ID Ref
  useEffect(() => {
    currentPlaylistIdRef.current = playlist?.id || null;
  }, [playlist?.id]);

  // Fetch Screen and Content Data
  const fetchData = useCallback(async () => {
    if (!slug) return;

    try {
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
        isActive: (screenData as any).is_active ?? true,
        lastHeartbeat: screenData.last_heartbeat ? new Date(screenData.last_heartbeat) : null,
        lastUpdated: new Date(screenData.updated_at),
        contentIds: [],
        currentPlaylistId: screenData.current_playlist_id,
      };

      setScreen(screenObj);
      setIsPlaying(screenObj.isPlaying);

      // Store the initial force_refresh_at so we only react to NEW refresh commands
      if (lastForceRefreshRef.current === null) {
        lastForceRefreshRef.current = screenData.force_refresh_at ?? '';
      }

      await updateScreenStatus(screenData.id, 'online');

      const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screenData.id);
      setPlaylist(activePlaylist);
      setContent(playlistContent);

      if (activePlaylist) {
        await supabase
          .from('screens')
          .update({ current_playlist_id: activePlaylist.id })
          .eq('id', screenData.id);
      }

      const effectiveSettings = await getEffectiveDisplaySettings(
        screenData.id,
        groupIds,
        screenData.branch_id
      );
      setSettings(effectiveSettings);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Setup Smart Reconnection
  const { status: connectionStatus, attempts, resetAttempts } = useReconnection({
    maxAttempts: 15,
    onReconnect: async () => {
      await fetchData();
      setupRealtimeSubscription();
    },
    onDisconnect: () => {
      console.log('Disconnected - Will retry automatically');
    },
  });

  // Setup Realtime Subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!screen?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const quickRefresh = async (showTransition = true) => {
      try {
        console.log('Quick refreshing content...');
        
        const { data: screenData } = await supabase
          .from('screens')
          .select('is_playing')
          .eq('id', screen.id)
          .single();

        if (screenData) {
          setIsPlaying(screenData.is_playing ?? true);
        }

        const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screen.id);
        
        const playlistChanged = activePlaylist?.id !== currentPlaylistIdRef.current;
        
        console.log('Playlist changed:', playlistChanged, 'new:', activePlaylist?.id, 'current:', currentPlaylistIdRef.current);
        
        if (playlistChanged && showTransition && activePlaylist) {
          pendingPlaylistRef.current = { playlist: activePlaylist, content: playlistContent };
          setNewPlaylistName(activePlaylist.name);
          setIsPlaylistTransitioning(true);
        } else if (playlistChanged) {
          setPlaylist(activePlaylist);
          setContent(playlistContent);
        } else {
          setContent(playlistContent);
        }
      } catch (err) {
        console.error('Quick refresh failed:', err);
      }
    };

    const channel = supabase
      .channel(`display-${screen.id}-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `id=eq.${screen.id}`,
        },
        (payload) => {
          console.log('Screen update:', payload.new);
          const updated = payload.new as any;
          
          setIsPlaying(updated.is_playing ?? true);

          // Remote refresh trigger — only fire when force_refresh_at is a NEW value
          const incomingRefreshAt = updated.force_refresh_at ?? '';
          if (incomingRefreshAt && incomingRefreshAt !== lastForceRefreshRef.current) {
            console.log('Remote refresh triggered:', incomingRefreshAt);
            lastForceRefreshRef.current = incomingRefreshAt;
            window.location.reload();
            return;
          }
          
          if (updated.current_playlist_id !== playlist?.id) {
            quickRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlists' },
        () => {
          console.log('Playlists changed');
          quickRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_items' },
        () => {
          console.log('Playlist items changed');
          quickRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'display_settings' },
        () => {
          console.log('Display settings changed');
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content' },
        () => {
          console.log('Content changed');
          quickRefresh();
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          resetAttempts();
        }
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('Channel error:', err);
        }
      });

    channelRef.current = channel;
  }, [screen?.id, playlist?.id, fetchData, resetAttempts]);

  // Initial Fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup subscription when screen loads
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

  // Heartbeat Mechanism — every 60 seconds for accurate online/offline detection
  useEffect(() => {
    if (!screen?.id) return;

    const screenId = screen.id;

    const heartbeat = async () => {
      if (!navigator.onLine) return;
      try {
        await updateScreenStatus(screenId, 'online');
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    };

    const markOffline = () => {
      // Use sendBeacon for reliable delivery even on actual page close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/screens?id=eq.${screenId}`;
      const body = JSON.stringify({ status: 'offline', updated_at: new Date().toISOString() });
      navigator.sendBeacon(
        url + '&apikey=' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        new Blob([body], { type: 'application/json' })
      );
    };

    // Send immediately on mount
    heartbeat();

    const interval = setInterval(heartbeat, 60 * 1000); // 60 seconds

    // Mark offline ONLY when the page is truly being closed/unloaded
    // NOT on visibilitychange (tab switch, minimize) — that causes false offline alerts
    const handleBeforeUnload = () => markOffline();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [screen?.id]);

  // Enter Fullscreen
  useEffect(() => {
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 1000);
    return () => clearTimeout(timer);
  }, [enterFullscreen]);

  // Periodic soft refresh every hour — re-fetches data WITHOUT reloading the page
  // This avoids re-downloading cached media files (saves egress)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('[Display] Hourly soft refresh — fetching data without page reload');
      fetchData();
    }, 60 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [fetchData]);


  // Handle Playlist Transition End
  const handleTransitionEnd = useCallback(() => {
    if (pendingPlaylistRef.current) {
      setPlaylist(pendingPlaylistRef.current.playlist);
      setContent(pendingPlaylistRef.current.content);
      pendingPlaylistRef.current = null;
    }
    setIsPlaylistTransitioning(false);
  }, []);

  // Loading state
  if (isLoading) {
    return <LoadingScreen message="Loading content..." />;
  }

  // Screen not found
  if (!screen) {
    return (
      <ErrorScreen
        title="Screen Not Found"
        message={`No screen found with slug: ${slug}`}
      />
    );
  }

  // Screen disabled by admin
  if (!screen.isActive) {
    return (
      <ErrorScreen
        title="Screen Disabled"
        message="This screen has been disabled. Please contact your administrator."
      />
    );
  }



  // Error with no content
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

  // Screen paused
  if (!isPlaying) {
    return <PausedScreen screenName={screen.name} />;
  }

  // No content
  if (!playlist || content.length === 0) {
    return <IdleScreen screenName={screen.name} />;
  }

  // Waiting for settings
  if (!settings) {
    return <LoadingScreen message="Loading settings..." />;
  }

  // Main Render
  return (
    <div className="display-fullscreen">
      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator status={connectionStatus} attempts={attempts} />
      
      {/* Playlist Transition */}
      <PlaylistTransition 
        isTransitioning={isPlaylistTransitioning}
        playlistName={newPlaylistName}
        onTransitionEnd={handleTransitionEnd}
      />
      
      {/* Content Renderer */}
      <ContentRenderer
        content={content}
        settings={settings}
        isPlaying={isPlaying}
      />
    </div>
  );
}
