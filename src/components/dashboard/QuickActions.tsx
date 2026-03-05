import { Link } from 'react-router-dom';
import { Plus, Upload, Monitor, ListVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <div className="stat-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" className="w-full justify-start gap-2 h-auto py-3" asChild>
          <Link to="/screens">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Monitor className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Add Screen</p>
              <p className="text-xs text-muted-foreground">Create new display</p>
            </div>
          </Link>
        </Button>
        <Button variant="secondary" className="w-full justify-start gap-2 h-auto py-3" asChild>
          <Link to="/content">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20">
              <Upload className="h-4 w-4 text-success" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Upload Content</p>
              <p className="text-xs text-muted-foreground">Add media files</p>
            </div>
          </Link>
        </Button>
        <Button variant="secondary" className="w-full justify-start gap-2 h-auto py-3" asChild>
          <Link to="/playlists">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20">
              <ListVideo className="h-4 w-4 text-warning" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">New Playlist</p>
              <p className="text-xs text-muted-foreground">Create playlist</p>
            </div>
          </Link>
        </Button>
        <Button variant="secondary" className="w-full justify-start gap-2 h-auto py-3" asChild>
          <Link to="/screens">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">Add Branch</p>
              <p className="text-xs text-muted-foreground">New location</p>
            </div>
          </Link>
        </Button>
      </div>
    </div>
  );
}
