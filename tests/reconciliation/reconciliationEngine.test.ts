import { describe, it, expect } from 'vitest';
import {
  runReconciliationEngine,
  detectFulfillmentBranch,
  normalizeOrderId,
  extractBaseOrderId,
} from '@/lib/reconciliationEngine';
import {
  singleParcelDeliveredOrder,
  singleParcelDeliveredCourier,
  nonPaidReturnedOrder,
  nonPaidReturnedCourier,
  multiParcelPaidReturnOrder,
  multiParcelPaidReturnCourier,
  partialDeliveryOrder,
  partialDeliveryCourier,
  exchangeOrder,
  exchangeCourier,
  splitParcelDeliveredOrder,
  splitParcelDeliveredCourier,
} from '../fixtures/reconciliationFixtures';

describe('DEEN Commerce Reconciliation Engine — Domain Invariant Tests', () => {
  describe('Rule 1: Fulfillment Branch & Courier ID Detection', () => {
    it('detects online store for central warehouse orders without suffix', () => {
      const res = detectFulfillmentBranch('17263');
      expect(res.branch).toBe('Online Store (Central Warehouse)');
      expect(res.suffix).toBe('');
    });

    it('detects Cumilla Branch for suffix "c"', () => {
      const res1 = detectFulfillmentBranch('17263 c');
      const res2 = detectFulfillmentBranch('17263-c');
      const res3 = detectFulfillmentBranch('17263c');
      expect(res1.branch).toBe('Cumilla Branch');
      expect(res2.branch).toBe('Cumilla Branch');
      expect(res3.branch).toBe('Cumilla Branch');
    });

    it('detects Wari Branch for suffix "w"', () => {
      const res = detectFulfillmentBranch('17263 w');
      expect(res.branch).toBe('Wari Branch');
      expect(res.suffix).toBe('w');
    });

    it('detects Sylhet Branch for suffix "s"', () => {
      const res = detectFulfillmentBranch('17263 s');
      expect(res.branch).toBe('Sylhet Branch');
      expect(res.suffix).toBe('s');
    });

    it('detects Mirpur Outlet POS for suffix "m"', () => {
      const res = detectFulfillmentBranch('17263 m');
      expect(res.branch).toBe('Mirpur Outlet POS');
      expect(res.suffix).toBe('m');
    });

    it('normalizes exchange prefixes correctly (D-, DD-, EXCH-)', () => {
      expect(normalizeOrderId('D-17263')).toBe('17263');
      expect(normalizeOrderId('DD-17263')).toBe('17263');
      expect(normalizeOrderId('EXCH-17263')).toBe('17263');
      expect(extractBaseOrderId('D-17263 c')).toBe('17263');
    });
  });

  describe('Rule 2: Full Delivery Reconciliation', () => {
    it('correctly classifies a single parcel delivered order as DELIVERED', () => {
      const result = runReconciliationEngine(
        singleParcelDeliveredOrder,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        singleParcelDeliveredCourier
      );

      expect(result.reconciledOrders.length).toBeGreaterThan(0);
      const row = result.reconciledOrders.find(r => r.orderId === '20001');
      expect(row).toBeDefined();
      expect(row?.orderDeliveryStatus).toBe('Delivered');
      expect(row?.itemDeliveryStatus).toBe('Delivered');
    });

    it('classifies split multi-parcel order as DELIVERED when all branch parcels are delivered', () => {
      const result = runReconciliationEngine(
        splitParcelDeliveredOrder,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        splitParcelDeliveredCourier
      );

      const rows = result.reconciledOrders.filter(r => r.orderId === '20006');
      expect(rows.length).toBe(2);
      rows.forEach(r => {
        expect(r.orderDeliveryStatus).toBe('Delivered');
        expect(r.itemDeliveryStatus).toBe('Delivered');
      });
    });
  });

  describe('Rule 3: Full Return (Non-Paid Return)', () => {
    it('correctly classifies an order as Returned when 0 COD was collected', () => {
      const result = runReconciliationEngine(
        nonPaidReturnedOrder,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        nonPaidReturnedCourier
      );

      const row = result.reconciledOrders.find(r => r.orderId === '20002');
      expect(row).toBeDefined();
      expect(['Not Paid Return', 'Returned'].includes(row?.orderDeliveryStatus || '')).toBe(true);
      expect(row?.itemDeliveryStatus).toBe('Returned');
    });
  });

  describe('Rule 4: Multi-Parcel Paid Return Propagation Rule', () => {
    it('propagates Paid Return to the order if at least one parcel collected return fees', () => {
      const result = runReconciliationEngine(
        multiParcelPaidReturnOrder,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        multiParcelPaidReturnCourier
      );

      const rows = result.reconciledOrders.filter(r => r.orderId === '20003');
      expect(rows.length).toBeGreaterThan(0);
      // All parcels in the order must inherit Paid Return
      rows.forEach(r => {
        expect(r.orderDeliveryStatus).toBe('Paid Return');
        expect(r.itemDeliveryStatus).toBe('Returned');
      });
    });
  });

  describe('Rule 5: Partial Delivery & Integer Constraint', () => {
    it('reconciles partial orders with strictly integer kept and returned quantities', () => {
      const result = runReconciliationEngine(
        partialDeliveryOrder,
        [],
        [],
        { excludeAugust: false, excludePOS: false, insideDeliveryFee: 50 },
        [],
        partialDeliveryCourier
      );

      const rows = result.reconciledOrders.filter(r => r.orderId === '20004');
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach(r => {
        expect(r.orderDeliveryStatus).toBe('Partial');
        // Returned quantity must be an integer, never a float (e.g. 0.5)
        expect(Number.isInteger(r.quantity)).toBe(true);
      });

      // One item was kept (৳700 shirt) and one was returned (৳1500 jeans)
      const keptRow = rows.find(r => r.sku === 'SHIRT-700');
      const returnedRow = rows.find(r => r.sku === 'JEANS-1500');
      expect(keptRow?.itemDeliveryStatus).toBe('Delivered');
      expect(returnedRow?.itemDeliveryStatus).toBe('Returned');
    });
  });

  describe('Rule 6: Exchanged Orders', () => {
    it('classifies D- prefix orders as Exchange', () => {
      const result = runReconciliationEngine(
        exchangeOrder,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        exchangeCourier
      );

      const row = result.reconciledOrders.find(r => r.orderId.includes('20005'));
      expect(row).toBeDefined();
      expect(row?.orderDeliveryStatus).toBe('Exchange');
      expect(row?.itemDeliveryStatus).toBe('Exchange');
    });
  });

  describe('Rule 7: WordPress / WooCommerce Status Marks & Pathao Plugin Telemetry (No Uploaded Manifests)', () => {
    it('reconciles WordPress return mark into FULL_RETURN without requiring uploaded Excel returns', () => {
      const wpReturnSalesOrders = [
        {
          'Order ID': '30001',
          'Order Date': '2026-10-15',
          'Customer Name': 'Rahim Uddin',
          'Phone': '01700112233',
          'City': 'Dhaka',
          'SKU': 'JEANS-301',
          'Item Name': 'DEEN Slim Jeans',
          'Quantity': 1,
          'Item Cost': 2100,
          'Order Amount': 2100,
          'Delivery Status': 'returned',
          'status': 'returned',
          'isReturnFromWp': true,
          'wpDeliveryStatus': 'Not Paid Return',
        },
      ];

      const result = runReconciliationEngine(
        wpReturnSalesOrders,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        []
      );

      expect(result.reconciledOrders.length).toBe(1);
      const row = result.reconciledOrders[0];
      expect(row.orderDeliveryStatus).toBe('Not Paid Return');
      expect(row.itemDeliveryStatus).toBe('Returned');
      expect(row.orderCategory).toBe('FULL_RETURN');
    });

    it('reconciles WordPress partial mark into PARTIAL with knapsack item allocation without uploaded manifest', () => {
      const wpPartialSalesOrders = [
        {
          'Order ID': '30002',
          'Order Date': '2026-10-16',
          'Customer Name': 'Karim Ullah',
          'Phone': '01800112244',
          'City': 'Chittagong',
          'SKU': 'SHIRT-OX-01',
          'Item Name': 'DEEN Oxford Shirt',
          'Quantity': 1,
          'Item Cost': 1200,
          'Order Amount': 3200,
          'Delivery Status': 'partial',
          'status': 'partial',
          'isPartialFromWp': true,
          'pathaoCollectedAmount': 1200,
          'wpDeliveryStatus': 'Partial',
        },
        {
          'Order ID': '30002',
          'Order Date': '2026-10-16',
          'Customer Name': 'Karim Ullah',
          'Phone': '01800112244',
          'City': 'Chittagong',
          'SKU': 'JEANS-REG-01',
          'Item Name': 'DEEN Regular Jeans',
          'Quantity': 1,
          'Item Cost': 2000,
          'Order Amount': 3200,
          'Delivery Status': 'partial',
          'status': 'partial',
          'isPartialFromWp': true,
          'pathaoCollectedAmount': 1200,
          'wpDeliveryStatus': 'Partial',
        },
      ];

      const result = runReconciliationEngine(
        wpPartialSalesOrders,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        []
      );

      const rows = result.reconciledOrders.filter(r => r.orderId === '30002');
      expect(rows.length).toBe(2);
      rows.forEach(r => {
        expect(r.orderDeliveryStatus).toBe('Partial');
        expect(r.orderCategory).toBe('PARTIAL');
        expect(Number.isInteger(r.quantity)).toBe(true);
      });

      const kept = rows.find(r => r.itemDeliveryStatus === 'Delivered');
      const returned = rows.find(r => r.itemDeliveryStatus === 'Returned');
      expect(kept).toBeDefined();
      expect(returned).toBeDefined();
      expect(kept?.sku).toBe('SHIRT-OX-01');
      expect(returned?.sku).toBe('JEANS-REG-01');
    });

    it('reconciles WordPress exchange mark into EXCHANGE', () => {
      const wpExchangeSalesOrders = [
        {
          'Order ID': '30003',
          'Order Date': '2026-10-17',
          'Customer Name': 'Anisur Rahman',
          'Phone': '01900112255',
          'City': 'Dhaka',
          'SKU': 'POLO-01',
          'Item Name': 'DEEN Polo T-Shirt',
          'Quantity': 1,
          'Item Cost': 950,
          'Order Amount': 950,
          'Delivery Status': 'exchange',
          'status': 'exchange',
          'isExchangeFromWp': true,
          'wpDeliveryStatus': 'Exchange',
        },
      ];

      const result = runReconciliationEngine(
        wpExchangeSalesOrders,
        [],
        [],
        { excludeAugust: false, excludePOS: false },
        [],
        []
      );

      expect(result.reconciledOrders.length).toBe(1);
      const row = result.reconciledOrders[0];
      expect(row.orderDeliveryStatus).toBe('Exchange');
      expect(row.itemDeliveryStatus).toBe('Exchange');
      expect(row.orderCategory).toBe('EXCHANGE');
      // Invariant: Exchange orders must NOT inflate full delivered commercial orders
      expect(result.summary.fullDeliveredOrders).toBe(0);
      expect(result.summary.totalExchangedOrders).toBe(1);
      expect(result.exchangedOrders.length).toBe(1);
    });
  });
});
