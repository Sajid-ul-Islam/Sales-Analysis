import { describe, it, expect } from 'vitest';
import {
  detectAgenticIntent,
  applyAgenticAction,
  clearAgenticTags,
  getAvailableAgenticPresets,
} from '@/lib/ai/agenticActions';
import {
  ReconciledOrderRow,
  CourierMismatchRecord,
  CustomerRiskProfile,
  SummaryAnalytics,
  AgenticActionProposal,
} from '@/types';
import { ReconciliationResult } from '@/lib/reconciliationEngine';

describe('Agentic AI Dataset Action Engine', () => {
  const sampleSummary: SummaryAnalytics = {
    grossOrders: 10,
    totalGrossItems: 14,
    fullDeliveredOrders: 6,
    partialOrders: 2,
    fullReturnedOrders: 2,
    totalReturnedOrders: 4,
    totalPartialProducts: 2,
    regularReturnedQty: 2,
    partialReturnedQty: 1,
    partialDeliveredQty: 2,
    partialTotalItems: 3,
    totalReturnedQty: 3,
    totalReturnedPlusPartial: 4,
    returnRate: 40.0,
    fullReturnRate: 20.0,
    partialRate: 20.0,
    grossRevenue: 25000,
    netDeliveredRevenue: 16500,
    totalItemsDelivered: 8,
    insideOrders: 4,
    outsideOrders: 6,
    insideReturns: 1,
    outsideReturns: 1,
    insidePartials: 0,
    outsidePartials: 2,
    insideNetRevenue: 9000,
    outsideNetRevenue: 7500,
    outsideRatio: '1.5',
    courierCost: {
      grossCharge: 1200,
      discount: 100,
      netCharge: 1100,
      paidReturnCollectedCod: 150,
      netCourierBurden: 950,
      consignmentsCount: 10,
      customerDeliveryFeeCollected: 640,
      collectedInsideCount: 3,
      collectedOutsideCount: 5,
      collectedDeliveryFeeInside: 150,
      collectedDeliveryFeeOutside: 450,
      collectedEligibleOrdersCount: 8,
      netCourierCostAfterDeliveryFee: 310,
    },
    unitEconomics: {
      grossInvoicedSales: 25000,
      netRealizedSales: 16500,
      estimatedCogs: 6930,
      grossMargin: 9570,
      totalCourierExpense: 950,
      packagingLoss: 100,
      metaAdCost: 2000,
      netContributionMargin: 6520,
      netMarginPercentage: 39.5,
      roas: 8.25,
      cac: 333,
    },
    totalExchangedOrders: 1,
    totalExchangedItemsQty: 1,
    totalExchangeCodCollected: 250,
    paidReturnsCount: 1,
    unpaidReturnsCount: 1,
    totalExchangeCourierExpense: 60,
  };

  const sampleOrders: ReconciledOrderRow[] = [
    {
      orderId: '17240',
      lineStatus: 'Primary Item (Unique Order)',
      deliveryStatus: 'Delivered',
      orderCategory: 'DELIVERED',
      orderDate: new Date('2026-09-10'),
      customerName: 'Rahim Khan',
      phone: '01711000001',
      city: 'Dhaka',
      districtArea: 'Inside Dhaka',
      sku: 'PAN-01',
      itemName: 'Panjabi Black',
      quantity: 1,
      itemCost: 1500,
      orderAmount: 1500,
      netRevenueImpact: 1500,
      paymentMethod: 'Cash on delivery',
      hasSplitSuffix: false,
      cogsEstimate: 675,
      fulfillmentLocation: 'Online Store (Central Warehouse)',
    },
    {
      orderId: '17255',
      lineStatus: 'Primary Item (Unique Order)',
      deliveryStatus: 'Returned',
      orderCategory: 'FULL_RETURN',
      orderDate: new Date('2026-09-11'),
      customerName: 'Karim Ullah',
      phone: '01811000002',
      city: 'Chittagong',
      districtArea: 'Outside Dhaka',
      sku: 'SHIRT-02',
      itemName: 'Casual Shirt Blue',
      quantity: 1,
      itemCost: 1200,
      orderAmount: 1200,
      netRevenueImpact: 0,
      paymentMethod: 'Cash on delivery',
      hasSplitSuffix: false,
      cogsEstimate: 540,
      fulfillmentLocation: 'Online Store (Central Warehouse)',
    },
    {
      orderId: '17263 c',
      lineStatus: 'Primary Item (Unique Order)',
      deliveryStatus: 'Partial Delivery',
      orderCategory: 'PARTIAL',
      orderDate: new Date('2026-09-12'),
      customerName: 'Sultana Begum',
      phone: '01911000003',
      city: 'Cumilla',
      districtArea: 'Outside Dhaka',
      sku: 'KURTI-03',
      itemName: 'Embroidered Kurti',
      quantity: 2,
      itemCost: 1800,
      orderAmount: 3600,
      netRevenueImpact: 1800,
      paymentMethod: 'Cash on delivery',
      hasSplitSuffix: true,
      branchSuffix: 'c',
      cogsEstimate: 810,
      fulfillmentLocation: 'Cumilla Branch',
    },
    {
      orderId: '17280',
      lineStatus: 'Primary Item (Unique Order)',
      deliveryStatus: 'Returned',
      orderCategory: 'FULL_RETURN',
      orderDate: new Date('2026-09-13'),
      customerName: 'Chronic Returner',
      phone: '01511000004',
      city: 'Sylhet',
      districtArea: 'Outside Dhaka',
      sku: 'POLO-04',
      itemName: 'Polo Shirt',
      quantity: 1,
      itemCost: 950,
      orderAmount: 950,
      netRevenueImpact: 0,
      paymentMethod: 'Cash on delivery',
      hasSplitSuffix: false,
      cogsEstimate: 420,
    },
  ];

  const sampleMismatches: CourierMismatchRecord[] = [
    {
      orderId: '17240',
      customerName: 'Rahim Khan',
      phone: '01711000001',
      excelStatus: 'Delivered',
      pathaoStatus: 'Delivered',
      expectedCod: 1500,
      pathaoCollectedCod: 1350,
      codDifference: 150,
      severity: 'WARNING',
      mismatchType: 'COD_MISMATCH',
      description: 'Courier collected ৳150 less than invoice',
      recommendedAction: 'Dispute with courier for remittance difference',
    },
  ];

  const sampleRiskProfiles: CustomerRiskProfile[] = [
    {
      phone: '01511000004',
      customerName: 'Chronic Returner',
      totalOrders: 4,
      deliveredOrders: 1,
      partialOrders: 0,
      returnedOrders: 3,
      returnRate: 75.0,
      totalSpent: 950,
      riskTier: 'HIGH_RISK',
      recommendation: 'Collect mandatory advance delivery fee',
    },
  ];

  const sampleResult: ReconciliationResult = {
    reconciledOrders: sampleOrders,
    returnedItems: [],
    skuAnalytics: [],
    customerRiskProfiles: sampleRiskProfiles,
    summary: sampleSummary,
    courierMismatches: sampleMismatches,
    exchangedOrders: [],
  };

  it('detects intent to tag Pathao courier discrepancies', () => {
    const proposal = detectAgenticIntent(
      "Tag all orders with courier variance > 100 as 'Pathao Claim Needed'",
      sampleResult
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.type).toBe('TAG_ORDERS');
    expect(proposal?.tag).toBe('Pathao Claim Needed');
    expect(proposal?.matchedOrderIds).toContain('17240');
    expect(proposal?.affectedCount).toBe(1);
    expect(proposal?.previewOrders.length).toBeGreaterThan(0);
  });

  it('detects intent to tag high-risk customers', () => {
    const proposal = detectAgenticIntent(
      "Tag high risk return orders as 'Hold for Advance'",
      sampleResult
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.type).toBe('TAG_ORDERS');
    expect(proposal?.tag).toBe('Hold for Advance');
    expect(proposal?.matchedOrderIds).toContain('17280');
    expect(proposal?.affectedCount).toBe(1);
  });

  it('detects intent to tag Outside Dhaka failed orders', () => {
    const proposal = detectAgenticIntent(
      "Tag all Outside Dhaka returned orders as 'Outside Logistics Review'",
      sampleResult
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.type).toBe('TAG_ORDERS');
    expect(proposal?.tag).toBe('Outside Logistics Review');
    expect(proposal?.matchedOrderIds).toContain('17255');
  });

  it('detects intent to tag branch-specific orders', () => {
    const proposal = detectAgenticIntent(
      "Tag cumilla branch orders as 'Cumilla Store Audit'",
      sampleResult
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.type).toBe('TAG_ORDERS');
    expect(proposal?.tag).toBe('Cumilla Store Audit');
    expect(proposal?.matchedOrderIds).toContain('17263 c');
  });

  it('detects intent to tag specific order IDs', () => {
    const proposal = detectAgenticIntent(
      "Tag order 17240 as 'VIP Merchant Express'",
      sampleResult
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.type).toBe('TAG_ORDERS');
    expect(proposal?.tag).toBe('VIP Merchant Express');
    expect(proposal?.matchedOrderIds).toContain('17240');
  });

  it('detects intent to clear tags', () => {
    const taggedOrders = sampleOrders.map((o) => ({ ...o, aiAuditTag: 'Sample Tag' }));
    const resultWithTags: ReconciliationResult = { ...sampleResult, reconciledOrders: taggedOrders };

    const proposal = detectAgenticIntent('Clear all ai tags from dataset', resultWithTags);
    expect(proposal).not.toBeNull();
    expect(proposal?.type).toBe('CLEAR_TAGS');
    expect(proposal?.affectedCount).toBe(4);
  });

  it('returns null for purely informational queries without action verbs', () => {
    expect(detectAgenticIntent('What was our net revenue yesterday?', sampleResult)).toBeNull();
    expect(detectAgenticIntent('Why is order 17263 partial?', sampleResult)).toBeNull();
  });

  it('immutably applies agentic action tags to targeted orders only', () => {
    const proposal: AgenticActionProposal = {
      id: 'test-prop',
      type: 'TAG_ORDERS',
      title: 'Tag 17240',
      description: 'Test',
      tag: 'Pathao Claim Needed',
      note: 'COD difference ৳150',
      matchCriteria: { target: 'variance' },
      matchedOrderIds: ['17240'],
      affectedCount: 1,
      previewOrders: [],
    };

    const updated = applyAgenticAction(sampleOrders, proposal);

    // Target order is tagged
    const target = updated.find((o) => o.orderId === '17240');
    expect(target?.aiAuditTag).toBe('Pathao Claim Needed');
    expect(target?.aiAuditNote).toBe('COD difference ৳150');

    // Untargeted orders are untouched
    const untargeted = updated.find((o) => o.orderId === '17255');
    expect(untargeted?.aiAuditTag).toBeUndefined();

    // Original array is not mutated (pure function)
    expect(sampleOrders.find((o) => o.orderId === '17240')?.aiAuditTag).toBeUndefined();
  });

  it('clears tags with clearAgenticTags', () => {
    const tagged = sampleOrders.map((o) => ({ ...o, aiAuditTag: 'Tag', aiAuditNote: 'Note' }));
    const cleared = clearAgenticTags(tagged);

    expect(cleared.every((o) => o.aiAuditTag === undefined && o.aiAuditNote === undefined)).toBe(true);
  });

  it('provides ready presets when mismatches and high-risk customers exist', () => {
    const presets = getAvailableAgenticPresets(sampleResult);
    expect(presets.length).toBeGreaterThanOrEqual(2);

    const tags = presets.map((p) => p.tag);
    expect(tags).toContain('Pathao Discrepancy');
    expect(tags).toContain('Hold for Advance');
  });
});
