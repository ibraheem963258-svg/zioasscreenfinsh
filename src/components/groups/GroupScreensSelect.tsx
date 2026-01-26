/**
 * GroupScreensSelect Component
 * Allows selecting multiple screens to assign to a group
 */

import { useState, useEffect } from 'react';
import { Check, Monitor, ChevronDown, Loader2, Save, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Screen, Branch } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GroupScreensSelectProps {
  groupId: string;
  screens: Screen[];
  branches: Branch[];
  onUpdate: (screenIds: string[]) => void;
}

export function GroupScreensSelect({
  groupId,
  screens,
  branches,
  onUpdate,
}: GroupScreensSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const { toast } = useToast();

  // Find screens currently assigned to this group
  const currentScreenIds = screens
    .filter(s => s.groupIds.includes(groupId))
    .map(s => s.id);

  useEffect(() => {
    setSelectedScreens(currentScreenIds);
  }, [groupId, screens]);

  const toggleScreen = (screenId: string) => {
    setSelectedScreens(prev =>
      prev.includes(screenId)
        ? prev.filter(id => id !== screenId)
        : [...prev, screenId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get all current assignments for this group
      const { data: existingAssignments } = await supabase
        .from('screen_group_assignments')
        .select('screen_id')
        .eq('group_id', groupId);

      const existingScreenIds = existingAssignments?.map(a => a.screen_id) || [];

      // Determine screens to add and remove
      const screensToAdd = selectedScreens.filter(id => !existingScreenIds.includes(id));
      const screensToRemove = existingScreenIds.filter(id => !selectedScreens.includes(id));

      // Remove unselected screens from this group
      if (screensToRemove.length > 0) {
        await supabase
          .from('screen_group_assignments')
          .delete()
          .eq('group_id', groupId)
          .in('screen_id', screensToRemove);
      }

      // Add newly selected screens to this group
      if (screensToAdd.length > 0) {
        const assignments = screensToAdd.map(screenId => ({
          screen_id: screenId,
          group_id: groupId,
        }));
        
        const { error } = await supabase
          .from('screen_group_assignments')
          .insert(assignments);
        
        if (error) throw error;
      }

      onUpdate(selectedScreens);
      setIsOpen(false);
      toast({
        title: 'Screens Updated',
        description: `Group now has ${selectedScreens.length} screen(s).`,
      });
    } catch (error) {
      console.error('Error updating screens:', error);
      toast({
        title: 'Error',
        description: 'Failed to update screen assignments.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Unknown';
  };

  // Group screens by branch for easier selection
  const screensByBranch = branches.map(branch => ({
    branch,
    screens: screens.filter(s => s.branchId === branch.id),
  })).filter(group => group.screens.length > 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span>{selectedScreens.length} Screen(s)</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="font-medium text-sm">Assign Screens to Group</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Select screens from any branch
          </p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-2 space-y-4">
            {screensByBranch.map(({ branch, screens: branchScreens }) => (
              <div key={branch.id} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {branch.name}
                  </span>
                </div>
                {branchScreens.map(screen => (
                  <div
                    key={screen.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => toggleScreen(screen.id)}
                  >
                    <Checkbox
                      checked={selectedScreens.includes(screen.id)}
                      onCheckedChange={() => toggleScreen(screen.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{screen.name}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs flex-shrink-0",
                        screen.status === 'online' && "border-success text-success",
                        screen.status === 'idle' && "border-warning text-warning",
                        screen.status === 'offline' && "border-destructive text-destructive"
                      )}
                    >
                      {screen.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
