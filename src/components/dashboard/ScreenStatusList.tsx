import { Monitor, Wifi, WifiOff } from 'lucide-react';
import { Screen, Branch } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ScreenStatusListProps {
  screens: Screen[];
  branches: Branch[];
}

export function ScreenStatusList({ screens, branches }: ScreenStatusListProps) {
  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || 'Unknown';
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Screen Status</h3>
        <span className="text-sm text-muted-foreground">{screens.length} screens</span>
      </div>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {screens.map((screen) => (
          <div
            key={screen.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              screen.status === 'online' ? 'bg-success/20' : 'bg-destructive/20'
            )}>
              <Monitor className={cn(
                "h-5 w-5",
                screen.status === 'online' ? 'text-success' : 'text-destructive'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{screen.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {getBranchName(screen.branchId)} • {screen.resolution}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {screen.status === 'online' ? (
                <Wifi className="h-4 w-4 text-success" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                screen.status === 'online' ? 'status-online' : 'status-offline'
              )}>
                {screen.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
