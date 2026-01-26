/**
 * ======================================
 * Hook لإدارة إعادة الاتصال الذكية
 * Smart Reconnection Management Hook
 * ======================================
 * 
 * الوظيفة: إدارة إعادة الاتصال بدون إعادة تحميل الصفحة
 * الميزات:
 *   - Exponential backoff للمحاولات
 *   - استكمال المحتوى بدون قطع
 *   - تحديث البيانات فقط عند الحاجة
 *   - دعم التشغيل 24/7
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ======================================
// واجهة إعدادات الـ Hook
// ======================================
interface UseReconnectionOptions {
  /** الحد الأقصى لعدد المحاولات قبل إعادة التحميل */
  maxAttempts?: number;
  /** أقصى وقت انتظار بين المحاولات (بالمللي ثانية) */
  maxDelay?: number;
  /** وقت الانتظار الأساسي (بالمللي ثانية) */
  baseDelay?: number;
  /** دالة تُستدعى عند إعادة الاتصال بنجاح */
  onReconnect?: () => void | Promise<void>;
  /** دالة تُستدعى عند انقطاع الاتصال */
  onDisconnect?: () => void;
  /** دالة تُستدعى عند تغيير الحالة */
  onStatusChange?: (status: ConnectionStatus) => void;
}

// ======================================
// حالات الاتصال
// Connection States
// ======================================
export type ConnectionStatus = 
  | 'connected'      // متصل
  | 'disconnected'   // غير متصل
  | 'reconnecting'   // جاري إعادة الاتصال
  | 'failed';        // فشل الاتصال نهائياً

// ======================================
// واجهة قيم الـ Hook
// ======================================
interface UseReconnectionReturn {
  /** حالة الاتصال الحالية */
  status: ConnectionStatus;
  /** هل متصل بالإنترنت */
  isOnline: boolean;
  /** عدد المحاولات الحالي */
  attempts: number;
  /** بدء عملية إعادة الاتصال يدوياً */
  reconnect: () => void;
  /** إعادة تعيين عداد المحاولات */
  resetAttempts: () => void;
}

export function useReconnection(options: UseReconnectionOptions = {}): UseReconnectionReturn {
  // ======================================
  // الإعدادات الافتراضية
  // Default Options
  // ======================================
  const {
    maxAttempts = 15,           // 15 محاولة قبل إعادة التحميل
    maxDelay = 30000,           // أقصى انتظار 30 ثانية
    baseDelay = 1000,           // انتظار أساسي 1 ثانية
    onReconnect,
    onDisconnect,
    onStatusChange,
  } = options;

  // ======================================
  // الحالات
  // States
  // ======================================
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [attempts, setAttempts] = useState(0);
  
  // المراجع
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);

  // ======================================
  // تغيير الحالة مع إشعار
  // Change status with notification
  // ======================================
  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
    console.log(`حالة الاتصال: ${newStatus}`);
  }, [onStatusChange]);

  // ======================================
  // حساب وقت الانتظار (Exponential Backoff)
  // Calculate delay (Exponential Backoff)
  // ======================================
  const calculateDelay = useCallback((attempt: number) => {
    // المعادلة: baseDelay * 2^attempt مع حد أقصى
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // إضافة عشوائية بسيطة لتجنب التزامن
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }, [baseDelay, maxDelay]);

  // ======================================
  // إعادة تعيين المحاولات
  // Reset attempts
  // ======================================
  const resetAttempts = useCallback(() => {
    attemptsRef.current = 0;
    setAttempts(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ======================================
  // تنفيذ إعادة الاتصال
  // Execute reconnection
  // ======================================
  const reconnect = useCallback(async () => {
    // التحقق من حالة الإنترنت أولاً
    if (!navigator.onLine) {
      console.log('إعادة الاتصال: في انتظار عودة الإنترنت');
      return;
    }

    // التحقق من عدد المحاولات
    if (attemptsRef.current >= maxAttempts) {
      console.log('إعادة الاتصال: تم تجاوز الحد الأقصى للمحاولات');
      updateStatus('failed');
      // إعادة تحميل الصفحة كملاذ أخير بعد 5 ثواني
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      return;
    }

    // زيادة عداد المحاولات
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);

    console.log(`إعادة الاتصال: المحاولة ${attemptsRef.current}/${maxAttempts}`);
    updateStatus('reconnecting');

    try {
      // تنفيذ دالة إعادة الاتصال
      await onReconnect?.();
      
      // نجاح إعادة الاتصال
      console.log('إعادة الاتصال: نجحت');
      resetAttempts();
      updateStatus('connected');
    } catch (error) {
      console.error('إعادة الاتصال: فشلت', error);
      
      // جدولة المحاولة التالية
      const delay = calculateDelay(attemptsRef.current);
      console.log(`إعادة الاتصال: المحاولة التالية بعد ${Math.round(delay / 1000)} ثانية`);
      
      timeoutRef.current = setTimeout(() => {
        reconnect();
      }, delay);
    }
  }, [maxAttempts, onReconnect, calculateDelay, resetAttempts, updateStatus]);

  // ======================================
  // مراقبة حالة الشبكة
  // Monitor network state
  // ======================================
  useEffect(() => {
    const handleOnline = () => {
      console.log('الشبكة: متصل');
      setIsOnline(true);
      // بدء إعادة الاتصال عند عودة الإنترنت
      reconnect();
    };

    const handleOffline = () => {
      console.log('الشبكة: غير متصل');
      setIsOnline(false);
      updateStatus('disconnected');
      onDisconnect?.();
      
      // إلغاء أي محاولة معلقة
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // التحقق من الحالة الأولية
    if (!navigator.onLine) {
      setIsOnline(false);
      updateStatus('disconnected');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [reconnect, updateStatus, onDisconnect]);

  // ======================================
  // مراقبة تغييرات الصفحة (visibility)
  // Monitor page visibility changes
  // ======================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('الصفحة: أصبحت مرئية - تحديث البيانات');
        // إعادة الاتصال عند عودة التركيز
        if (status === 'disconnected' || status === 'failed') {
          resetAttempts();
          reconnect();
        } else {
          // تحديث البيانات فقط بدون إعادة اتصال كامل
          onReconnect?.();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, reconnect, resetAttempts, onReconnect]);

  return {
    status,
    isOnline,
    attempts,
    reconnect,
    resetAttempts,
  };
}
