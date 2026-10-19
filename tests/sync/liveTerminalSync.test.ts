import { describe, it, expect } from 'vitest';
import {
  normalizeCourierStatus,
  detectCourierDiscrepancy,
  cleanOrderId,
  extractBaseOrderId,
  detectFulfillmentBranch,
  syncLiveTerminalData,
  parseDateToEpoch,
  indexTrackingRecord,
  CourierTrackingInfo,
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

    it('flags UNCOLLECTED_COD when Cash on Delivery order is delivered but collected amount is 0', () => {
      const disc = detectCourierDiscrepancy('completed', 'Delivered', 2850, 0, {
        paymentMethod: 'Cash on delivery (COD)',
      });
      expect(disc.hasDiscrepancy).toBe(true);
      expect(disc.type).toBe('UNCOLLECTED_COD');
      expect(disc.message).toContain('Uncollected COD');
    });

    it('flags DOUBLE_COLLECTION_RISK when prepaid order had cash collected at doorstep', () => {
      const disc = detectCourierDiscrepancy('completed', 'Delivered', 3200, 3200, {
        paymentMethod: 'bKash Online Payment',
      });
      expect(disc.hasDiscrepancy).toBe(true);
      expect(disc.type).toBe('DOUBLE_COLLECTION_RISK');
      expect(disc.message).toContain('Double Collection Risk');
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

  describe('extractBaseOrderId', () => {
    it('strips branch register suffixes (m, c, w, s)', () => {
      expect(extractBaseOrderId('17263 m')).toBe('17263');
      expect(extractBaseOrderId('17263-c')).toBe('17263');
      expect(extractBaseOrderId('17263_w')).toBe('17263');
      expect(extractBaseOrderId('17263 s')).toBe('17263');
      expect(extractBaseOrderId('17263m')).toBe('17263');
    });

    it('strips exchange and duplicate prefixes (d-, dd-, ex-)', () => {
      expect(extractBaseOrderId('D-17263')).toBe('17263');
      expect(extractBaseOrderId('DD-17263')).toBe('17263');
      expect(extractBaseOrderId('ex-17263')).toBe('17263');
    });

    it('handles null, undefined, or empty gracefully', () => {
      expect(extractBaseOrderId(null)).toBe('');
      expect(extractBaseOrderId(undefined)).toBe('');
      expect(extractBaseOrderId('')).toBe('');
    });
  });

  describe('detectFulfillmentBranch', () => {
    it('identifies Mirpur Outlet POS (suffix m)', () => {
      const branch = detectFulfillmentBranch('17263 m');
      expect(branch.branchCode).toBe('MIRPUR');
      expect(branch.branchName).toBe('Mirpur Outlet POS');
      expect(branch.isBranchFulfillment).toBe(true);
      expect(branch.baseOrderId).toBe('17263');
    });

    it('identifies Cumilla Branch (suffix c)', () => {
      const branch = detectFulfillmentBranch('17263 c');
      expect(branch.branchCode).toBe('CUMILLA');
      expect(branch.branchName).toBe('Cumilla Branch');
      expect(branch.isBranchFulfillment).toBe(true);
      expect(branch.baseOrderId).toBe('17263');
    });

    it('identifies Wari Branch (suffix w)', () => {
      const branch = detectFulfillmentBranch('17263 w');
      expect(branch.branchCode).toBe('WARI');
      expect(branch.branchName).toBe('Wari Branch');
      expect(branch.isBranchFulfillment).toBe(true);
      expect(branch.baseOrderId).toBe('17263');
    });

    it('identifies Sylhet Branch (suffix s)', () => {
      const branch = detectFulfillmentBranch('17263 s');
      expect(branch.branchCode).toBe('SYLHET');
      expect(branch.branchName).toBe('Sylhet Branch');
      expect(branch.isBranchFulfillment).toBe(true);
      expect(branch.baseOrderId).toBe('17263');
    });

    it('identifies Exchange Replacement (prefix D-)', () => {
      const branch = detectFulfillmentBranch('D-17263');
      expect(branch.branchCode).toBe('EXCHANGE');
      expect(branch.branchName).toBe('Exchange Replacement');
      expect(branch.isBranchFulfillment).toBe(true);
      expect(branch.baseOrderId).toBe('17263');
    });

    it('defaults to Central Warehouse (Online) when no branch suffix is present', () => {
      const branch = detectFulfillmentBranch('17263');
      expect(branch.branchCode).toBe('ONLINE');
      expect(branch.branchName).toBe('Central Warehouse (Online)');
      expect(branch.isBranchFulfillment).toBe(false);
      expect(branch.baseOrderId).toBe('17263');
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

    it('resolves consignment tracking by order ID when consignment ID is missing in WooCommerce', async () => {
      // Order 16048 has no consignment ID specified, but exists in baseline pathaoDelivery
      const mockOrders = [
        {
          'Order ID': '16048',
          orderId: '16048',
          'Order Date': '2026-10-15 10:30',
          'Customer Name': 'Tanvir Ahmed',
          Phone: '01700000000',
          'Item Name': 'DEEN High-End Raw Washed Jeans',
          SKU: '101-0100-149',
          Quantity: 1,
          'Item Cost': 2490,
          'Order Amount': 2490,
          'Delivery Status': 'shipped',
          'Consignment ID': '', // Empty in WooCommerce
        },
      ];

      const result = await syncLiveTerminalData({
        activeOrders: mockOrders,
        limitConsignments: 5,
        skipNetwork: true,
      });

      expect(result.success).toBe(true);
      const enrichedOrder = result.orders.find((o) => o['Order ID'] === '16048');
      expect(enrichedOrder).toBeDefined();
      expect(enrichedOrder?.consignmentId).toBe('RD290926W5BWHU');
      expect(enrichedOrder?.['Courier Status']).toBe('Returned');
    });

    it('resolves consignment tracking by customer phone when order ID mismatches', async () => {
      // Order ID is completely different, but phone number matches baseline Pathao record (1952700500)
      const mockOrders = [
        {
          'Order ID': 'MISMATCH-99999',
          orderId: 'MISMATCH-99999',
          'Order Date': '2026-10-15 10:30',
          'Customer Name': 'Deen Customer',
          Phone: '01952700500',
          'Item Name': 'DEEN Apparel Item',
          SKU: 'GEN-001',
          Quantity: 1,
          'Item Cost': 2000,
          'Order Amount': 2000,
          'Delivery Status': 'processing',
          'Consignment ID': '',
        },
      ];

      const result = await syncLiveTerminalData({
        activeOrders: mockOrders,
        limitConsignments: 5,
        skipNetwork: true,
      });

      expect(result.success).toBe(true);
      const enrichedOrder = result.orders.find((o) => o['Order ID'] === 'MISMATCH-99999');
      expect(enrichedOrder).toBeDefined();
      expect(enrichedOrder?.consignmentId).toBe('RD260926A2ADZ2');
      expect(enrichedOrder?.['Courier Status']).toBe('Returned');
    });

    it('selects the latest Pathao order when multiple orders exist for the same customer phone', () => {
      const courierMap: Record<string, CourierTrackingInfo> = {};
      const phoneMap = new Map<string, CourierTrackingInfo[]>();

      const olderOrder = {
        'Order consignment id': 'RD-OLD-1111',
        'Merchant order id': '1001',
        'Recipient phone': '01711223344',
        'Order status': 'Delivered',
        'Order created at': '2026-10-10 10:00:00',
      };

      const newerOrder = {
        'Order consignment id': 'RD-NEW-2222',
        'Merchant order id': '1002',
        'Recipient phone': '01711223344',
        'Order status': 'In Transit',
        'Order created at': '2026-10-16 15:30:00',
      };

      indexTrackingRecord(olderOrder, courierMap, phoneMap);
      indexTrackingRecord(newerOrder, courierMap, phoneMap);

      const candidateList = phoneMap.get('01711223344');
      expect(candidateList).toBeDefined();
      expect(candidateList?.length).toBe(2);
      // The newest order must be prioritized first
      expect(candidateList?.[0].consignmentId).toBe('RD-NEW-2222');
      expect(candidateList?.[0].courierStatus).toBe('In Transit');
    });

    it('parses timestamps across Excel serial floats, ISO strings, and epoch numbers', () => {
      // Excel serial 46295.72 -> October 2026
      const excelEpoch = parseDateToEpoch(46295.72);
      expect(excelEpoch).toBeGreaterThan(1700000000000);

      // ISO string
      const isoEpoch = parseDateToEpoch('2026-10-16T12:00:00Z');
      expect(isoEpoch).toBe(Date.parse('2026-10-16T12:00:00Z'));

      // Empty or invalid
      expect(parseDateToEpoch('')).toBe(0);
      expect(parseDateToEpoch(null)).toBe(0);
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
