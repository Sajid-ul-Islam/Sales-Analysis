import {
  ReconciledOrderRow,
  CourierMismatchRecord,
  SkuAnalytics,
  CustomerRiskProfile,
  SummaryAnalytics
} from '@/types';
import { processLiveOpsData } from '@/lib/liveOpsProcessor';

export interface BranchMetricSummary {
  branchName: string;
  orderCount: number;
  deliveredCount: number;
  returnCount: number;
  returnRate: number;
  netRevenue: number;
}

export interface CourierAuditSummary {
  totalMismatches: number;
  criticalCount: number;
  warningCount: number;
  totalDisputedCod: number;
  topDiscrepancies: Array<{ orderId: string; description: string; codDifference: number }>;
}

export interface SkuLossSummary {
  topRiskSkus: Array<{
    sku: string;
    itemName: string;
    grossQty: number;
    returnedQty: number;
    returnRate: number;
    totalLoss: number;
  }>;
}

export interface CustomerRiskSummary {
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  atRiskCustomerOrders: number;
}

/**
 * Deterministic computation of fulfillment branch metrics from reconciled order rows.
 */
export function computeBranchMetrics(orders: ReconciledOrderRow[] = []): BranchMetricSummary[] {
  if (!orders || orders.length === 0) return [];

  const branchMap: Record<string, {
    orderIds: Set<string>;
    deliveredIds: Set<string>;
    returnIds: Set<string>;
    netRevenue: number;
  }> = {};

  for (const row of orders) {
    const loc = row.fulfillmentLocation || 'Online Store (Central Warehouse)';
    if (!branchMap[loc]) {
      branchMap[loc] = {
        orderIds: new Set(),
        deliveredIds: new Set(),
        returnIds: new Set(),
        netRevenue: 0,
      };
    }

    const b = branchMap[loc];
    b.orderIds.add(row.orderId);

    const isDelivered = row.orderDeliveryStatus === 'Delivered' || row.orderCategory === 'DELIVERED';
    const isReturn =
      row.orderDeliveryStatus === 'Paid Return' ||
      row.orderDeliveryStatus === 'Not Paid Return' ||
      row.orderCategory === 'FULL_RETURN' ||
      row.orderDeliveryStatus === 'Partial' ||
      row.orderCategory === 'PARTIAL';

    if (isDelivered) b.deliveredIds.add(row.orderId);
    if (isReturn) b.returnIds.add(row.orderId);
    b.netRevenue += Number(row.netRevenueImpact) || 0;
  }

  return Object.entries(branchMap).map(([branchName, data]) => {
    const orderCount = data.orderIds.size;
    const deliveredCount = data.deliveredIds.size;
    const returnCount = data.returnIds.size;
    const returnRate = orderCount > 0 ? (returnCount / orderCount) * 100 : 0;

    return {
      branchName,
      orderCount,
      deliveredCount,
      returnCount,
      returnRate: Number(returnRate.toFixed(1)),
      netRevenue: Math.round(data.netRevenue),
    };
  }).sort((a, b) => b.orderCount - a.orderCount);
}

/**
 * Deterministic aggregation of courier audit discrepancies.
 */
export function computeCourierAuditSummary(mismatches: CourierMismatchRecord[] = []): CourierAuditSummary {
  if (!mismatches || mismatches.length === 0) {
    return {
      totalMismatches: 0,
      criticalCount: 0,
      warningCount: 0,
      totalDisputedCod: 0,
      topDiscrepancies: []
    };
  }

  let criticalCount = 0;
  let warningCount = 0;
  let totalDisputedCod = 0;

  const discrepancies: Array<{ orderId: string; description: string; codDifference: number }> = [];

  for (const m of mismatches) {
    const diff = Math.abs(Number(m.codDifference) || 0);
    if (m.severity === 'CRITICAL') {
      criticalCount++;
      totalDisputedCod += diff;
      if (discrepancies.length < 5) {
        discrepancies.push({
          orderId: m.orderId,
          description: m.description,
          codDifference: Math.round(diff)
        });
      }
    } else if (m.severity === 'WARNING') {
      warningCount++;
      totalDisputedCod += diff;
      if (discrepancies.length < 5) {
        discrepancies.push({
          orderId: m.orderId,
          description: m.description,
          codDifference: Math.round(diff)
        });
      }
    }
  }

  return {
    totalMismatches: mismatches.length,
    criticalCount,
    warningCount,
    totalDisputedCod: Math.round(totalDisputedCod),
    topDiscrepancies: discrepancies
  };
}

/**
 * Deterministic extraction of top return-loss SKUs.
 */
export function computeSkuRiskSummary(skuAnalytics: SkuAnalytics[] = []): SkuLossSummary {
  if (!skuAnalytics || skuAnalytics.length === 0) {
    return { topRiskSkus: [] };
  }

  const top = [...skuAnalytics]
    .filter(s => (s.grossQty || 0) >= 3 && (s.returnedQty || 0) > 0)
    .sort((a, b) => (b.totalLossFromReturns || 0) - (a.totalLossFromReturns || 0))
    .slice(0, 5)
    .map(s => ({
      sku: s.sku,
      itemName: s.itemName,
      grossQty: s.grossQty,
      returnedQty: s.returnedQty,
      returnRate: Number((s.returnRate || 0).toFixed(1)),
      totalLoss: Math.round(s.totalLossFromReturns || 0)
    }));

  return { topRiskSkus: top };
}

/**
 * Deterministic profiling of customer RTO risk tiers.
 */
export function computeCustomerRiskSummary(profiles: CustomerRiskProfile[] = []): CustomerRiskSummary {
  if (!profiles || profiles.length === 0) {
    return {
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      atRiskCustomerOrders: 0
    };
  }

  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let atRiskCustomerOrders = 0;

  for (const p of profiles) {
    if (p.riskTier === 'HIGH_RISK') {
      highRiskCount++;
      atRiskCustomerOrders += (p.totalOrders || 0);
    } else if (p.riskTier === 'MEDIUM') {
      mediumRiskCount++;
    } else {
      lowRiskCount++;
    }
  }

  return {
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    atRiskCustomerOrders
  };
}

export interface LiveOpsAnalyticsSlice {
  referenceDate: string;
  refDayName: string;
  isFallbackDate: boolean;
  todayShipped: {
    ordersCount: number;
    itemsCount: number;
    grossRevenue: number;
    aov: number;
    deltaVs7dVolumePct: number;
    deltaVs7dRevenuePct: number;
  };
  queue: {
    totalCount: number;
    processingCount: number;
    holdCount: number;
  };
  todaysOrders: {
    totalCount: number;
    shippedCount: number;
    processingCount: number;
  };
  courierTelemetry: {
    handedOverCount: number;
    handedOverRate: number;
    inTransitCount: number;
    deliveredCount: number;
    returnedCount: number;
    pendingPickupCount: number;
    untrackedCount: number;
    totalCodCollected: number;
    discrepanciesCount: number;
    discrepancies: Array<{
      orderId: string;
      type: string;
      message: string;
      courierStatus: string;
      wcStatus: string;
    }>;
  };
  sevenDayBaseline: {
    avg7dItems: number;
    avg7dOrders: number;
    avg7dRevenue: number;
    avg7dAov: number;
    dailyHistory: Array<{
      dateIso: string;
      dayName: string;
      orderCount: number;
      itemCount: number;
      revenue: number;
      aov: number;
    }>;
  };
  topPerformers?: {
    topCategory: { name: string; volume: number; revenue: number };
    topProduct: { name: string; units: number; revenue: number };
    selectsRevSharePct: number;
    newCustomerPct: number;
    repeatCustomerPct: number;
  };
  executiveBriefingText?: string;
}

export interface AnalyticsSlices {
  branches?: BranchMetricSummary[];
  courierAudit?: CourierAuditSummary;
  skuLoss?: SkuLossSummary;
  customerRisk?: CustomerRiskSummary;
  liveOps?: LiveOpsAnalyticsSlice;
}

/**
 * Deterministically computes real-time operational live sales, queue, delivery telemetry,
 * and 7-day rolling reconciliation baseline for AI assistant grounding.
 */
export function computeLiveOpsSlice(
  orders: any[] = [],
  options?: {
    onlineOnly?: boolean;
    customDate?: string;
  }
): LiveOpsAnalyticsSlice {
  const report = processLiveOpsData(orders, {
    view: 'Today Shipped',
    onlineOnly: options?.onlineOnly ?? false,
    customDate: options?.customDate,
  });

  // Extract courier telemetry from order rows
  const seenOrders = new Set<string>();
  let handedOverCount = 0;
  let inTransitCount = 0;
  let deliveredCount = 0;
  let returnedCount = 0;
  let pendingPickupCount = 0;
  let untrackedCount = 0;
  let totalCodCollected = 0;
  const discrepanciesList: Array<{
    orderId: string;
    type: string;
    message: string;
    courierStatus: string;
    wcStatus: string;
  }> = [];

  for (const o of orders) {
    const oid = String(o['Order ID'] || o.orderId || '').trim();
    if (!oid || seenOrders.has(oid)) continue;
    seenOrders.add(oid);

    const cStatus = String(o['Courier Status'] || o.courierStatus || 'Untracked');
    if (cStatus !== 'Untracked') {
      handedOverCount++;
    } else {
      untrackedCount++;
    }

    if (cStatus === 'In Transit') inTransitCount++;
    else if (cStatus === 'Delivered') {
      deliveredCount++;
      totalCodCollected += Number(o.collectedAmount || o['Order Amount'] || o['Item Cost'] || 0);
    } else if (cStatus === 'Returned') returnedCount++;
    else if (cStatus === 'Pending Pickup') pendingPickupCount++;

    if (o.hasDiscrepancy) {
      discrepanciesList.push({
        orderId: oid,
        type: String(o.discrepancyType || 'DISCREPANCY'),
        message: String(o.discrepancyMessage || 'Store and courier mismatch detected'),
        courierStatus: cStatus,
        wcStatus: String(o['Delivery Status'] || o.status || ''),
      });
    }
  }

  const distinctOrders = seenOrders.size;
  const handedOverRate = distinctOrders > 0 ? Math.round((handedOverCount / distinctOrders) * 1000) / 10 : 0;
  const briefing = report.executiveBriefing;

  return {
    referenceDate: report.referenceDate,
    refDayName: report.refDayName,
    isFallbackDate: report.isFallbackDate,
    todayShipped: {
      ordersCount: Number(report.shippedOrders.value) || 0,
      itemsCount: Number(report.shippedItems.value) || 0,
      grossRevenue: report.salesRevenue.rawValue,
      aov: report.basketSize.rawValue,
      deltaVs7dVolumePct: briefing?.vs7dVolumePct || 0,
      deltaVs7dRevenuePct: briefing?.vs7dRevenuePct || 0,
    },
    queue: {
      totalCount: (report.allOrdersBreakdown.processingCount || 0) + (report.allOrdersBreakdown.holdCount || 0),
      processingCount: report.allOrdersBreakdown.processingCount || 0,
      holdCount: report.allOrdersBreakdown.holdCount || 0,
    },
    todaysOrders: {
      totalCount: (Number(report.shippedOrders.value) || 0) + (report.allOrdersBreakdown.processingCount || 0),
      shippedCount: Number(report.shippedOrders.value) || 0,
      processingCount: report.allOrdersBreakdown.processingCount || 0,
    },
    courierTelemetry: {
      handedOverCount,
      handedOverRate,
      inTransitCount,
      deliveredCount,
      returnedCount,
      pendingPickupCount,
      untrackedCount,
      totalCodCollected: Math.round(totalCodCollected),
      discrepanciesCount: discrepanciesList.length,
      discrepancies: discrepanciesList.slice(0, 5),
    },
    sevenDayBaseline: {
      avg7dItems: report.avg7dMetrics.items,
      avg7dOrders: report.avg7dMetrics.orders,
      avg7dRevenue: report.avg7dMetrics.revenue,
      avg7dAov: report.avg7dMetrics.aov,
      dailyHistory: report.last7DaysHistory.map((h) => ({
        dateIso: h.dateIso,
        dayName: h.dayName,
        orderCount: h.orderCount,
        itemCount: h.itemCount,
        revenue: h.revenue,
        aov: h.aov,
      })),
    },
    topPerformers: briefing ? {
      topCategory: briefing.topCategory,
      topProduct: briefing.topProduct,
      selectsRevSharePct: briefing.selectsSharePct,
      newCustomerPct: briefing.newCustomerPct,
      repeatCustomerPct: 100 - briefing.newCustomerPct,
    } : undefined,
    executiveBriefingText: briefing?.clipboardText,
  };
}

/**
 * Generates dynamic, focused deterministic analytical facts tailored to the merchant's query intent.
 */
export function generateQueryAnalyticalFacts(
  query: string,
  summary: SummaryAnalytics,
  slices?: AnalyticsSlices,
  activeTab?: string
): string {
  const q = (query || '').toLowerCase();
  const facts: string[] = [];

  // 1. Branch / Retail Outlet Facts
  const mentionsBranch =
    q.includes('branch') ||
    q.includes('outlet') ||
    q.includes('cumilla') ||
    q.includes('wari') ||
    q.includes('sylhet') ||
    q.includes('mirpur') ||
    q.includes('pos') ||
    activeTab?.includes('Outlet');

  if (mentionsBranch && slices?.branches && slices.branches.length > 0) {
    facts.push('Deterministic Branch Performance:');
    for (const b of slices.branches) {
      facts.push(`- **${b.branchName}:** ${b.orderCount} orders | Net Sales: ৳${b.netRevenue.toLocaleString()} | Return Rate: ${b.returnRate}% (${b.returnCount} returns)`);
    }
  }

  // 2. Courier Discrepancy Facts
  const mentionsCourier =
    q.includes('courier') ||
    q.includes('pathao') ||
    q.includes('mismatch') ||
    q.includes('dispute') ||
    q.includes('cod') ||
    q.includes('remittance') ||
    activeTab?.includes('Courier');

  if (mentionsCourier && slices?.courierAudit) {
    const c = slices.courierAudit;
    facts.push('Deterministic Courier Mismatch Audit:');
    facts.push(`- Total Mismatches: ${c.totalMismatches} (Critical: ${c.criticalCount}, Warning: ${c.warningCount})`);
    facts.push(`- Total Disputed / Uncollected COD: ৳${c.totalDisputedCod.toLocaleString()}`);
    if (c.topDiscrepancies.length > 0) {
      for (const d of c.topDiscrepancies.slice(0, 3)) {
        facts.push(`  * Order ${d.orderId}: ৳${d.codDifference} discrepancy (${d.description})`);
      }
    }
  }

  // 3. High-Risk SKU Facts
  const mentionsSku =
    q.includes('sku') ||
    q.includes('product') ||
    q.includes('item') ||
    q.includes('leak') ||
    q.includes('loss') ||
    activeTab?.includes('Sku') ||
    activeTab?.includes('Return');

  if (mentionsSku && slices?.skuLoss?.topRiskSkus && slices.skuLoss.topRiskSkus.length > 0) {
    facts.push('Deterministic High Return-Loss SKUs:');
    for (const s of slices.skuLoss.topRiskSkus.slice(0, 4)) {
      facts.push(`- **${s.sku}** (${s.itemName}): ${s.returnRate}% return rate (${s.returnedQty}/${s.grossQty} returned) | Cash Loss: ৳${s.totalLoss.toLocaleString()}`);
    }
  }

  // 4. Customer Risk Facts
  const mentionsRisk =
    q.includes('risk') ||
    q.includes('fraud') ||
    q.includes('chronic') ||
    q.includes('advance') ||
    activeTab?.includes('CustomerRisk');

  if (mentionsRisk && slices?.customerRisk) {
    const cr = slices.customerRisk;
    facts.push('Deterministic Customer Risk Profiling:');
    facts.push(`- High-Risk Chronic Returners: ${cr.highRiskCount} customers (${cr.atRiskCustomerOrders} total orders)`);
    facts.push(`- Medium-Risk Phone Verification Queue: ${cr.mediumRiskCount} customers`);
    facts.push(`- Low-Risk Verified Buyers: ${cr.lowRiskCount} customers`);
  }

  // 5. Territory Linehaul Facts
  const mentionsTerritory =
    q.includes('territory') ||
    q.includes('outside') ||
    q.includes('inside') ||
    q.includes('dhaka') ||
    q.includes('division') ||
    activeTab?.includes('Territory');

  // 6. Live Operations: Today's Sales, Warehouse Queue, Real-Time Delivery & Daily Reconciliation Updates
  const mentionsLiveOps =
    q.includes('today') ||
    q.includes('todays') ||
    q.includes('sale') ||
    q.includes('sales') ||
    q.includes('live') ||
    q.includes('queue') ||
    q.includes('pack') ||
    q.includes('shipped') ||
    q.includes('dispatch') ||
    q.includes('real-time') ||
    q.includes('real time') ||
    q.includes('reconciliation') ||
    q.includes('7-day') ||
    q.includes('7 day') ||
    q.includes('baseline') ||
    q.includes('yesterday') ||
    q.includes('telemetry') ||
    activeTab?.includes('LiveOps');

  if (mentionsLiveOps && slices?.liveOps) {
    const l = slices.liveOps;
    facts.push('Deterministic Live Operations & Today\'s Sales Report:');
    facts.push(`- **Operational Reference Day:** ${l.refDayName} (${l.referenceDate})${l.isFallbackDate ? ' (Latest recorded dispatches snapshot)' : ''}`);
    facts.push(`- **Today\'s Dispatched Volume:** ${l.todayShipped.ordersCount} unique orders (${l.todayShipped.itemsCount} items)`);
    facts.push(`- **Today\'s Gross Shipped Revenue:** ৳${l.todayShipped.grossRevenue.toLocaleString()} (AOV: ৳${l.todayShipped.aov.toLocaleString()})`);
    facts.push(`- **Performance vs 7-Day Daily Baseline:** ${l.todayShipped.deltaVs7dVolumePct >= 0 ? '+' : ''}${l.todayShipped.deltaVs7dVolumePct}% items | ${l.todayShipped.deltaVs7dRevenuePct >= 0 ? '+' : ''}${l.todayShipped.deltaVs7dRevenuePct}% revenue`);
    facts.push(`- **Fulfillment Queue:** ${l.queue.totalCount} orders pending packaging (${l.queue.processingCount} processing, ${l.queue.holdCount} on-hold)`);
    facts.push(`- **Today\'s Total Orders:** ${l.todaysOrders.totalCount} active orders (${l.todaysOrders.shippedCount} shipped + ${l.todaysOrders.processingCount} in packaging)`);

    facts.push('Real-Time Courier Telemetry (Pathao Hermes):');
    facts.push(`- **Courier Status Breakdown:** ${l.courierTelemetry.deliveredCount} Delivered, ${l.courierTelemetry.inTransitCount} In Transit, ${l.courierTelemetry.returnedCount} Returned, ${l.courierTelemetry.pendingPickupCount} Pending Pickup, ${l.courierTelemetry.untrackedCount} Untracked`);
    facts.push(`- **Courier Handover Rate:** ${l.courierTelemetry.handedOverRate}% (${l.courierTelemetry.handedOverCount} parcels handed over)`);
    facts.push(`- **Real-Time COD Collected:** ৳${l.courierTelemetry.totalCodCollected.toLocaleString()}`);

    if (l.courierTelemetry.discrepanciesCount > 0) {
      facts.push(`- **Active Courier Discrepancies:** ${l.courierTelemetry.discrepanciesCount} detected`);
      for (const d of l.courierTelemetry.discrepancies.slice(0, 3)) {
        facts.push(`  * Order ${d.orderId} [${d.type || 'DISCREPANCY'}]: Store=${d.wcStatus || 'N/A'}, Courier=${d.courierStatus || 'N/A'}${d.message ? ` (${d.message})` : ''}`);
      }
    } else {
      facts.push('- **Active Courier Discrepancies:** 0 detected (Store and courier statuses are in complete harmony)');
    }

    facts.push('Daily Reconciliation & 7-Day Rolling Baseline:');
    facts.push(`- **7-Day Daily Baseline:** ${l.sevenDayBaseline.avg7dItems} items/day | ${l.sevenDayBaseline.avg7dOrders} orders/day | ৳${l.sevenDayBaseline.avg7dRevenue.toLocaleString()}/day (AOV: ৳${l.sevenDayBaseline.avg7dAov.toLocaleString()})`);

    if (l.sevenDayBaseline.dailyHistory.length > 0) {
      facts.push('- **Recent 7-Day Dispatch History:**');
      for (const h of l.sevenDayBaseline.dailyHistory.slice(0, 5)) {
        facts.push(`  * ${h.dayName} (${h.dateIso}): ${h.orderCount} orders (${h.itemCount} items) | ৳${h.revenue.toLocaleString()} (AOV ৳${h.aov})`);
      }
    }

    if (l.topPerformers) {
      const tp = l.topPerformers;
      facts.push('Today\'s Performance Spotlight:');
      facts.push(`- **Top Category:** ${tp.topCategory.name} (${tp.topCategory.volume} pcs, ৳${tp.topCategory.revenue.toLocaleString()})`);
      facts.push(`- **Top Product SKU:** ${tp.topProduct.name} (${tp.topProduct.units} units sold)`);
      facts.push(`- **DEEN Selects Share:** ${tp.selectsRevSharePct}% of gross revenue`);
      facts.push(`- **Customer Mix:** ${tp.newCustomerPct}% New buyers / ${tp.repeatCustomerPct}% Returning repeat customers`);
    }
  }

  return facts.join('\n');
}
