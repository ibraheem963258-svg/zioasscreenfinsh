/**
 * ======================================
 * مكون عارض البث المباشر
 * Live Stream Renderer Component
 * ======================================
 * 
 * الوظيفة: تشغيل روابط البث المباشر (HLS/m3u8)
 * يدعم: التبديل السلس بين القنوات بدون إعادة تحميل
 * الأولوية: البث المباشر له أولوية على أي محتوى آخر
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';

// ======================================
// واجهة خصائص المكون
// ======================================
interface LiveStreamRendererProps {
  /** رابط البث المباشر (HLS/m3u8) */
  streamUrl: string;
  /** نوع تكبير المحتوى */
  contentScaling?: 'fit' | 'fill' | 'stretch';
  /** دالة تُستدعى عند حدوث خطأ */
  onError?: (error: string) => void;
  /** دالة تُستدعى عند تغيير حالة الاتصال */
  onConnectionChange?: (connected: boolean) => void;
}

// ======================================
// مكون حالة الاتصال
// Connection Status Component
// ======================================
function StreamStatus({ 
  isConnecting, 
  isError,
  errorMessage 
}: { 
  isConnecting: boolean; 
  isError: boolean;
  errorMessage?: string;
}) {
  // إخفاء المكون إذا لم يكن هناك حالة للعرض
  if (!isConnecting && !isError) return null;

  return (
    <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border">
      {isConnecting && (
        <>
          <div className="w-3 h-3 bg-warning rounded-full animate-pulse" />
          <span className="text-sm text-warning">جاري الاتصال بالبث...</span>
        </>
      )}
      {isError && (
        <>
          <div className="w-3 h-3 bg-destructive rounded-full" />
          <span className="text-sm text-destructive">
            {errorMessage || 'خطأ في البث'}
          </span>
        </>
      )}
    </div>
  );
}

// ======================================
// المكون الرئيسي
// Main Component
// ======================================
export function LiveStreamRenderer({
  streamUrl,
  contentScaling = 'fill',
  onError,
  onConnectionChange,
}: LiveStreamRendererProps) {
  // ======================================
  // المراجع والحالات
  // Refs and States
  // ======================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  
  // عدد محاولات إعادة الاتصال
  const retryCount = useRef(0);
  const maxRetries = 5;

  // ======================================
  // تحديد كلاس التكبير حسب الإعداد
  // Determine scaling class based on setting
  // ======================================
  const getScalingClass = useCallback(() => {
    switch (contentScaling) {
      case 'fit':
        return 'object-contain';
      case 'fill':
        return 'object-cover';
      case 'stretch':
        return 'object-fill';
      default:
        return 'object-cover';
    }
  }, [contentScaling]);

  // ======================================
  // تهيئة وتشغيل البث المباشر
  // Initialize and play live stream
  // ======================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    // دالة تنظيف HLS
    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    // إعادة ضبط الحالات
    setIsConnecting(true);
    setIsError(false);
    setErrorMessage(undefined);
    retryCount.current = 0;

    // ======================================
    // التحقق من دعم HLS
    // Check HLS support
    // ======================================
    if (Hls.isSupported()) {
      // تنظيف أي جلسة سابقة
      cleanup();

      // إنشاء مثيل HLS جديد مع إعدادات محسّنة
      const hls = new Hls({
        // إعدادات التحميل المسبق
        enableWorker: true,
        lowLatencyMode: true,
        // إعدادات إعادة المحاولة
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        // أوقات الانتظار
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        // إعدادات التخزين المؤقت
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // إعدادات البث المباشر
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
      });

      hlsRef.current = hls;

      // ======================================
      // معالجة الأحداث
      // Event Handlers
      // ======================================
      
      // عند تحميل البيانات الوصفية
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('البث المباشر: تم تحميل البيانات الوصفية بنجاح');
        setIsConnecting(false);
        setIsError(false);
        onConnectionChange?.(true);
        
        // بدء التشغيل التلقائي
        video.play().catch(err => {
          console.warn('البث المباشر: فشل التشغيل التلقائي', err);
        });
      });

      // عند حدوث خطأ
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('البث المباشر: خطأ', data);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // خطأ في الشبكة - محاولة إعادة الاتصال
              if (retryCount.current < maxRetries) {
                retryCount.current++;
                console.log(`البث المباشر: محاولة إعادة الاتصال ${retryCount.current}/${maxRetries}`);
                setErrorMessage(`إعادة الاتصال... (${retryCount.current}/${maxRetries})`);
                
                // انتظار قبل إعادة المحاولة
                setTimeout(() => {
                  hls.startLoad();
                }, 2000 * retryCount.current);
              } else {
                setIsError(true);
                setErrorMessage('فشل الاتصال بالبث');
                onError?.('فشل الاتصال بالبث بعد عدة محاولات');
                onConnectionChange?.(false);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // خطأ في الوسائط - محاولة استعادة
              console.log('البث المباشر: محاولة استعادة من خطأ الوسائط');
              hls.recoverMediaError();
              break;
            default:
              // خطأ فادح - إيقاف التشغيل
              setIsError(true);
              setErrorMessage('خطأ في تشغيل البث');
              onError?.('خطأ فادح في البث المباشر');
              onConnectionChange?.(false);
              cleanup();
              break;
          }
        }
      });

      // تحميل المصدر
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // ======================================
      // دعم Safari المدمج لـ HLS
      // Safari native HLS support
      // ======================================
      video.src = streamUrl;
      
      video.addEventListener('loadedmetadata', () => {
        setIsConnecting(false);
        onConnectionChange?.(true);
        video.play().catch(err => {
          console.warn('البث المباشر: فشل التشغيل التلقائي على Safari', err);
        });
      });

      video.addEventListener('error', () => {
        setIsError(true);
        setErrorMessage('خطأ في تحميل البث');
        onError?.('فشل تحميل البث على Safari');
        onConnectionChange?.(false);
      });
    } else {
      // ======================================
      // HLS غير مدعوم
      // HLS not supported
      // ======================================
      setIsError(true);
      setErrorMessage('البث المباشر غير مدعوم على هذا المتصفح');
      onError?.('HLS غير مدعوم على هذا المتصفح');
    }

    // ======================================
    // تنظيف عند إلغاء التحميل
    // Cleanup on unmount
    // ======================================
    return cleanup;
  }, [streamUrl, onError, onConnectionChange]);

  // ======================================
  // التعامل مع تغيير رابط البث
  // Handle stream URL change
  // ======================================
  useEffect(() => {
    // يتم التعامل مع التغيير تلقائياً في useEffect أعلاه
    // بفضل streamUrl في مصفوفة التبعيات
    console.log('البث المباشر: تم تغيير رابط البث إلى', streamUrl);
  }, [streamUrl]);

  // ======================================
  // عرض المكون
  // Render Component
  // ======================================
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* مؤشر حالة الاتصال */}
      <StreamStatus 
        isConnecting={isConnecting} 
        isError={isError}
        errorMessage={errorMessage}
      />
      
      {/* عنصر الفيديو للبث المباشر */}
      <video
        ref={videoRef}
        className={cn("w-full h-full", getScalingClass())}
        autoPlay
        muted
        playsInline
        // إعادة المحاولة عند الانقطاع
        onStalled={() => {
          console.log('البث المباشر: توقف مؤقت - جاري الانتظار');
        }}
        onWaiting={() => {
          console.log('البث المباشر: في انتظار البيانات');
        }}
      />
    </div>
  );
}
