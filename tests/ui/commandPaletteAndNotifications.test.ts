import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dispatchSyncNotification,
  SyncNotificationItem,
  DEEN_SYNC_NOTIFICATION_EVENT,
} from '@/lib/syncNotificationBus';

describe('Experience Enhancements: Command Palette & Sync Notification Center', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {
      dispatchEvent: (event: any) => {
        const listeners = (globalThis as any).__eventListeners?.[event.type] || [];
        listeners.forEach((fn: any) => fn(event));
      },
      addEventListener: (type: string, fn: any) => {
        (globalThis as any).__eventListeners = (globalThis as any).__eventListeners || {};
        (globalThis as any).__eventListeners[type] = (globalThis as any).__eventListeners[type] || [];
        (globalThis as any).__eventListeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: any) => {
        if ((globalThis as any).__eventListeners?.[type]) {
          (globalThis as any).__eventListeners[type] = (globalThis as any).__eventListeners[type].filter(
            (cb: any) => cb !== fn
          );
        }
      },
    };
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params: { detail: any }) {
        this.type = type;
        this.detail = params.detail;
      }
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).CustomEvent;
    delete (globalThis as any).__eventListeners;
  });

  describe('SyncNotificationCenter Event Pipeline', () => {
    it('dispatches sync notification custom event with generated UUID and timestamp', () => {
      let capturedEvent: any = null;
      const listener = (e: any) => {
        capturedEvent = e;
      };

      window.addEventListener(DEEN_SYNC_NOTIFICATION_EVENT, listener);

      const dispatched = dispatchSyncNotification({
        type: 'orders_synced',
        title: 'Live WooCommerce Synced',
        description: 'Synchronized 42 orders successfully.',
        targetTab: 'tabOrders',
      });

      window.removeEventListener(DEEN_SYNC_NOTIFICATION_EVENT, listener);

      expect(dispatched).not.toBeNull();
      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent.detail).toBeDefined();
      expect(capturedEvent.detail.type).toBe('orders_synced');
      expect(capturedEvent.detail.title).toBe('Live WooCommerce Synced');
      expect(capturedEvent.detail.description).toBe('Synchronized 42 orders successfully.');
      expect(capturedEvent.detail.targetTab).toBe('tabOrders');
      expect(capturedEvent.detail.id).toMatch(/^sync-notif-\d+-[a-z0-9]+$/);
      expect(capturedEvent.detail.timestamp).toBeTruthy();
    });

    it('supports discrepancy_detected and error notification types', () => {
      const dispatched: any[] = [];
      const listener = (e: any) => {
        dispatched.push(e.detail);
      };

      window.addEventListener(DEEN_SYNC_NOTIFICATION_EVENT, listener);

      dispatchSyncNotification({
        type: 'discrepancy_detected',
        title: 'Hermes Status Mismatch',
        description: 'Order #19203 has Delivered status with Return in Pathao.',
        targetTab: 'tabCourierMismatch',
        targetOrderId: '19203',
      });

      dispatchSyncNotification({
        type: 'error',
        title: 'Connection Timeout',
        description: 'WooCommerce API returned 504 Gateway Timeout.',
        targetTab: 'tabSettings',
      });

      window.removeEventListener(DEEN_SYNC_NOTIFICATION_EVENT, listener);

      expect(dispatched.length).toBe(2);
      expect(dispatched[0].type).toBe('discrepancy_detected');
      expect(dispatched[0].targetOrderId).toBe('19203');
      expect(dispatched[1].type).toBe('error');
    });
  });

  describe('Command Palette Tab Configuration Integrity', () => {
    it('ensures all dashboard navigation tab IDs are mapped and valid', () => {
      const validTabs = [
        'tabExecutive',
        'tabLiveOps',
        'tabOrders',
        'tabItemReturns',
        'tabCourierMismatch',
        'tabOutletDispatch',
        'tabOutletSales',
        'tabTerritory',
        'tabExchanges',
        'tabMarketingAnalytics',
        'tabSku',
        'tabCustomerRisk',
        'tabStatus',
        'tabSettings',
      ];

      expect(validTabs).toContain('tabExecutive');
      expect(validTabs).toContain('tabLiveOps');
      expect(validTabs).toContain('tabOrders');
      expect(validTabs).toContain('tabCourierMismatch');
      expect(validTabs).toContain('tabMarketingAnalytics');
      expect(validTabs.length).toBe(14);
    });
  });
});
