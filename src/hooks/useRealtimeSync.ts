"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SyncEvent } from '@/lib/sync/eventLog';

export interface UseRealtimeSyncOptions {
  enabled?: boolean;
  onEvent?: (event: SyncEvent) => void;
  maxStoredEvents?: number;
}

export interface UseRealtimeSyncReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  events: SyncEvent[];
  pendingCount: number;
  lastEvent: SyncEvent | null;
  clearPending: () => void;
  reconnect: () => void;
}

export function useRealtimeSync(options: UseRealtimeSyncOptions = {}): UseRealtimeSyncReturn {
  const { enabled = true, onEvent, maxStoredEvents = 50 } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const clearPending = useCallback(() => {
    setPendingCount(0);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || !enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = new URL('/api/sync/events/stream', window.location.origin);
    if (lastEventIdRef.current) {
      url.searchParams.set('lastEventId', lastEventIdRef.current);
    }

    const es = new EventSource(url.toString(), { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
    };

    const handleMessage = (e: MessageEvent) => {
      if (!e.data || e.data.startsWith(':')) return;

      try {
        const parsed: SyncEvent = JSON.parse(e.data);
        if (parsed.id) {
          lastEventIdRef.current = parsed.id;
        }

        setLastEvent(parsed);
        setPendingCount((prev) => prev + 1);
        setEvents((prev) => [parsed, ...prev].slice(0, maxStoredEvents));

        if (onEventRef.current) {
          onEventRef.current(parsed);
        }
      } catch {
        // Ignore non-JSON comments or keepalive
      }
    };

    // Listen to generic messages and specific event types
    es.onmessage = handleMessage;
    es.addEventListener('wc:order.updated', handleMessage);
    es.addEventListener('wc:order.created', handleMessage);
    es.addEventListener('wc:order.deleted', handleMessage);
    es.addEventListener('pathao:delivered', handleMessage);
    es.addEventListener('pathao:returned', handleMessage);
    es.addEventListener('pathao:in_transit', handleMessage);
    es.addEventListener('pathao:partial', handleMessage);

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectAttemptsRef.current += 1;

      setIsReconnecting(true);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [enabled, maxStoredEvents]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (!enabled) return;

    // Inactivity sleep: Only establish streaming connection when tab is active/visible
    if (typeof document !== 'undefined' && !document.hidden) {
      connect();
    }

    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        // Sleep on background tab: disconnect to save Vercel serverless duration and bandwidth
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
          setIsConnected(false);
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      } else {
        // Wake up on focus: reconnect and catch up on missed events
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect]);

  return {
    isConnected,
    isReconnecting,
    events,
    pendingCount,
    lastEvent,
    clearPending,
    reconnect,
  };
}
