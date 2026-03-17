import { useState } from 'react';
import { Monitor, Layers, Building2, Globe, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ContentItem, Screen, ScreenGroup, Branch } from '@/lib/types';
import { createPlaylist } from '@/lib/api/playlists';
import { useToast } from '@/hooks/use-toast';

type AssignMode = 'all' | 'branch' | 'group' | 'screen';

interface AssignContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentItem | null;
  screens: Screen[];
  groups: ScreenGroup[];
  branches: Branch[];
  onAssignComplete: () => void;
}

export function AssignContentDialog({
  open,
  onOpenChange,
  content,
  screens,
  groups,
  branches,
  onAssignComplete,
}: AssignContentDialogProps) {
  const [mode, setMode] = useState<AssignMode>('screen');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const { toast } = useToast();

  const modes = [
    { id: 'all' as AssignMode, label: 'All Screens', icon: Globe, description: 'Assign to all screens' },
    { id: 'branch' as AssignMode, label: 'Branch', icon: Building2, description: 'All screens in a branch' },
    { id: 'group' as AssignMode, label: 'Group', icon: Layers, description: 'All screens in a group' },
    { id: 'screen' as AssignMode, label: 'Individual', icon: Monitor, description: 'Select specific screens' },
  ];

  const handleModeChange = (newMode: AssignMode) => {
    setMode(newMode);
    setSelectedIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getItems = () => {
    switch (mode) {
      case 'branch':
        return branches.map(b => ({ id: b.id, name: b.name, subtitle: b.location || '' }));
      case 'group':
        return groups.map(g => ({ 
          id: g.id, 
          name: g.name, 
          subtitle: branches.find(b => b.id === g.branchId)?.name || '' 
        }));
      case 'screen':
        return screens.map(s => ({ 
          id: s.id, 
          name: s.name, 
          subtitle: branches.find(b => b.id === s.branchId)?.name || '',
          status: s.status
        }));
      default:
        return [];
    }
  };

  const handleAssign = async () => {
    if (!content) return;

    setIsSaving(true);
    try {
      const name = playlistName.trim() || `Playlist - ${content.name}`;
      const items = [{ contentId: content.id, duration: content.duration || 10, order: 0 }];

      if (mode === 'all') {
        // Create playlist for each branch
        for (const branch of branches) {
          await createPlaylist(name, 'branch', branch.id, items, true);
        }
        toast({
          title: 'Playlist Created!',
          description: `Content will be displayed on all ${branches.length} branches.`,
        });
      } else {
        // Create playlist for each selected target
        const targetType = mode === 'branch' ? 'branch' : mode === 'group' ? 'group' : 'screen';
        for (const id of selectedIds) {
          await createPlaylist(name, targetType, id, items, true);
        }
        toast({
          title: 'Playlist Created!',
          description: `${selectedIds.length} ${mode}${selectedIds.length > 1 ? 's' : ''} will display the content.`,
        });
      }
      
      setSelectedIds([]);
      setPlaylistName('');
      onAssignComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating playlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to create playlist.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canAssign = mode === 'all' || selectedIds.length > 0;
  const items = getItems();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Content</DialogTitle>
          <DialogDescription>
            Choose where to display "{content?.name}"
          </DialogDescription>
        </DialogHeader>

        {/* Content Preview */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
          <div className="w-16 h-10 rounded overflow-hidden bg-secondary">
            <img
              src={content?.thumbnailUrl}
              alt={content?.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{content?.name}</p>
            <p className="text-xs text-muted-foreground">
              {content?.type} • {content?.duration}s
            </p>
          </div>
        </div>

        {/* Playlist Name */}
        <div className="space-y-2">
          <Label htmlFor="playlist-name">Playlist Name (Optional)</Label>
          <Input
            id="playlist-name"
            placeholder={`Playlist - ${content?.name || 'Content'}`}
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-4 gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                mode === m.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <m.icon className={cn(
                "h-5 w-5",
                mode === m.id ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs font-medium",
                mode === m.id ? "text-primary" : "text-muted-foreground"
              )}>
                {m.label}
              </span>
            </button>
          ))}
        </div>

        {/* Selection List */}
        {mode !== 'all' && (
          <ScrollArea className="h-[200px] rounded-lg border">
            <div className="p-2 space-y-1">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No {mode}s available
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                      selectedIds.includes(item.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-secondary"
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {'status' in item && item.status && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        String(item.status) === 'online' 
                          ? "bg-success/20 text-success" 
                          : String(item.status) === 'idle'
                          ? "bg-warning/20 text-warning"
                          : "bg-destructive/20 text-destructive"
                      )}>
                        {String(item.status)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {/* All Screens Info */}
        {mode === 'all' && (
          <div className="flex items-center justify-center p-8 rounded-lg border bg-secondary/30">
            <div className="text-center">
              <Globe className="h-12 w-12 mx-auto text-primary mb-3" />
              <p className="font-medium">Assign to All Screens</p>
              <p className="text-sm text-muted-foreground mt-1">
                Content will be displayed on all {screens.length} screens
              </p>
            </div>
          </div>
        )}

        {/* Selection Summary */}
        {mode !== 'all' && selectedIds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} {mode}{selectedIds.length > 1 ? 's' : ''} selected
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleAssign}
            disabled={!canAssign || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create & Activate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
