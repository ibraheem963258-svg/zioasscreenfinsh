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
  Edit2,
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2,
  Copy,
  Link,
  Play,
  Pause
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  toggleScreenPlaying
} from '@/lib/api';
import { Screen, Branch, ScreenGroup } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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

    // Subscribe to realtime updates for screens
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
            setScreens(prev => prev.map(s => 
              s.id === updatedScreen.id 
                ? { 
                    ...s, 
                    status: updatedScreen.status as 'online' | 'offline',
                    isPlaying: updatedScreen.is_playing ?? true,
                    lastUpdated: new Date(updatedScreen.updated_at)
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
    if (!newGroupName || !newGroupBranch) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newGroup = await createScreenGroup(newGroupName, newGroupDescription, newGroupBranch);
      setGroups(prev => [newGroup, ...prev]);
      setIsAddGroupOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupBranch('');
      toast({
        title: 'Created',
        description: 'Group created successfully.',
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
                    Create a screen group to organize displays.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input 
                      placeholder="e.g., Menu Displays" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input 
                      placeholder="e.g., Digital menu screens" 
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select value={newGroupBranch} onValueChange={setNewGroupBranch}>
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
                {filteredScreens.map((screen) => (
                  <div key={screen.id} className="stat-card group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          screen.status === 'online' ? 'bg-success/20' : 'bg-destructive/20'
                        )}>
                          <Monitor className={cn(
                            "h-5 w-5",
                            screen.status === 'online' ? 'text-success' : 'text-destructive'
                          )} />
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
                        {screen.status === 'online' ? (
                          <Wifi className="h-4 w-4 text-success" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-destructive" />
                        )}
                        <Badge variant={screen.status === 'online' ? 'default' : 'destructive'} className={cn(
                          screen.status === 'online' ? 'bg-success/20 text-success border-success/30' : ''
                        )}>
                          {screen.status === 'online' ? 'Online' : 'Offline'}
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

                      <div className="flex flex-wrap gap-1">
                        {getGroupNames(screen.groupIds).map((name, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-border">
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
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Resolution</span>
                          <span className="text-foreground">{screen.resolution}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Last Updated</span>
                          <span className="text-foreground">
                            {formatDistanceToNow(screen.lastUpdated, { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-muted-foreground">Display URL</span>
                          <button
                            onClick={() => handleCopyUrl(screen)}
                            className="flex items-center gap-1 text-primary text-xs hover:underline cursor-pointer"
                          >
                            <Link className="h-3 w-3" />
                            Copy URL
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{branchScreens.length}</p>
                          <p className="text-xs text-muted-foreground">Screens</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-success">{onlineCount}</p>
                          <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{branchGroups.length}</p>
                          <p className="text-xs text-muted-foreground">Groups</p>
                        </div>
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
                  Create your first group to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => {
                  const groupScreens = screens.filter(s => s.groupIds.includes(group.id));
                  
                  return (
                    <div key={group.id} className="stat-card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                            <Layers className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{group.name}</h3>
                            <p className="text-sm text-muted-foreground">{group.description}</p>
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
                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Branch</span>
                          <Badge variant="secondary">{getBranchName(group.branchId)}</Badge>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-muted-foreground">Screens</span>
                          <span className="text-lg font-bold text-foreground">{groupScreens.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
