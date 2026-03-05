import { supabase } from '@/integrations/supabase/client';
import { Branch, ScreenGroup, Screen, ContentItem, Schedule, DashboardStats } from './types';

// Branches
export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data.map(b => ({
    id: b.id,
    name: b.name,
    location: b.location || '',
    createdAt: new Date(b.created_at),
  }));
}

export async function createBranch(name: string, location: string): Promise<Branch> {
  const { data, error } = await supabase
    .from('branches')
    .insert({ name, location })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    location: data.location || '',
    createdAt: new Date(data.created_at),
  };
}

export async function deleteBranch(id: string): Promise<void> {
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Screen Groups
export async function getScreenGroups(): Promise<ScreenGroup[]> {
  const { data, error } = await supabase
    .from('screen_groups')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description || undefined,
    branchId: g.branch_id || '',
    createdAt: new Date(g.created_at),
  }));
}

export async function createScreenGroup(name: string, description: string, branchId: string): Promise<ScreenGroup> {
  const { data, error } = await supabase
    .from('screen_groups')
    .insert({ 
      name, 
      description, 
      branch_id: branchId || null // Allow null branch for cross-branch groups
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    branchId: data.branch_id || '',
    createdAt: new Date(data.created_at),
  };
}

export async function deleteScreenGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('screen_groups')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Screens
export async function getScreens(): Promise<Screen[]> {
  // Use server-side RPC for accurate status calculation (avoids client clock drift)
  const [{ data: screensData, error: screensError }, { data: assignmentsData }, { data: contentAssignments }] =
    await Promise.all([
      supabase.rpc('get_screens_with_status').order('updated_at', { ascending: false }),
      supabase.from('screen_group_assignments').select('screen_id, group_id'),
      supabase.from('content_assignments').select('content_id, target_id').eq('target_type', 'screen'),
    ]);

  if (screensError) throw screensError;

  return (screensData as any[]).map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    branchId: s.branch_id,
    groupIds: (assignmentsData || []).filter((a: any) => a.screen_id === s.id).map((a: any) => a.group_id),
    orientation: s.orientation as 'landscape' | 'portrait',
    resolution: s.resolution,
    // computed_status is calculated server-side — always accurate
    status: s.computed_status as 'online' | 'offline' | 'idle',
    isPlaying: s.is_playing ?? true,
    isActive: s.is_active ?? true,
    lastHeartbeat: s.last_heartbeat ? new Date(s.last_heartbeat) : null,
    lastUpdated: new Date(s.updated_at),
    contentIds: (contentAssignments || []).filter((c: any) => c.target_id === s.id).map((c: any) => c.content_id),
    currentPlaylistId: s.current_playlist_id,
    liveStreamUrl: s.live_stream_url || null,
    liveStreamEnabled: s.live_stream_enabled || false,
  }));
}

export async function createScreen(
  name: string,
  slug: string,
  branchId: string,
  orientation: string,
  resolution: string,
  groupIds: string[] = []
): Promise<Screen> {
  const { data, error } = await supabase
    .from('screens')
    .insert({ name, slug, branch_id: branchId, orientation, resolution })
    .select()
    .single();
  
  if (error) throw error;

  // Assign to groups if any
  if (groupIds.length > 0) {
    const assignments = groupIds.map(groupId => ({
      screen_id: data.id,
      group_id: groupId,
    }));
    await supabase.from('screen_group_assignments').insert(assignments);
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    branchId: data.branch_id,
    groupIds,
    orientation: data.orientation as 'landscape' | 'portrait',
    resolution: data.resolution,
    status: data.status as 'online' | 'offline' | 'idle',
    isPlaying: data.is_playing ?? true,
    isActive: (data as any).is_active ?? true,
    lastHeartbeat: data.last_heartbeat ? new Date(data.last_heartbeat) : null,
    lastUpdated: new Date(data.updated_at),
    contentIds: [],
    currentPlaylistId: data.current_playlist_id ?? null,
  };
}

export async function deleteScreen(id: string): Promise<void> {
  const { error } = await supabase
    .from('screens')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function updateScreenStatus(id: string, status: 'online' | 'offline'): Promise<void> {
  const { error } = await supabase
    .from('screens')
    .update({ status, last_heartbeat: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
}

export async function toggleScreenPlaying(id: string, isPlaying: boolean): Promise<void> {
  const { error } = await supabase
    .from('screens')
    .update({ is_playing: isPlaying } as any)
    .eq('id', id);
  
  if (error) throw error;
}

export async function toggleScreenActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('screens')
    .update({ is_active: isActive } as any)
    .eq('id', id);
  
  if (error) throw error;
}


// Content
export async function getContent(): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type as 'image' | 'video',
    url: c.url,
    thumbnailUrl: c.thumbnail_url || c.url,
    duration: c.duration,
    fileSize: Number(c.file_size),
    uploadedAt: new Date(c.created_at),
  }));
}

export async function createContent(
  name: string,
  type: 'image' | 'video',
  url: string,
  thumbnailUrl: string,
  duration: number,
  fileSize: number
): Promise<ContentItem> {
  const { data, error } = await supabase
    .from('content')
    .insert({ name, type, url, thumbnail_url: thumbnailUrl, duration, file_size: fileSize })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    type: data.type as 'image' | 'video',
    url: data.url,
    thumbnailUrl: data.thumbnail_url || data.url,
    duration: data.duration,
    fileSize: Number(data.file_size),
    uploadedAt: new Date(data.created_at),
  };
}

export async function deleteContent(id: string): Promise<void> {
  const { error } = await supabase
    .from('content')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function assignContent(
  contentId: string,
  targetType: 'screen' | 'group' | 'branch',
  targetId: string,
  displayOrder?: number
): Promise<void> {
  const { error } = await supabase
    .from('content_assignments')
    .insert({ 
      content_id: contentId, 
      target_type: targetType, 
      target_id: targetId,
      display_order: displayOrder ?? 0
    });
  
  if (error) throw error;
}

export async function assignPlaylist(
  items: { contentId: string; duration: number; order: number }[],
  targetType: 'screen' | 'group' | 'branch',
  targetIds: string[]
): Promise<void> {
  // First, clear existing assignments for these targets
  for (const targetId of targetIds) {
    await supabase
      .from('content_assignments')
      .delete()
      .eq('target_type', targetType)
      .eq('target_id', targetId);
  }

  // Then, create new assignments
  const assignments = [];
  for (const targetId of targetIds) {
    for (const item of items) {
      assignments.push({
        content_id: item.contentId,
        target_type: targetType,
        target_id: targetId,
        display_order: item.order,
      });
    }
  }

  const { error } = await supabase
    .from('content_assignments')
    .insert(assignments);

  if (error) throw error;
}

// Schedules
export async function getSchedules(): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data.map(s => ({
    id: s.id,
    name: s.name,
    contentId: s.content_id,
    targetType: s.target_type as 'screen' | 'group' | 'branch',
    targetId: s.target_id,
    startDate: new Date(s.start_date),
    endDate: new Date(s.end_date),
    startTime: s.start_time,
    endTime: s.end_time,
    priority: s.priority,
    isActive: s.is_active,
    createdAt: new Date(s.created_at),
  }));
}

export async function createSchedule(
  name: string,
  contentId: string,
  targetType: 'screen' | 'group' | 'branch',
  targetId: string,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  priority: number
): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      name,
      content_id: contentId,
      target_type: targetType,
      target_id: targetId,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      priority,
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    contentId: data.content_id,
    targetType: data.target_type as 'screen' | 'group' | 'branch',
    targetId: data.target_id,
    startDate: new Date(data.start_date),
    endDate: new Date(data.end_date),
    startTime: data.start_time,
    endTime: data.end_time,
    priority: data.priority,
    isActive: data.is_active,
    createdAt: new Date(data.created_at),
  };
}

export async function toggleSchedule(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ is_active: isActive })
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function updateSchedule(
  id: string,
  name: string,
  contentId: string,
  targetType: 'screen' | 'group' | 'branch',
  targetId: string,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  priority: number
): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({
      name,
      content_id: contentId,
      target_type: targetType,
      target_id: targetId,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      priority,
    })
    .eq('id', id);
  
  if (error) throw error;
}

// Dashboard Stats — uses server-side RPC for accurate status (no client clock dependency)
export async function getDashboardStats(): Promise<DashboardStats> {
  const [screensRpc, branches, groups, content, schedules, playlists] = await Promise.all([
    // RPC computes status server-side — accurate to the second, no client drift
    supabase.rpc('get_screens_with_status'),
    supabase.from('branches').select('id', { count: 'exact', head: true }),
    supabase.from('screen_groups').select('id', { count: 'exact', head: true }),
    supabase.from('content').select('id', { count: 'exact', head: true }),
    supabase.from('schedules').select('id, is_active'),
    supabase.from('playlists').select('id, is_active'),
  ]);

  const screensData = (screensRpc.data as any[]) || [];
  const schedulesData = schedules.data || [];
  const playlistsData = playlists.data || [];

  const onlineScreens  = screensData.filter(s => s.computed_status === 'online').length;
  const idleScreens    = screensData.filter(s => s.computed_status === 'idle').length;
  const offlineScreens = screensData.filter(s => s.computed_status === 'offline').length;

  return {
    totalScreens: screensData.length,
    onlineScreens,
    offlineScreens,
    idleScreens,
    totalBranches: branches.count || 0,
    totalGroups: groups.count || 0,
    totalContent: content.count || 0,
    activePlaylists: playlistsData.filter(p => p.is_active).length,
    activeSchedules: schedulesData.filter(s => s.is_active).length,
  };
}

// Storage & Egress stats — computed server-side from real file_size values
export async function getContentStorageStats(): Promise<{
  totalFiles: number; totalBytes: number; totalGb: number;
  videoFiles: number; videoBytes: number;
  imageFiles: number; imageBytes: number;
  avgVideoBytes: number;
} | null> {
  const { data, error } = await supabase.rpc('get_content_storage_stats');
  if (error) { console.error('[Storage stats] RPC failed:', error); return null; }
  const d = data as any;
  return {
    totalFiles:    Number(d.total_files    ?? 0),
    totalBytes:    Number(d.total_bytes    ?? 0),
    totalGb:       Number(d.total_gb       ?? 0),
    videoFiles:    Number(d.video_files    ?? 0),
    videoBytes:    Number(d.video_bytes    ?? 0),
    imageFiles:    Number(d.image_files    ?? 0),
    imageBytes:    Number(d.image_bytes    ?? 0),
    avgVideoBytes: Number(d.avg_video_bytes ?? 0),
  };
}

// Egress estimate — server-side calculation based on real file sizes
export async function estimateMonthlyEgress(
  androidScreens = 0,
  samsungScreens = 0,
  updatesPerMonth = 4
): Promise<{
  totalContentGb: number; androidMonthlyGb: number; samsungMonthlyGb: number;
  totalMonthlyGb: number; budgetGb: number; withinBudget: boolean; budgetUsedPct: number;
} | null> {
  const { data, error } = await supabase.rpc('estimate_monthly_egress', {
    p_android_screens: androidScreens,
    p_samsung_screens: samsungScreens,
    p_updates_per_month: updatesPerMonth,
  });
  if (error) { console.error('[Egress estimate] RPC failed:', error); return null; }
  const d = data as any;
  return {
    totalContentGb:   Number(d.total_content_gb   ?? 0),
    androidMonthlyGb: Number(d.android_monthly_gb ?? 0),
    samsungMonthlyGb: Number(d.samsung_monthly_gb ?? 0),
    totalMonthlyGb:   Number(d.total_monthly_gb   ?? 0),
    budgetGb:         Number(d.budget_gb          ?? 250),
    withinBudget:     Boolean(d.within_budget),
    budgetUsedPct:    Number(d.budget_used_pct    ?? 0),
  };
}

// Get content for a specific screen (used by display page)
export async function getScreenContent(slug: string): Promise<{ screen: Screen | null; content: ContentItem[] }> {
  // Get screen by slug
  const { data: screenData, error: screenError } = await supabase
    .from('screens')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  
  if (screenError) throw screenError;
  if (!screenData) return { screen: null, content: [] };

  // Get group assignments for this screen
  const { data: groupAssignments } = await supabase
    .from('screen_group_assignments')
    .select('group_id')
    .eq('screen_id', screenData.id);

  const groupIds = groupAssignments?.map(a => a.group_id) || [];

  // Get content assignments for this screen, its groups, and its branch
  const { data: contentAssignments, error: assignmentsError } = await supabase
    .from('content_assignments')
    .select('content_id, target_type, target_id');
  
  if (assignmentsError) throw assignmentsError;

  // Filter relevant assignments
  const relevantContentIds = new Set<string>();
  contentAssignments?.forEach(a => {
    if (a.target_type === 'screen' && a.target_id === screenData.id) {
      relevantContentIds.add(a.content_id);
    }
    if (a.target_type === 'group' && groupIds.includes(a.target_id)) {
      relevantContentIds.add(a.content_id);
    }
    if (a.target_type === 'branch' && a.target_id === screenData.branch_id) {
      relevantContentIds.add(a.content_id);
    }
  });

  // Get the actual content
  let contentItems: ContentItem[] = [];
  if (relevantContentIds.size > 0) {
    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .select('*')
      .in('id', Array.from(relevantContentIds));
    
    if (contentError) throw contentError;
    contentItems = contentData.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type as 'image' | 'video',
      url: c.url,
      thumbnailUrl: c.thumbnail_url || c.url,
      duration: c.duration,
      fileSize: Number(c.file_size),
      uploadedAt: new Date(c.created_at),
    }));
  }

  const hasActivePlaylist = screenData.current_playlist_id !== null;
  const isOnline = screenData.status === 'online';
  let status: 'online' | 'offline' | 'idle' = screenData.status as 'online' | 'offline';
  if (isOnline && !hasActivePlaylist) {
    status = 'idle';
  }

  const screen: Screen = {
    id: screenData.id,
    name: screenData.name,
    slug: screenData.slug,
    branchId: screenData.branch_id,
    groupIds,
    orientation: screenData.orientation as 'landscape' | 'portrait',
    resolution: screenData.resolution,
    status,
    isPlaying: screenData.is_playing ?? true,
    isActive: (screenData as any).is_active ?? true,
    lastHeartbeat: screenData.last_heartbeat ? new Date(screenData.last_heartbeat) : null,
    lastUpdated: new Date(screenData.updated_at),
    contentIds: Array.from(relevantContentIds),
    currentPlaylistId: screenData.current_playlist_id ?? null,
  };

  return { screen, content: contentItems };
}
