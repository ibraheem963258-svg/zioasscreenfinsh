import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { DisplaySettings } from '@/lib/types';
import { getDisplaySettings, upsertDisplaySettings } from '@/lib/api/display-settings';
import { useToast } from '@/hooks/use-toast';

interface DisplaySettingsDialogProps {
  targetType: 'screen' | 'group' | 'branch';
  targetId: string;
  targetName: string;
  trigger?: React.ReactNode;
}

export function DisplaySettingsDialog({
  targetType,
  targetId,
  targetName,
  trigger,
}: DisplaySettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<Partial<DisplaySettings>>({
    slideDuration: 10,
    transitionType: 'fade',
    transitionDuration: 500,
    playbackOrder: 'loop',
    contentScaling: 'fill',
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, targetType, targetId]);

  const fetchSettings = async () => {
    try {
      const existingSettings = await getDisplaySettings(targetType, targetId);
      if (existingSettings) {
        setSettings(existingSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await upsertDisplaySettings(targetType, targetId, settings);
      toast({ title: 'Saved', description: 'Display settings updated successfully.' });
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Display Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Display Settings</DialogTitle>
          <DialogDescription>
            Configure display settings for {targetName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Slide Duration (seconds)</Label>
            <Input
              type="number"
              value={settings.slideDuration || 10}
              onChange={(e) => setSettings({ ...settings, slideDuration: parseInt(e.target.value) || 10 })}
              min={1}
              max={300}
            />
            <p className="text-xs text-muted-foreground">
              Default time each slide is displayed
            </p>
          </div>

          <div className="space-y-2">
            <Label>Transition Type</Label>
            <Select
              value={settings.transitionType || 'fade'}
              onValueChange={(value) => setSettings({ ...settings, transitionType: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide">Slide</SelectItem>
                <SelectItem value="crossfade">Crossfade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Transition Duration (ms)</Label>
            <Input
              type="number"
              value={settings.transitionDuration || 500}
              onChange={(e) => setSettings({ ...settings, transitionDuration: parseInt(e.target.value) || 500 })}
              min={100}
              max={3000}
              step={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Playback Order</Label>
            <Select
              value={settings.playbackOrder || 'loop'}
              onValueChange={(value) => setSettings({ ...settings, playbackOrder: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loop">Loop (Sequential)</SelectItem>
                <SelectItem value="shuffle">Shuffle (Random)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Content Scaling</Label>
            <Select
              value={settings.contentScaling || 'fill'}
              onValueChange={(value) => setSettings({ ...settings, contentScaling: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fit">Fit (Show entire content)</SelectItem>
                <SelectItem value="fill">Fill (Cover entire screen)</SelectItem>
                <SelectItem value="stretch">Stretch (May distort)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
