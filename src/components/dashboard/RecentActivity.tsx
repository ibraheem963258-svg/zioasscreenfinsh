import { Activity, Monitor, Upload, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'screen' | 'content' | 'schedule';
  action: string;
  target: string;
  timestamp: Date;
}

const mockActivity: ActivityItem[] = [
  { id: '1', type: 'screen', action: 'came online', target: 'Main Entrance Display', timestamp: new Date(Date.now() - 300000) },
  { id: '2', type: 'content', action: 'uploaded', target: 'Summer Menu 2024', timestamp: new Date(Date.now() - 900000) },
  { id: '3', type: 'schedule', action: 'activated', target: 'Morning Breakfast Menu', timestamp: new Date(Date.now() - 1800000) },
  { id: '4', type: 'screen', action: 'went offline', target: 'Window Display', timestamp: new Date(Date.now() - 3600000) },
  { id: '5', type: 'content', action: 'assigned to', target: 'Gate B1 Info', timestamp: new Date(Date.now() - 7200000) },
];

const iconMap = {
  screen: Monitor,
  content: Upload,
  schedule: Calendar,
};

const colorMap = {
  screen: 'bg-primary/20 text-primary',
  content: 'bg-success/20 text-success',
  schedule: 'bg-warning/20 text-warning',
};

export function RecentActivity() {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
      </div>
      <div className="space-y-4">
        {mockActivity.map((item) => {
          const Icon = iconMap[item.type];
          return (
            <div key={item.id} className="flex items-start gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[item.type]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{item.target}</span>{' '}
                  <span className="text-muted-foreground">{item.action}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
