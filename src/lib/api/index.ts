// Re-export all API functions from a single entry point
export * from './playlists';
export * from './display-settings';

// Also re-export from the main api file for backwards compatibility
export {
  getBranches,
  createBranch,
  deleteBranch,
  getScreenGroups,
  createScreenGroup,
  deleteScreenGroup,
  getScreens,
  createScreen,
  deleteScreen,
  updateScreenStatus,
  toggleScreenPlaying,
  getContent,
  createContent,
  deleteContent,
  assignContent,
  assignPlaylist,
  getSchedules,
  createSchedule,
  toggleSchedule,
  deleteSchedule,
  getDashboardStats,
  getScreenContent,
} from '../api';
