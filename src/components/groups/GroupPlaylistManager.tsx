/**
 * GroupPlaylistManager Component
 * Manages playlists for a group - content syncs to all screens in the group
 */

import { useState, useEffect } from 'react';
import { ListMusic, Play, Pause, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { 
  getPlaylistsForTarget, 
  activatePlaylist, 
  deactivatePlaylist,
  deletePlaylist 
} from '@/lib/api/playlists';
import { Playlist } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PlaylistManager } from '@/components/playlists/PlaylistManager';

interface GroupPlaylistManagerProps {
  groupId: string;
  groupName: string;
  screenCount: number;
  onPlaylistChange?: () => void;
}

export function GroupPlaylistManager({
  groupId,
  groupName,
  screenCount,
  onPlaylistChange,
}: GroupPlaylistManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const data = await getPlaylistsForTarget('group', groupId);
      setPlaylists(data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPlaylists();
    }
  }, [isOpen, groupId]);

  const handleActivate = async (playlistId: string) => {
    try {
      await activatePlaylist(playlistId);
      await fetchPlaylists();
      onPlaylistChange?.();
      toast({
        title: 'Playlist Activated',
        description: `Content will now display on all ${screenCount} screen(s) in "${groupName}".`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to activate playlist.',
        variant: 'destructive',
      });
    }
  };

  const handleDeactivate = async (playlistId: string) => {
    try {
      await deactivatePlaylist(playlistId);
      await fetchPlaylists();
      onPlaylistChange?.();
      toast({
        title: 'Playlist Deactivated',
        description: 'Content stopped on group screens.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deactivate playlist.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (playlistId: string) => {
    try {
      await deletePlaylist(playlistId);
      await fetchPlaylists();
      onPlaylistChange?.();
      toast({
        title: 'Deleted',
        description: 'Playlist deleted successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete playlist.',
        variant: 'destructive',
      });
    }
  };

  const activePlaylist = playlists.find(p => p.isActive);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <ListMusic className="h-4 w-4 mr-2" />
          {activePlaylist ? (
            <>
              <span className="truncate">{activePlaylist.name}</span>
              <Badge variant="default" className="ml-2 flex-shrink-0">Active</Badge>
            </>
          ) : (
            'Manage Content'
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Group Content Control</SheetTitle>
          <SheetDescription>
            Managing content for "{groupName}" ({screenCount} screens)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Info Banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-sm text-primary mb-1">
              Unified Content Control
            </h4>
            <p className="text-xs text-muted-foreground">
              Any playlist activated here will display on all {screenCount} screen(s) 
              in this group simultaneously. Changes are applied in real-time.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PlaylistManager
              targetType="group"
              targetId={groupId}
              targetName={groupName}
              playlists={playlists}
              onPlaylistsChange={fetchPlaylists}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
