import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildMonthlyNetSalesWorkbook,
  cleanProductMainName,
  extractMasterSku,
} from '@/lib/excelExport';
import { ReconciliationResult } from '@/lib/reconciliationEngine';
import { ReconciledOrderRow, ReturnedItemRow, SkuAnalytics } from '@/types';

function createMockReconciliationResult(): ReconciliationResult {
  const mockReconciledOrders: ReconciledOrderRow[] = [
    {
      orderId: '1001',
      lineStatus: 'Delivered',
      deliveryStatus: 'Delivered',
      orderDeliveryStatus: 'Delivered',
      itemDeliveryStatus: 'Delivered',
      orderDate: new Date('2026-10-15T10:00:00Z'),
      customerName: 'Sajid Islam',
      phone: '01711000111',
      city: 'Dhaka',
      districtArea: 'Inside Dhaka',
      sku: 'DEN-001-32',
      itemName: 'Vintage Slim Denim - 32',
      quantity: 1,
      itemCost: 2200,
      orderAmount: 2250,
      netRevenueImpact: 2200,
      paymentMethod: 'cod',
      orderCategory: 'DELIVERED',
      isPaidReturn: false,
      isExchange: false,
      requiresManualReview: false,
      fulfillmentLocation: 'Online Store (Central Warehouse)',
      sipInventory: 'Central Warehouse',
    },
    {
      orderId: '1001 c',
      lineStatus: 'Delivered',
      deliveryStatus: 'Delivered',
      orderDeliveryStatus: 'Delivered',
      itemDeliveryStatus: 'Delivered',
      orderDate: new Date('2026-10-15T10:00:00Z'),
      customerName: 'Sajid Islam',
      phone: '01711000111',
      city: 'Cumilla',
      districtArea: 'Outside Dhaka',
      sku: 'POLO-002-L',
      itemName: 'Classic Pique Polo - L',
      quantity: 1,
      itemCost: 1400,
      orderAmount: 1490,
      netRevenueImpact: 1400,
      paymentMethod: 'cod',
      orderCategory: 'DELIVERED',
      isPaidReturn: false,
      isExchange: false,
      requiresManualReview: false,
      fulfillmentLocation: 'Cumilla Branch',
      sipInventory: 'Cumilla Branch',
    },
    {
      orderId: '1002',
      lineStatus: 'Returned',
      deliveryStatus: 'Full Return (RTO)',
      orderDeliveryStatus: 'Not Paid Return',
      itemDeliveryStatus: 'Returned',
      orderDate: new Date('2026-10-16T12:00:00Z'),
      customerName: 'Tanvir Ahmed',
      phone: '01811222333',
      city: 'Chattogram',
      districtArea: 'Outside Dhaka',
      sku: 'DEN-001-34',
      itemName: 'Vintage Slim Denim - 34',
      quantity: 1,
      itemCost: 2200,
      orderAmount: 2290,
      netRevenueImpact: 0,
      paymentMethod: 'cod',
      orderCategory: 'FULL_RETURN',
      isPaidReturn: false,
      isExchange: false,
      requiresManualReview: false,
      fulfillmentLocation: 'Online Store (Central Warehouse)',
      sipInventory: 'Central Warehouse',
    },
    {
      orderId: '1003',
      lineStatus: 'POS Sale',
      deliveryStatus: 'Walk-in Sale',
      orderDeliveryStatus: 'Delivered',
      itemDeliveryStatus: 'Delivered',
      orderDate: new Date('2026-10-16T15:00:00Z'),
      customerName: 'Walk-in Customer',
      phone: '01911999888',
      city: 'Dhaka',
      districtArea: 'Inside Dhaka',
      sku: 'TSH-003-M',
      itemName: 'Heavyweight Solid Tee - M',
      quantity: 1,
      itemCost: 950,
      orderAmount: 950,
      netRevenueImpact: 950,
      paymentMethod: 'pos_cash',
      orderCategory: 'DELIVERED',
      isPaidReturn: false,
      isExchange: false,
      requiresManualReview: false,
      fulfillmentLocation: 'Mirpur Outlet POS',
      sipInventory: 'Mirpur Outlet POS',
    },
    {
      orderId: 'D-1004',
      lineStatus: 'Exchange Replacement',
      deliveryStatus: 'Exchange Delivered',
      orderDeliveryStatus: 'Exchange',
      itemDeliveryStatus: 'Exchange',
      orderDate: new Date('2026-10-17T09:00:00Z'),
      customerName: 'Rafiqul Islam',
      phone: '01611444555',
      city: 'Dhaka',
      districtArea: 'Inside Dhaka',
      sku: 'DEN-001-36',
      itemName: 'Vintage Slim Denim - 36',
      quantity: 1,
      itemCost: 2200,
      orderAmount: 0,
      netRevenueImpact: 0,
      paymentMethod: 'cod',
      orderCategory: 'EXCHANGE',
      isPaidReturn: false,
      isExchange: true,
      requiresManualReview: false,
      fulfillmentLocation: 'Exchange Replacement',
      sipInventory: 'Exchange Replacement',
    },
  ];

  const mockReturnedItems: ReturnedItemRow[] = [
    {
      orderId: '1002',
      returnSource: 'Full Return (Non-Paid Return)',
      deliveryStatus: 'Full Return (RTO)',
      orderDate: new Date('2026-10-16T12:00:00Z'),
      customerName: 'Tanvir Ahmed',
      phone: '01811222333',
      districtArea: 'Outside Dhaka',
      sku: 'DEN-001-34',
      itemName: 'Vintage Slim Denim - 34',
      quantity: 1,
      itemCost: 2200,
      returnedValue: 2200,
      sipInventory: 'Central Warehouse',
      orderAmount: 2290,
    },
  ];

  const mockSkuAnalytics: SkuAnalytics[] = [
    {
      sku: 'DEN-001-32',
      itemName: 'Vintage Slim Denim - 32',
      category: 'Jeans',
      grossQty: 1,
      deliveredQty: 1,
      returnedQty: 0,
      deliveredRevenue: 2200,
      returnRate: 0,
      totalLossFromReturns: 0,
    },
    {
      sku: 'DEN-001-34',
      itemName: 'Vintage Slim Denim - 34',
      category: 'Jeans',
      grossQty: 1,
      deliveredQty: 0,
      returnedQty: 1,
      deliveredRevenue: 0,
      returnRate: 100,
      totalLossFromReturns: 2200,
    },
    {
      sku: 'POLO-002-L',
      itemName: 'Classic Pique Polo - L',
      category: 'Polo Shirts',
      grossQty: 1,
      deliveredQty: 1,
      returnedQty: 0,
      deliveredRevenue: 1400,
      returnRate: 0,
      totalLossFromReturns: 0,
    },
  ];

  return {
    reconciledOrders: mockReconciledOrders,
    returnedItems: mockReturnedItems,
    skuAnalytics: mockSkuAnalytics,
    customerRiskProfiles: [],
    summary: {
      grossOrders: 4,
      totalGrossItems: 4,
      fullDeliveredOrders: 2,
      partialOrders: 0,
      fullReturnedOrders: 1,
      totalReturnedOrders: 1,
      totalPartialProducts: 0,
      regularReturnedQty: 1,
      partialReturnedQty: 0,
      partialDeliveredQty: 0,
      partialTotalItems: 0,
      totalReturnedQty: 1,
      totalReturnedPlusPartial: 1,
      returnRate: 25.0,
      fullReturnRate: 25.0,
      partialRate: 0,
      grossRevenue: 6740,
      netDeliveredRevenue: 4550,
      totalItemsDelivered: 2,
      insideOrders: 2,
      outsideOrders: 2,
      insideReturns: 0,
      outsideReturns: 1,
      insidePartials: 0,
      outsidePartials: 0,
      insideNetRevenue: 3150,
      outsideNetRevenue: 1400,
      outsideRatio: '1.0',
      courierCost: {
        grossCharge: 420,
        discount: 40,
        netCharge: 380,
        paidReturnCollectedCod: 0,
        netCourierBurden: 240,
        consignmentsCount: 3,
        customerDeliveryFeeCollected: 140,
        collectedInsideCount: 1,
        collectedOutsideCount: 1,
        collectedDeliveryFeeInside: 50,
        collectedDeliveryFeeOutside: 90,
        collectedEligibleOrdersCount: 2,
        netCourierCostAfterDeliveryFee: 240,
      },
      unitEconomics: {
        grossInvoicedSales: 6740,
        netRealizedSales: 4550,
        estimatedCogs: 1911,
        grossMargin: 2639,
        totalCourierExpense: 380,
        packagingLoss: 25,
        metaAdCost: 800,
        netContributionMargin: 1434,
        netMarginPercentage: 31.52,
        roas: 5.69,
        cac: 400,
      },
      totalExchangedOrders: 1,
      totalExchangedItemsQty: 1,
      totalExchangeCodCollected: 0,
      totalExchangeCourierExpense: 70,
    },
    courierMismatches: [],
    exchangedOrders: [],
  };
}

describe('Monthly Net Sales Report (.xlsx) Export Engine', () => {
  it('correctly consolidates apparel size variants into Master SKUs', () => {
    expect(extractMasterSku('DEN-001-32')).toBe('DEN-001');
    expect(extractMasterSku('DEN-001-34')).toBe('DEN-001');
    expect(extractMasterSku('POLO-002_XL')).toBe('POLO-002');
    expect(cleanProductMainName('Vintage Slim Denim - 32')).toBe('Vintage Slim Denim');
    expect(cleanProductMainName('Vintage Slim Denim - 34')).toBe('Vintage Slim Denim');
    expect(cleanProductMainName('Classic Pique Polo - L')).toBe('Classic Pique Polo');
  });

  it('builds a 7-sheet Excel workbook with all expected sheet names', () => {
    const mockResult = createMockReconciliationResult();
    const wb = buildMonthlyNetSalesWorkbook(mockResult, { monthLabel: 'October 2026' });

    expect(wb.SheetNames).toHaveLength(7);
    expect(wb.SheetNames).toEqual([
      'Executive Summary & P&L',
      'Category Sales & Retention',
      'Master SKU Leaderboard',
      'Commercial Orders Ledger',
      'Item-Wise Returns & Partials',
      'Omnichannel & SIP Inventory',
      'Courier & COD Settlement',
    ]);
  });

  it('enforces column auto-fit sizing on every sheet to prevent cell truncation', () => {
    const mockResult = createMockReconciliationResult();
    const wb = buildMonthlyNetSalesWorkbook(mockResult, { monthLabel: 'October 2026' });

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      expect(ws['!cols']).toBeDefined();
      expect(ws['!cols']!.length).toBeGreaterThan(0);
      for (const col of ws['!cols']!) {
        expect(col.wch).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('isolates offline POS sales and exchange replacements from the commercial sales ledger', () => {
    const mockResult = createMockReconciliationResult();
    const wb = buildMonthlyNetSalesWorkbook(mockResult, { monthLabel: 'October 2026' });

    const commercialSheet = wb.Sheets['Commercial Orders Ledger'];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(commercialSheet);

    // Order 1003 is POS sale -> must be excluded
    // Order D-1004 is Exchange replacement -> must be excluded
    const orderIds = rows.map((r) => r['Order ID']);
    expect(orderIds).toContain('1001');
    expect(orderIds).toContain('1001 c');
    expect(orderIds).toContain('1002');
    expect(orderIds).not.toContain('1003');
    expect(orderIds).not.toContain('D-1004');
  });

  it('aggregates Master SKUs and calculates retention & return rates correctly', () => {
    const mockResult = createMockReconciliationResult();
    const wb = buildMonthlyNetSalesWorkbook(mockResult, { monthLabel: 'October 2026' });

    const masterSheet = wb.Sheets['Master SKU Leaderboard'];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(masterSheet);

    const denim = rows.find((r) => r['Master SKU'] === 'DEN-001');
    expect(denim).toBeDefined();
    // 1 dispatched in size 32, 1 in size 34 -> total 2
    expect(denim!['Dispatched (Units)']).toBe(2);
    expect(denim!['Delivered (Units)']).toBe(1);
    expect(denim!['Returned (Units)']).toBe(1);
    expect(denim!['Retention Rate (%)']).toBe('50.0%');
    expect(denim!['Return Rate (%)']).toBe('50.0%');
  });

  it('records correct branch fulfillment breakdown on Omnichannel & SIP Inventory sheet', () => {
    const mockResult = createMockReconciliationResult();
    const wb = buildMonthlyNetSalesWorkbook(mockResult, { monthLabel: 'October 2026' });

    const omniSheet = wb.Sheets['Omnichannel & SIP Inventory'];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(omniSheet);

    const warehouseNode = rows.find((r) => r['Fulfillment Location'] === 'Central Warehouse');
    const cumillaNode = rows.find((r) => r['Fulfillment Location'] === 'Cumilla Branch');

    expect(warehouseNode).toBeDefined();
    expect(cumillaNode).toBeDefined();
    expect(cumillaNode!['Net Realized Sales (BDT)']).toBe(1400);
  });
});
