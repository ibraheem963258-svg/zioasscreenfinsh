import { Branch, ScreenGroup, Screen, ContentItem, Schedule, DashboardStats } from './types';

export const mockBranches: Branch[] = [
  { id: 'b1', name: 'Downtown Main', location: '123 Main Street', createdAt: new Date('2024-01-15') },
  { id: 'b2', name: 'Airport Terminal', location: 'Terminal 2, Gate B', createdAt: new Date('2024-02-20') },
  { id: 'b3', name: 'Shopping Mall', location: 'City Center Mall, Floor 2', createdAt: new Date('2024-03-10') },
  { id: 'b4', name: 'Central Station', location: 'Railway Station, Hall A', createdAt: new Date('2024-04-05') },
];

export const mockGroups: ScreenGroup[] = [
  { id: 'g1', name: 'Menu Boards', description: 'Digital menu displays', branchId: 'b1', createdAt: new Date('2024-01-16') },
  { id: 'g2', name: 'Promotional', description: 'Promotional content screens', branchId: 'b1', createdAt: new Date('2024-01-16') },
  { id: 'g3', name: 'Flight Info', description: 'Flight information displays', branchId: 'b2', createdAt: new Date('2024-02-21') },
  { id: 'g4', name: 'Wayfinding', description: 'Navigation and maps', branchId: 'b3', createdAt: new Date('2024-03-11') },
  { id: 'g5', name: 'Departures', description: 'Train departure boards', branchId: 'b4', createdAt: new Date('2024-04-06') },
];

export const mockScreens: Screen[] = [
  { id: 's1', name: 'Main Entrance Display', slug: 'main-entrance', branchId: 'b1', groupIds: ['g1', 'g2'], orientation: 'landscape', resolution: '1920x1080', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c1', 'c2'] },
  { id: 's2', name: 'Counter Menu 1', slug: 'counter-menu-1', branchId: 'b1', groupIds: ['g1'], orientation: 'portrait', resolution: '1080x1920', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c1'] },
  { id: 's3', name: 'Counter Menu 2', slug: 'counter-menu-2', branchId: 'b1', groupIds: ['g1'], orientation: 'portrait', resolution: '1080x1920', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c1'] },
  { id: 's4', name: 'Window Display', slug: 'window-display', branchId: 'b1', groupIds: ['g2'], orientation: 'landscape', resolution: '3840x2160', status: 'offline', isPlaying: false, lastUpdated: new Date(Date.now() - 3600000), contentIds: ['c2', 'c3'] },
  { id: 's5', name: 'Gate B1 Info', slug: 'gate-b1-info', branchId: 'b2', groupIds: ['g3'], orientation: 'landscape', resolution: '1920x1080', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c4'] },
  { id: 's6', name: 'Gate B2 Info', slug: 'gate-b2-info', branchId: 'b2', groupIds: ['g3'], orientation: 'landscape', resolution: '1920x1080', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c4'] },
  { id: 's7', name: 'Terminal Map', slug: 'terminal-map', branchId: 'b2', groupIds: ['g3'], orientation: 'landscape', resolution: '3840x2160', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c5'] },
  { id: 's8', name: 'Mall Directory 1', slug: 'mall-directory-1', branchId: 'b3', groupIds: ['g4'], orientation: 'portrait', resolution: '1080x1920', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c6'] },
  { id: 's9', name: 'Mall Directory 2', slug: 'mall-directory-2', branchId: 'b3', groupIds: ['g4'], orientation: 'portrait', resolution: '1080x1920', status: 'offline', isPlaying: false, lastUpdated: new Date(Date.now() - 7200000), contentIds: ['c6'] },
  { id: 's10', name: 'Food Court Display', slug: 'food-court-display', branchId: 'b3', groupIds: ['g4'], orientation: 'landscape', resolution: '1920x1080', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c2', 'c3'] },
  { id: 's11', name: 'Departure Board Main', slug: 'departure-main', branchId: 'b4', groupIds: ['g5'], orientation: 'landscape', resolution: '3840x2160', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c7'] },
  { id: 's12', name: 'Platform 1 Info', slug: 'platform-1-info', branchId: 'b4', groupIds: ['g5'], orientation: 'landscape', resolution: '1920x1080', status: 'online', isPlaying: true, lastUpdated: new Date(), contentIds: ['c7'] },
];

export const mockContent: ContentItem[] = [
  { id: 'c1', name: 'Summer Menu 2024', type: 'image', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1920', thumbnailUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', duration: 10, fileSize: 2500000, uploadedAt: new Date('2024-06-01') },
  { id: 'c2', name: 'Promo Video - Summer Sale', type: 'video', url: 'https://example.com/video1.mp4', thumbnailUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=400', duration: 30, fileSize: 15000000, uploadedAt: new Date('2024-06-15') },
  { id: 'c3', name: 'New Product Launch', type: 'image', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1920', thumbnailUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', duration: 8, fileSize: 1800000, uploadedAt: new Date('2024-07-01') },
  { id: 'c4', name: 'Flight Information Template', type: 'image', url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920', thumbnailUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400', duration: 15, fileSize: 2200000, uploadedAt: new Date('2024-02-20') },
  { id: 'c5', name: 'Terminal Map', type: 'image', url: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=1920', thumbnailUrl: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400', duration: 20, fileSize: 3000000, uploadedAt: new Date('2024-02-21') },
  { id: 'c6', name: 'Mall Directory Map', type: 'image', url: 'https://images.unsplash.com/photo-1519567241046-7f570f0e1ce2?w=1920', thumbnailUrl: 'https://images.unsplash.com/photo-1519567241046-7f570f0e1ce2?w=400', duration: 30, fileSize: 2800000, uploadedAt: new Date('2024-03-11') },
  { id: 'c7', name: 'Train Schedule Template', type: 'image', url: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=1920', thumbnailUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400', duration: 10, fileSize: 1500000, uploadedAt: new Date('2024-04-06') },
];

export const mockSchedules: Schedule[] = [
  { id: 'sch1', name: 'Morning Breakfast Menu', contentId: 'c1', targetType: 'group', targetId: 'g1', startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31'), startTime: '06:00', endTime: '11:00', priority: 10, isActive: true, createdAt: new Date('2024-01-15') },
  { id: 'sch2', name: 'Summer Promo Campaign', contentId: 'c2', targetType: 'branch', targetId: 'b1', startDate: new Date('2024-06-01'), endDate: new Date('2024-08-31'), startTime: '00:00', endTime: '23:59', priority: 5, isActive: true, createdAt: new Date('2024-06-01') },
  { id: 'sch3', name: 'Weekend Special', contentId: 'c3', targetType: 'screen', targetId: 's1', startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31'), startTime: '10:00', endTime: '22:00', priority: 8, isActive: true, createdAt: new Date('2024-05-01') },
];

export const mockStats: DashboardStats = {
  totalScreens: mockScreens.length,
  onlineScreens: mockScreens.filter(s => s.status === 'online').length,
  offlineScreens: mockScreens.filter(s => s.status === 'offline').length,
  totalBranches: mockBranches.length,
  totalGroups: mockGroups.length,
  totalContent: mockContent.length,
  activeSchedules: mockSchedules.filter(s => s.isActive).length,
};
