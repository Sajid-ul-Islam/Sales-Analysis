export interface SyncNotificationItem {
  id: string;
  type: 'orders_synced' | 'courier_updated' | 'discrepancy_detected' | 'error' | 'info';
  title: string;
  description: string;
  timestamp: string;
  targetTab?: string;
  targetOrderId?: string;
}

export const DEEN_SYNC_NOTIFICATION_EVENT = 'deen_sync_notification';
export const DEEN_SYNC_HISTORY_STORAGE_KEY = 'deen_sync_history_v1';

export function dispatchSyncNotification(
  event: Omit<SyncNotificationItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): SyncNotificationItem | null {
  if (typeof window !== 'undefined') {
    const fullItem: SyncNotificationItem = {
      ...event,
      id: event.id || `sync-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    window.dispatchEvent(new CustomEvent(DEEN_SYNC_NOTIFICATION_EVENT, { detail: fullItem }));
    return fullItem;
  }
  return null;
}
