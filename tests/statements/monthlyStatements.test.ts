import { describe, it, expect } from 'vitest';
import {
  computeMonthlyStatementSummaries,
  extractOrderMonthKey,
  MonthlyStatementSummary,
} from '@/lib/monthlyStatements';
import { RawOrderRow } from '@/types';
import { buildMonthlyNetSalesWorkbook } from '@/lib/excelExport';
import { ReconciliationResult } from '@/lib/reconciliationEngine';

describe('Executive Monthly Statements Engine', () => {
  describe('extractOrderMonthKey', () => {
    it('correctly extracts YYYY-MM from standard ISO string', () => {
      expect(extractOrderMonthKey('2026-10-15T14:30:00')).toBe('2026-10');
      expect(extractOrderMonthKey('2026-09-01T00:00:00Z')).toBe('2026-09');
      expect(extractOrderMonthKey('2026-11-03T15:20:19')).toBe('2026-11');
    });

    it('correctly extracts YYYY-MM from DD/MM/YYYY and DD-MM-YYYY formats', () => {
      expect(extractOrderMonthKey('15/10/2026')).toBe('2026-10');
      expect(extractOrderMonthKey('01-09-2026 12:00:00')).toBe('2026-09');
    });

    it('correctly extracts YYYY-MM from Excel numeric serial date', () => {
      // 46295 corresponds to 2026-09-30
      expect(extractOrderMonthKey(46295.99)).toBe('2026-09');
    });

    it('returns null for empty or invalid values', () => {
      expect(extractOrderMonthKey('')).toBeNull();
      expect(extractOrderMonthKey(null)).toBeNull();
      expect(extractOrderMonthKey(undefined)).toBeNull();
    });
  });

  describe('computeMonthlyStatementSummaries', () => {
    const mockMultiMonthOrders: Partial<RawOrderRow>[] = [
      // September Orders
      {
        'Order ID': '16001',
        orderId: '16001',
        'Order Date': '2026-09-10T10:00:00',
        orderDeliveryStatus: 'Delivered',
        Quantity: 2,
        'Item Cost': 1500,
      },
      {
        'Order ID': '16002',
        orderId: '16002',
        'Order Date': '2026-09-20T12:00:00',
        orderDeliveryStatus: 'Returned',
        Quantity: 1,
        'Item Cost': 1000,
      },
      // October Orders
      {
        'Order ID': '17001',
        orderId: '17001',
        'Order Date': '2026-10-05T10:00:00',
        orderDeliveryStatus: 'Delivered',
        Quantity: 1,
        'Item Cost': 2000,
      },
      {
        'Order ID': '17002',
        orderId: '17002',
        'Order Date': '2026-10-15T14:00:00',
        orderDeliveryStatus: 'Paid Return',
        Quantity: 1,
        'Item Cost': 1200,
      },
      {
        'Order ID': '17003',
        orderId: '17003',
        'Order Date': '2026-10-25T16:00:00',
        orderDeliveryStatus: 'completed',
        wpDeliveryStatus: 'Not Paid Return',
        Substatus: 'Return',
        Quantity: 1,
        'Item Cost': 1500,
      },
      // November Orders (Live ongoing)
      {
        'Order ID': '19001',
        orderId: '19001',
        'Order Date': '2026-11-02T11:00:00',
        orderDeliveryStatus: 'Delivered',
        Quantity: 1,
        'Item Cost': 1800,
      },
    ];

    it('accurately groups orders into distinct monthly statements sorted descending', () => {
      const summaries = computeMonthlyStatementSummaries(mockMultiMonthOrders as any);
      expect(summaries.length).toBe(3);

      expect(summaries[0].monthKey).toBe('2026-11');
      expect(summaries[0].label).toBe('November 2026');
      expect(summaries[0].status).toBe('ONGOING_LIVE');
      expect(summaries[0].isCurrentMonth).toBe(true);

      expect(summaries[1].monthKey).toBe('2026-10');
      expect(summaries[1].label).toBe('October 2026');
      expect(summaries[1].status).toBe('CLOSED');
      expect(summaries[1].isCurrentMonth).toBe(false);

      expect(summaries[2].monthKey).toBe('2026-09');
      expect(summaries[2].label).toBe('September 2026');
      expect(summaries[2].status).toBe('CLOSED');
      expect(summaries[2].isCurrentMonth).toBe(false);
    });

    it('calculates exact unit counts, gross revenue, and delivered net revenue per month', () => {
      const summaries = computeMonthlyStatementSummaries(mockMultiMonthOrders as any);

      // September: 3 units (2 delivered, 1 returned). Gross = 3000 + 1000 = 4000. Delivered = 3000.
      const sept = summaries.find((s) => s.monthKey === '2026-09')!;
      expect(sept.unitCount).toBe(3);
      expect(sept.grossRevenue).toBe(4000);
      expect(sept.deliveredRevenue).toBe(3000);
      expect(sept.deliveredUnits).toBe(2);
      expect(sept.returnedUnits).toBe(1);
      expect(sept.deliveryRate).toBe(66.7);
      expect(sept.returnRate).toBe(33.3);

      // October: 3 units (1 delivered, 2 returned). Gross = 2000 + 1200 + 1500 = 4700. Delivered = 2000.
      const oct = summaries.find((s) => s.monthKey === '2026-10')!;
      expect(oct.unitCount).toBe(3);
      expect(oct.grossRevenue).toBe(4700);
      expect(oct.deliveredRevenue).toBe(2000);
      expect(oct.paidReturnUnits).toBe(1);
      expect(oct.nonPaidReturnUnits).toBe(1);

      // November: 1 unit delivered. Gross = 1800. Delivered = 1800.
      const nov = summaries.find((s) => s.monthKey === '2026-11')!;
      expect(nov.unitCount).toBe(1);
      expect(nov.grossRevenue).toBe(1800);
      expect(nov.deliveredRevenue).toBe(1800);
      expect(nov.deliveryRate).toBe(100);
    });

    it('detects phantom completed revenue discrepancies when store status is completed but item returned', () => {
      const summaries = computeMonthlyStatementSummaries(mockMultiMonthOrders as any);
      const oct = summaries.find((s) => s.monthKey === '2026-10')!;
      expect(oct.phantomDiscrepancyCount).toBe(1);
      expect(oct.phantomDiscrepancyRevenue).toBe(1500);
    });
  });

  describe('Monthly Statement 7-Sheet Workbook Generator', () => {
    it('successfully generates the authoritative 7-sheet closing workbook with custom month label', () => {
      const mockResult: ReconciliationResult = {
        reconciledOrders: [
          {
            orderId: '18001',
            orderNumber: '18001',
            orderDeliveryStatus: 'Delivered',
            itemDeliveryStatus: 'Delivered',
            customerName: 'Rahim Khan',
            phone: '01711223344',
            city: 'Dhaka',
            districtArea: 'Inside Dhaka',
            sku: '101-0100-150',
            itemName: 'DEEN Slim Jeans',
            quantity: 1,
            itemCost: 1500,
            orderTotalAmount: 1500,
            netRevenueImpact: 1500,
            category: 'Jeans',
            sipInventory: 'Central Warehouse',
            createdVia: 'checkout',
            isOrderOnline: true,
            isPos: false,
          } as any,
        ],
        returnedItems: [],
        skuAnalytics: [],
        customerRiskProfiles: [],
        summary: {
          grossOrders: 1,
          totalGrossItems: 1,
          fullDeliveredOrders: 1,
          partialOrders: 0,
          fullReturnedOrders: 0,
          grossInvoicedSales: 1500,
          netDeliveredRevenue: 1500,
          returnLossValue: 0,
          overallReturnRate: 0,
          pathaoTotalCourierCharge: 60,
          pathaoNetPayable: 60,
          outsideDhakaOrdersCount: 0,
          insideDhakaOrdersCount: 1,
        } as any,
        courierMismatches: [],
        exchangedOrders: [],
      };

      const wb = buildMonthlyNetSalesWorkbook(mockResult, {
        monthLabel: 'October 2026',
      });

      expect(wb.SheetNames).toEqual([
        'Executive Summary & P&L',
        'Category Sales & Retention',
        'Master SKU Leaderboard',
        'Commercial Orders Ledger',
        'Item-Wise Returns & Partials',
        'Omnichannel & SIP Inventory',
        'Courier & COD Settlement',
      ]);

      // Check auto-fitted column widths exist on every sheet
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        expect(ws['!cols']).toBeDefined();
        expect(ws['!cols']!.length).toBeGreaterThan(0);
      });
    });
  });
});

