import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function StatCard({ title, value, icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn(
            "mt-2 text-3xl font-bold",
            variant === 'success' && 'text-success',
            variant === 'warning' && 'text-warning',
            variant === 'danger' && 'text-destructive',
            variant === 'default' && 'text-foreground'
          )}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              "mt-1 text-sm",
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}% from last month
            </p>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
          variant === 'success' && 'bg-success/10 text-success',
          variant === 'warning' && 'bg-warning/10 text-warning',
          variant === 'danger' && 'bg-destructive/10 text-destructive',
          variant === 'default' && 'bg-primary/10 text-primary'
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
