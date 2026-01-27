import { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Search,
  Clock,
  MoreVertical,
  Trash2,
  Play,
  Pause,
  Monitor,
  Layers,
  Building2,
  Loader2,
  Edit2
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Label } from '@/components/ui/label';
import { 
  getSchedules, 
  createSchedule, 
  toggleSchedule, 
  deleteSchedule,
  updateSchedule,
  getContent,
  getScreens,
  getScreenGroups,
  getBranches
} from '@/lib/api';
import { Schedule, ContentItem, Screen, ScreenGroup, Branch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Format date to English locale (YYYY-MM-DD for display)
const formatDateEN = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format time to English locale
const formatTimeEN = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newScheduleContent, setNewScheduleContent] = useState('');
  const [newScheduleTargetType, setNewScheduleTargetType] = useState<'screen' | 'group' | 'branch'>('screen');
  const [newScheduleTargetId, setNewScheduleTargetId] = useState('');
  const [newScheduleStartDate, setNewScheduleStartDate] = useState('');
  const [newScheduleEndDate, setNewScheduleEndDate] = useState('');
  const [newScheduleStartTime, setNewScheduleStartTime] = useState('09:00');
  const [newScheduleEndTime, setNewScheduleEndTime] = useState('17:00');
  const [newSchedulePriority, setNewSchedulePriority] = useState('5');

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schedulesData, contentData, screensData, groupsData, branchesData] = await Promise.all([
        getSchedules(),
        getContent(),
        getScreens(),
        getScreenGroups(),
        getBranches(),
      ]);
      setSchedules(schedulesData);
      setContent(contentData);
      setScreens(screensData);
      setGroups(groupsData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getContentName = (contentId: string) => {
    return content.find(c => c.id === contentId)?.name || 'Unknown';
  };

  const getTargetName = (targetType: string, targetId: string) => {
    switch (targetType) {
      case 'screen':
        return screens.find(s => s.id === targetId)?.name || 'Unknown screen';
      case 'group':
        return groups.find(g => g.id === targetId)?.name || 'Unknown group';
      case 'branch':
        return branches.find(b => b.id === targetId)?.name || 'Unknown branch';
      default:
        return 'Unknown';
    }
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'screen':
        return Monitor;
      case 'group':
        return Layers;
      case 'branch':
        return Building2;
      default:
        return Monitor;
    }
  };

  const getTargetOptions = (targetType: 'screen' | 'group' | 'branch') => {
    switch (targetType) {
      case 'screen':
        return screens.map(s => ({ id: s.id, name: s.name }));
      case 'group':
        return groups.map(g => ({ id: g.id, name: g.name }));
      case 'branch':
        return branches.map(b => ({ id: b.id, name: b.name }));
      default:
        return [];
    }
  };

  const filteredSchedules = schedules.filter(schedule =>
    schedule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = async (scheduleId: string, currentStatus: boolean) => {
    // Optimistic update
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId ? { ...s, isActive: !currentStatus } : s
    ));
    try {
      await toggleSchedule(scheduleId, !currentStatus);
      toast({
        title: 'Updated',
        description: 'Schedule status changed.',
      });
    } catch (error) {
      // Revert on error
      setSchedules(prev => prev.map(s => 
        s.id === scheduleId ? { ...s, isActive: currentStatus } : s
      ));
      toast({
        title: 'Error',
        description: 'Failed to update schedule.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (scheduleId: string) => {
    // Optimistic update
    const previousSchedules = schedules;
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    try {
      await deleteSchedule(scheduleId);
      toast({
        title: 'Deleted',
        description: 'Schedule deleted.',
      });
    } catch (error) {
      // Revert on error
      setSchedules(previousSchedules);
      toast({
        title: 'Error',
        description: 'Failed to delete schedule.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSchedule = async () => {
    if (!newScheduleName || !newScheduleContent || !newScheduleTargetId || !newScheduleStartDate || !newScheduleEndDate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newSchedule = await createSchedule(
        newScheduleName,
        newScheduleContent,
        newScheduleTargetType,
        newScheduleTargetId,
        newScheduleStartDate,
        newScheduleEndDate,
        newScheduleStartTime,
        newScheduleEndTime,
        parseInt(newSchedulePriority)
      );
      setSchedules(prev => [newSchedule, ...prev]);
      setIsAddOpen(false);
      resetForm();
      toast({
        title: 'Created',
        description: 'Schedule created successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create schedule.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSchedule = async () => {
    if (!editingSchedule || !newScheduleName || !newScheduleContent || !newScheduleTargetId || !newScheduleStartDate || !newScheduleEndDate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateSchedule(
        editingSchedule.id,
        newScheduleName,
        newScheduleContent,
        newScheduleTargetType,
        newScheduleTargetId,
        newScheduleStartDate,
        newScheduleEndDate,
        newScheduleStartTime,
        newScheduleEndTime,
        parseInt(newSchedulePriority)
      );
      
      // Update local state
      setSchedules(prev => prev.map(s => 
        s.id === editingSchedule.id 
          ? {
              ...s,
              name: newScheduleName,
              contentId: newScheduleContent,
              targetType: newScheduleTargetType,
              targetId: newScheduleTargetId,
              startDate: new Date(newScheduleStartDate),
              endDate: new Date(newScheduleEndDate),
              startTime: newScheduleStartTime,
              endTime: newScheduleEndTime,
              priority: parseInt(newSchedulePriority),
            }
          : s
      ));
      
      setIsEditOpen(false);
      setEditingSchedule(null);
      resetForm();
      toast({
        title: 'Updated',
        description: 'Schedule updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update schedule.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setNewScheduleName(schedule.name);
    setNewScheduleContent(schedule.contentId);
    setNewScheduleTargetType(schedule.targetType);
    setNewScheduleTargetId(schedule.targetId);
    setNewScheduleStartDate(schedule.startDate.toISOString().split('T')[0]);
    setNewScheduleEndDate(schedule.endDate.toISOString().split('T')[0]);
    setNewScheduleStartTime(schedule.startTime);
    setNewScheduleEndTime(schedule.endTime);
    setNewSchedulePriority(schedule.priority.toString());
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setNewScheduleName('');
    setNewScheduleContent('');
    setNewScheduleTargetType('screen');
    setNewScheduleTargetId('');
    setNewScheduleStartDate('');
    setNewScheduleEndDate('');
    setNewScheduleStartTime('09:00');
    setNewScheduleEndTime('17:00');
    setNewSchedulePriority('5');
  };

  const ScheduleFormFields = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Schedule Name</Label>
        <Input 
          placeholder="e.g., Morning Breakfast Menu" 
          value={newScheduleName}
          onChange={(e) => setNewScheduleName(e.target.value)}
          lang="en"
          dir="ltr"
        />
      </div>
      <div className="space-y-2">
        <Label>Content</Label>
        <Select value={newScheduleContent} onValueChange={setNewScheduleContent}>
          <SelectTrigger>
            <SelectValue placeholder="Select content" />
          </SelectTrigger>
          <SelectContent>
            {content.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target Type</Label>
          <Select value={newScheduleTargetType} onValueChange={(v) => {
            setNewScheduleTargetType(v as 'screen' | 'group' | 'branch');
            setNewScheduleTargetId('');
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="screen">Single Screen</SelectItem>
              <SelectItem value="group">Screen Group</SelectItem>
              <SelectItem value="branch">Branch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Target</Label>
          <Select value={newScheduleTargetId} onValueChange={setNewScheduleTargetId}>
            <SelectTrigger>
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              {getTargetOptions(newScheduleTargetType).map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input 
            type="date" 
            value={newScheduleStartDate}
            onChange={(e) => setNewScheduleStartDate(e.target.value)}
            lang="en"
            dir="ltr"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input 
            type="date" 
            value={newScheduleEndDate}
            onChange={(e) => setNewScheduleEndDate(e.target.value)}
            lang="en"
            dir="ltr"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input 
            type="time" 
            value={newScheduleStartTime}
            onChange={(e) => setNewScheduleStartTime(e.target.value)}
            lang="en"
            dir="ltr"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input 
            type="time" 
            value={newScheduleEndTime}
            onChange={(e) => setNewScheduleEndTime(e.target.value)}
            lang="en"
            dir="ltr"
            className="[&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Priority (1-10)</Label>
        <Input 
          type="number" 
          min={1} 
          max={10} 
          value={newSchedulePriority}
          onChange={(e) => setNewSchedulePriority(e.target.value)}
          lang="en"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">
          Higher priority schedules override lower priority ones.
        </p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Schedules</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage content display schedules
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Schedule</DialogTitle>
                <DialogDescription>
                  Schedule content to display at specific times.
                </DialogDescription>
              </DialogHeader>
              <ScheduleFormFields />
              <Button className="w-full" onClick={handleCreateSchedule} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Schedule
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schedules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" dir="ltr">{schedules.length}</p>
              <p className="text-sm text-muted-foreground">Total Schedules</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/20">
              <Play className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" dir="ltr">
                {schedules.filter(s => s.isActive).length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Pause className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" dir="ltr">
                {schedules.filter(s => !s.isActive).length}
              </p>
              <p className="text-sm text-muted-foreground">Paused</p>
            </div>
          </div>
        </div>

        {/* Schedules List */}
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12 stat-card">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No schedules found</h3>
            <p className="text-muted-foreground mt-1">
              Create your first schedule to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchedules.map((schedule) => {
              const TargetIcon = getTargetIcon(schedule.targetType);
              
              return (
                <div
                  key={schedule.id}
                  className={cn(
                    "stat-card flex flex-col sm:flex-row sm:items-center gap-4",
                    !schedule.isActive && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-lg",
                      schedule.isActive ? "bg-success/20" : "bg-muted"
                    )}>
                      <Calendar className={cn(
                        "h-6 w-6",
                        schedule.isActive ? "text-success" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{schedule.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Content: {getContentName(schedule.contentId)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div className="flex items-center gap-2">
                      <TargetIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {getTargetName(schedule.targetType, schedule.targetId)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground" dir="ltr">
                        {formatDateEN(schedule.startDate)} - {formatDateEN(schedule.endDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground" dir="ltr">
                        {formatTimeEN(schedule.startTime)} - {formatTimeEN(schedule.endTime)}
                      </span>
                    </div>

                    <Badge variant="secondary" dir="ltr">
                      Priority: {schedule.priority}
                    </Badge>

                    <Badge 
                      variant={schedule.isActive ? "default" : "secondary"}
                      className={schedule.isActive ? "bg-success/20 text-success border-success/30" : ""}
                    >
                      {schedule.isActive ? "Active" : "Paused"}
                    </Badge>

                    <Switch
                      checked={schedule.isActive}
                      onCheckedChange={() => handleToggle(schedule.id, schedule.isActive)}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(schedule)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingSchedule(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
              <DialogDescription>
                Update the schedule settings.
              </DialogDescription>
            </DialogHeader>
            <ScheduleFormFields />
            <Button className="w-full" onClick={handleEditSchedule} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
