'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  lastOnlineAt?: number;
  lastOfflineAt?: number;
}

export function useNetworkStatus(): NetworkStatus & {
  measureAsyncOperation: <T>(operation: () => Promise<T>, slowThresholdMs?: number) => Promise<T>;
  isOperationSlow: boolean;
  elapsedSlowMs: number;
} {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  });

  const [isSlowConnection, setIsSlowConnection] = useState<boolean>(false);
  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined);
  const [rtt, setRtt] = useState<number | undefined>(undefined);
  const [downlink, setDownlink] = useState<number | undefined>(undefined);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | undefined>(undefined);
  const [lastOfflineAt, setLastOfflineAt] = useState<number | undefined>(undefined);

  const [isOperationSlow, setIsOperationSlow] = useState<boolean>(false);
  const [elapsedSlowMs, setElapsedSlowMs] = useState<number>(0);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(Date.now());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API inspection (if supported by browser)
    const conn = (navigator as unknown as { connection?: { effectiveType?: string; rtt?: number; downlink?: number; addEventListener?: (type: string, listener: () => void) => void } }).connection;
    if (conn) {
      const updateConn = () => {
        setEffectiveType(conn.effectiveType);
        setRtt(conn.rtt);
        setDownlink(conn.downlink);
        const slow = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || (conn.rtt && conn.rtt > 800);
        setIsSlowConnection(Boolean(slow));
      };
      updateConn();
      if (conn.addEventListener) {
        conn.addEventListener('change', updateConn);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const measureAsyncOperation = useCallback(
    async <T>(operation: () => Promise<T>, slowThresholdMs = 2500): Promise<T> => {
      setIsOperationSlow(false);
      setElapsedSlowMs(0);
      const startTime = Date.now();

      slowTimerRef.current = setTimeout(() => {
        setIsOperationSlow(true);
        elapsedIntervalRef.current = setInterval(() => {
          setElapsedSlowMs(Date.now() - startTime);
        }, 100);
      }, slowThresholdMs);

      try {
        const result = await operation();
        return result;
      } finally {
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
        setIsOperationSlow(false);
        setElapsedSlowMs(0);
      }
    },
    []
  );

  return {
    isOnline,
    isSlowConnection,
    effectiveType,
    rtt,
    downlink,
    lastOnlineAt,
    lastOfflineAt,
    measureAsyncOperation,
    isOperationSlow,
    elapsedSlowMs,
  };
}
