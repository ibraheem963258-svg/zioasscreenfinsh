export interface Branch {
  id: string;
  name: string;
  location: string;
  createdAt: Date;
}

export interface ScreenGroup {
  id: string;
  name: string;
  description?: string;
  branchId: string;
  createdAt: Date;
}

/**
 * Screen Interface
 */
export interface Screen {
  id: string;
  name: string;
  slug: string;
  branchId: string;
  groupIds: string[];
  orientation: 'landscape' | 'portrait';
  resolution: string;
  status: 'online' | 'offline' | 'idle';
  isPlaying: boolean;
  isActive: boolean;
  lastHeartbeat: Date | null;
  lastUpdated: Date;
  contentIds: string[];
  currentPlaylistId: string | null;
}

export interface ContentItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  duration?: number;
  fileSize: number;
  uploadedAt: Date;
}

export interface Playlist {
  id: string;
  name: string;
  targetType: 'screen' | 'group' | 'branch';
  targetId: string;
  isActive: boolean;
  items: PlaylistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  contentId: string;
  displayOrder: number;
  duration: number;
  content?: ContentItem;
}

export interface DisplaySettings {
  id: string;
  targetType: 'screen' | 'group' | 'branch';
  targetId: string;
  slideDuration: number;
  transitionType: 'none' | 'fade' | 'slide' | 'crossfade';
  transitionDuration: number;
  playbackOrder: 'loop' | 'shuffle';
  contentScaling: 'fit' | 'fill' | 'stretch';
  createdAt: Date;
  updatedAt: Date;
}

export interface Schedule {
  id: string;
  name: string;
  contentId: string;
  targetType: 'screen' | 'group' | 'branch';
  targetId: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface DashboardStats {
  totalScreens: number;
  onlineScreens: number;
  offlineScreens: number;
  idleScreens: number;
  totalBranches: number;
  totalGroups: number;
  totalContent: number;
  activePlaylists: number;
  activeSchedules: number;
}
