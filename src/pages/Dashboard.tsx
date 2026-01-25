import { Monitor, Building2, Layers, FolderOpen, Calendar, Wifi, WifiOff } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ScreenStatusList } from '@/components/dashboard/ScreenStatusList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { mockStats, mockScreens, mockBranches } from '@/lib/mock-data';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your digital signage network.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Screens"
            value={mockStats.totalScreens}
            icon={<Monitor className="h-6 w-6" />}
          />
          <StatCard
            title="Online Screens"
            value={mockStats.onlineScreens}
            icon={<Wifi className="h-6 w-6" />}
            variant="success"
          />
          <StatCard
            title="Offline Screens"
            value={mockStats.offlineScreens}
            icon={<WifiOff className="h-6 w-6" />}
            variant="danger"
          />
          <StatCard
            title="Active Schedules"
            value={mockStats.activeSchedules}
            icon={<Calendar className="h-6 w-6" />}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Branches"
            value={mockStats.totalBranches}
            icon={<Building2 className="h-6 w-6" />}
          />
          <StatCard
            title="Screen Groups"
            value={mockStats.totalGroups}
            icon={<Layers className="h-6 w-6" />}
          />
          <StatCard
            title="Content Items"
            value={mockStats.totalContent}
            icon={<FolderOpen className="h-6 w-6" />}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ScreenStatusList screens={mockScreens} branches={mockBranches} />
          </div>
          <div className="space-y-6">
            <QuickActions />
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
