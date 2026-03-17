/**
 * ======================================
 * Smart Reconnection Management Hook
 * ======================================
 * 
 * Features:
 *   - Exponential backoff for retries
 *   - Content continuation without interruption
 *   - Data update only when needed
 *   - 24/7 operation support
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReconnectionOptions {
  /** Maximum number of attempts before reload */
  maxAttempts?: number;
  /** Maximum delay between attempts (milliseconds) */
  maxDelay?: number;
  /** Base delay time (milliseconds) */
  baseDelay?: number;
  /** Callback for successful reconnection */
  onReconnect?: () => void | Promise<void>;
  /** Callback for disconnection */
  onDisconnect?: () => void;
  /** Callback for status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
}

export type ConnectionStatus = 
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

interface UseReconnectionReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Whether online */
  isOnline: boolean;
  /** Current attempt count */
  attempts: number;
  /** Manually trigger reconnection */
  reconnect: () => void;
  /** Reset attempt counter */
  resetAttempts: () => void;
}

export function useReconnection(options: UseReconnectionOptions = {}): UseReconnectionReturn {
  const {
    maxAttempts = 15,
    maxDelay = 30000,
    baseDelay = 1000,
    onReconnect,
    onDisconnect,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [attempts, setAttempts] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
    console.log(`Connection status: ${newStatus}`);
  }, [onStatusChange]);

  const calculateDelay = useCallback((attempt: number) => {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }, [baseDelay, maxDelay]);

  const resetAttempts = useCallback(() => {
    attemptsRef.current = 0;
    setAttempts(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('Reconnection: Waiting for internet');
      return;
    }

    if (attemptsRef.current >= maxAttempts) {
      console.log('Reconnection: Maximum attempts exceeded');
      updateStatus('failed');
      setTimeout(() => {
        window.location.reload();
      }, 5000);
      return;
    }

    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);

    console.log(`Reconnection: Attempt ${attemptsRef.current}/${maxAttempts}`);
    updateStatus('reconnecting');

    try {
      await onReconnect?.();
      
      console.log('Reconnection: Success');
      resetAttempts();
      updateStatus('connected');
    } catch (error) {
      console.error('Reconnection: Failed', error);
      
      const delay = calculateDelay(attemptsRef.current);
      console.log(`Reconnection: Next attempt in ${Math.round(delay / 1000)} seconds`);
      
      timeoutRef.current = setTimeout(() => {
        reconnect();
      }, delay);
    }
  }, [maxAttempts, onReconnect, calculateDelay, resetAttempts, updateStatus]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Online');
      setIsOnline(true);
      reconnect();
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      setIsOnline(false);
      updateStatus('disconnected');
      onDisconnect?.();
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('Page: Visible - Refreshing data');
        if (status === 'disconnected' || status === 'failed') {
          resetAttempts();
          reconnect();
        } else {
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
