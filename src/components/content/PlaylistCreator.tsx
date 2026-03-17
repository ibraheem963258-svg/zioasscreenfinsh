import { useState } from 'react';
import { 
  ListVideo, 
  Plus, 
  Trash2, 
  GripVertical, 
  Clock, 
  Image, 
  Video,
  Check,
  Loader2,
  Monitor,
  Layers,
  Building2,
  Globe
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ContentItem, Screen, ScreenGroup, Branch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type Step = 'select' | 'arrange' | 'assign';
type AssignMode = 'all' | 'branch' | 'group' | 'screen';

interface PlaylistItem {
  content: ContentItem;
  duration: number;
  order: number;
}

interface PlaylistCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allContent: ContentItem[];
  screens: Screen[];
  groups: ScreenGroup[];
  branches: Branch[];
  onCreatePlaylist: (items: PlaylistItem[], targetType: string, targetIds: string[]) => Promise<void>;
}

export function PlaylistCreator({
  open,
  onOpenChange,
  allContent,
  screens,
  groups,
  branches,
  onCreatePlaylist,
}: PlaylistCreatorProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]); // can have duplicates
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [assignMode, setAssignMode] = useState<AssignMode>('screen');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setStep('select');
    setSelectedContent([]);
    setPlaylistItems([]);
    setAssignMode('screen');
    setSelectedTargets([]);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // Allow adding the same item multiple times
  const toggleContentSelection = (item: ContentItem) => {
    setSelectedContent(prev => [...prev, item]);
  };

  const goToArrange = () => {
    if (selectedContent.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one content item.',
        variant: 'destructive',
      });
      return;
    }
    
    setPlaylistItems(
      selectedContent.map((content, index) => ({
        content,
        duration: content.duration || 10,
        order: index,
      }))
    );
    setStep('arrange');
  };

  const updateItemDuration = (index: number, duration: number) => {
    setPlaylistItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, duration } : item))
    );
  };

  const removeItem = (index: number) => {
    setPlaylistItems(prev => prev.filter((_, i) => i !== index));
  };

  const moveItem = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= playlistItems.length) return;
    
    setPlaylistItems(prev => {
      const newItems = [...prev];
      [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
      return newItems.map((item, i) => ({ ...item, order: i }));
    });
  };

  const toggleTarget = (id: string) => {
    setSelectedTargets(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getTargetItems = () => {
    switch (assignMode) {
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
          subtitle: branches.find(b => b.id === s.branchId)?.name || '' 
        }));
      default:
        return [];
    }
  };

  const handleCreate = async () => {
    if (playlistItems.length === 0) {
      toast({ title: 'Error', description: 'Playlist is empty.', variant: 'destructive' });
      return;
    }

    if (assignMode !== 'all' && selectedTargets.length === 0) {
      toast({ title: 'Error', description: 'Please select targets.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const targets = assignMode === 'all' 
        ? branches.map(b => b.id) 
        : selectedTargets;
      const targetType = assignMode === 'all' ? 'branch' : assignMode;
      
      await onCreatePlaylist(playlistItems, targetType, targets);
      
      toast({
        title: 'Playlist Created!',
        description: `${playlistItems.length} items will be displayed.`,
      });
      handleClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create playlist.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalDuration = playlistItems.reduce((sum, item) => sum + item.duration, 0);

  const assignModes = [
    { id: 'all' as AssignMode, label: 'All', icon: Globe },
    { id: 'branch' as AssignMode, label: 'Branch', icon: Building2 },
    { id: 'group' as AssignMode, label: 'Group', icon: Layers },
    { id: 'screen' as AssignMode, label: 'Screen', icon: Monitor },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListVideo className="h-5 w-5" />
            Create Playlist
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select content to add to your playlist'}
            {step === 'arrange' && 'Arrange order and set display duration'}
            {step === 'assign' && 'Choose where to display this playlist'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 py-2">
          {['select', 'arrange', 'assign'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === s ? "bg-primary text-primary-foreground" :
                ['select', 'arrange', 'assign'].indexOf(step) > i 
                  ? "bg-primary/20 text-primary" 
                  : "bg-secondary text-muted-foreground"
              )}>
                {i + 1}
              </div>
              {i < 2 && <div className="w-12 h-0.5 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Content */}
        {step === 'select' && (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-[350px] rounded-lg border p-2">
              <div className="grid grid-cols-2 gap-2">
                {allContent.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleContentSelection(item)}
                      className="flex items-center gap-3 p-3 rounded-lg text-left transition-all bg-secondary/50 border-2 border-transparent hover:bg-secondary hover:border-primary/50"
                    >
                      <div className="relative w-16 h-10 rounded overflow-hidden bg-secondary shrink-0">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 left-1">
                          {item.type === 'image' ? (
                            <Image className="h-3 w-3 text-white drop-shadow" />
                          ) : (
                            <Video className="h-3 w-3 text-white drop-shadow" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.duration}s</p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
              </div>
            </ScrollArea>
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-muted-foreground">
                {selectedContent.length} items selected (duplicates allowed)
              </p>
              <Button onClick={goToArrange} disabled={selectedContent.length === 0}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Arrange & Set Duration */}
        {step === 'arrange' && (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-[300px] rounded-lg border">
              <div className="p-2 space-y-2">
                {playlistItems.map((item, index) => (
                  <div
                    key={`${item.content.id}-${index}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                      >
                        <GripVertical className="h-3 w-3 rotate-180" />
                      </button>
                      <button
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === playlistItems.length - 1}
                        className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                      >
                        <GripVertical className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    
                    <div className="w-14 h-9 rounded overflow-hidden bg-secondary shrink-0">
                      <img
                        src={item.content.thumbnailUrl}
                        alt={item.content.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.content.name}</p>
                      <p className="text-xs text-muted-foreground">{item.content.type}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={item.duration}
                        onChange={(e) => updateItemDuration(index, parseInt(e.target.value) || 5)}
                        className="w-16 h-8 text-center"
                        min={1}
                      />
                      <span className="text-sm text-muted-foreground">sec</span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-medium">Total Duration</p>
                <p className="text-xs text-muted-foreground">{playlistItems.length} items</p>
              </div>
              <p className="text-2xl font-bold text-primary">
                {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}
              </p>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => setStep('assign')} disabled={playlistItems.length === 0}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Assign to Targets */}
        {step === 'assign' && (
          <div className="flex-1 min-h-0">
            {/* Mode Selection */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {assignModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setAssignMode(m.id);
                    setSelectedTargets([]);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                    assignMode === m.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <m.icon className={cn(
                    "h-5 w-5",
                    assignMode === m.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    assignMode === m.id ? "text-primary" : "text-muted-foreground"
                  )}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            {assignMode === 'all' ? (
              <div className="flex items-center justify-center p-8 rounded-lg border bg-secondary/30">
                <div className="text-center">
                  <Globe className="h-12 w-12 mx-auto text-primary mb-3" />
                  <p className="font-medium">Display on All Screens</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Playlist will play on all {screens.length} screens
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[180px] rounded-lg border">
                <div className="p-2 space-y-1">
                  {getTargetItems().map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleTarget(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                        selectedTargets.includes(item.id)
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-secondary"
                      )}
                    >
                      <Checkbox
                        checked={selectedTargets.includes(item.id)}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep('arrange')}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={isSaving || (assignMode !== 'all' && selectedTargets.length === 0)}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Playlist
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}