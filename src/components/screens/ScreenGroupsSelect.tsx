/**
 * Multi-select component for assigning a screen to multiple groups
 */
import { useState, useEffect } from 'react';
import { Check, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ScreenGroup } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScreenGroupsSelectProps {
  screenId: string;
  currentGroupIds: string[];
  groups: ScreenGroup[];
  onUpdate: (newGroupIds: string[]) => void;
}

export function ScreenGroupsSelect({ 
  screenId, 
  currentGroupIds, 
  groups,
  onUpdate 
}: ScreenGroupsSelectProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(currentGroupIds);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedGroups(currentGroupIds);
  }, [currentGroupIds]);

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Delete existing assignments
      await supabase
        .from('screen_group_assignments')
        .delete()
        .eq('screen_id', screenId);

      // Insert new assignments
      if (selectedGroups.length > 0) {
        const assignments = selectedGroups.map(groupId => ({
          screen_id: screenId,
          group_id: groupId,
        }));
        
        const { error } = await supabase
          .from('screen_group_assignments')
          .insert(assignments);
        
        if (error) throw error;
      }

      onUpdate(selectedGroups);
      setIsOpen(false);
      toast({
        title: 'Groups Updated',
        description: `Screen assigned to ${selectedGroups.length} group(s).`,
      });
    } catch (error) {
      console.error('Error updating groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to update group assignments.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedGroupNames = selectedGroups
    .map(id => groups.find(g => g.id === id)?.name)
    .filter(Boolean);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 gap-1 text-xs w-full justify-start"
        >
          <Layers className="h-3 w-3" />
          {selectedGroupNames.length > 0 ? (
            <span className="truncate">
              {selectedGroupNames.length} group(s)
            </span>
          ) : (
            <span className="text-muted-foreground">Assign Groups</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="font-medium text-sm">Assign to Groups</h4>
          <p className="text-xs text-muted-foreground">
            Select groups for this screen
          </p>
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No groups available
            </p>
          ) : (
            <div className="space-y-1">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent",
                    selectedGroups.includes(group.id) && "bg-accent"
                  )}
                  onClick={() => handleToggleGroup(group.id)}
                >
                  <Checkbox
                    checked={selectedGroups.includes(group.id)}
                    onCheckedChange={() => handleToggleGroup(group.id)}
                  />
                  <span className="text-sm flex-1 truncate">{group.name}</span>
                  {selectedGroups.includes(group.id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t border-border">
          <Button 
            size="sm" 
            className="w-full" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
