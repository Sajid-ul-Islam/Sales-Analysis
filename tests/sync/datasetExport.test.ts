import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadDatasetAsJson } from '@/lib/datasetExport';
import { compareOrdersByNumber, getExportCustomerName } from '@/lib/excelExport';

describe('Dataset Snapshot Export & Sorting Invariants (Method 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Method 1: Dataset Export Formatting', () => {
    it('generates standard DatasetSnapshot schema without throwing in SSR', () => {
      // In Node environment (window === undefined), downloadDatasetAsJson safely no-ops
      expect(() => {
        downloadDatasetAsJson({
          orders: [{ orderId: '1001', 'Item Cost': 1200 } as any],
          returns: [],
          partials: [],
          exchanges: [],
          pathaoDelivery: [],
        });
      }).not.toThrow();
    });
  });

  describe('Order Export Formatting & Sorting Invariants', () => {
    it('sorts orders naturally by numeric order number including suffixes and prefixes', () => {
      const testOrders = [
        { 'Order ID': '18085' },
        { 'Order ID': '17263' },
        { 'Order ID': '18000' },
        { 'Order ID': '17263 m' },
        { 'Order ID': '17263 c' },
        { 'Order ID': 'D-17250' },
        { 'Order ID': '#18001' },
      ];

      const sorted = [...testOrders].sort(compareOrdersByNumber);
      const sortedIds = sorted.map((o) => o['Order ID']);

      expect(sortedIds).toEqual([
        'D-17250',
        '17263',
        '17263 c',
        '17263 m',
        '18000',
        '#18001',
        '18085',
      ]);
    });

    it('extracts full unmasked customer name even if masked version with asterisks is present', () => {
      // Masked in Customer Name, unmasked in rawCustomerName
      const order1 = {
        'Customer Name': 'T*** P***',
        rawCustomerName: 'Tusher Paul',
      };
      expect(getExportCustomerName(order1)).toBe('Tusher Paul');

      // Unmasked in customerName
      const order2 = {
        customerName: 'Sajidul Islam',
      };
      expect(getExportCustomerName(order2)).toBe('Sajidul Islam');

      // Billing names
      const order3 = {
        billing: { first_name: 'Tanvir', last_name: 'Ahmed' },
      };
      expect(getExportCustomerName(order3)).toBe('Tanvir Ahmed');

      // Fallback
      expect(getExportCustomerName({})).toBe('Customer');
    });

    it('extracts full unmasked 11-digit phone number even if masked version is present', async () => {
      const { getExportPhoneNumber } = await import('@/lib/excelExport');

      // Masked in Phone, but unmasked in rawPhone
      const order1 = {
        Phone: '0178****157',
        rawPhone: '01783650157',
      };
      expect(getExportPhoneNumber(order1)).toBe('01783650157');

      // Masked in Phone, unmasked in formattedPhone with 880 prefix
      const order2 = {
        Phone: '0178****157',
        formattedPhone: '8801783650157',
      };
      expect(getExportPhoneNumber(order2)).toBe('01783650157');

      // Plain clean 11-digit phone
      const order3 = {
        phone: '01812345678',
      };
      expect(getExportPhoneNumber(order3)).toBe('01812345678');
    });
  });
});
