import { useState } from 'react';
import {
  Upload,
  Image,
  Video,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  Link,
  Download,
  Clock,
  HardDrive
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { mockContent, mockScreens, mockGroups, mockBranches } from '@/lib/mock-data';
import { ContentItem } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Content() {
  const [content, setContent] = useState<ContentItem[]>(mockContent);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const { toast } = useToast();

  const filteredContent = content.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = (contentId: string) => {
    setContent(prev => prev.filter(c => c.id !== contentId));
    toast({
      title: 'Content deleted',
      description: 'The content has been removed successfully.',
    });
  };

  const handleAssign = (contentItem: ContentItem) => {
    setSelectedContent(contentItem);
    setIsAssignOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Content Library</h1>
            <p className="text-muted-foreground mt-1">
              Upload and manage your digital signage content
            </p>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Content
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Content</DialogTitle>
                <DialogDescription>
                  Add new images or videos to your content library.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports: JPG, PNG, MP4, WebM (Max 100MB)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Content Name</Label>
                  <Input placeholder="e.g., Summer Promo Banner" />
                </div>
                <div className="space-y-2">
                  <Label>Display Duration (seconds)</Label>
                  <Input type="number" placeholder="10" defaultValue={10} />
                </div>
              </div>
              <Button className="w-full" onClick={() => {
                setIsUploadOpen(false);
                toast({ title: 'Content uploaded', description: 'Your content has been added to the library.' });
              }}>
                Upload
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredContent.map((item) => (
            <div
              key={item.id}
              className="stat-card group overflow-hidden"
            >
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
                    {item.type}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="secondary" size="sm" className="mr-2">
                    <Eye className="h-4 w-4" />
                  </Button>
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
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
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
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screen">Single Screen</SelectItem>
                    <SelectItem value="group">Screen Group</SelectItem>
                    <SelectItem value="branch">All Screens in Branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Target</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose..." />
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
            <Button className="w-full" onClick={() => {
              setIsAssignOpen(false);
              toast({ title: 'Content assigned', description: 'Content has been assigned successfully.' });
            }}>
              Assign Content
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
