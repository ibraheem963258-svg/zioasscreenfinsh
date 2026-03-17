/**
 * ======================================
 * Hook للتحكم في وضع ملء الشاشة
 * Fullscreen Control Hook
 * ======================================
 * 
 * الوظيفة: تفعيل ملء الشاشة تلقائياً مع معالجة قيود المتصفحات
 * يدعم: Smart TV browsers, متصفحات الموبايل, المتصفحات العادية
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ======================================
// واجهة قيم الـ Hook
// ======================================
interface UseFullscreenReturn {
  /** هل الشاشة في وضع ملء الشاشة */
  isFullscreen: boolean;
  /** تفعيل ملء الشاشة */
  enterFullscreen: () => Promise<boolean>;
  /** إلغاء ملء الشاشة */
  exitFullscreen: () => Promise<boolean>;
  /** تبديل وضع ملء الشاشة */
  toggleFullscreen: () => Promise<boolean>;
  /** هل الجهاز يدعم ملء الشاشة */
  isSupported: boolean;
}

// ======================================
// تعريفات إضافية للمتصفحات القديمة
// Extended definitions for older browsers
// ======================================
interface ExtendedDocument extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface ExtendedHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenReturn {
  // ======================================
  // الحالات
  // States
  // ======================================
  const [isFullscreen, setIsFullscreen] = useState(false);
  const attemptedRef = useRef(false);
  const doc = document as ExtendedDocument;

  // ======================================
  // التحقق من دعم ملء الشاشة
  // Check fullscreen support
  // ======================================
  const isSupported = !!(
    document.fullscreenEnabled ||
    (doc as any).webkitFullscreenEnabled ||
    (doc as any).mozFullScreenEnabled ||
    (doc as any).msFullscreenEnabled
  );

  // ======================================
  // التحقق من حالة ملء الشاشة الحالية
  // Check current fullscreen state
  // ======================================
  const checkFullscreen = useCallback(() => {
    return !!(
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }, []);

  // ======================================
  // تفعيل ملء الشاشة
  // Enter fullscreen mode
  // ======================================
  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    const elem = document.documentElement as ExtendedHTMLElement;

    try {
      // محاولة استخدام API القياسي أولاً
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
        return true;
      }
      // Webkit (Chrome, Safari)
      if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
        return true;
      }
      // Mozilla (Firefox)
      if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
        return true;
      }
      // Microsoft (Edge, IE)
      if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
        return true;
      }
      
      console.log('ملء الشاشة: غير مدعوم على هذا المتصفح');
      return false;
    } catch (error) {
      // بعض المتصفحات تمنع fullscreen بدون تفاعل المستخدم
      console.log('ملء الشاشة: فشل التفعيل التلقائي', error);
      return false;
    }
  }, []);

  // ======================================
  // إلغاء ملء الشاشة
  // Exit fullscreen mode
  // ======================================
  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return true;
      }
      if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        return true;
      }
      if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
        return true;
      }
      if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
        return true;
      }
      return false;
    } catch (error) {
      console.log('ملء الشاشة: فشل الإلغاء', error);
      return false;
    }
  }, []);

  // ======================================
  // تبديل وضع ملء الشاشة
  // Toggle fullscreen mode
  // ======================================
  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (checkFullscreen()) {
      return exitFullscreen();
    }
    return enterFullscreen();
  }, [checkFullscreen, enterFullscreen, exitFullscreen]);

  // ======================================
  // مراقبة تغييرات ملء الشاشة
  // Monitor fullscreen changes
  // ======================================
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = checkFullscreen();
      setIsFullscreen(isFull);
      console.log('ملء الشاشة: تغيرت الحالة إلى', isFull ? 'ملء' : 'عادي');
    };

    // الاستماع لجميع أحداث تغيير ملء الشاشة
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // التحقق من الحالة الأولية
    setIsFullscreen(checkFullscreen());

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [checkFullscreen]);

  // ======================================
  // محاولة التفعيل التلقائي
  // Auto-enter fullscreen attempt
  // ======================================
  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    // ======================================
    // محاولات متعددة لتفعيل ملء الشاشة
    // Multiple attempts to enter fullscreen
    // ======================================
    const attempts = [
      // المحاولة الأولى: فوراً
      () => enterFullscreen(),
      // المحاولة الثانية: بعد تحميل الصفحة
      () => new Promise<void>(resolve => {
        setTimeout(() => {
          enterFullscreen();
          resolve();
        }, 1000);
      }),
      // المحاولة الثالثة: بعد 3 ثواني
      () => new Promise<void>(resolve => {
        setTimeout(() => {
          enterFullscreen();
          resolve();
        }, 3000);
      }),
    ];

    // تنفيذ المحاولات
    const runAttempts = async () => {
      for (const attempt of attempts) {
        const success = await attempt();
        if (success || checkFullscreen()) {
          console.log('ملء الشاشة: تم التفعيل بنجاح');
          break;
        }
      }
    };

    runAttempts();

    // ======================================
    // تفعيل عند أول تفاعل (للمتصفحات المقيدة)
    // Enable on first interaction (for restricted browsers)
    // ======================================
    const handleFirstInteraction = () => {
      if (!checkFullscreen()) {
        enterFullscreen();
      }
      // إزالة المستمعات بعد التفاعل
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [enterFullscreen, checkFullscreen]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isSupported,
  };
}
