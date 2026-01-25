import { supabase } from '@/integrations/supabase/client';
import { Playlist, PlaylistItem, ContentItem } from '../types';

export async function getPlaylists(): Promise<Playlist[]> {
  const { data: playlistsData, error: playlistsError } = await supabase
    .from('playlists')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (playlistsError) throw playlistsError;

  const { data: itemsData, error: itemsError } = await supabase
    .from('playlist_items')
    .select('*')
    .order('display_order', { ascending: true });
  
  if (itemsError) throw itemsError;

  return playlistsData.map(p => ({
    id: p.id,
    name: p.name,
    targetType: p.target_type as 'screen' | 'group' | 'branch',
    targetId: p.target_id,
    isActive: p.is_active,
    items: itemsData
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

export async function activatePlaylist(playlistId: string): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .update({ is_active: true })
    .eq('id', playlistId);
  
  if (error) throw error;
}

export async function deactivatePlaylist(playlistId: string): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .update({ is_active: false })
    .eq('id', playlistId);
  
  if (error) throw error;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId);
  
  if (error) throw error;
}

export async function getActivePlaylistForScreen(screenId: string): Promise<{
  playlist: Playlist | null;
  content: ContentItem[];
}> {
  // Get screen to find branch and groups
  const { data: screenData, error: screenError } = await supabase
    .from('screens')
    .select('*')
    .eq('id', screenId)
    .single();
  
  if (screenError) throw screenError;

  const { data: groupAssignments } = await supabase
    .from('screen_group_assignments')
    .select('group_id')
    .eq('screen_id', screenId);

  const groupIds = groupAssignments?.map(a => a.group_id) || [];

  // Check for active playlist at screen level first, then group, then branch
  let activePlaylist = null;

  // Screen level
  const { data: screenPlaylist } = await supabase
    .from('playlists')
    .select('*')
    .eq('target_type', 'screen')
    .eq('target_id', screenId)
    .eq('is_active', true)
    .maybeSingle();

  if (screenPlaylist) {
    activePlaylist = screenPlaylist;
  } else if (groupIds.length > 0) {
    // Group level
    const { data: groupPlaylist } = await supabase
      .from('playlists')
      .select('*')
      .eq('target_type', 'group')
      .in('target_id', groupIds)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    if (groupPlaylist) {
      activePlaylist = groupPlaylist;
    }
  }

  if (!activePlaylist) {
    // Branch level
    const { data: branchPlaylist } = await supabase
      .from('playlists')
      .select('*')
      .eq('target_type', 'branch')
      .eq('target_id', screenData.branch_id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (branchPlaylist) {
      activePlaylist = branchPlaylist;
    }
  }

  if (!activePlaylist) {
    return { playlist: null, content: [] };
  }

  // Get playlist items
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
      content: [] 
    };
  }

  // Get content for items
  const contentIds = itemsData.map(i => i.content_id);
  const { data: contentData } = await supabase
    .from('content')
    .select('*')
    .in('id', contentIds);

  const content: ContentItem[] = (contentData || []).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type as 'image' | 'video',
    url: c.url,
    thumbnailUrl: c.thumbnail_url || c.url,
    duration: c.duration,
    fileSize: Number(c.file_size),
    uploadedAt: new Date(c.created_at),
  }));

  // Sort content by display order
  const orderedContent = itemsData.map(item => {
    const contentItem = content.find(c => c.id === item.content_id);
    return contentItem ? { ...contentItem, duration: item.duration } : null;
  }).filter(Boolean) as ContentItem[];

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
