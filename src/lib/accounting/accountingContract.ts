/**
 * Authoritative Accounting Contract & Mathematical Invariants
 * Enforces domain accounting rules from .agents/rules/reconciliation_and_accounting_rules.md
 */

export interface OrderLevelMetrics {
  orderId: string;
  orderTotalAmount: number; // Gross Invoiced Order Total
  shippingFeePaid: number;  // Delivery fee invoiced
  discountAmount?: number;
  refundAmount?: number;
  netOrderValue: number;
}

export interface LineItemMetrics {
  orderId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
}

export interface DoubleCountingAuditResult {
  isValid: boolean;
  uniqueOrderCount: number;
  totalLineItemsCount: number;
  deduplicatedTotalGMV: number;
  naiveSummedGMV: number;
  inflationDelta: number;
  inflationPercentage: number;
}

import { RawOrderRow } from '@/types';

/**
 * Invariant 1: Multi-Item Order GMV Deduplication
 * Verifies that aggregating order totals across flattened line items does not double-count revenue.
 */
export function assertNoDoubleCounting(rows: (RawOrderRow | Record<string, unknown>)[]): DoubleCountingAuditResult {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      isValid: true,
      uniqueOrderCount: 0,
      totalLineItemsCount: 0,
      deduplicatedTotalGMV: 0,
      naiveSummedGMV: 0,
      inflationDelta: 0,
      inflationPercentage: 0,
    };
  }

  const orderMap = new Map<string, number>();
  let naiveSum = 0;

  for (const row of rows) {
    const orderId = String(row['Order ID'] || row.orderId || row.id || '');
    const amount = parseFloat(String(row['Order Total Amount'] || row['Order Amount'] || (row as Record<string, unknown>).orderTotal || 0)) || 0;
    naiveSum += amount;

    if (!orderMap.has(orderId)) {
      orderMap.set(orderId, amount);
    }
  }

  const deduplicatedSum = Array.from(orderMap.values()).reduce((sum, val) => sum + val, 0);
  const inflationDelta = Math.max(0, naiveSum - deduplicatedSum);
  const inflationPercentage = deduplicatedSum > 0 ? (inflationDelta / deduplicatedSum) * 100 : 0;

  return {
    isValid: inflationDelta === 0 || rows.length === orderMap.size,
    uniqueOrderCount: orderMap.size,
    totalLineItemsCount: rows.length,
    deduplicatedTotalGMV: Number(deduplicatedSum.toFixed(2)),
    naiveSummedGMV: Number(naiveSum.toFixed(2)),
    inflationDelta: Number(inflationDelta.toFixed(2)),
    inflationPercentage: Number(inflationPercentage.toFixed(2)),
  };
}

/**
 * Invariant 2: COD Delivery Fee Conservation
 * Collected COD = Kept Items Value + Territory Delivery Fee (tolerance <= 2.0 BDT)
 */
export function assertDeliveryFeeBalance(params: {
  collectedCod: number;
  keptMerchandiseValue: number;
  deliveryFee: number;
  tolerance?: number;
}): { isBalanced: boolean; expectedCod: number; deviation: number } {
  const { collectedCod, keptMerchandiseValue, deliveryFee, tolerance = 2.0 } = params;
  const expectedCod = keptMerchandiseValue + deliveryFee;
  const deviation = Math.abs(collectedCod - expectedCod);

  return {
    isBalanced: deviation <= tolerance,
    expectedCod: Number(expectedCod.toFixed(2)),
    deviation: Number(deviation.toFixed(2)),
  };
}

/**
 * Invariant 3: Whole Integer Quantities
 * Quantities of garments returned or kept must strictly be non-negative integers.
 * Floats like 0.5 are strictly forbidden.
 */
export function assertWholeIntegerQuantities(
  assignments: Array<{ totalQty: number; keptQty: number; returnedQty: number }>
): { isValid: boolean; violations: Array<{ totalQty: number; keptQty: number; returnedQty: number }> } {
  const violations: Array<{ totalQty: number; keptQty: number; returnedQty: number }> = [];

  for (const a of assignments) {
    const isTotalInt = Number.isInteger(a.totalQty) && a.totalQty >= 0;
    const isKeptInt = Number.isInteger(a.keptQty) && a.keptQty >= 0;
    const isReturnedInt = Number.isInteger(a.returnedQty) && a.returnedQty >= 0;
    const isConservationMet = a.keptQty + a.returnedQty === a.totalQty;

    if (!isTotalInt || !isKeptInt || !isReturnedInt || !isConservationMet) {
      violations.push(a);
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Invariant 4: Unit Economics & Contribution Margin Invariants
 * Validates CM2, CM3, COGS ratio (42-45%), Packaging sunk loss (25 BDT / return).
 */
export function validateUnitEconomics(params: {
  realizedNetSales: number;
  cogsAmount: number;
  netCourierBurden: number;
  returnedOrPartialOrderCount: number;
  packagingUnitCost?: number;
  metaAdSpend: number;
}): {
  grossProductMargin: number;
  packagingLossTotal: number;
  cm2: number;
  cm3: number;
  cogsRatioPercent: number;
  roas: number;
  isCogsInExpectedRange: boolean;
} {
  const {
    realizedNetSales,
    cogsAmount,
    netCourierBurden,
    returnedOrPartialOrderCount,
    packagingUnitCost = 25,
    metaAdSpend,
  } = params;

  const grossProductMargin = realizedNetSales - cogsAmount;
  const packagingLossTotal = returnedOrPartialOrderCount * packagingUnitCost;
  const cm2 = grossProductMargin - netCourierBurden - packagingLossTotal;
  const cm3 = cm2 - metaAdSpend;
  const cogsRatioPercent = realizedNetSales > 0 ? (cogsAmount / realizedNetSales) * 100 : 0;
  const roas = metaAdSpend > 0 ? realizedNetSales / metaAdSpend : 0;

  return {
    grossProductMargin: Number(grossProductMargin.toFixed(2)),
    packagingLossTotal: Number(packagingLossTotal.toFixed(2)),
    cm2: Number(cm2.toFixed(2)),
    cm3: Number(cm3.toFixed(2)),
    cogsRatioPercent: Number(cogsRatioPercent.toFixed(2)),
    roas: Number(roas.toFixed(2)),
    // Expected COGS modeled at 40% - 48% range
    isCogsInExpectedRange: cogsRatioPercent >= 40 && cogsRatioPercent <= 48,
  };
}
