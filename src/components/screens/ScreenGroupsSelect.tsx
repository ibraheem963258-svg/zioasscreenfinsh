/**
 * Multi-select component for assigning a screen to multiple groups
 * Uses dropdown with checkboxes for clear selection
 */
import { useMemo, useState, useEffect } from 'react';
import { Check, Layers, Loader2, ChevronDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
  const [search, setSearch] = useState('');
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

  const normalizedQuery = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups.filter(g =>
      `${g.name} ${g.description ?? ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [groups, normalizedQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-2 text-xs w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            {selectedGroupNames.length > 0 ? (
              <span className="truncate max-w-[120px]">
                {selectedGroupNames.length === 1 
                  ? selectedGroupNames[0] 
                  : `${selectedGroupNames.length} groups`}
              </span>
            ) : (
              <span className="text-muted-foreground">Add to Groups</span>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-50" align="start" sideOffset={4}>
        <div className="p-3 border-b border-border bg-muted/50">
          <h4 className="font-medium text-sm">Assign to Groups</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select one or more groups for this screen
          </p>
        </div>
        <Command shouldFilter={false} className="rounded-none border-0 bg-popover">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search groups…"
            className="border-b"
          />
          <CommandList className="max-h-[40vh] overflow-y-auto overscroll-contain">
            {groups.length === 0 ? (
              <div className="p-4 text-center">
                <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No groups available</p>
                <p className="text-xs text-muted-foreground mt-1">Create a group first</p>
              </div>
            ) : (
              <>
                <CommandEmpty>No matches</CommandEmpty>
                {filteredGroups.map(group => {
                  const isSelected = selectedGroups.includes(group.id);
                  return (
                    <CommandItem
                      key={group.id}
                      value={`${group.name} ${group.description ?? ''}`}
                      onSelect={() => handleToggleGroup(group.id)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                        "hover:bg-accent",
                        isSelected && "bg-accent"
                      )}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{group.name}</span>
                        {group.description && (
                          <span className="text-xs text-muted-foreground truncate block">
                            {group.description}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </CommandItem>
                  );
                })}
              </>
            )}
          </CommandList>
        </Command>
        <div className="p-2 border-t border-border bg-muted/30">
          <Button 
            size="sm" 
            className="w-full gap-2" 
            onClick={handleSave}
            disabled={isSaving || groups.length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
