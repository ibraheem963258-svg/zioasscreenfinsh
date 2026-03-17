import { supabase } from '@/integrations/supabase/client';
import { Playlist, PlaylistItem, ContentItem } from '../types';

export async function getPlaylists(): Promise<Playlist[]> {
  const [
    { data: playlistsData, error: playlistsError },
    { data: itemsData, error: itemsError },
    { data: screensData },
    { data: groupAssignmentsData },
  ] = await Promise.all([
    supabase.from('playlists').select('*').order('created_at', { ascending: false }),
    supabase.from('playlist_items').select('*').order('display_order', { ascending: true }),
    supabase.from('screens').select('id, current_playlist_id, branch_id'),
    supabase.from('screen_group_assignments').select('screen_id, group_id'),
  ]);
  
  if (playlistsError) throw playlistsError;
  if (itemsError) throw itemsError;

  const screens = screensData || [];
  const groupAssignments = groupAssignmentsData || [];

  // Build a set of playlist IDs that are truly active on at least one screen
  const effectivelyActiveIds = new Set<string>();

  for (const playlist of playlistsData) {
    if (!playlist.is_active) continue;

    if (playlist.target_type === 'screen') {
      // Active only if the screen's current_playlist_id points to this playlist
      const screen = screens.find(s => s.id === playlist.target_id);
      if (screen?.current_playlist_id === playlist.id) {
        effectivelyActiveIds.add(playlist.id);
      }
    } else if (playlist.target_type === 'group') {
      // Active if at least one screen is in this group AND has no screen-level active playlist
      const screenIdsInGroup = groupAssignments
        .filter(ga => ga.group_id === playlist.target_id)
        .map(ga => ga.screen_id);
      
      const hasAffectedScreen = screenIdsInGroup.some(screenId => {
        const screen = screens.find(s => s.id === screenId);
        if (!screen) return false;
        // Check if screen has its own active playlist (which would override group)
        const hasScreenPlaylist = playlistsData.some(
          p => p.is_active && p.target_type === 'screen' && p.target_id === screenId
        );
        return !hasScreenPlaylist;
      });
      
      if (hasAffectedScreen) effectivelyActiveIds.add(playlist.id);
    } else if (playlist.target_type === 'branch') {
      // Active if at least one screen in this branch has no higher-priority active playlist
      const branchScreens = screens.filter(s => s.branch_id === playlist.target_id);
      
      const hasAffectedScreen = branchScreens.some(screen => {
        const screenGroupIds = groupAssignments
          .filter(ga => ga.screen_id === screen.id)
          .map(ga => ga.group_id);
        
        const hasScreenPlaylist = playlistsData.some(
          p => p.is_active && p.target_type === 'screen' && p.target_id === screen.id
        );
        const hasGroupPlaylist = playlistsData.some(
          p => p.is_active && p.target_type === 'group' && screenGroupIds.includes(p.target_id)
        );
        return !hasScreenPlaylist && !hasGroupPlaylist;
      });
      
      if (hasAffectedScreen) effectivelyActiveIds.add(playlist.id);
    }
  }

  return playlistsData.map(p => ({
    id: p.id,
    name: p.name,
    targetType: p.target_type as 'screen' | 'group' | 'branch',
    targetId: p.target_id,
    isActive: effectivelyActiveIds.has(p.id),
    items: (itemsData || [])
      .filter(i => i.playlist_id === p.id)
      .map(i => ({
        id: i.id,
        playlistId: i.playlist_id,
        contentId: i.content_id,
        displayOrder: i.display_order,
        duration: i.duration,
      })),
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));
}

export async function getPlaylistsForTarget(
  targetType: 'screen' | 'group' | 'branch',
  targetId: string
): Promise<Playlist[]> {
  const { data: playlistsData, error: playlistsError } = await supabase
    .from('playlists')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });
  
  if (playlistsError) throw playlistsError;

  if (!playlistsData.length) return [];

  const playlistIds = playlistsData.map(p => p.id);
  const { data: itemsData, error: itemsError } = await supabase
    .from('playlist_items')
    .select('*')
    .in('playlist_id', playlistIds)
    .order('display_order', { ascending: true });
  
  if (itemsError) throw itemsError;

  return playlistsData.map(p => ({
    id: p.id,
    name: p.name,
    targetType: p.target_type as 'screen' | 'group' | 'branch',
    targetId: p.target_id,
    isActive: p.is_active,
    items: (itemsData || [])
      .filter(i => i.playlist_id === p.id)
      .map(i => ({
        id: i.id,
        playlistId: i.playlist_id,
        contentId: i.content_id,
        displayOrder: i.display_order,
        duration: i.duration,
      })),
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));
}

export async function createPlaylist(
  name: string,
  targetType: 'screen' | 'group' | 'branch',
  targetId: string,
  items: { contentId: string; duration: number; order: number }[],
  activateImmediately: boolean = true
): Promise<Playlist> {
  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .insert({
      name,
      target_type: targetType,
      target_id: targetId,
      is_active: activateImmediately,
    })
    .select()
    .single();
  
  if (playlistError) throw playlistError;

  if (items.length > 0) {
    const playlistItems = items.map(item => ({
      playlist_id: playlist.id,
      content_id: item.contentId,
      duration: item.duration,
      display_order: item.order,
    }));

    const { error: itemsError } = await supabase
      .from('playlist_items')
      .insert(playlistItems);
    
    if (itemsError) throw itemsError;
  }

  // CRITICAL: Deactivate old playlists for this target, then update screens
  if (activateImmediately) {
    // Deactivate all other playlists for this target
    await supabase
      .from('playlists')
      .update({ is_active: false })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .neq('id', playlist.id);

    // Update current_playlist_id on all affected screens to fire Realtime
    await updateAffectedScreens(targetType, targetId, playlist.id);
  }

  return {
    id: playlist.id,
    name: playlist.name,
    targetType: playlist.target_type as 'screen' | 'group' | 'branch',
    targetId: playlist.target_id,
    isActive: playlist.is_active,
    items: items.map((item, idx) => ({
      id: '', // Will be fetched on next load
      playlistId: playlist.id,
      contentId: item.contentId,
      displayOrder: item.order,
      duration: item.duration,
    })),
    createdAt: new Date(playlist.created_at),
    updatedAt: new Date(playlist.updated_at),
  };
}

export async function updatePlaylist(
  playlistId: string,
  updates: {
    name?: string;
    items?: { contentId: string; duration: number; order: number }[];
  }
): Promise<void> {
  if (updates.name) {
    const { error } = await supabase
      .from('playlists')
      .update({ name: updates.name })
      .eq('id', playlistId);
    
    if (error) throw error;
  }

  if (updates.items) {
    // Delete existing items
    await supabase
      .from('playlist_items')
      .delete()
      .eq('playlist_id', playlistId);

    // Insert new items
    if (updates.items.length > 0) {
      const playlistItems = updates.items.map(item => ({
        playlist_id: playlistId,
        content_id: item.contentId,
        duration: item.duration,
        display_order: item.order,
      }));

      const { error } = await supabase
        .from('playlist_items')
        .insert(playlistItems);
      
      if (error) throw error;
    }
  }
}

// Helper: update current_playlist_id on all screens affected by a playlist
async function updateAffectedScreens(
  targetType: string,
  targetId: string,
  playlistId: string | null
) {
  if (targetType === 'screen') {
    await supabase
      .from('screens')
      .update({ current_playlist_id: playlistId })
      .eq('id', targetId);
  } else if (targetType === 'group') {
    const { data: groupScreens } = await supabase
      .from('screen_group_assignments')
      .select('screen_id')
      .eq('group_id', targetId);
    if (groupScreens?.length) {
      await supabase
        .from('screens')
        .update({ current_playlist_id: playlistId })
        .in('id', groupScreens.map(g => g.screen_id));
    }
  } else if (targetType === 'branch') {
    await supabase
      .from('screens')
      .update({ current_playlist_id: playlistId })
      .eq('branch_id', targetId);
  }
}

export async function activatePlaylist(playlistId: string): Promise<void> {
  const { data: playlistData, error: fetchError } = await supabase
    .from('playlists')
    .select('target_type, target_id')
    .eq('id', playlistId)
    .single();
  
  if (fetchError) throw fetchError;

  // Deactivate all other playlists for the same target first
  await supabase
    .from('playlists')
    .update({ is_active: false })
    .eq('target_type', playlistData.target_type)
    .eq('target_id', playlistData.target_id)
    .neq('id', playlistId);

  // CRITICAL: When activating a group or branch playlist, deactivate any screen-level
  // playlists for the affected screens. Screen-level playlists take priority in
  // getActivePlaylistForScreen (screen > group > branch), so if any screen-level
  // playlist remains active it will block the group/branch playlist from showing.
  if (playlistData.target_type === 'group') {
    const { data: groupScreens } = await supabase
      .from('screen_group_assignments')
      .select('screen_id')
      .eq('group_id', playlistData.target_id);
    if (groupScreens?.length) {
      const screenIds = groupScreens.map(g => g.screen_id);
      await supabase
        .from('playlists')
        .update({ is_active: false })
        .eq('target_type', 'screen')
        .in('target_id', screenIds);
    }
  } else if (playlistData.target_type === 'branch') {
    const { data: branchScreens } = await supabase
      .from('screens')
      .select('id')
      .eq('branch_id', playlistData.target_id);
    if (branchScreens?.length) {
      const screenIds = branchScreens.map(s => s.id);
      await supabase
        .from('playlists')
        .update({ is_active: false })
        .eq('target_type', 'screen')
        .in('target_id', screenIds);
    }
  }

  const { error } = await supabase
    .from('playlists')
    .update({ is_active: true })
    .eq('id', playlistId);
  
  if (error) throw error;

  // Trigger realtime on ALL affected screens (screen / group / branch)
  await updateAffectedScreens(playlistData.target_type, playlistData.target_id, playlistId);
}

export async function deactivatePlaylist(playlistId: string): Promise<void> {
  const { data: playlistData, error: fetchError } = await supabase
    .from('playlists')
    .select('target_type, target_id')
    .eq('id', playlistId)
    .single();
  
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('playlists')
    .update({ is_active: false })
    .eq('id', playlistId);
  
  if (error) throw error;

  // Clear current_playlist_id on all affected screens
  await updateAffectedScreens(playlistData.target_type, playlistData.target_id, null);
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const { data: playlistData, error: fetchError } = await supabase
    .from('playlists')
    .select('target_type, target_id')
    .eq('id', playlistId)
    .maybeSingle();
  
  if (playlistData) {
    await updateAffectedScreens(playlistData.target_type, playlistData.target_id, null);
  }

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId);
  
  if (error) throw error;
}

/**
 * Returns the active playlist + content for a screen.
 *
 * Optimization: accepts pre-fetched `knownGroupIds` and `knownBranchId` from the
 * caller (Display.tsx `fetchData`) to skip the redundant `screens` + `screen_group_assignments`
 * queries that were already executed there.  Falls back to fetching them when not provided
 * (e.g. called from quickRefresh / fallback paths that don't have the data handy).
 *
 * Playlist resolution collapses the old 3 sequential queries (screen → group → branch)
 * into one OR query, then picks the highest-priority result client-side.
 * Priority: screen > group > branch
 */
export async function getActivePlaylistForScreen(
  screenId: string,
  knownGroupIds?: string[],
  knownBranchId?: string,
): Promise<{
  playlist: Playlist | null;
  content: ContentItem[];
}> {
  // ── Resolve groupIds + branchId ───────────────────────────────────────────
  // If the caller already fetched these, reuse them (saves 2 queries).
  let groupIds: string[];
  let branchId: string;

  if (knownGroupIds !== undefined && knownBranchId !== undefined) {
    groupIds = knownGroupIds;
    branchId = knownBranchId;
  } else {
    const [{ data: screenData, error: screenError }, { data: groupAssignments }] =
      await Promise.all([
        supabase.from('screens').select('branch_id').eq('id', screenId).single(),
        supabase.from('screen_group_assignments').select('group_id').eq('screen_id', screenId),
      ]);

    if (screenError) throw screenError;
    groupIds = groupAssignments?.map(a => a.group_id) || [];
    branchId = screenData.branch_id;
  }

  // ── Single OR query across all 3 levels ──────────────────────────────────
  // Build a filter that fetches ALL potentially-active playlists in one round-trip,
  // then select the highest-priority one client-side.
  type OrFilter =
    | `target_type.eq.screen,target_id.eq.${string}`
    | `target_type.eq.branch,target_id.eq.${string}`;

  // CRITICAL: each group must be wrapped in and() so PostgREST treats them as
  // (type=screen AND id=X) OR (type=branch AND id=Y) — without and(), commas
  // inside .or() are separate OR conditions which returns ALL screen playlists.
  const orParts: string[] = [
    `and(target_type.eq.screen,target_id.eq.${screenId})`,
    `and(target_type.eq.branch,target_id.eq.${branchId})`,
  ];
  if (groupIds.length > 0) {
    orParts.push(`and(target_type.eq.group,target_id.in.(${groupIds.join(',')}))`);
  }

  const { data: candidates, error: playlistError } = await supabase
    .from('playlists')
    .select('*')
    .eq('is_active', true)
    .or(orParts.join(','));

  if (playlistError) throw playlistError;
  if (!candidates?.length) return { playlist: null, content: [] };

  // Priority: screen > group > branch
  const PRIORITY: Record<string, number> = { screen: 0, group: 1, branch: 2 };
  const activePlaylist = candidates.reduce((best, cur) =>
    PRIORITY[cur.target_type] < PRIORITY[best.target_type] ? cur : best
  );

  // ── Fetch items + content in parallel ────────────────────────────────────
  const { data: itemsData } = await supabase
    .from('playlist_items')
    .select('*')
    .eq('playlist_id', activePlaylist.id)
    .order('display_order', { ascending: true });

  if (!itemsData?.length) {
    return {
      playlist: {
        id: activePlaylist.id,
        name: activePlaylist.name,
        targetType: activePlaylist.target_type as 'screen' | 'group' | 'branch',
        targetId: activePlaylist.target_id,
        isActive: activePlaylist.is_active,
        items: [],
        createdAt: new Date(activePlaylist.created_at),
        updatedAt: new Date(activePlaylist.updated_at),
      },
      content: [],
    };
  }

  const contentIds = itemsData.map(i => i.content_id);
  const { data: contentData } = await supabase
    .from('content')
    .select('*')
    .in('id', contentIds);

  const contentMap = new Map((contentData || []).map(c => [c.id, c]));

  // Sort content by display order and map to ContentItem
  const orderedContent = itemsData
    .map(item => {
      const c = contentMap.get(item.content_id);
      if (!c) return null;
      return {
        id: c.id,
        name: c.name,
        type: c.type as 'image' | 'video',
        url: c.url,
        thumbnailUrl: c.thumbnail_url || c.url,
        // Use item-level duration so per-item overrides are respected
        duration: item.duration,
        fileSize: Number(c.file_size),
        // CRITICAL: use updated_at as cache version key (not created_at).
        // IndexedDB compares this; match → zero egress re-download.
        uploadedAt: new Date(c.updated_at),
      } as ContentItem;
    })
    .filter(Boolean) as ContentItem[];

  return {
    playlist: {
      id: activePlaylist.id,
      name: activePlaylist.name,
      targetType: activePlaylist.target_type as 'screen' | 'group' | 'branch',
      targetId: activePlaylist.target_id,
      isActive: activePlaylist.is_active,
      items: itemsData.map(i => ({
        id: i.id,
        playlistId: i.playlist_id,
        contentId: i.content_id,
        displayOrder: i.display_order,
        duration: i.duration,
      })),
      createdAt: new Date(activePlaylist.created_at),
      updatedAt: new Date(activePlaylist.updated_at),
    },
    content: orderedContent,
  };
}
