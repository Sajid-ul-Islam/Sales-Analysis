import { describe, it, expect } from 'vitest';
import { retrieveRelevantKnowledge, KNOWLEDGE_BASE_ENTRIES } from '@/lib/ai/knowledgeBase';
import {
  computeBranchMetrics,
  computeCourierAuditSummary,
  computeSkuRiskSummary,
  computeCustomerRiskSummary,
  computeLiveOpsSlice,
  generateQueryAnalyticalFacts
} from '@/lib/ai/semanticAnalytics';
import { ReconciledOrderRow, CourierMismatchRecord, SkuAnalytics, CustomerRiskProfile, SummaryAnalytics, RawOrderRow } from '@/types';

describe('Semantic Metric Catalog & Knowledge Base Retrieval', () => {
  it('contains essential e-commerce reconciliation entries', () => {
    expect(KNOWLEDGE_BASE_ENTRIES.length).toBeGreaterThanOrEqual(8);
    const ids = KNOWLEDGE_BASE_ENTRIES.map(k => k.id);
    expect(ids).toContain('branch_suffix_rules');
    expect(ids).toContain('reconciliation_partial_knapsack');
    expect(ids).toContain('courier_pathao_dispute_sla');
    expect(ids).toContain('customer_risk_tiers');
    expect(ids).toContain('metric_net_realized_sales');
  });

  it('retrieves branch suffix rules when asking about branch suffixes or Cumilla/Wari/Sylhet', () => {
    const results = retrieveRelevantKnowledge('Why does my order ID have a suffix c or w?');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'branch_suffix_rules')).toBe(true);
  });

  it('retrieves Knapsack DP integer rule when asking about partial orders', () => {
    const results = retrieveRelevantKnowledge('How do you calculate partial returns and can quantity be 0.5?');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'reconciliation_partial_knapsack')).toBe(true);
    const knapsackEntry = results.find(r => r.id === 'reconciliation_partial_knapsack');
    expect(knapsackEntry?.formulaOrRule).toContain('Strict Integer Invariant');
  });

  it('retrieves Pathao dispute SLA when asking about courier COD leakage', () => {
    const results = retrieveRelevantKnowledge('Pathao courier COD mismatch dispute timeline', 'tabCourierAudit');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'courier_pathao_dispute_sla')).toBe(true);
  });

  it('retrieves customer risk fraud SOP when asking about chronic returners', () => {
    const results = retrieveRelevantKnowledge('What action should we take for high risk chronic returner customers?', 'tabCustomerRisk');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'customer_risk_tiers')).toBe(true);
    const riskEntry = results.find(r => r.id === 'customer_risk_tiers');
    expect(riskEntry?.formulaOrRule).toContain('HIGH_RISK');
    expect(riskEntry?.formulaOrRule).toContain('advance delivery fee');
  });

  it('returns empty array when query is empty or whitespace', () => {
    expect(retrieveRelevantKnowledge('')).toEqual([]);
    expect(retrieveRelevantKnowledge('   ')).toEqual([]);
  });
});

describe('Deterministic Analytics & Slicing Engine', () => {
  const sampleOrders: ReconciledOrderRow[] = [
    {
      orderId: '1001',
      lineStatus: 'Primary Item (Unique Order)',
      deliveryStatus: 'Delivered',
      orderCategory: 'DELIVERED',
      orderDeliveryStatus: 'Delivered',
      orderDate: new Date('2026-10-01'),
      customerName: 'Customer A',
      phone: '01700000001',
      city: 'Cumilla',
      districtArea: 'Outside Dhaka',
      sku: 'SKU-01',
      itemName: 'Shirt',
      quantity: 1,
      itemCost: 1000,
      orderAmount: 1000,
      netRevenueImpact: 1000,
      paymentMethod: 'COD',
      hasSplitSuffix: true,
      cogsEstimate: 450,
      fulfillmentLocation: 'Cumilla Branch',
      branchSuffix: 'c'
    },
    {
      orderId: '1002',
      lineStatus: 'Primary Item (Unique Order)',
      deliveryStatus: 'Returned',
      orderCategory: 'FULL_RETURN',
      orderDeliveryStatus: 'Not Paid Return',
      orderDate: new Date('2026-10-02'),
      customerName: 'Customer B',
      phone: '01700000002',
      city: 'Dhaka',
      districtArea: 'Inside Dhaka',
      sku: 'SKU-02',
      itemName: 'Panjabi',
      quantity: 1,
      itemCost: 1500,
      orderAmount: 1500,
      netRevenueImpact: 0,
      paymentMethod: 'COD',
      hasSplitSuffix: false,
      cogsEstimate: 675,
      fulfillmentLocation: 'Online Store (Central Warehouse)',
      branchSuffix: ''
    }
  ];

  const sampleMismatches: CourierMismatchRecord[] = [
    {
      orderId: '1005',
      customerName: 'Dispute User',
      phone: '01800000005',
      excelStatus: 'Delivered',
      pathaoStatus: 'Returned to Merchant',
      expectedCod: 2200,
      pathaoCollectedCod: 0,
      codDifference: -2200,
      severity: 'CRITICAL',
      mismatchType: 'STATUS_MISMATCH',
      description: 'Store recorded Delivered but Pathao shows Return',
      recommendedAction: 'Verify POD'
    }
  ];

  const sampleSkus: SkuAnalytics[] = [
    {
      sku: 'LEAK-99',
      itemName: 'Silk Kurti',
      grossQty: 10,
      deliveredQty: 4,
      returnedQty: 6,
      deliveredRevenue: 4000,
      returnRate: 60.0,
      totalLossFromReturns: 6000
    }
  ];

  const sampleProfiles: CustomerRiskProfile[] = [
    {
      phone: '01799999999',
      customerName: 'High Risk Buyer',
      totalOrders: 6,
      deliveredOrders: 1,
      partialOrders: 0,
      returnedOrders: 5,
      returnRate: 83.3,
      totalSpent: 1200,
      riskTier: 'HIGH_RISK',
      recommendation: 'Collect advance fee'
    }
  ];

  const sampleSummary: SummaryAnalytics = {
    grossOrders: 100,
    totalGrossItems: 120,
    fullDeliveredOrders: 75,
    partialOrders: 10,
    fullReturnedOrders: 15,
    totalReturnedOrders: 25,
    totalPartialProducts: 10,
    regularReturnedQty: 15,
    partialReturnedQty: 10,
    partialDeliveredQty: 10,
    partialTotalItems: 20,
    totalReturnedQty: 25,
    totalReturnedPlusPartial: 25,
    returnRate: 25.0,
    fullReturnRate: 15.0,
    partialRate: 10.0,
    grossRevenue: 150000,
    netDeliveredRevenue: 112500,
    totalItemsDelivered: 85,
    insideOrders: 40,
    outsideOrders: 60,
    insideReturns: 5,
    outsideReturns: 10,
    insidePartials: 2,
    outsidePartials: 8,
    insideNetRevenue: 45000,
    outsideNetRevenue: 67500,
    outsideRatio: '1.5',
    totalExchangedOrders: 5,
    totalExchangeCodCollected: 3500,
    totalExchangedItemsQty: 5,
    totalExchangeCourierExpense: 750,
    courierCost: {} as any,
    unitEconomics: {} as any
  };

  it('computes accurate branch breakdown metrics', () => {
    const branches = computeBranchMetrics(sampleOrders);
    expect(branches.length).toBe(2);
    const cumilla = branches.find(b => b.branchName === 'Cumilla Branch');
    expect(cumilla?.orderCount).toBe(1);
    expect(cumilla?.deliveredCount).toBe(1);
    expect(cumilla?.returnRate).toBe(0);
    expect(cumilla?.netRevenue).toBe(1000);
  });

  it('aggregates critical courier mismatch figures', () => {
    const audit = computeCourierAuditSummary(sampleMismatches);
    expect(audit.totalMismatches).toBe(1);
    expect(audit.criticalCount).toBe(1);
    expect(audit.totalDisputedCod).toBe(2200);
  });

  it('identifies top return-loss SKUs', () => {
    const skuSummary = computeSkuRiskSummary(sampleSkus);
    expect(skuSummary.topRiskSkus.length).toBe(1);
    expect(skuSummary.topRiskSkus[0].sku).toBe('LEAK-99');
    expect(skuSummary.topRiskSkus[0].returnRate).toBe(60.0);
  });

  it('profiles customer risk counts', () => {
    const riskSummary = computeCustomerRiskSummary(sampleProfiles);
    expect(riskSummary.highRiskCount).toBe(1);
    expect(riskSummary.atRiskCustomerOrders).toBe(6);
  });

  it('retrieves live ops today shipped rules when asking about today sales or shipped calculation', () => {
    const results = retrieveRelevantKnowledge("What are today's sales and how is today shipped calculated?");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'live_ops_today_shipped_standard')).toBe(true);
    const entry = results.find(r => r.id === 'live_ops_today_shipped_standard');
    expect(entry?.formulaOrRule).toContain('Date Modified');
    expect(entry?.formulaOrRule).toContain('Strict Integer Standard');
  });

  it('retrieves warehouse queue and today order definitions', () => {
    const results = retrieveRelevantKnowledge('How is queue and total orders calculated in live terminal?', 'tabLiveOps');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'live_ops_queue_and_todays_orders_rules')).toBe(true);
  });

  it('retrieves real-time courier telemetry rules and discrepancies', () => {
    const results = retrieveRelevantKnowledge('Pathao courier delivery telemetry and COD discrepancies');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'real_time_courier_telemetry_and_discrepancies')).toBe(true);
  });

  it('retrieves 7-day rolling baseline integer rules', () => {
    const results = retrieveRelevantKnowledge('How does the 7-day rolling baseline compare with today sales?');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'daily_reconciliation_seven_day_baseline')).toBe(true);
  });

  it('computes accurate LiveOpsAnalyticsSlice and generates grounded analytical facts', () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const mockLiveOrders: RawOrderRow[] = [
      {
        orderId: '2001',
        status: 'completed',
        date_modified: `${todayIso}T10:30:00`,
        date_created: `${todayIso}T09:00:00`,
        itemCost: 1200,
        orderAmount: 1200,
        quantity: 1,
        itemName: 'Panjabi Premium',
        customerName: 'Live Buyer 1',
        phone: '01711111111',
        deliveryStatus: 'Delivered',
        pathaoStatus: 'Delivered',
        courierCollectedCod: 1200,
      },
      {
        orderId: '2002',
        status: 'processing',
        date_modified: `${todayIso}T11:00:00`,
        date_created: `${todayIso}T10:00:00`,
        itemCost: 1500,
        orderAmount: 1500,
        quantity: 1,
        itemName: 'Formal Shirt',
        customerName: 'Live Buyer 2',
        phone: '01722222222',
        deliveryStatus: 'In Transit',
        pathaoStatus: 'In Transit',
        courierCollectedCod: 0,
      },
      {
        orderId: '2003',
        status: 'on-hold',
        date_modified: `${todayIso}T11:30:00`,
        date_created: `${todayIso}T11:00:00`,
        itemCost: 2000,
        orderAmount: 2000,
        quantity: 1,
        itemName: 'Silk Kurti',
        customerName: 'Live Buyer 3',
        phone: '01733333333',
        deliveryStatus: 'Pending Pickup',
      }
    ];

    const liveOpsSlice = computeLiveOpsSlice(mockLiveOrders);
    expect(liveOpsSlice.referenceDate).toBe(todayIso);
    expect(liveOpsSlice.todayShipped.ordersCount).toBeGreaterThanOrEqual(1);
    expect(liveOpsSlice.queue.processingCount).toBeGreaterThanOrEqual(1);
    expect(liveOpsSlice.queue.holdCount).toBeGreaterThanOrEqual(1);
    expect(liveOpsSlice.queue.totalCount).toBe(liveOpsSlice.queue.processingCount + liveOpsSlice.queue.holdCount);
    expect(liveOpsSlice.courierTelemetry).toBeDefined();

    const facts = generateQueryAnalyticalFacts("What are today's sales and real-time delivery status?", sampleSummary, {
      liveOps: liveOpsSlice
    });
    expect(facts).toContain("Deterministic Live Operations & Today's Sales Report");
    expect(facts).toContain("Today's Dispatched Volume");
    expect(facts).toContain('Fulfillment Queue');
    expect(facts).toContain('Real-Time Courier Telemetry (Pathao Hermes)');
    expect(facts).toContain('Daily Reconciliation & 7-Day Rolling Baseline');
  });
});
