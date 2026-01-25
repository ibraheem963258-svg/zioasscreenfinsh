import { useState } from 'react';
import {
  Calendar,
  Plus,
  Search,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Pause,
  Monitor,
  Layers,
  Building2
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { mockSchedules, mockContent, mockScreens, mockGroups, mockBranches } from '@/lib/mock-data';
import { Schedule } from '@/lib/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>(mockSchedules);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const getContentName = (contentId: string) => {
    return mockContent.find(c => c.id === contentId)?.name || 'Unknown';
  };

  const getTargetName = (targetType: string, targetId: string) => {
    switch (targetType) {
      case 'screen':
        return mockScreens.find(s => s.id === targetId)?.name || 'Unknown Screen';
      case 'group':
        return mockGroups.find(g => g.id === targetId)?.name || 'Unknown Group';
      case 'branch':
        return mockBranches.find(b => b.id === targetId)?.name || 'Unknown Branch';
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

  const filteredSchedules = schedules.filter(schedule =>
    schedule.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (scheduleId: string) => {
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId ? { ...s, isActive: !s.isActive } : s
    ));
    toast({
      title: 'Schedule updated',
      description: 'Schedule status has been changed.',
    });
  };

  const handleDelete = (scheduleId: string) => {
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    toast({
      title: 'Schedule deleted',
      description: 'The schedule has been removed.',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Schedules</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage content schedules for your screens
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
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Schedule Name</Label>
                  <Input placeholder="e.g., Morning Breakfast Menu" />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select content" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockContent.map(content => (
                        <SelectItem key={content.id} value={content.id}>
                          {content.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Type</Label>
                    <Select>
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
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockScreens.map(screen => (
                          <SelectItem key={screen.id} value={screen.id}>
                            {screen.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" defaultValue="09:00" />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" defaultValue="17:00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Priority (1-10)</Label>
                  <Input type="number" min={1} max={10} defaultValue={5} />
                  <p className="text-xs text-muted-foreground">
                    Higher priority schedules override lower ones during overlapping times.
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={() => {
                setIsAddOpen(false);
                toast({ title: 'Schedule created', description: 'Your new schedule has been created.' });
              }}>
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
              <p className="text-2xl font-bold text-foreground">{schedules.length}</p>
              <p className="text-sm text-muted-foreground">Total Schedules</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/20">
              <Play className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
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
              <p className="text-2xl font-bold text-foreground">
                {schedules.filter(s => !s.isActive).length}
              </p>
              <p className="text-sm text-muted-foreground">Paused</p>
            </div>
          </div>
        </div>

        {/* Schedules List */}
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
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {schedule.startTime} - {schedule.endTime}
                    </span>
                  </div>

                  <Badge variant="secondary">
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
                    onCheckedChange={() => handleToggle(schedule.id)}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
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

        {filteredSchedules.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No schedules found</h3>
            <p className="text-muted-foreground mt-1">
              Create your first schedule to get started.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
