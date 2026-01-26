/**
 * ======================================
 * صفحة عرض الشاشة
 * Display Page
 * ======================================
 * 
 * الوظائف:
 *   - عرض المحتوى على الشاشات الخارجية (TV, Android TV, Smart TV)
 *   - دعم البث المباشر (HLS/m3u8) مع أولوية على Playlist
 *   - ملء الشاشة التلقائي
 *   - إعادة الاتصال الذكية بدون reload
 *   - تحديث المحتوى في الوقت الفعلي
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { updateScreenStatus } from '@/lib/api';
import { getActivePlaylistForScreen, getEffectiveDisplaySettings } from '@/lib/api/index';
import { supabase } from '@/integrations/supabase/client';
import { Screen, ContentItem, Playlist, DisplaySettings } from '@/lib/types';
import { ContentRenderer } from '@/components/display/ContentRenderer';
import { LiveStreamRenderer } from '@/components/display/LiveStreamRenderer';
import { LoadingScreen } from '@/components/display/LoadingScreen';
import { ErrorScreen } from '@/components/display/ErrorScreen';
import { IdleScreen } from '@/components/display/IdleScreen';
import { PausedScreen } from '@/components/display/PausedScreen';
import { PlaylistTransition } from '@/components/display/PlaylistTransition';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useReconnection, ConnectionStatus } from '@/hooks/useReconnection';

// ======================================
// مكون حالة الاتصال
// Connection Status Component
// ======================================
function ConnectionStatusIndicator({ 
  status, 
  attempts 
}: { 
  status: ConnectionStatus; 
  attempts: number;
}) {
  // إخفاء المكون إذا كان متصل
  if (status === 'connected') return null;
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border">
      {status === 'reconnecting' && (
        <>
          <div className="w-3 h-3 bg-warning rounded-full animate-pulse" />
          <span className="text-sm text-warning">
            جاري إعادة الاتصال... ({attempts})
          </span>
        </>
      )}
      {status === 'disconnected' && (
        <>
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span className="text-sm text-destructive">غير متصل</span>
        </>
      )}
      {status === 'failed' && (
        <>
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span className="text-sm text-destructive">فشل الاتصال - جاري إعادة التحميل</span>
        </>
      )}
    </div>
  );
}

// ======================================
// المكون الرئيسي
// Main Component
// ======================================
export default function Display() {
  const { slug } = useParams<{ slug: string }>();
  
  // ======================================
  // الحالات الرئيسية
  // Main States
  // ======================================
  const [screen, setScreen] = useState<Screen | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ======================================
  // حالات البث المباشر
  // Live Stream States
  // ======================================
  const [liveStreamUrl, setLiveStreamUrl] = useState<string | null>(null);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(false);

  // ======================================
  // حالات الانتقال بين Playlists
  // Playlist Transition States
  // ======================================
  const [isPlaylistTransitioning, setIsPlaylistTransitioning] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const pendingPlaylistRef = useRef<{ playlist: Playlist | null; content: ContentItem[] } | null>(null);
  const currentPlaylistIdRef = useRef<string | null>(null);
  
  // ======================================
  // مراجع القنوات
  // Channel Refs
  // ======================================
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ======================================
  // استخدام Hooks المخصصة
  // Custom Hooks
  // ======================================
  const { enterFullscreen } = useFullscreen();

  // ======================================
  // مزامنة مرجع Playlist ID
  // Sync Playlist ID Ref
  // ======================================
  useEffect(() => {
    currentPlaylistIdRef.current = playlist?.id || null;
  }, [playlist?.id]);

  // ======================================
  // جلب بيانات الشاشة والمحتوى
  // Fetch Screen and Content Data
  // ======================================
  const fetchData = useCallback(async () => {
    if (!slug) return;

    try {
      // جلب الشاشة بواسطة الـ slug
      const { data: screenData, error: screenError } = await supabase
        .from('screens')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (screenError) throw screenError;
      if (!screenData) {
        setScreen(null);
        setError('الشاشة غير موجودة');
        setIsLoading(false);
        return;
      }

      // جلب مجموعات الشاشة
      const { data: groupAssignments } = await supabase
        .from('screen_group_assignments')
        .select('group_id')
        .eq('screen_id', screenData.id);

      const groupIds = groupAssignments?.map(a => a.group_id) || [];

      // بناء كائن الشاشة
      const screenObj: Screen = {
        id: screenData.id,
        name: screenData.name,
        slug: screenData.slug,
        branchId: screenData.branch_id,
        groupIds,
        orientation: screenData.orientation as 'landscape' | 'portrait',
        resolution: screenData.resolution,
        status: screenData.status as 'online' | 'offline' | 'idle',
        isPlaying: screenData.is_playing ?? true,
        lastHeartbeat: screenData.last_heartbeat ? new Date(screenData.last_heartbeat) : null,
        lastUpdated: new Date(screenData.updated_at),
        contentIds: [],
        currentPlaylistId: screenData.current_playlist_id,
        // حقول البث المباشر
        liveStreamUrl: (screenData as any).live_stream_url || null,
        liveStreamEnabled: (screenData as any).live_stream_enabled || false,
      };

      setScreen(screenObj);
      setIsPlaying(screenObj.isPlaying);
      
      // تحديث حالة البث المباشر
      setLiveStreamUrl(screenObj.liveStreamUrl || null);
      setLiveStreamEnabled(screenObj.liveStreamEnabled || false);

      // تحديث حالة الشاشة إلى online
      await updateScreenStatus(screenData.id, 'online');

      // جلب Playlist النشطة والمحتوى (فقط إذا كان البث المباشر غير مفعل)
      if (!screenObj.liveStreamEnabled) {
        const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screenData.id);
        setPlaylist(activePlaylist);
        setContent(playlistContent);

        // تحديث current_playlist_id للشاشة
        if (activePlaylist) {
          await supabase
            .from('screens')
            .update({ current_playlist_id: activePlaylist.id })
            .eq('id', screenData.id);
        }
      }

      // جلب إعدادات العرض
      const effectiveSettings = await getEffectiveDisplaySettings(
        screenData.id,
        groupIds,
        screenData.branch_id
      );
      setSettings(effectiveSettings);

    } catch (err) {
      console.error('خطأ في جلب البيانات:', err);
      setError('فشل في تحميل المحتوى');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // ======================================
  // إعداد إعادة الاتصال الذكية
  // Setup Smart Reconnection
  // ======================================
  const { status: connectionStatus, attempts, resetAttempts } = useReconnection({
    maxAttempts: 15,
    onReconnect: async () => {
      await fetchData();
      setupRealtimeSubscription();
    },
    onDisconnect: () => {
      console.log('تم قطع الاتصال - سيتم إعادة المحاولة تلقائياً');
    },
  });

  // ======================================
  // إعداد الاشتراك في الوقت الفعلي
  // Setup Realtime Subscription
  // ======================================
  const setupRealtimeSubscription = useCallback(() => {
    if (!screen?.id) return;

    // إزالة القناة القديمة إن وجدت
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // ======================================
    // دالة التحديث السريع
    // Quick Refresh Function
    // ======================================
    const quickRefresh = async (showTransition = true) => {
      try {
        console.log('تحديث سريع للمحتوى...');
        
        // التحقق من البث المباشر أولاً
        const { data: screenData } = await supabase
          .from('screens')
          .select('live_stream_url, live_stream_enabled, is_playing')
          .eq('id', screen.id)
          .single();

        if (screenData) {
          setLiveStreamUrl((screenData as any).live_stream_url || null);
          setLiveStreamEnabled((screenData as any).live_stream_enabled || false);
          setIsPlaying(screenData.is_playing ?? true);
          
          // إذا كان البث المباشر مفعل، لا نحتاج تحديث Playlist
          if ((screenData as any).live_stream_enabled) {
            return;
          }
        }

        // جلب Playlist النشطة
        const { playlist: activePlaylist, content: playlistContent } = await getActivePlaylistForScreen(screen.id);
        
        // التحقق من تغيير Playlist
        const playlistChanged = activePlaylist?.id !== currentPlaylistIdRef.current;
        
        console.log('تغير Playlist:', playlistChanged, 'جديد:', activePlaylist?.id, 'حالي:', currentPlaylistIdRef.current);
        
        if (playlistChanged && showTransition && activePlaylist) {
          // عرض انتقال Playlist
          pendingPlaylistRef.current = { playlist: activePlaylist, content: playlistContent };
          setNewPlaylistName(activePlaylist.name);
          setIsPlaylistTransitioning(true);
        } else if (playlistChanged) {
          // تحديث مباشر بدون انتقال
          setPlaylist(activePlaylist);
          setContent(playlistContent);
        } else {
          // نفس Playlist - تحديث المحتوى فقط
          setContent(playlistContent);
        }
      } catch (err) {
        console.error('فشل التحديث السريع:', err);
      }
    };

    // ======================================
    // إنشاء قناة الاشتراك
    // Create Subscription Channel
    // ======================================
    const channel = supabase
      .channel(`display-${screen.id}-realtime-${Date.now()}`)
      // تحديثات الشاشة (تشغيل/إيقاف، البث المباشر)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `id=eq.${screen.id}`,
        },
        (payload) => {
          console.log('تحديث الشاشة:', payload.new);
          const updated = payload.new as any;
          
          // تحديث حالة التشغيل
          setIsPlaying(updated.is_playing ?? true);
          
          // تحديث البث المباشر
          setLiveStreamUrl(updated.live_stream_url || null);
          setLiveStreamEnabled(updated.live_stream_enabled || false);
          
          // تحديث Playlist إذا تغيرت
          if (updated.current_playlist_id !== playlist?.id) {
            quickRefresh();
          }
        }
      )
      // تغييرات Playlists
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlists' },
        () => {
          console.log('تغيير في Playlists');
          quickRefresh();
        }
      )
      // تغييرات عناصر Playlist
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_items' },
        () => {
          console.log('تغيير في عناصر Playlist');
          quickRefresh();
        }
      )
      // تغييرات إعدادات العرض
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'display_settings' },
        () => {
          console.log('تغيير في إعدادات العرض');
          fetchData();
        }
      )
      // تغييرات المحتوى
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content' },
        () => {
          console.log('تغيير في المحتوى');
          quickRefresh();
        }
      )
      .subscribe((status, err) => {
        console.log('حالة الاشتراك:', status);
        
        if (status === 'SUBSCRIBED') {
          resetAttempts();
        }
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('خطأ في القناة:', err);
        }
      });

    channelRef.current = channel;
  }, [screen?.id, playlist?.id, fetchData, resetAttempts]);

  // ======================================
  // الجلب الأولي
  // Initial Fetch
  // ======================================
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ======================================
  // إعداد الاشتراك عند تحميل الشاشة
  // Setup subscription when screen loads
  // ======================================
  useEffect(() => {
    if (screen?.id) {
      setupRealtimeSubscription();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [screen?.id, setupRealtimeSubscription]);

  // ======================================
  // آلية Heartbeat
  // Heartbeat Mechanism
  // ======================================
  useEffect(() => {
    if (!screen?.id) return;

    const heartbeat = async () => {
      if (!navigator.onLine) return;
      
      try {
        await updateScreenStatus(screen.id, 'online');
      } catch (err) {
        console.error('فشل Heartbeat:', err);
      }
    };

    // إرسال heartbeat كل 30 ثانية
    const interval = setInterval(heartbeat, 30000);
    return () => clearInterval(interval);
  }, [screen?.id]);

  // ======================================
  // تفعيل ملء الشاشة
  // Enter Fullscreen
  // ======================================
  useEffect(() => {
    // محاولة تفعيل ملء الشاشة بعد ثانية
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 1000);
    return () => clearTimeout(timer);
  }, [enterFullscreen]);

  // ======================================
  // إعادة التحميل الدورية للاستقرار (كل ساعة بدلاً من 30 دقيقة)
  // Periodic Reload for Stability (every hour instead of 30 minutes)
  // ======================================
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      window.location.reload();
    }, 60 * 60 * 1000); // ساعة واحدة

    return () => clearInterval(refreshInterval);
  }, []);

  // ======================================
  // معالج انتهاء انتقال Playlist
  // Handle Playlist Transition End
  // ======================================
  const handleTransitionEnd = useCallback(() => {
    if (pendingPlaylistRef.current) {
      setPlaylist(pendingPlaylistRef.current.playlist);
      setContent(pendingPlaylistRef.current.content);
      pendingPlaylistRef.current = null;
    }
    setIsPlaylistTransitioning(false);
  }, []);

  // ======================================
  // حالات العرض المختلفة
  // Different Display States
  // ======================================
  
  // حالة التحميل
  if (isLoading) {
    return <LoadingScreen message="جاري تحميل المحتوى..." />;
  }

  // الشاشة غير موجودة
  if (!screen) {
    return (
      <ErrorScreen
        title="الشاشة غير موجودة"
        message={`لا توجد شاشة بالمعرّف: ${slug}`}
      />
    );
  }

  // خطأ وعدم وجود محتوى
  if (error && !content.length && !liveStreamEnabled) {
    return (
      <ErrorScreen
        title="خطأ"
        message={error}
        showRetry
        onRetry={() => {
          setError(null);
          setIsLoading(true);
          fetchData();
        }}
      />
    );
  }

  // الشاشة متوقفة
  if (!isPlaying) {
    return <PausedScreen screenName={screen.name} />;
  }

  // لا يوجد محتوى ولا بث مباشر
  if (!liveStreamEnabled && (!playlist || content.length === 0)) {
    return <IdleScreen screenName={screen.name} />;
  }

  // انتظار الإعدادات
  if (!settings) {
    return <LoadingScreen message="جاري تحميل الإعدادات..." />;
  }

  // ======================================
  // العرض الرئيسي
  // Main Render
  // ======================================
  return (
    <div className="display-fullscreen">
      {/* مؤشر حالة الاتصال */}
      <ConnectionStatusIndicator status={connectionStatus} attempts={attempts} />
      
      {/* انتقال Playlist */}
      <PlaylistTransition 
        isTransitioning={isPlaylistTransitioning}
        playlistName={newPlaylistName}
        onTransitionEnd={handleTransitionEnd}
      />
      
      {/* 
        ======================================
        البث المباشر له الأولوية على Playlist
        Live Stream has priority over Playlist
        ======================================
      */}
      {liveStreamEnabled && liveStreamUrl ? (
        <LiveStreamRenderer
          streamUrl={liveStreamUrl}
          contentScaling={settings.contentScaling}
          onError={(err) => console.error('خطأ في البث المباشر:', err)}
          onConnectionChange={(connected) => {
            console.log('حالة البث المباشر:', connected ? 'متصل' : 'غير متصل');
          }}
        />
      ) : (
        <ContentRenderer
          content={content}
          settings={settings}
          isPlaying={isPlaying}
        />
      )}
    </div>
  );
}
