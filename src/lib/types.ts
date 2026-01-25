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

export interface Screen {
  id: string;
  name: string;
  slug: string;
  branchId: string;
  groupIds: string[];
  orientation: 'landscape' | 'portrait';
  resolution: string;
  status: 'online' | 'offline';
  lastUpdated: Date;
  contentIds: string[];
}

export interface ContentItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  duration?: number; // in seconds, for videos or image display time
  fileSize: number;
  uploadedAt: Date;
}

export interface Schedule {
  id: string;
  name: string;
  contentId: string;
  targetType: 'screen' | 'group' | 'branch';
  targetId: string;
  startDate: Date;
  endDate: Date;
  startTime: string; // HH:mm format
  endTime: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface DashboardStats {
  totalScreens: number;
  onlineScreens: number;
  offlineScreens: number;
  totalBranches: number;
  totalGroups: number;
  totalContent: number;
  activeSchedules: number;
}
