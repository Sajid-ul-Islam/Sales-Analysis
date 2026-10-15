import { describe, it, expect } from 'vitest';
import {
  normalizeCourierStatus,
  detectCourierDiscrepancy,
  cleanOrderId,
  syncLiveTerminalData,
} from '@/lib/sync/liveTerminalSync';

describe('Live Terminal Synchronization & Courier Reconciliation Engine', () => {
  describe('normalizeCourierStatus', () => {
    it('standardizes various courier status representations', () => {
      expect(normalizeCourierStatus('Delivered')).toBe('Delivered');
      expect(normalizeCourierStatus('delivered to customer')).toBe('Delivered');
      expect(normalizeCourierStatus('Partial Delivered')).toBe('Partial');
      expect(normalizeCourierStatus('partial return')).toBe('Partial');
      expect(normalizeCourierStatus('Returned To Merchant')).toBe('Returned');
      expect(normalizeCourierStatus('RTO Received')).toBe('Returned');
      expect(normalizeCourierStatus('Cancelled by customer')).toBe('Returned');
      expect(normalizeCourierStatus('In Transit to Hub')).toBe('In Transit');
      expect(normalizeCourierStatus('Picked up by courier')).toBe('In Transit');
      expect(normalizeCourierStatus('Pending Pickup')).toBe('Pending Pickup');
      expect(normalizeCourierStatus('Pickup Requested')).toBe('Pending Pickup');
      expect(normalizeCourierStatus('')).toBe('Untracked');
      expect(normalizeCourierStatus(undefined)).toBe('Untracked');
    });
  });

  describe('detectCourierDiscrepancy', () => {
    it('flags RETURNED_BUT_SHIPPED when WooCommerce status is shipped but Pathao status is Returned', () => {
      const disc = detectCourierDiscrepancy('shipped', 'Returned', 2500, 0);
      expect(disc.hasDiscrepancy).toBe(true);
      expect(disc.type).toBe('RETURNED_BUT_SHIPPED');
      expect(disc.message).toContain('returned parcel to merchant');
    });

    it('flags RETURNED_BUT_SHIPPED when WooCommerce status is completed but Pathao status is Returned', () => {
      const disc = detectCourierDiscrepancy('completed', 'Returned', 1850, 0);
      expect(disc.hasDiscrepancy).toBe(true);
      expect(disc.type).toBe('RETURNED_BUT_SHIPPED');
    });

    it('flags DELIVERED_BUT_PROCESSING when WooCommerce is processing but Pathao has Delivered', () => {
      const disc = detectCourierDiscrepancy('processing', 'Delivered', 2200, 2200);
      expect(disc.hasDiscrepancy).toBe(true);
      expect(disc.type).toBe('DELIVERED_BUT_PROCESSING');
      expect(disc.message).toContain('still processing');
    });

    it('flags COD_MISMATCH when collectable and collected differ significantly', () => {
      const disc = detectCourierDiscrepancy('shipped', 'Delivered', 3500, 2000);
      expect(disc.hasDiscrepancy).toBe(true);
      expect(disc.type).toBe('COD_MISMATCH');
      expect(disc.message).toContain('COD mismatch');
    });

    it('returns no discrepancy when store and courier statuses are in harmony', () => {
      const disc = detectCourierDiscrepancy('completed', 'Delivered', 2400, 2400);
      expect(disc.hasDiscrepancy).toBe(false);
      expect(disc.type).toBe('NONE');
    });

    it('returns no discrepancy for legitimate in-transit shipments', () => {
      const disc = detectCourierDiscrepancy('shipped', 'In Transit', 1900, 0);
      expect(disc.hasDiscrepancy).toBe(false);
      expect(disc.type).toBe('NONE');
    });
  });

  describe('cleanOrderId', () => {
    it('normalizes string and quoted order identifiers', () => {
      expect(cleanOrderId('"16048"')).toBe('16048');
      expect(cleanOrderId('  17263 m  ')).toBe('17263m');
      expect(cleanOrderId(18200)).toBe('18200');
      expect(cleanOrderId(null)).toBe('');
    });
  });

  describe('syncLiveTerminalData orchestrator', () => {
    it('enriches active orders with courier telemetry and discrepancy diagnostics', async () => {
      const mockOrders = [
        {
          'Order ID': '16048',
          orderId: '16048',
          'Order Date': '2026-10-15 10:30',
          'Customer Name': 'Tanvir Ahmed',
          Phone: '01700000000',
          'Item Name': 'DEEN High-End Raw Washed Jeans - Slim Fit - 34',
          SKU: '101-0100-149',
          Quantity: 1,
          'Item Cost': 2490,
          'Order Amount': 2490,
          'Delivery Status': 'shipped',
          'Consignment ID': 'RD290926W5BWHU',
        },
        {
          'Order ID': '17001',
          orderId: '17001',
          'Order Date': '2026-10-15 11:15',
          'Customer Name': 'Rashid Khan',
          Phone: '01800000000',
          'Item Name': 'Calvin Klein Crewneck Sweatshirt',
          SKU: 'CK-SW-01',
          Quantity: 1,
          'Item Cost': 3200,
          'Order Amount': 3200,
          'Delivery Status': 'processing',
          'Consignment ID': '',
        },
      ];

      const result = await syncLiveTerminalData({
        activeOrders: mockOrders,
        limitConsignments: 10,
        skipNetwork: true,
      });

      expect(result.success).toBe(true);
      expect(result.orders.length).toBe(2);
      expect(result.stats.totalOrders).toBe(2);
      expect(result.stats.handedOverCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.handedOverRate).toBeGreaterThan(0);

      // Verify first order was enriched with Pathao tracking
      const enrichedOrder1 = result.orders.find((o) => o['Order ID'] === '16048');
      expect(enrichedOrder1).toBeDefined();
      expect(enrichedOrder1?.['Courier Status']).toBeDefined();
      expect(enrichedOrder1?.consignmentId).toBe('RD290926W5BWHU');

      // Verify second order without consignment is marked Untracked
      const enrichedOrder2 = result.orders.find((o) => o['Order ID'] === '17001');
      expect(enrichedOrder2).toBeDefined();
      expect(enrichedOrder2?.['Courier Status']).toBe('Untracked');
    });

    it('falls back to bundled baseline data when no orders are provided', async () => {
      const result = await syncLiveTerminalData({
        limitConsignments: 5,
        skipNetwork: true,
      });

      expect(result.success).toBe(true);
      expect(result.orders.length).toBeGreaterThan(0);
      expect(result.stats.totalOrders).toBeGreaterThan(0);
      expect(result.stats.handedOverRate).toBeGreaterThanOrEqual(0);
    });
  });
});
