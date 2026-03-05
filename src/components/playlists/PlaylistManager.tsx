import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Play, Pause, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Playlist, ContentItem } from '@/lib/types';
import { getContent } from '@/lib/api';
import { 
  createPlaylist, 
  activatePlaylist, 
  deactivatePlaylist, 
  deletePlaylist,
  updatePlaylist 
} from '@/lib/api/playlists';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PlaylistManagerProps {
  targetType: 'screen' | 'group' | 'branch';
  targetId: string;
  targetName: string;
  playlists: Playlist[];
  onPlaylistsChange: () => void;
}

export function PlaylistManager({
  targetType,
  targetId,
  targetName,
  playlists,
  onPlaylistsChange,
}: PlaylistManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ contentId: string; duration: number; order: number }[]>([]);
  const [activateImmediately, setActivateImmediately] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await getContent();
        setContent(data);
      } catch (error) {
        console.error('Error fetching content:', error);
      }
    };
    fetchContent();
  }, []);

  const handleAddToPlaylist = (contentItem: ContentItem) => {
    setSelectedItems([
      ...selectedItems,
      {
        contentId: contentItem.id,
        duration: contentItem.duration || 10,
        order: selectedItems.length,
      },
    ]);
  };

  const handleRemoveFromPlaylist = (contentId: string) => {
    setSelectedItems(
      selectedItems
        .filter(i => i.contentId !== contentId)
        .map((item, idx) => ({ ...item, order: idx }))
    );
  };

  const handleDurationChange = (contentId: string, duration: number) => {
    setSelectedItems(
      selectedItems.map(item =>
        item.contentId === contentId ? { ...item, duration } : item
      )
    );
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast({ title: 'Error', description: 'Please enter a playlist name.', variant: 'destructive' });
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one content item.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await createPlaylist(
        newPlaylistName,
        targetType,
        targetId,
        selectedItems,
        activateImmediately
      );
      toast({ title: 'Created', description: 'Playlist created successfully.' });
      setIsCreateOpen(false);
      setNewPlaylistName('');
      setSelectedItems([]);
      onPlaylistsChange();
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast({ title: 'Error', description: 'Failed to create playlist.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (playlistId: string) => {
    try {
      await activatePlaylist(playlistId);
      toast({ title: 'Activated', description: 'Playlist is now active.' });
      onPlaylistsChange();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to activate playlist.', variant: 'destructive' });
    }
  };

  const handleDeactivate = async (playlistId: string) => {
    try {
      await deactivatePlaylist(playlistId);
      toast({ title: 'Deactivated', description: 'Playlist has been deactivated.' });
      onPlaylistsChange();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to deactivate playlist.', variant: 'destructive' });
    }
  };

  const handleDelete = async (playlistId: string) => {
    try {
      await deletePlaylist(playlistId);
      toast({ title: 'Deleted', description: 'Playlist has been deleted.' });
      onPlaylistsChange();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete playlist.', variant: 'destructive' });
    }
  };

  const getContentName = (contentId: string) => {
    return content.find(c => c.id === contentId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Playlists</h3>
          <p className="text-sm text-muted-foreground">for {targetName}</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
              <DialogDescription>
                Create a new playlist for {targetName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Playlist Name</Label>
                <Input
                  placeholder="e.g., Morning Menu"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Available Content</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                  {content.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleAddToPlaylist(item)}
                      className="p-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted"
                    >
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type} • {item.duration}s</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Playlist Items ({selectedItems.length})</Label>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                    Click on content above to add items
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item, idx) => (
                      <div
                        key={item.contentId}
                        className="flex items-center gap-3 p-2 border rounded-lg"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{idx + 1}.</span>
                        <span className="flex-1 text-sm truncate">{getContentName(item.contentId)}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.duration}
                            onChange={(e) => handleDurationChange(item.contentId, parseInt(e.target.value) || 10)}
                            className="w-20 h-8"
                            min={1}
                          />
                          <span className="text-xs text-muted-foreground">sec</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveFromPlaylist(item.contentId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="activate"
                  checked={activateImmediately}
                  onCheckedChange={(checked) => setActivateImmediately(checked as boolean)}
                />
                <Label htmlFor="activate" className="text-sm">
                  Activate immediately (will deactivate other playlists)
                </Label>
              </div>

              <Button 
                className="w-full" 
                onClick={handleCreatePlaylist}
                disabled={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-sm text-muted-foreground">No playlists created yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                playlist.isActive ? "bg-success/10 border-success/30" : "bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  playlist.isActive ? "bg-success animate-pulse" : "bg-muted-foreground"
                )} />
                <div>
                  <p className="font-medium text-foreground">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {playlist.items.length} items
                  </p>
                </div>
                {playlist.isActive && (
                  <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                    Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {playlist.isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeactivate(playlist.id)}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleActivate(playlist.id)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(playlist.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
