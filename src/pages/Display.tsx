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
import { updateScreenStatus, heartbeatAndPoll } from '@/lib/api';
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
  // Only show indicator when connection has completely failed — not during normal reconnection attempts
  if (status !== 'failed') return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border">
      <div className="w-3 h-3 bg-destructive rounded-full" />
      <span className="text-sm text-destructive">Connection failed - Reloading</span>
    </div>
  );
}

// ======================================
// Main Component
// ======================================
export default function Display() {
  const { slug } = useParams<{ slug: string }>();

  // ── Request persistent storage on mount ──────────────────────────────────
  // Asks the browser (including Samsung Tizen) to NOT evict IndexedDB even
  // after full power-off. If granted, videos survive a shutdown → zero re-download.
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persist().then((granted) => {
        console.log('[Display] Persistent storage:', granted ? '✅ GRANTED — cache survives power-off' : '⚠️ DENIED — cache may be cleared on shutdown');
      }).catch(() => {});
    }
  }, []);
  
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

  // ── dataReadyRef: set to true ONLY after fetchData() completes successfully.
  // Prevents the heartbeat (which fires immediately on mount) from comparing
  // currentPlaylistIdRef (still null) vs the DB value and triggering a spurious
  // quickRefresh before the initial data load is done.
  const dataReadyRef = useRef<boolean>(false);
  
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

      // Pass already-fetched groupIds + branchId to skip redundant DB queries inside
      const { playlist: activePlaylist, content: playlistContent } =
        await getActivePlaylistForScreen(screenData.id, groupIds, screenData.branch_id);
      setPlaylist(activePlaylist);
      setContent(playlistContent);

      if (activePlaylist) {
        await supabase
          .from('screens')
          .update({ current_playlist_id: activePlaylist.id })
          .eq('id', screenData.id);
      }

      // Single OR query — no sequential screen→group→branch round-trips
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
      // Signal that initial data is ready — heartbeat can now safely compare playlist IDs
      dataReadyRef.current = true;
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

  // Track current playlist ID ref for filtering playlist_items updates
  const currentPlaylistIdForFilterRef = useRef<string | null>(null);
  useEffect(() => {
    currentPlaylistIdForFilterRef.current = playlist?.id ?? null;
  }, [playlist?.id]);

  // Setup Realtime Subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!screen?.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Debounce: prevent concurrent quickRefresh calls (race condition → caches wrong videos)
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = (showTransition = true) => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => quickRefresh(showTransition), 300);
    };

    const quickRefresh = async (showTransition = true) => {
      try {
        console.log('[Display] Quick refresh triggered');
        
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
        
        console.log('[Display] Playlist changed:', playlistChanged, 'new:', activePlaylist?.id, 'current:', currentPlaylistIdRef.current);
        console.log('[Display] Active playlist content count:', playlistContent.length, playlistContent.map(c => c.name));
        
        if (playlistChanged && showTransition && activePlaylist) {
          pendingPlaylistRef.current = { playlist: activePlaylist, content: playlistContent };
          setNewPlaylistName(activePlaylist.name);
          setIsPlaylistTransitioning(true);
        } else if (playlistChanged) {
          setPlaylist(activePlaylist);
          setContent(playlistContent);
        } else {
          // CRITICAL: Playlist is the same — only update content if items actually changed.
          // Calling setContent with a new array reference (even identical data) causes
          // ContentRenderer's useEffect to re-run and can re-touch the video src.
          // We compare by content ID + updated_at to detect real changes only.
          setContent(prev => {
            const prevSig = prev.map(c => `${c.id}:${c.uploadedAt?.getTime()}`).join(',');
            const nextSig = playlistContent.map(c => `${c.id}:${c.uploadedAt?.getTime()}`).join(',');
            if (prevSig === nextSig) {
              console.log('[Display] Content unchanged — skipping setContent to prevent re-render');
              return prev; // return exact same reference → no re-render
            }
            console.log('[Display] Content changed — updating');
            return playlistContent;
          });
        }
      } catch (err) {
        console.error('[Display] Quick refresh failed:', err);
      }
    };

    // Soft-refresh settings only — does NOT rebuild content array, does NOT re-download media
    const refreshSettingsOnly = async () => {
      try {
        console.log('[Display] Settings-only refresh (no media reload)');
        const { data: screenRow } = await supabase
          .from('screens')
          .select('id, branch_id')
          .eq('id', screen.id)
          .single();
        if (!screenRow) return;
        const { data: groupAssignments } = await supabase
          .from('screen_group_assignments')
          .select('group_id')
          .eq('screen_id', screen.id);
        const gIds = groupAssignments?.map(a => a.group_id) || [];
        const { getEffectiveDisplaySettings } = await import('@/lib/api/display-settings');
        const newSettings = await getEffectiveDisplaySettings(screen.id, gIds, screenRow.branch_id);
        setSettings(newSettings);
      } catch (err) {
        console.error('[Display] Settings refresh failed:', err);
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
          
          // Use ref (not playlist state) to avoid this callback being stale or
          // causing setupRealtimeSubscription to re-run when playlist changes.
          if (updated.current_playlist_id !== currentPlaylistIdRef.current) {
            quickRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        // Filter to only playlists targeting this screen's branch — avoids triggering
        // on unrelated playlist changes in the system
        { event: '*', schema: 'public', table: 'playlists' },
        (payload) => {
          const changed = (payload.new || payload.old) as any;
          // Only refresh if the changed playlist is relevant to this screen
          // (target is this screen, or a group/branch — we can't filter groups easily so
          //  we accept group/branch changes but skip screen-targeted playlists for other screens)
          if (changed?.target_type === 'screen' && changed?.target_id !== screen.id) {
            console.log('[Display] Ignoring playlist change for different screen');
            return;
          }
          console.log('[Display] Relevant playlist changed');
          debouncedRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_items' },
        (payload) => {
          // BUG FIX: Filter playlist_items updates to only those belonging to the current
          // active playlist. Without this, EVERY item change in the system (for ANY screen)
          // was triggering a quickRefresh — causing unnecessary DB queries and potential
          // video re-cache for unrelated screens.
          const changed = (payload.new || payload.old) as any;
          const currentPid = currentPlaylistIdForFilterRef.current;
          if (currentPid && changed?.playlist_id && changed.playlist_id !== currentPid) {
            console.log('[Display] Ignoring playlist_items change for different playlist:', changed.playlist_id);
            return;
          }
          console.log('[Display] Relevant playlist_items changed');
          debouncedRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'display_settings' },
        (payload) => {
          // BUG FIX: Previously called fetchData() which rebuilds the entire content array
          // with a new reference, triggering ContentRenderer's useEffect and potentially
          // re-resolving video blob URLs (unnecessary IndexedDB lookups / egress risk).
          // Now we only refresh settings — content stays untouched.
          const changed = (payload.new || payload.old) as any;
          // Skip if settings change is for a completely unrelated target
          // (we can't easily filter by screen hierarchy here without extra queries,
          //  but refreshSettingsOnly is lightweight — just a few small JSON reads)
          console.log('[Display] Display settings changed — soft settings refresh only');
          refreshSettingsOnly();
        }
      )
      // NOTE: Removed global 'content' table listener — it was triggering quickRefresh
      // for ANY content change in the system (uploads, deletes from other screens),
      // which caused IndexedDB to attempt caching unrelated videos.
      // Content changes are already caught via playlist_items updates.
      .subscribe((status, err) => {
        console.log('Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          resetAttempts();
        }
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (err) console.error('Channel error:', err);
          else console.warn('Channel closed/timed out, will reconnect...');
        }
      });

    channelRef.current = channel;
  // CRITICAL: playlist?.id is intentionally NOT in deps.
  // Using currentPlaylistIdRef inside the closure avoids recreating the channel
  // every time the playlist changes, which was triggering extra quickRefresh calls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen?.id, fetchData, resetAttempts]);

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

  // ── Combined Heartbeat + Fallback Poll ──────────────────────────────────────
  // Single PATCH every 60 seconds that:
  //   1) Updates last_heartbeat + status → keeps screen "online"
  //   2) Returns current_playlist_id + is_playing in the same response
  //      → replaces the old separate 5-min fallback GET entirely
  // Net saving: eliminates ~216 extra queries/day per screen (was 1,296/day → now ~1,080/day)
  useEffect(() => {
    if (!screen?.id) return;

    const screenId = screen.id;

    const combinedHeartbeat = async () => {
      if (!navigator.onLine) return;
      // Guard: don't compare playlist IDs before fetchData() completes.
      // On first heartbeat (fires immediately on mount), currentPlaylistIdRef is still
      // null because fetchData hasn't resolved yet → false "playlist changed" detection.
      if (!dataReadyRef.current) return;
      try {
        const result = await heartbeatAndPoll(screenId);
        if (!result) return;

        // Sync play state
        setIsPlaying(result.isPlaying);

        // Check for playlist change (same logic as old fallback poll)
        const playlistChanged = result.currentPlaylistId !== currentPlaylistIdRef.current;
        if (!playlistChanged) return;

        console.log('[Display] Heartbeat detected playlist change:', result.currentPlaylistId);

        const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screenId);

        if (activePlaylist) {
          pendingPlaylistRef.current = { playlist: activePlaylist, content: playlistContent };
          setNewPlaylistName(activePlaylist.name);
          setIsPlaylistTransitioning(true);
        } else {
          setPlaylist(null);
          setContent([]);
        }
      } catch (err) {
        console.error('[Display] Combined heartbeat failed:', err);
      }
    };

    const markOffline = () => {
      // sendBeacon for reliable delivery even on page close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/screens?id=eq.${screenId}`;
      const body = JSON.stringify({ status: 'offline', updated_at: new Date().toISOString() });
      navigator.sendBeacon(
        url + '&apikey=' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        new Blob([body], { type: 'application/json' })
      );
    };

    // Fire immediately on mount
    combinedHeartbeat();

    const interval = setInterval(combinedHeartbeat, 60 * 1000); // 60 seconds

    // Mark offline ONLY on true page close — NOT visibilitychange (avoids false alerts)
    window.addEventListener('beforeunload', markOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', markOffline);
    };
  }, [screen?.id]);

  // Enter Fullscreen
  useEffect(() => {
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 1000);
    return () => clearTimeout(timer);
  }, [enterFullscreen]);

  // Soft refresh every 6 hours — lightweight: only checks for playlist changes,
  // does NOT call fetchData() (which would rebuild the full content array and
  // trigger ContentRenderer's useEffect, risking blob URL re-resolution).
  // The signature check (prevSig === nextSig) in quickRefresh already guarantees
  // setContent is a no-op if content hasn't changed — zero egress risk.
  useEffect(() => {
    if (!screen?.id) return;
    const refreshInterval = setInterval(() => {
      console.log('[Display] 6h soft refresh — checking for playlist changes only');
      // quickRefresh is defined inside setupRealtimeSubscription's closure.
      // We replicate a lightweight version here to avoid a dependency on the closure:
      // just trigger a re-fetch of the active playlist without touching the full screen data.
      getActivePlaylistForScreen(screen.id).then(({ playlist: activePlaylist, content: playlistContent }) => {
        const playlistChanged = activePlaylist?.id !== currentPlaylistIdRef.current;
        if (!playlistChanged) {
          // Same playlist — check if items changed via signature
          setContent(prev => {
            const prevSig = prev.map(c => `${c.id}:${c.uploadedAt?.getTime()}`).join(',');
            const nextSig = playlistContent.map(c => `${c.id}:${c.uploadedAt?.getTime()}`).join(',');
            if (prevSig === nextSig) return prev; // no re-render, no egress
            console.log('[Display] 6h refresh: content changed — updating');
            return playlistContent;
          });
        } else if (activePlaylist) {
          console.log('[Display] 6h refresh: playlist changed — transitioning');
          pendingPlaylistRef.current = { playlist: activePlaylist, content: playlistContent };
          setNewPlaylistName(activePlaylist.name);
          setIsPlaylistTransitioning(true);
        } else {
          setPlaylist(null);
          setContent([]);
        }
      }).catch(err => console.error('[Display] 6h soft refresh failed:', err));
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen?.id]);


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
