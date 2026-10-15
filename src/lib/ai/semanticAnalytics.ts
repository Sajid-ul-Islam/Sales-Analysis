import {
  ReconciledOrderRow,
  CourierMismatchRecord,
  SkuAnalytics,
  CustomerRiskProfile,
  SummaryAnalytics
} from '@/types';

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

export interface AnalyticsSlices {
  branches?: BranchMetricSummary[];
  courierAudit?: CourierAuditSummary;
  skuLoss?: SkuLossSummary;
  customerRisk?: CustomerRiskSummary;
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

  if (mentionsTerritory && summary) {
    facts.push('Deterministic Territory Distribution:');
    facts.push(`- Inside Dhaka: ${summary.insideOrders?.toLocaleString() || 0} orders | Net Realized: ৳${(summary.insideNetRevenue || 0).toLocaleString()} | Returns: ${summary.insideReturns || 0}`);
    facts.push(`- Outside Dhaka: ${summary.outsideOrders?.toLocaleString() || 0} orders | Net Realized: ৳${(summary.outsideNetRevenue || 0).toLocaleString()} | Returns: ${summary.outsideReturns || 0}`);
    facts.push(`- Linehaul Dependency Ratio: ~${Math.round(Number(summary.outsideRatio) || 1)} Outside orders per 1 Inside Dhaka order`);
  }

  return facts.join('\n');
}
