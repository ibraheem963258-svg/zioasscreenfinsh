import { Monitor, Wifi, WifiOff, CirclePause, Clock } from 'lucide-react';
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

  const getStatusConfig = (status: Screen['status']) => {
    switch (status) {
      case 'online':
        return {
          bgColor: 'bg-success/20',
          textColor: 'text-success',
          icon: Wifi,
          label: 'Online',
          badgeClass: 'status-online',
        };
      case 'idle':
        return {
          bgColor: 'bg-warning/20',
          textColor: 'text-warning',
          icon: CirclePause,
          label: 'Idle',
          badgeClass: 'bg-warning/20 text-warning',
        };
      case 'offline':
      default:
        return {
          bgColor: 'bg-destructive/20',
          textColor: 'text-destructive',
          icon: WifiOff,
          label: 'Offline',
          badgeClass: 'status-offline',
        };
    }
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Screen Status</h3>
        <span className="text-sm text-muted-foreground">{screens.length} screens</span>
      </div>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {screens.map((screen) => {
          const statusConfig = getStatusConfig(screen.status);
          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={screen.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                statusConfig.bgColor
              )}>
                <Monitor className={cn("h-5 w-5", statusConfig.textColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{screen.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getBranchName(screen.branchId)} • {screen.resolution}
                </p>
                {screen.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    Last ping: {formatDistanceToNow(screen.lastHeartbeat, { addSuffix: true })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-4 w-4", statusConfig.textColor)} />
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full capitalize",
                  statusConfig.badgeClass
                )}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
