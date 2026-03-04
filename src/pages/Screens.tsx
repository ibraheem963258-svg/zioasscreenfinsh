/**
 * ======================================
 * Screens Management Page
 * ======================================
 */

import { useState, useEffect } from 'react';
import { 
  Monitor, 
  Plus, 
  Building2, 
  Layers, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2,
  Copy,
  Link,
  Play,
  Pause,
  CirclePause,
  ListMusic,
  Settings,
  Clock,
  RefreshCw
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { 
  getScreens, 
  getBranches, 
  getScreenGroups, 
  createScreen, 
  createBranch, 
  createScreenGroup,
  deleteScreen,
  deleteBranch,
  deleteScreenGroup,
  toggleScreenPlaying,
} from '@/lib/api';
import { getPlaylistsForTarget } from '@/lib/api/playlists';
import { Screen, Branch, ScreenGroup, Playlist } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { PlaylistManager } from '@/components/playlists/PlaylistManager';
import { DisplaySettingsDialog } from '@/components/settings/DisplaySettingsDialog';
import { ScreenGroupsSelect } from '@/components/screens/ScreenGroupsSelect';
import { GroupScreensSelect } from '@/components/groups/GroupScreensSelect';
import { GroupPlaylistManager } from '@/components/groups/GroupPlaylistManager';

export default function Screens() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddScreenOpen, setIsAddScreenOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Playlist management
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(null);
  const [screenPlaylists, setScreenPlaylists] = useState<Playlist[]>([]);
  const [isPlaylistSheetOpen, setIsPlaylistSheetOpen] = useState(false);
  
  // Form states
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenSlug, setNewScreenSlug] = useState('');
  const [newScreenBranch, setNewScreenBranch] = useState('');
  const [newScreenOrientation, setNewScreenOrientation] = useState('landscape');
  const [newScreenResolution, setNewScreenResolution] = useState('1920x1080');
  
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupBranch, setNewGroupBranch] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('screens-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'screens',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedScreen = payload.new as any;
            const lastHeartbeat = updatedScreen.last_heartbeat ? new Date(updatedScreen.last_heartbeat) : null;
            const minutesSinceHeartbeat = lastHeartbeat
              ? (Date.now() - lastHeartbeat.getTime()) / 60000
              : Infinity;
            const hasActivePlaylist = updatedScreen.current_playlist_id !== null;
            let newStatus: 'online' | 'offline' | 'idle' = updatedScreen.status as 'online' | 'offline' | 'idle';
            if (minutesSinceHeartbeat > 10) {
              newStatus = 'offline';
            } else if (newStatus === 'online' && !hasActivePlaylist) {
              newStatus = 'idle';
            }
            setScreens(prev => prev.map(s => 
              s.id === updatedScreen.id 
                ? { 
                    ...s, 
                    status: newStatus,
                    isPlaying: updatedScreen.is_playing ?? true,
                    lastHeartbeat,
                    lastUpdated: new Date(updatedScreen.updated_at),
                    currentPlaylistId: updatedScreen.current_playlist_id,
                  }
                : s
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [screensData, branchesData, groupsData] = await Promise.all([
        getScreens(),
        getBranches(),
        getScreenGroups(),
      ]);
      setScreens(screensData);
      setBranches(branchesData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScreenPlaylists = async (screen: Screen) => {
    try {
      const playlists = await getPlaylistsForTarget('screen', screen.id);
      setScreenPlaylists(playlists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const handleOpenPlaylistSheet = async (screen: Screen) => {
    setSelectedScreen(screen);
    await fetchScreenPlaylists(screen);
    setIsPlaylistSheetOpen(true);
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Unknown';
  };

  const getGroupNames = (groupIds: string[]) => {
    return groupIds.map(id => groups.find(g => g.id === id)?.name).filter(Boolean);
  };

  const filteredScreens = screens.filter(screen => {
    const matchesSearch = screen.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = filterBranch === 'all' || screen.branchId === filterBranch;
    const matchesStatus = filterStatus === 'all' || screen.status === filterStatus;
    return matchesSearch && matchesBranch && matchesStatus;
  });

  const getDisplayUrl = (slug: string) => {
    return `${window.location.origin}/display/${slug}`;
  };

  const handlePreview = (screen: Screen) => {
    window.open(`/display/${screen.slug}`, '_blank');
  };

  const handleCopyUrl = async (screen: Screen) => {
    const url = getDisplayUrl(screen.slug);
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Copied!',
        description: 'Display URL copied to clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteScreen = async (screenId: string) => {
    try {
      await deleteScreen(screenId);
      setScreens(prev => prev.filter(s => s.id !== screenId));
      toast({
        title: 'Deleted',
        description: 'Screen deleted successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete screen.',
        variant: 'destructive',
      });
    }
  };

  const handleTogglePlaying = async (screen: Screen) => {
    const newState = !screen.isPlaying;
    try {
      await toggleScreenPlaying(screen.id, newState);
      setScreens(prev => prev.map(s => 
        s.id === screen.id ? { ...s, isPlaying: newState } : s
      ));
      toast({
        title: newState ? 'Playing' : 'Paused',
        description: `Content on "${screen.name}" is now ${newState ? 'playing' : 'paused'}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle playback.',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshScreen = async (screen: Screen) => {
    try {
      await supabase
        .from('screens')
        .update({ force_refresh_at: new Date().toISOString() } as any)
        .eq('id', screen.id);
      toast({
        title: 'Refresh Sent',
        description: `A refresh command was sent to "${screen.name}".`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send refresh.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateScreen = async () => {
    if (!newScreenName || !newScreenSlug || !newScreenBranch) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newScreen = await createScreen(
        newScreenName,
        newScreenSlug,
        newScreenBranch,
        newScreenOrientation,
        newScreenResolution
      );
      setScreens(prev => [newScreen, ...prev]);
      setIsAddScreenOpen(false);
      resetScreenForm();
      toast({
        title: 'Created',
        description: 'Screen created successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create screen.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName) {
      toast({
        title: 'Error',
        description: 'Please enter a branch name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newBranch = await createBranch(newBranchName, newBranchLocation);
      setBranches(prev => [newBranch, ...prev]);
      setIsAddBranchOpen(false);
      setNewBranchName('');
      setNewBranchLocation('');
      toast({
        title: 'Created',
        description: 'Branch created successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create branch.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) {
      toast({
        title: 'Error',
        description: 'Please enter a group name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Branch is now optional - pass empty string if not selected
      const newGroup = await createScreenGroup(newGroupName, newGroupDescription, newGroupBranch || '');
      setGroups(prev => [newGroup, ...prev]);
      setIsAddGroupOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupBranch('');
      toast({
        title: 'Created',
        description: 'Group created successfully. You can now add screens from any branch.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create group.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetScreenForm = () => {
    setNewScreenName('');
    setNewScreenSlug('');
    setNewScreenBranch('');
    setNewScreenOrientation('landscape');
    setNewScreenResolution('1920x1080');
  };

  const getStatusConfig = (status: Screen['status']) => {
    switch (status) {
      case 'online':
        return {
          bgColor: 'bg-success/20',
          textColor: 'text-success',
          icon: Wifi,
          label: 'Online',
          badgeClass: 'status-online',
        };
      case 'idle':
        return {
          bgColor: 'bg-warning/20',
          textColor: 'text-warning',
          icon: CirclePause,
          label: 'Idle',
          badgeClass: 'status-idle',
        };
      case 'offline':
      default:
        return {
          bgColor: 'bg-destructive/20',
          textColor: 'text-destructive',
          icon: WifiOff,
          label: 'Offline',
          badgeClass: 'status-offline',
        };
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Screen Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage screens, branches, and groups
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  Add Branch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Branch</DialogTitle>
                  <DialogDescription>
                    Create a new branch location for screens.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Branch Name</Label>
                    <Input 
                      placeholder="e.g., Main Branch" 
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input 
                      placeholder="e.g., 123 Main Street" 
                      value={newBranchLocation}
                      onChange={(e) => setNewBranchLocation(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateBranch} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Branch
                </Button>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Layers className="h-4 w-4 mr-2" />
                  Add Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Group</DialogTitle>
                  <DialogDescription>
                    Create a screen group to control content across multiple screens from any branch.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Group Name *</Label>
                    <Input 
                      placeholder="e.g., Menu Displays" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea 
                      placeholder="e.g., All digital menu screens across locations" 
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Branch (Optional)</Label>
                    <Select 
                      value={newGroupBranch || "__none__"} 
                      onValueChange={(val) => setNewGroupBranch(val === "__none__" ? "" : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No branch restriction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No branch restriction</SelectItem>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Groups can contain screens from any branch regardless of this setting.
                    </p>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateGroup} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Group
                </Button>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddScreenOpen} onOpenChange={setIsAddScreenOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Screen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Screen</DialogTitle>
                  <DialogDescription>
                    Configure a new display screen for your signage network.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Screen Name</Label>
                    <Input 
                      placeholder="e.g., Main Entrance Display" 
                      value={newScreenName}
                      onChange={(e) => setNewScreenName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL Slug</Label>
                    <Input 
                      placeholder="e.g., main-entrance" 
                      value={newScreenSlug}
                      onChange={(e) => setNewScreenSlug(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      <Select value={newScreenBranch} onValueChange={setNewScreenBranch}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Orientation</Label>
                      <Select value={newScreenOrientation} onValueChange={setNewScreenOrientation}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="landscape">Landscape</SelectItem>
                          <SelectItem value="portrait">Portrait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <Select value={newScreenResolution} onValueChange={setNewScreenResolution}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                        <SelectItem value="1080x1920">1080x1920 (Portrait HD)</SelectItem>
                        <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                        <SelectItem value="2160x3840">2160x3840 (Portrait 4K)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateScreen} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Screen
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="screens" className="space-y-4">
          <TabsList>
            <TabsTrigger value="screens" className="gap-2">
              <Monitor className="h-4 w-4" />
              Screens ({screens.length})
            </TabsTrigger>
            <TabsTrigger value="branches" className="gap-2">
              <Building2 className="h-4 w-4" />
              Branches ({branches.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Layers className="h-4 w-4" />
              Groups ({groups.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screens" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search screens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-[180px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Screens Grid */}
            {filteredScreens.length === 0 ? (
              <div className="text-center py-12 stat-card">
                <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No screens found</h3>
                <p className="text-muted-foreground mt-1">
                  Create your first screen to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredScreens.map((screen) => {
                  const statusConfig = getStatusConfig(screen.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={screen.id} className="stat-card group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            statusConfig.bgColor
                          )}>
                            <Monitor className={cn("h-5 w-5", statusConfig.textColor)} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{screen.name}</h3>
                            <p className="text-sm text-muted-foreground">{getBranchName(screen.branchId)}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenPlaylistSheet(screen)}>
                              <ListMusic className="h-4 w-4 mr-2" />
                              Manage Playlists
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyUrl(screen)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Display URL
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePreview(screen)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePreview(screen)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Display URL
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDeleteScreen(screen.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusIcon className={cn("h-4 w-4", statusConfig.textColor)} />
                          <Badge variant="outline" className={statusConfig.badgeClass}>
                            {statusConfig.label}
                          </Badge>
                          {screen.status === 'online' && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "gap-1",
                                screen.isPlaying 
                                  ? 'bg-primary/10 text-primary border-primary/30' 
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {screen.isPlaying ? (
                                <><Play className="h-3 w-3" /> Playing</>
                              ) : (
                                <><Pause className="h-3 w-3" /> Paused</>
                              )}
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {screen.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1 items-center">
                          <ScreenGroupsSelect
                            screenId={screen.id}
                            currentGroupIds={screen.groupIds}
                            groups={groups}
                            onUpdate={(newGroupIds) => {
                              setScreens(prev => prev.map(s =>
                                s.id === screen.id ? { ...s, groupIds: newGroupIds } : s
                              ));
                            }}
                          />
                        </div>

                        <div className="pt-3 border-t border-border space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Content Playback</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {screen.isPlaying ? 'On' : 'Off'}
                              </span>
                              <Switch 
                                checked={screen.isPlaying} 
                                onCheckedChange={() => handleTogglePlaying(screen)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Resolution</span>
                            <span className="text-foreground">{screen.resolution}</span>
                          </div>
                          {screen.lastHeartbeat && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Last Ping
                              </span>
                              <span className="text-foreground">
                                {formatDistanceToNow(screen.lastHeartbeat, { addSuffix: true })}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Display URL</span>
                            <button
                              onClick={() => handleCopyUrl(screen)}
                              className="flex items-center gap-1 text-primary text-xs hover:underline cursor-pointer"
                            >
                              <Link className="h-3 w-3" />
                              Copy URL
                            </button>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleOpenPlaylistSheet(screen)}
                            >
                              <ListMusic className="h-4 w-4 mr-1" />
                              Playlists
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Send refresh command to screen"
                              onClick={() => handleRefreshScreen(screen)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <DisplaySettingsDialog
                              targetType="screen"
                              targetId={screen.id}
                              targetName={screen.name}
                              trigger={
                                <Button variant="outline" size="sm">
                                  <Settings className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            {branches.length === 0 ? (
              <div className="text-center py-12 stat-card">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No branches found</h3>
                <p className="text-muted-foreground mt-1">
                  Create your first branch to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branches.map((branch) => {
                  const branchScreens = screens.filter(s => s.branchId === branch.id);
                  const branchGroups = groups.filter(g => g.branchId === branch.id);
                  const onlineCount = branchScreens.filter(s => s.status === 'online').length;
                  const idleCount = branchScreens.filter(s => s.status === 'idle').length;
                  
                  return (
                    <div key={branch.id} className="stat-card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{branch.name}</h3>
                            <p className="text-sm text-muted-foreground">{branch.location}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              await deleteBranch(branch.id);
                              setBranches(prev => prev.filter(b => b.id !== branch.id));
                              toast({ title: 'Deleted', description: 'Branch deleted successfully.' });
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border">
                        <div className="text-center">
                          <p className="text-xl font-bold text-foreground">{branchScreens.length}</p>
                          <p className="text-xs text-muted-foreground">Screens</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-success">{onlineCount}</p>
                          <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-warning">{idleCount}</p>
                          <p className="text-xs text-muted-foreground">Idle</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-foreground">{branchGroups.length}</p>
                          <p className="text-xs text-muted-foreground">Groups</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <DisplaySettingsDialog
                          targetType="branch"
                          targetId={branch.id}
                          targetName={branch.name}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            {groups.length === 0 ? (
              <div className="text-center py-12 stat-card">
                <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No groups found</h3>
                <p className="text-muted-foreground mt-1">
                  Create your first group to control content across multiple screens.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => {
                  const groupScreens = screens.filter(s => s.groupIds.includes(group.id));
                  const onlineCount = groupScreens.filter(s => s.status === 'online').length;
                  const idleCount = groupScreens.filter(s => s.status === 'idle').length;
                  const offlineCount = groupScreens.filter(s => s.status === 'offline').length;
                  
                  return (
                    <div key={group.id} className="stat-card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                            <Layers className="h-5 w-5 text-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground">{group.name}</h3>
                            {group.description && (
                              <p className="text-sm text-muted-foreground truncate">{group.description}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              await deleteScreenGroup(group.id);
                              setGroups(prev => prev.filter(g => g.id !== group.id));
                              toast({ title: 'Deleted', description: 'Group deleted successfully.' });
                            }}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Screen Stats */}
                      <div className="grid grid-cols-4 gap-2 py-3 border-t border-b border-border mb-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{groupScreens.length}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-success">{onlineCount}</p>
                          <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-warning">{idleCount}</p>
                          <p className="text-xs text-muted-foreground">Idle</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-destructive">{offlineCount}</p>
                          <p className="text-xs text-muted-foreground">Offline</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        {/* Assign Screens */}
                        <GroupScreensSelect
                          groupId={group.id}
                          screens={screens}
                          branches={branches}
                          onUpdate={(screenIds) => {
                            // Refresh screens to update groupIds
                            fetchData();
                          }}
                        />

                        {/* Content Control - Playlist Manager */}
                        <GroupPlaylistManager
                          groupId={group.id}
                          groupName={group.name}
                          screenCount={groupScreens.length}
                          onPlaylistChange={fetchData}
                        />

                        {/* Display Settings */}
                        <DisplaySettingsDialog
                          targetType="group"
                          targetId={group.id}
                          targetName={group.name}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Playlist Management Sheet */}
      <Sheet open={isPlaylistSheetOpen} onOpenChange={setIsPlaylistSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Playlist Management</SheetTitle>
            <SheetDescription>
              {selectedScreen ? `Managing playlists for "${selectedScreen.name}"` : ''}
            </SheetDescription>
          </SheetHeader>
          {selectedScreen && (
            <div className="mt-6">
              <PlaylistManager
                targetType="screen"
                targetId={selectedScreen.id}
                targetName={selectedScreen.name}
                playlists={screenPlaylists}
                onPlaylistsChange={() => fetchScreenPlaylists(selectedScreen)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
