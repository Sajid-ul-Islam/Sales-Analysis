export type LocationType = 'Inside Dhaka' | 'Outside Dhaka' | 'Outlet / POS';

export type DeliveryCategory = 'DELIVERED' | 'PARTIAL' | 'FULL_RETURN' | 'EXCHANGE';

export interface RawOrderRow {
  [key: string]: unknown;
}

export interface ReconciledOrderRow {
  orderId: string;
  lineStatus: string; // 'Primary Item (Unique Order)' | 'Additional Item (Multi-Item Order)'
  deliveryStatus: string;
  orderCategory: DeliveryCategory;
  orderDeliveryStatus?: 'Delivered' | 'Paid Return' | 'Not Paid Return' | 'Exchange' | 'Partial';
  itemDeliveryStatus?: 'Delivered' | 'Returned' | 'Exchange';
  orderDate: Date | null;
  customerName: string;
  phone: string;
  city: string;
  districtArea: LocationType;
  sku: string;
  itemName: string;
  quantity: number;
  itemCost: number;
  orderAmount: number;
  netRevenueImpact: number;
  paymentMethod: string;
  hasSplitSuffix: boolean;
  rawNote?: string;
  cogsEstimate: number; // estimated production/fabric cost (typically 45% of retail)
  fulfillmentLocation?: 'Online Store (Central Warehouse)' | 'Mirpur Outlet POS' | 'Mirpur Outlet' | 'Cumilla Branch' | 'Wari Branch' | 'Sylhet Branch' | 'Warehouse (Mirpur)';
  branchSuffix?: string; // 'c' | 'w' | 's' | 'm' | ''
  isPaidReturn?: boolean;
  isExchange?: boolean;
  aiAuditTag?: string; // AI operational tag (e.g. 'Pathao Discrepancy', 'Hold for Advance', 'Branch Audit')
  aiAuditNote?: string; // AI audit description or reason
  requiresManualReview?: boolean; // True when subset-sum match is ambiguous or deviates from discrete targets
  decisionEvidence?: import('@/lib/subsetSumAuditor').DecisionEvidence; // Explainable evidence trail for the reconciliation outcome
  rawCustomerName?: string;
  rawPhone?: string;
  wpDeliveryStatus?: 'Delivered' | 'Paid Return' | 'Not Paid Return' | 'Exchange' | 'Partial';
  wpMarkSource?: 'wc_status' | 'pathao_plugin' | 'custom_status_meta' | 'order_note' | 'webhook' | null;
  pathaoPluginStatus?: string;
  pathaoCollectedAmount?: number;
  /** True when the WordPress/WooCommerce order status or Pathao plugin meta marks this order as returned */
  isReturnFromWp?: boolean;
  /** True when the WordPress/WooCommerce order status or Pathao plugin meta marks this as a partial delivery */
  isPartialFromWp?: boolean;
  /** True when the WordPress/WooCommerce order is a manual exchange/replacement (non-checkout) */
  isExchangeFromWp?: boolean;
  /** True when the return is paid (collected_amount > 0 or status notes indicate paid return) */
  isPaidReturnFromWp?: boolean;
}

export interface ReturnedItemRow {
  orderId: string;
  returnSource: 'Full Return (RTO / Paid Return)' | 'Full Return (Non-Paid Return)' | 'Partial Order Return (Rejected Item)' | 'Partial Order Return (Estimated Proportion)';
  deliveryStatus: string;
  orderDate: Date | null;
  customerName: string;
  phone: string;
  districtArea: LocationType;
  sku: string;
  itemName: string;
  quantity: number;
  itemCost: number;
  returnedValue: number;
  orderAmount: number;
}

export interface SkuAnalytics {
  sku: string;
  itemName: string;
  category?: string;
  unitPrice?: number;
  grossQty: number;
  deliveredQty: number;
  partialQty?: number;
  returnedQty: number;
  deliveredRevenue: number;
  returnRate: number;
  totalLossFromReturns: number;
}

export interface CustomerRiskProfile {
  phone: string;
  customerName: string;
  totalOrders: number;
  deliveredOrders: number;
  partialOrders: number;
  returnedOrders: number;
  returnRate: number; // 0 - 100%
  totalSpent: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH_RISK';
  recommendation: string;
}

export interface CourierCostSummary {
  grossCharge: number;
  discount: number;
  netCharge: number;
  paidReturnCollectedCod: number;
  netCourierBurden: number; // netCharge - paidReturnCollectedCod
  consignmentsCount: number;
  customerDeliveryFeeCollected: number;
  collectedInsideCount: number;
  collectedOutsideCount: number;
  collectedDeliveryFeeInside: number;
  collectedDeliveryFeeOutside: number;
  collectedEligibleOrdersCount: number;
  netCourierCostAfterDeliveryFee: number;
}

export interface UnitEconomics {
  grossInvoicedSales: number;
  netRealizedSales: number;
  estimatedCogs: number; // approx 42-45% of gross delivered
  grossMargin: number;
  totalCourierExpense: number;
  packagingLoss: number; // ৳25 per return order
  metaAdCost: number; // Total Meta (Facebook & Instagram) performance marketing spend
  netContributionMargin: number; // Bottom-line cash yield after COGS, Courier, Packaging & Meta Ads
  netMarginPercentage: number;
  roas: number; // Blended Return on Ad Spend (Realized Net Sales / Meta Ad Spend)
  cac: number; // Blended Customer Acquisition Cost per delivered order
}

export interface SummaryAnalytics {
  grossOrders: number;
  totalGrossItems: number;
  fullDeliveredOrders: number;
  netDeliveredOrders?: number;
  partialOrders: number;
  fullReturnedOrders: number;
  totalReturnedOrders: number;
  totalPartialProducts: number;
  regularReturnedQty: number;
  partialReturnedQty: number;
  partialDeliveredQty: number;
  partialTotalItems: number;
  totalReturnedQty: number;
  totalReturnedPlusPartial: number;
  returnRate: number;
  fullReturnRate: number;
  partialRate: number;
  grossRevenue: number;
  netDeliveredRevenue: number;
  totalReturnedRevenue?: number;
  regularReturnedRevenue?: number;
  partialReturnedRevenue?: number;
  partialDeliveredRevenue?: number;
  totalItemsDelivered: number;
  insideOrders: number;
  outsideOrders: number;
  insideReturns: number;
  outsideReturns: number;
  insidePartials: number;
  outsidePartials: number;
  insideNetRevenue: number;
  outsideNetRevenue: number;
  outsideRatio: string;
  courierCost: CourierCostSummary;
  unitEconomics: UnitEconomics;
  totalExchangedOrders: number;
  totalExchangedItemsQty: number;
  totalExchangeCodCollected: number;
  paidReturnsCount?: number;
  unpaidReturnsCount?: number;
  totalExchangeCourierExpense: number;
  pathaoDeliveryCount?: number;
  pathaoMatchedOrdersCount?: number;
  doubleCountingAudit?: import('@/lib/accounting/accountingContract').DoubleCountingAuditResult;
}

export interface SummaryMetrics extends SummaryAnalytics {
  totalOrderValue?: number;
  deliveredOrdersCount?: number;
  totalOrders?: number;
  totalCourierLoss?: number;
}

export interface PathaoDeliveryRow {
  consignmentId: string;
  createdAt: string;
  description: string;
  merchantOrderId: string;
  recipientName: string;
  recipientAddress: string;
  recipientPhone: string;
  paymentStatus: string;
  collectableAmount: number;
  collectedAmount: number;
  totalFee: number;
  codFee: number;
  deliveryFee: number;
  orderStatus: string;
  storeName: string;
  orderType: string;
}

export interface ExchangedOrderRow {
  orderId: string;
  rawOrderId: string;
  consignmentId: string;
  recipientName: string;
  phone: string;
  address: string;
  deliveryStatus: string;
  type: string;
  statusUpdatedOn: string;
  codAmount: number;
  courierCharge: number;
  discount: number;
  paymentStatus: string;
  actionPod?: string;
  matchedInOrders: boolean;
  quantity?: number;
  itemDescription?: string;
}

export type MismatchSeverity = 'CRITICAL' | 'WARNING' | 'MATCH' | 'INFO';

export interface CourierMismatchRecord {
  orderId: string;
  consignmentId?: string;
  customerName: string;
  phone: string;
  excelStatus: string; // 'Returned' | 'Partial' | 'Exchange' | 'Delivered'
  pathaoStatus: string; // 'Delivered' | 'Returned to Merchant' | 'Partial Delivery' | 'Not Found in Pathao' | 'In Transit'
  expectedCod: number;
  pathaoCollectedCod: number;
  codDifference: number;
  severity: MismatchSeverity;
  mismatchType: 'STATUS_MISMATCH' | 'COD_MISMATCH' | 'MISSING_IN_COURIER' | 'UNLOGGED_RETURN' | 'RECONCILED';
  description: string;
  recommendedAction: string;
  requiresManualReview?: boolean;
  reviewReason?: string;
}

export type AgenticActionType = 'TAG_ORDERS' | 'CLEAR_TAGS' | 'FILTER_VIEW';

export interface AgenticPreviewOrder {
  orderId: string;
  customerName: string;
  phone?: string;
  amount: number;
  status: string;
  reason: string;
}

export interface AgenticActionProposal {
  id: string;
  type: AgenticActionType;
  title: string;
  description: string;
  tag?: string;
  note?: string;
  matchCriteria: {
    target: 'variance' | 'high_risk' | 'outside_dhaka' | 'branch' | 'sku' | 'order_ids' | 'status' | 'uncollected_cod' | 'all';
    threshold?: number;
    branchSuffix?: string;
    branchName?: string;
    sku?: string;
    orderIds?: string[];
    status?: string;
  };
  matchedOrderIds: string[];
  affectedCount: number;
  previewOrders: AgenticPreviewOrder[];
  isApplied?: boolean;
}

export interface DatasetSnapshot {
  orders: RawOrderRow[];
  pathaoDelivery: RawOrderRow[];
  returns: RawOrderRow[];
  partials: RawOrderRow[];
  exchanges: RawOrderRow[];
  sourceName?: string;
  syncedAt?: string;
  version?: string;
}
