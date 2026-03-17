/**
 * GroupScreensSelect Component
 * Dropdown for selecting multiple screens to assign to a group
 *
 * UX goal:
 * - When there are many screens/groups, the list must remain usable.
 * - Provide search + a scrollable list inside the dropdown.
 */

import { useMemo, useState, useEffect } from 'react';
import { Check, Monitor, ChevronDown, Loader2, Save, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
  const [search, setSearch] = useState('');
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
  const screensByBranch = useMemo(
    () =>
      branches
        .map(branch => ({
          branch,
          screens: screens.filter(s => s.branchId === branch.id),
        }))
        .filter(group => group.screens.length > 0),
    [branches, screens]
  );

  const normalizedQuery = search.trim().toLowerCase();
  const filteredScreensByBranch = useMemo(() => {
    if (!normalizedQuery) return screensByBranch;
    return screensByBranch
      .map(({ branch, screens: branchScreens }) => ({
        branch,
        screens: branchScreens.filter(s =>
          `${s.name} ${getBranchName(s.branchId)} ${s.status}`
            .toLowerCase()
            .includes(normalizedQuery)
        ),
      }))
      .filter(g => g.screens.length > 0);
  }, [normalizedQuery, screensByBranch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'border-success text-success bg-success/10';
      case 'idle': return 'border-warning text-warning bg-warning/10';
      default: return 'border-destructive text-destructive bg-destructive/10';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between gap-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span>
              {selectedScreens.length > 0 
                ? `${selectedScreens.length} Screen(s)` 
                : 'Select Screens'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-50" align="start" sideOffset={4}>
        <div className="p-3 border-b border-border bg-muted/50">
          <h4 className="font-medium text-sm">Assign Screens to Group</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select screens from any branch
          </p>
        </div>
        <Command shouldFilter={false} className="rounded-none border-0 bg-popover">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search screens…"
            className="border-b"
          />
          <CommandList className="max-h-[40vh] overflow-y-auto overscroll-contain">
            {screensByBranch.length === 0 ? (
              <div className="p-4 text-center">
                <Monitor className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No screens available</p>
              </div>
            ) : (
              <>
                <CommandEmpty>No matches</CommandEmpty>
                {filteredScreensByBranch.map(({ branch, screens: branchScreens }) => (
                  <CommandGroup
                    key={branch.id}
                    heading={
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {branch.name}
                        </span>
                      </span>
                    }
                  >
                    {branchScreens.map(screen => {
                      const isSelected = selectedScreens.includes(screen.id);
                      return (
                        <CommandItem
                          key={screen.id}
                          value={`${branch.name} ${screen.name} ${screen.status}`}
                          onSelect={() => toggleScreen(screen.id)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                            "hover:bg-accent",
                            isSelected && "bg-accent"
                          )}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{screen.name}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-xs flex-shrink-0", getStatusColor(screen.status))}
                          >
                            {screen.status}
                          </Badge>
                          {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
        <div className="p-2 border-t border-border bg-muted/30">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleSave}
            disabled={isSaving || screens.length === 0}
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