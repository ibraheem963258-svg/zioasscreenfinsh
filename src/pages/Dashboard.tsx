import { useEffect, useState, useCallback } from 'react';
import { Monitor, Building2, Layers, FolderOpen, Calendar, Wifi, WifiOff, CirclePause, ListMusic } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ScreenStatusList } from '@/components/dashboard/ScreenStatusList';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { supabase } from '@/integrations/supabase/client';
import { getDashboardStats, getScreens, getBranches } from '@/lib/api';
import { DashboardStats, Screen, Branch } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// Recompute a screen's status based on heartbeat time (client-side mirror of DB logic)
function computeScreenStatus(s: Screen): Screen['status'] {
  const minutesSince = s.lastHeartbeat
    ? (Date.now() - s.lastHeartbeat.getTime()) / 60000
    : Infinity;
  if (minutesSince > 2) return 'offline';
  if (!s.isPlaying || !s.currentPlaylistId) return 'idle';
  return 'online';
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, screensData, branchesData] = await Promise.all([
        getDashboardStats(),
        getScreens(),
        getBranches(),
      ]);
      setStats(statsData);
      setScreens(screensData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // ── Realtime: react immediately when a screen row changes ──
    const channel = supabase
      .channel('dashboard-screens-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'screens' },
        (payload) => {
          const updated = payload.new as any;
          setScreens(prev =>
            prev.map(s => {
              if (s.id !== updated.id) return s;
              const next: Screen = {
                ...s,
                status: updated.status as Screen['status'],
                isPlaying: updated.is_playing ?? true,
                isActive: updated.is_active ?? true,
                lastHeartbeat: updated.last_heartbeat ? new Date(updated.last_heartbeat) : null,
                lastUpdated: new Date(updated.updated_at),
                currentPlaylistId: updated.current_playlist_id,
              };
              // Override with locally-computed status (catches stale "online" in DB)
              return { ...next, status: computeScreenStatus(next) };
            })
          );
          // Refresh stats counts
          getDashboardStats().then(setStats).catch(console.error);
        }
      )
      .subscribe();

    // ── Periodic local recompute every 30s (catches tabs closed / power off) ──
    const statusInterval = setInterval(() => {
      setScreens(prev => prev.map(s => ({ ...s, status: computeScreenStatus(s) })));
      getDashboardStats().then(setStats).catch(console.error);
    }, 30 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(statusInterval);
    };
  }, [fetchData]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-96 mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome! Here's an overview of your digital signage network.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Screens"
            value={stats?.totalScreens || 0}
            icon={<Monitor className="h-6 w-6" />}
          />
          <StatCard
            title="Online"
            value={stats?.onlineScreens || 0}
            icon={<Wifi className="h-6 w-6" />}
            variant="success"
          />
          <StatCard
            title="Idle"
            value={stats?.idleScreens || 0}
            icon={<CirclePause className="h-6 w-6" />}
            variant="warning"
          />
          <StatCard
            title="Offline"
            value={stats?.offlineScreens || 0}
            icon={<WifiOff className="h-6 w-6" />}
            variant="danger"
          />
          <StatCard
            title="Active Playlists"
            value={stats?.activePlaylists || 0}
            icon={<ListMusic className="h-6 w-6" />}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Branches"
            value={stats?.totalBranches || 0}
            icon={<Building2 className="h-6 w-6" />}
          />
          <StatCard
            title="Screen Groups"
            value={stats?.totalGroups || 0}
            icon={<Layers className="h-6 w-6" />}
          />
          <StatCard
            title="Content Items"
            value={stats?.totalContent || 0}
            icon={<FolderOpen className="h-6 w-6" />}
          />
          <StatCard
            title="Active Schedules"
            value={stats?.activeSchedules || 0}
            icon={<Calendar className="h-6 w-6" />}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ScreenStatusList screens={screens} branches={branches} />
          </div>
          <div className="space-y-6">
            <QuickActions />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
