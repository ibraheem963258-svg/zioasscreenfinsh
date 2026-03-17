import { useState, useEffect } from 'react';
import { Search, Filter, Play, Pause, Trash2, Monitor, Users, Building2, MoreVertical, Plus, Edit2, Loader2, Save } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Playlist, ContentItem, Screen, ScreenGroup, Branch } from '@/lib/types';
import { 
  getPlaylists, 
  activatePlaylist, 
  deactivatePlaylist, 
  deletePlaylist,
  updatePlaylist
} from '@/lib/api/playlists';
import { getScreens, getScreenGroups, getBranches, getContent } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type FilterStatus = 'all' | 'active' | 'inactive';
type FilterTarget = 'all' | 'screen' | 'group' | 'branch';

export default function Playlists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [targetFilter, setTargetFilter] = useState<FilterTarget>('all');
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});
  
  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editName, setEditName] = useState('');
  const [editItems, setEditItems] = useState<{ contentId: string; duration: number; order: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  const fetchPlaylists = async () => {
    try {
      const data = await getPlaylists();
      setPlaylists(data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      toast({ title: 'Error', description: 'Failed to load playlists', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTargetNames = async () => {
    try {
      const [screensData, groupsData, branchesData, contentData] = await Promise.all([
        getScreens(),
        getScreenGroups(),
        getBranches(),
        getContent(),
      ]);
      
      setScreens(screensData);
      setGroups(groupsData);
      setBranches(branchesData);
      setContent(contentData);
      
      const names: Record<string, string> = {};
      screensData.forEach(s => names[s.id] = s.name);
      groupsData.forEach(g => names[g.id] = g.name);
      branchesData.forEach(b => names[b.id] = b.name);
      setTargetNames(names);
    } catch (error) {
      console.error('Error fetching target names:', error);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchTargetNames();

    const channel = supabase
      .channel('playlists-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlists' },
        () => fetchPlaylists()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleActivate = async (id: string) => {
    // Optimistic update
    setPlaylists(prev => prev.map(p => ({
      ...p,
      isActive: p.id === id ? true : (p.targetId === prev.find(x => x.id === id)?.targetId ? false : p.isActive)
    })));
    try {
      await activatePlaylist(id);
      toast({ title: 'Activated', description: 'Playlist is now active' });
    } catch (error) {
      fetchPlaylists(); // Revert
      toast({ title: 'Error', description: 'Failed to activate playlist', variant: 'destructive' });
    }
  };

  const handleDeactivate = async (id: string) => {
    // Optimistic update
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, isActive: false } : p));
    try {
      await deactivatePlaylist(id);
      toast({ title: 'Deactivated', description: 'Playlist has been paused' });
    } catch (error) {
      fetchPlaylists(); // Revert
      toast({ title: 'Error', description: 'Failed to deactivate playlist', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic update - remove from UI immediately
    const previousPlaylists = playlists;
    setPlaylists(prev => prev.filter(p => p.id !== id));
    try {
      await deletePlaylist(id);
      toast({ title: 'Deleted', description: 'Playlist has been deleted' });
    } catch (error) {
      // Revert on error
      setPlaylists(previousPlaylists);
      toast({ title: 'Error', description: 'Failed to delete playlist', variant: 'destructive' });
    }
  };

  const openEditDialog = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setEditName(playlist.name);
    setEditItems(playlist.items.map(item => ({
      contentId: item.contentId,
      duration: item.duration,
      order: item.displayOrder,
    })));
    setIsEditOpen(true);
  };

  const handleUpdatePlaylist = async () => {
    if (!editingPlaylist || !editName.trim()) {
      toast({ title: 'Error', description: 'Please enter a playlist name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      await updatePlaylist(editingPlaylist.id, {
        name: editName,
        items: editItems,
      });

      // Optimistic update
      setPlaylists(prev => prev.map(p => 
        p.id === editingPlaylist.id 
          ? { 
              ...p, 
              name: editName,
              items: editItems.map((item, idx) => ({
                id: p.items[idx]?.id || '',
                playlistId: p.id,
                contentId: item.contentId,
                displayOrder: item.order,
                duration: item.duration,
              }))
            } 
          : p
      ));

      setIsEditOpen(false);
      setEditingPlaylist(null);
      toast({ title: 'Updated', description: 'Playlist updated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update playlist', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const addContentToEdit = (contentItem: ContentItem) => {
    if (editItems.some(i => i.contentId === contentItem.id)) return;
    setEditItems([
      ...editItems,
      {
        contentId: contentItem.id,
        duration: contentItem.duration || 10,
        order: editItems.length,
      },
    ]);
  };

  const removeContentFromEdit = (contentId: string) => {
    setEditItems(
      editItems
        .filter(i => i.contentId !== contentId)
        .map((item, idx) => ({ ...item, order: idx }))
    );
  };

  const updateItemDuration = (contentId: string, duration: number) => {
    setEditItems(
      editItems.map(item =>
        item.contentId === contentId ? { ...item, duration } : item
      )
    );
  };

  const getContentName = (contentId: string) => {
    return content.find(c => c.id === contentId)?.name || 'Unknown';
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'screen': return <Monitor className="h-4 w-4" />;
      case 'group': return <Users className="h-4 w-4" />;
      case 'branch': return <Building2 className="h-4 w-4" />;
      default: return null;
    }
  };

  const filteredPlaylists = playlists.filter(playlist => {
    const matchesSearch = playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      targetNames[playlist.targetId]?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && playlist.isActive) ||
      (statusFilter === 'inactive' && !playlist.isActive);
    
    const matchesTarget = targetFilter === 'all' || playlist.targetType === targetFilter;
    
    return matchesSearch && matchesStatus && matchesTarget;
  });

  const stats = {
    total: playlists.length,
    active: playlists.filter(p => p.isActive).length,
    inactive: playlists.filter(p => !p.isActive).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Playlists</h1>
            <p className="text-muted-foreground">Manage all content playlists</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground" dir="ltr">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg border bg-success/10 border-success/30">
            <p className="text-sm text-success">Active</p>
            <p className="text-2xl font-bold text-success" dir="ltr">{stats.active}</p>
          </div>
          <div className="p-4 rounded-lg border bg-muted">
            <p className="text-sm text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground" dir="ltr">{stats.inactive}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search playlists or targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetFilter} onValueChange={(v) => setTargetFilter(v as FilterTarget)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              <SelectItem value="screen">Screens</SelectItem>
              <SelectItem value="group">Groups</SelectItem>
              <SelectItem value="branch">Branches</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Playlist Name</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : filteredPlaylists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No playlists found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPlaylists.map((playlist) => (
                  <TableRow key={playlist.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          playlist.isActive ? "bg-success animate-pulse" : "bg-muted-foreground"
                        )} />
                        <Badge 
                          variant={playlist.isActive ? "default" : "secondary"}
                          className={cn(
                            playlist.isActive && "bg-success/20 text-success border-success/30"
                          )}
                        >
                          {playlist.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{playlist.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTargetIcon(playlist.targetType)}
                        <span className="text-sm">
                          {targetNames[playlist.targetId] || 'Unknown'}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {playlist.targetType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell dir="ltr">{playlist.items.length} items</TableCell>
                    <TableCell className="text-muted-foreground text-sm" dir="ltr">
                      {formatDistanceToNow(playlist.createdAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(playlist)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {playlist.isActive ? (
                            <DropdownMenuItem onClick={() => handleDeactivate(playlist.id)}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivate(playlist.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDelete(playlist.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingPlaylist(null);
            setEditName('');
            setEditItems([]);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Playlist</DialogTitle>
              <DialogDescription>
                Update the playlist name and content items.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Playlist Name</Label>
                <Input
                  placeholder="e.g., Morning Menu"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Available Content</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                  {content.map((item) => {
                    const isSelected = editItems.some(i => i.contentId === item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isSelected && addContentToEdit(item)}
                        className={cn(
                          "p-2 rounded-lg border cursor-pointer transition-colors",
                          isSelected 
                            ? "bg-muted opacity-50 cursor-not-allowed" 
                            : "hover:bg-muted"
                        )}
                      >
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.type} • {item.duration}s</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Playlist Items ({editItems.length})</Label>
                {editItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                    Click on content above to add items
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editItems.map((item, idx) => (
                      <div
                        key={item.contentId}
                        className="flex items-center gap-3 p-2 border rounded-lg"
                      >
                        <span className="text-sm font-medium" dir="ltr">{idx + 1}.</span>
                        <span className="flex-1 text-sm truncate">{getContentName(item.contentId)}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.duration}
                            onChange={(e) => updateItemDuration(item.contentId, parseInt(e.target.value) || 10)}
                            className="w-20 h-8"
                            min={1}
                            lang="en"
                            dir="ltr"
                          />
                          <span className="text-xs text-muted-foreground">sec</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeContentFromEdit(item.contentId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button 
                className="w-full" 
                onClick={handleUpdatePlaylist}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
