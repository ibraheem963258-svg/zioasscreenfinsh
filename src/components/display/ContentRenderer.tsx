/**
 * ======================================
 * مكون عرض المحتوى المحسّن
 * Enhanced Content Renderer Component
 * ======================================
 * 
 * الميزات:
 *   - انتقالات سلسة بدون شاشة سوداء
 *   - تحميل مسبق للمحتوى التالي
 *   - دعم Fade, Slide, Crossfade
 *   - استمرارية الصوت والصورة
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ContentItem, DisplaySettings } from '@/lib/types';
import { cn } from '@/lib/utils';

// ======================================
// واجهة خصائص المكون
// Component Props Interface
// ======================================
interface ContentRendererProps {
  /** قائمة المحتوى للعرض */
  content: ContentItem[];
  /** إعدادات العرض */
  settings: DisplaySettings;
  /** هل التشغيل نشط */
  isPlaying: boolean;
  /** دالة تُستدعى عند تغيير المحتوى */
  onContentChange?: (index: number) => void;
}

export function ContentRenderer({
  content,
  settings,
  isPlaying,
  onContentChange,
}: ContentRendererProps) {
  // ======================================
  // الحالات الرئيسية
  // Main States
  // ======================================
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // حالات التحميل المسبق
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set([0]));
  const [preloadedContent, setPreloadedContent] = useState<Map<number, boolean>>(new Map());
  
  // ترتيب العرض (للـ shuffle)
  const [displayOrder, setDisplayOrder] = useState<number[]>(() => 
    content.length > 0 ? content.map((_, i) => i) : []
  );

  // ======================================
  // المراجع
  // Refs
  // ======================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ======================================
  // تهيئة ترتيب العرض
  // Initialize Display Order
  // ======================================
  useEffect(() => {
    if (content.length === 0) return;

    let order = content.map((_, i) => i);
    
    // خلط الترتيب إذا كان shuffle مفعل
    if (settings.playbackOrder === 'shuffle') {
      // Fisher-Yates shuffle algorithm
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    
    setDisplayOrder(order);
    setCurrentIndex(0);
    setNextIndex(order.length > 1 ? 1 : 0);
    
    // إعادة تعيين حالات التحميل
    setLoadedIndexes(new Set([0]));
    setPreloadedContent(new Map());
  }, [content, settings.playbackOrder]);

  // ======================================
  // التحميل المسبق للمحتوى التالي
  // Preload Next Content
  // ======================================
  useEffect(() => {
    if (displayOrder.length <= 1) return;
    
    const nextIdx = (currentIndex + 1) % displayOrder.length;
    const contentIdx = displayOrder[nextIdx];
    
    // إلغاء أي تحميل سابق
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    
    // التحميل المسبق للمحتوى التالي
    if (!loadedIndexes.has(contentIdx)) {
      const nextContent = content[contentIdx];
      if (nextContent) {
        if (nextContent.type === 'image') {
          // تحميل الصورة مسبقاً
          const img = new Image();
          img.src = nextContent.url;
          img.onload = () => {
            console.log(`تم تحميل الصورة التالية: ${nextContent.name}`);
            setLoadedIndexes(prev => new Set([...prev, contentIdx]));
            setPreloadedContent(prev => new Map(prev).set(contentIdx, true));
          };
          img.onerror = () => {
            console.error(`فشل تحميل الصورة: ${nextContent.name}`);
          };
        } else if (nextContent.type === 'video') {
          // تحميل الفيديو مسبقاً
          setLoadedIndexes(prev => new Set([...prev, contentIdx]));
          setPreloadedContent(prev => new Map(prev).set(contentIdx, true));
        }
      }
    }
    
    setNextIndex(nextIdx);
  }, [currentIndex, displayOrder, content, loadedIndexes]);

  // ======================================
  // الانتقال للمحتوى التالي
  // Go to Next Content
  // ======================================
  const goToNext = useCallback(() => {
    const orderLen = displayOrder.length || content.length;
    if (orderLen <= 1 || !isPlaying) return;

    // بدء الانتقال
    setIsTransitioning(true);

    // تأخير التغيير حسب مدة الانتقال
    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % orderLen;
        onContentChange?.(next);
        return next;
      });
      setIsTransitioning(false);
    }, settings.transitionDuration);
  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying, onContentChange]);

  // ======================================
  // التشغيل التلقائي والانتقال
  // Auto-play and Transition
  // ======================================
  useEffect(() => {
    if (content.length === 0 || !isPlaying) return;

    const order = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
    const safeIndex = ((currentIndex % order.length) + order.length) % order.length;
    const contentIdx = order[safeIndex];
    const currentContent = content[contentIdx];
    
    if (!currentContent) return;

    // تحديد مدة العرض
    let duration: number;
    
    if (currentContent.type === 'video') {
      // للفيديو: استخدام مدة الفيديو أو المدة المحددة في المحتوى
      duration = (currentContent.duration || settings.slideDuration) * 1000;
    } else {
      // للصور: استخدام المدة المحددة في المحتوى أو الإعدادات
      duration = (currentContent.duration || settings.slideDuration) * 1000;
    }

    const timer = setTimeout(goToNext, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, content, displayOrder, settings.slideDuration, goToNext, isPlaying]);

  // ======================================
  // معالج انتهاء الفيديو
  // Video Ended Handler
  // ======================================
  const handleVideoEnded = useCallback(() => {
    if (content.length > 1) {
      goToNext();
    } else if (videoRef.current) {
      // إعادة تشغيل الفيديو إذا كان وحيداً
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
  }, [content.length, goToNext]);

  // ======================================
  // معالج تحميل الفيديو التالي
  // Next Video Loaded Handler
  // ======================================
  const handleNextVideoLoaded = useCallback(() => {
    if (nextVideoRef.current) {
      // تجهيز الفيديو التالي للتشغيل الفوري
      nextVideoRef.current.pause();
      nextVideoRef.current.currentTime = 0;
    }
  }, []);

  // ======================================
  // دالة الحصول على كلاس التكبير
  // Get Scaling Class Function
  // ======================================
  const getScalingClass = useCallback(() => {
    switch (settings.contentScaling) {
      case 'fit':
        return 'object-contain';
      case 'fill':
        return 'object-cover';
      case 'stretch':
        return 'object-fill';
      default:
        return 'object-cover';
    }
  }, [settings.contentScaling]);

  // ======================================
  // دالة الحصول على أنماط الانتقال
  // Get Transition Styles Function
  // ======================================
  const getTransitionStyles = useCallback(() => {
    const duration = `${settings.transitionDuration}ms`;
    
    switch (settings.transitionType) {
      case 'slide':
        return {
          current: {
            transition: `transform ${duration} ease-in-out`,
            transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)',
          },
          next: {
            transition: `transform ${duration} ease-in-out`,
            transform: isTransitioning ? 'translateX(0)' : 'translateX(100%)',
          },
        };
      case 'crossfade':
        return {
          current: {
            transition: `opacity ${duration} ease-in-out`,
            opacity: isTransitioning ? 0 : 1,
          },
          next: {
            transition: `opacity ${duration} ease-in-out`,
            opacity: isTransitioning ? 1 : 0,
          },
        };
      case 'fade':
      default:
        return {
          current: {
            transition: `opacity ${duration} ease-in-out`,
            opacity: isTransitioning ? 0 : 1,
          },
          next: {
            opacity: 0,
          },
        };
    }
  }, [settings.transitionType, settings.transitionDuration, isTransitioning]);

  // ======================================
  // التحقق من وجود محتوى
  // Check for Content
  // ======================================
  if (content.length === 0) {
    return null;
  }
  
  // ======================================
  // حساب الفهارس الآمنة
  // Calculate Safe Indexes
  // ======================================
  const effectiveDisplayOrder = displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);
  const contentIdx = effectiveDisplayOrder[currentIndex] ?? 0;
  const currentContent = content[contentIdx];
  const nextContentIdx = effectiveDisplayOrder[nextIndex] ?? 0;
  const nextContent = content[nextContentIdx];

  // التحقق من المحتوى الحالي
  if (!currentContent) {
    const fallbackContent = content[0];
    if (!fallbackContent) return null;
    
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {fallbackContent.type === 'image' ? (
          <img
            src={fallbackContent.url}
            alt={fallbackContent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={fallbackContent.url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        )}
      </div>
    );
  }

  const transitionStyles = getTransitionStyles();

  // ======================================
  // العرض الرئيسي
  // Main Render
  // ======================================
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* ======================================
          المحتوى الحالي
          Current Content
          ====================================== */}
      <div 
        className="absolute inset-0"
        style={transitionStyles.current}
      >
        {currentContent.type === 'image' ? (
          <img
            src={currentContent.url}
            alt={currentContent.name}
            className={cn("w-full h-full", getScalingClass())}
            loading="eager"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentContent.url}
            className={cn("w-full h-full", getScalingClass())}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            onError={(e) => console.error('خطأ في تحميل الفيديو:', e)}
          />
        )}
      </div>

      {/* ======================================
          المحتوى التالي (للانتقال السلس)
          Next Content (for smooth transition)
          ====================================== */}
      {nextContent && nextContent.id !== currentContent.id && (
        <div 
          className={cn(
            "absolute inset-0",
            settings.transitionType === 'fade' && "pointer-events-none"
          )}
          style={transitionStyles.next}
        >
          {nextContent.type === 'image' ? (
            <img
              src={nextContent.url}
              alt={nextContent.name}
              className={cn("w-full h-full", getScalingClass())}
              loading="eager"
            />
          ) : (
            <video
              ref={nextVideoRef}
              src={nextContent.url}
              className={cn("w-full h-full", getScalingClass())}
              preload="auto"
              muted
              playsInline
              onLoadedData={handleNextVideoLoaded}
            />
          )}
        </div>
      )}

      {/* ======================================
          التحميل المسبق المخفي
          Hidden Preloading
          ====================================== */}
      <div className="hidden">
        {content.slice(0, 3).map((item, idx) => (
          idx !== contentIdx && (
            item.type === 'image' ? (
              <img key={item.id} src={item.url} alt="" />
            ) : (
              <video key={item.id} src={item.url} preload="metadata" muted />
            )
          )
        ))}
      </div>

      {/* ======================================
          مؤشرات التقدم
          Progress Indicators
          ====================================== */}
      {content.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {effectiveDisplayOrder.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                idx === currentIndex 
                  ? 'w-8 bg-white' 
                  : 'w-2 bg-white/40'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
