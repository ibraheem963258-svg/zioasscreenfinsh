import { useState, useEffect } from 'react';
import { Search, Filter, Play, Pause, Trash2, Monitor, Users, Building2, MoreVertical, Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Playlist } from '@/lib/types';
import { 
  getPlaylists, 
  activatePlaylist, 
  deactivatePlaylist, 
  deletePlaylist 
} from '@/lib/api/playlists';
import { getScreens, getScreenGroups, getBranches } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type FilterStatus = 'all' | 'active' | 'inactive';
type FilterTarget = 'all' | 'screen' | 'group' | 'branch';

export default function Playlists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [targetFilter, setTargetFilter] = useState<FilterTarget>('all');
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});
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
      const [screens, groups, branches] = await Promise.all([
        getScreens(),
        getScreenGroups(),
        getBranches(),
      ]);
      
      const names: Record<string, string> = {};
      screens.forEach(s => names[s.id] = s.name);
      groups.forEach(g => names[g.id] = g.name);
      branches.forEach(b => names[b.id] = b.name);
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
    try {
      await activatePlaylist(id);
      toast({ title: 'Activated', description: 'Playlist is now active' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to activate playlist', variant: 'destructive' });
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivatePlaylist(id);
      toast({ title: 'Deactivated', description: 'Playlist has been paused' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to deactivate playlist', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlaylist(id);
      toast({ title: 'Deleted', description: 'Playlist has been deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete playlist', variant: 'destructive' });
    }
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
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg border bg-success/10 border-success/30">
            <p className="text-sm text-success">Active</p>
            <p className="text-2xl font-bold text-success">{stats.active}</p>
          </div>
          <div className="p-4 rounded-lg border bg-muted">
            <p className="text-sm text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
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
                    <TableCell>{playlist.items.length} items</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
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
      </div>
    </DashboardLayout>
  );
}
