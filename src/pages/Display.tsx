import { useState, useEffect, useCallback } from 'react';
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

export default function Display() {
  const { slug } = useParams<{ slug: string }>();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Heartbeat mechanism
  useEffect(() => {
    if (!screen?.id) return;

    const heartbeat = async () => {
      try {
        await updateScreenStatus(screen.id, 'online');
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    };

    // Send heartbeat every 30 seconds
    const interval = setInterval(heartbeat, 30000);

    return () => clearInterval(interval);
  }, [screen?.id]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!screen?.id) return;

    const channel = supabase
      .channel(`display-${screen.id}`)
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
        }
      )
      // Playlist changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlists',
        },
        () => {
          // Refetch when playlists change
          fetchData();
        }
      )
      // Playlist items changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_items',
        },
        () => {
          fetchData();
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
      // Content changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screen?.id, fetchData]);

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

  // Auto-refresh every 5 minutes for stability
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      window.location.reload();
    }, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
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
      <ContentRenderer
        content={content}
        settings={settings}
        isPlaying={isPlaying}
      />
    </div>
  );
}
