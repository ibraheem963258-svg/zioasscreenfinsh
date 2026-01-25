import { useState, useEffect } from 'react';
import {
  Upload,
  Image,
  Video,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Trash2,
  Link,
  Clock,
  HardDrive,
  Loader2
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  getContent, 
  createContent, 
  deleteContent, 
  assignContent,
  getScreens,
  getScreenGroups,
  getBranches
} from '@/lib/api';
import { ContentItem, Screen, ScreenGroup, Branch } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Content() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [groups, setGroups] = useState<ScreenGroup[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [newContentName, setNewContentName] = useState('');
  const [newContentUrl, setNewContentUrl] = useState('');
  const [newContentType, setNewContentType] = useState<'image' | 'video'>('image');
  const [newContentDuration, setNewContentDuration] = useState('10');
  
  const [assignTargetType, setAssignTargetType] = useState<'screen' | 'group' | 'branch'>('screen');
  const [assignTargetId, setAssignTargetId] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contentData, screensData, groupsData, branchesData] = await Promise.all([
        getContent(),
        getScreens(),
        getScreenGroups(),
        getBranches(),
      ]);
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

  const filteredContent = content.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (contentId: string) => {
    try {
      await deleteContent(contentId);
      setContent(prev => prev.filter(c => c.id !== contentId));
      toast({
        title: 'Deleted',
        description: 'Content deleted successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete content.',
        variant: 'destructive',
      });
    }
  };

  const handleAssign = (contentItem: ContentItem) => {
    setSelectedContent(contentItem);
    setIsAssignOpen(true);
  };

  const handleCreateContent = async () => {
    if (!newContentName || !newContentUrl) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newContent = await createContent(
        newContentName,
        newContentType,
        newContentUrl,
        newContentUrl,
        parseInt(newContentDuration),
        0
      );
      setContent(prev => [newContent, ...prev]);
      setIsUploadOpen(false);
      setNewContentName('');
      setNewContentUrl('');
      setNewContentType('image');
      setNewContentDuration('10');
      toast({
        title: 'Created',
        description: 'Content added successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create content.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignContent = async () => {
    if (!selectedContent || !assignTargetId) {
      toast({
        title: 'Error',
        description: 'Please select a target.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await assignContent(selectedContent.id, assignTargetType, assignTargetId);
      setIsAssignOpen(false);
      setAssignTargetId('');
      toast({
        title: 'Assigned',
        description: 'Content assigned successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign content.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTargetOptions = () => {
    switch (assignTargetType) {
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
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
            <h1 className="text-3xl font-bold text-foreground">Content Library</h1>
            <p className="text-muted-foreground mt-1">
              Manage your digital signage content
            </p>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Add Content
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Content</DialogTitle>
                <DialogDescription>
                  Add new images or videos to your content library.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Content Name</Label>
                  <Input 
                    placeholder="e.g., Summer Promo" 
                    value={newContentName}
                    onChange={(e) => setNewContentName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <Select value={newContentType} onValueChange={(v) => setNewContentType(v as 'image' | 'video')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Content URL</Label>
                  <Input 
                    placeholder="https://example.com/image.jpg" 
                    value={newContentUrl}
                    onChange={(e) => setNewContentUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Duration (seconds)</Label>
                  <Input 
                    type="number" 
                    value={newContentDuration}
                    onChange={(e) => setNewContentDuration(e.target.value)}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateContent} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Content
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
              <Image className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {content.filter(c => c.type === 'image').length}
              </p>
              <p className="text-sm text-muted-foreground">Images</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/20">
              <Video className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {content.filter(c => c.type === 'video').length}
              </p>
              <p className="text-sm text-muted-foreground">Videos</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/20">
              <HardDrive className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatFileSize(content.reduce((acc, c) => acc + c.fileSize, 0))}
              </p>
              <p className="text-sm text-muted-foreground">Total Size</p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {filteredContent.length === 0 ? (
          <div className="text-center py-12 stat-card">
            <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No content found</h3>
            <p className="text-muted-foreground mt-1">
              Add your first content to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredContent.map((item) => (
              <div key={item.id} className="stat-card group overflow-hidden">
                {/* Thumbnail */}
                <div className="relative aspect-video rounded-lg overflow-hidden mb-4 bg-secondary">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                      {item.type === 'image' ? (
                        <Image className="h-3 w-3 mr-1" />
                      ) : (
                        <Video className="h-3 w-3 mr-1" />
                      )}
                      {item.type === 'image' ? 'Image' : 'Video'}
                    </Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-foreground truncate flex-1">{item.name}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAssign(item)}>
                          <Link className="h-4 w-4 mr-2" />
                          Assign to Screen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.duration}s
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatFileSize(item.fileSize)}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Uploaded {formatDistanceToNow(item.uploadedAt, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assign Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Content</DialogTitle>
              <DialogDescription>
                Assign "{selectedContent?.name}" to screens, groups, or branches.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={assignTargetType} onValueChange={(v) => {
                  setAssignTargetType(v as 'screen' | 'group' | 'branch');
                  setAssignTargetId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screen">Single Screen</SelectItem>
                    <SelectItem value="group">Screen Group</SelectItem>
                    <SelectItem value="branch">All Branch Screens</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Target</Label>
                <Select value={assignTargetId} onValueChange={setAssignTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getTargetOptions().map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleAssignContent} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Assign Content
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
