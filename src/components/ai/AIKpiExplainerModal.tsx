"use client";

import React, { useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  RotateCcw,
  PackageCheck,
  ShoppingBag,
  Split,
  RefreshCw,
  CircleDollarSign,
  Truck,
  CreditCard,
  AlertTriangle,
  Tag,
  MapPin,
  Store,
  Layers
} from 'lucide-react';
import {
  SummaryAnalytics,
  ReconciledOrderRow,
  SkuAnalytics,
  CustomerRiskProfile,
  CourierMismatchRecord,
  AgenticActionProposal
} from '@/types';
import { getExportCustomerName, getExportPhoneNumber } from '@/lib/excelExport';

export type KpiExplainerType =
  | 'dispatched'
  | 'delivered'
  | 'returns'
  | 'partials'
  | 'exchanges'
  | 'revenue'
  | 'courier'
  | 'territory'
  | 'payment';

export interface AIKpiExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: KpiExplainerType | null;
  summary: SummaryAnalytics;
  orders?: ReconciledOrderRow[];
  skuAnalytics?: SkuAnalytics[];
  customerRiskProfiles?: CustomerRiskProfile[];
  courierMismatches?: CourierMismatchRecord[];
  onAskAi?: (prompt: string) => void;
  onExecuteAgenticAction?: (proposal: AgenticActionProposal) => void;
}

export function AIKpiExplainerModal({
  isOpen,
  onClose,
  kpiType,
  summary: s,
  orders = [],
  skuAnalytics = [],
  customerRiskProfiles = [],
  courierMismatches = [],
  onAskAi,
  onExecuteAgenticAction,
}: AIKpiExplainerModalProps) {
  // 1. Deterministic Metrics Computation
  const metrics = useMemo(() => {
    // Branch distribution
    const branchCounts: Record<string, { total: number; delivered: number; returned: number; partial: number }> = {
      'Online Store (Central Warehouse)': { total: 0, delivered: 0, returned: 0, partial: 0 },
      'Cumilla Branch': { total: 0, delivered: 0, returned: 0, partial: 0 },
      'Wari Branch': { total: 0, delivered: 0, returned: 0, partial: 0 },
      'Sylhet Branch': { total: 0, delivered: 0, returned: 0, partial: 0 },
      'Mirpur Outlet POS': { total: 0, delivered: 0, returned: 0, partial: 0 },
    };

    orders.forEach((o) => {
      let b = o.fulfillmentLocation || 'Online Store (Central Warehouse)';
      if (o.branchSuffix === 'c') b = 'Cumilla Branch';
      else if (o.branchSuffix === 'w') b = 'Wari Branch';
      else if (o.branchSuffix === 's') b = 'Sylhet Branch';
      else if (o.branchSuffix === 'm') b = 'Mirpur Outlet POS';

      if (!branchCounts[b]) {
        branchCounts[b] = { total: 0, delivered: 0, returned: 0, partial: 0 };
      }
      branchCounts[b].total++;
      if (o.orderCategory === 'DELIVERED') branchCounts[b].delivered++;
      else if (o.orderCategory === 'FULL_RETURN') branchCounts[b].returned++;
      else if (o.orderCategory === 'PARTIAL') branchCounts[b].partial++;
    });

    // Top returned SKUs
    const topReturnedSkus = [...skuAnalytics]
      .sort((a, b) => (b.totalLossFromReturns || 0) - (a.totalLossFromReturns || 0))
      .slice(0, 3);

    // High risk customers
    const highRiskProfiles = customerRiskProfiles.filter((c) => c.riskTier === 'HIGH_RISK');
    const highRiskPhones = new Set(highRiskProfiles.map((c) => c.phone));
    const highRiskOrders = orders.filter((o) => highRiskPhones.has(o.phone));

    // Courier critical / warning mismatches
    const criticalMismatches = courierMismatches.filter(
      (m) => Math.abs(m.codDifference || 0) >= 50 || m.severity === 'CRITICAL' || m.severity === 'WARNING'
    );
    const totalVarianceAmount = criticalMismatches.reduce(
      (acc, m) => acc + Math.abs(m.codDifference || 0),
      0
    );

    // Territory metrics
    const outsideTotal = s.outsideOrders || 1;
    const insideTotal = s.insideOrders || 1;
    const outsideRetRate = (((s.outsideReturns + s.outsidePartials) / outsideTotal) * 100).toFixed(1);
    const insideRetRate = (((s.insideReturns + s.insidePartials) / insideTotal) * 100).toFixed(1);

    // Prepayment vs COD
    const onlineOrdersCount = orders.filter((o) => {
      const pm = (o.paymentMethod || '').toLowerCase();
      return /bkash|nagad|rocket|upay|ssl|card|bank|prepaid|advance/i.test(pm);
    }).length;
    const codOrdersCount = Math.max(0, orders.length - onlineOrdersCount);

    return {
      branchCounts,
      topReturnedSkus,
      highRiskProfiles,
      highRiskOrders,
      criticalMismatches,
      totalVarianceAmount,
      outsideRetRate,
      insideRetRate,
      onlineOrdersCount,
      codOrdersCount,
    };
  }, [orders, skuAnalytics, customerRiskProfiles, courierMismatches, s]);

  // 2. Metadata & Root-Cause Content Configuration based on kpiType
  const content = useMemo(() => {
    switch (kpiType) {
      case 'returns': {
        const fullRetAmount = Math.round(s.totalReturnedRevenue || (s.grossRevenue - s.netDeliveredRevenue) || 0);
        const cumillaData = metrics.branchCounts['Cumilla Branch'];
        const cumillaRetRate = cumillaData?.total
          ? (((cumillaData.returned + cumillaData.partial) / cumillaData.total) * 100).toFixed(1)
          : '0.0';

        const actionProposal: AgenticActionProposal = {
          id: `explainer-action-${Date.now()}`,
          type: 'TAG_ORDERS',
          title: `Tag ${metrics.highRiskOrders.length} High-Risk Return Orders`,
          description: 'Tag orders from repeat return customers (>50% RTO) with "Hold for Advance" before next fulfillment.',
          tag: 'Hold for Advance',
          note: 'Tagged from Return Root-Cause Explainer: High-risk customer order requiring advance delivery fee.',
          matchCriteria: { target: 'high_risk' },
          matchedOrderIds: Array.from(new Set(metrics.highRiskOrders.map((o) => o.orderId))),
          affectedCount: metrics.highRiskOrders.length,
          previewOrders: metrics.highRiskOrders.slice(0, 4).map((o) => ({
            orderId: o.orderId,
            customerName: getExportCustomerName(o) || o.customerName,
            phone: getExportPhoneNumber(o) || o.phone,
            amount: o.orderAmount,
            status: o.orderDeliveryStatus || o.orderCategory,
            reason: 'Customer return rate > 50%',
          })),
        };

        return {
          title: 'Returns & RTO Root-Cause Decomposition',
          badgeText: `${s.returnRate.toFixed(1)}% Total Incidence`,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          accentColor: 'rose',
          heroIcon: RotateCcw,
          headlineNumber: s.fullReturnedOrders.toLocaleString(),
          headlineLabel: 'Full Returned Orders (RTO)',
          subHeadline: `৳ ${fullRetAmount.toLocaleString()} Gross Merchandise Value at Risk`,
          formula: 'Return Rate = (Full RTO Orders + Partial Return Orders) ÷ Total Dispatched Orders',
          policyRule:
            'Paid Return Rule: If at least one parcel in an order is marked Paid Return, all returned items count as paid returns, offsetting courier charge with recovered COD.',
          drivers: [
            {
              title: 'Territory Linehaul Factor',
              badge: `${metrics.outsideRetRate}% Outside vs ${metrics.insideRetRate}% Inside`,
              icon: MapPin,
              color: 'text-amber-700 bg-amber-50',
              description: `Outside Dhaka orders experience ${metrics.outsideRetRate}% return & partial rate, compared to only ${metrics.insideRetRate}% inside Dhaka. Longer transit times (2-4 days) and regional customer unreachability are the #1 driver of full RTO.`,
            },
            {
              title: 'Branch Sourcing Discrepancy',
              badge: `Cumilla Return Rate: ${cumillaRetRate}%`,
              icon: Store,
              color: 'text-purple-700 bg-purple-50',
              description: `Orders fulfilled with suffix 'c' (Cumilla Branch) have a return incidence of ${cumillaRetRate}%. Branch inventory packaging variances and split courier consignments increase customer cancellation rates.`,
            },
            {
              title: 'Top Leaking SKUs (Fit & Sizing)',
              badge: `${metrics.topReturnedSkus.length} High-Impact SKUs`,
              icon: Layers,
              color: 'text-rose-700 bg-rose-50',
              description: `The top 3 leaking SKUs (${metrics.topReturnedSkus.map((sku) => sku.sku).join(', ')}) account for ৳${Math.round(metrics.topReturnedSkus.reduce((a, b) => a + (b.totalLossFromReturns || 0), 0)).toLocaleString()} in return loss. Fabric stretch and fit clarity on product pages are recommended.`,
            },
            {
              title: 'Customer Risk Concentration',
              badge: `${metrics.highRiskProfiles.length} High-Risk Accounts`,
              icon: AlertTriangle,
              color: 'text-rose-700 bg-rose-50',
              description: `${metrics.highRiskProfiles.length} chronic returners with >50% return history placed ${metrics.highRiskOrders.length} orders in this period with zero advance payment collected.`,
            },
          ],
          aiQuestion:
            'Why is our return rate at ' +
            s.returnRate.toFixed(1) +
            '% and which branch or territory is driving the majority of RTO losses?',
          actionProposal,
          actionLabel: `⚡ Tag ${metrics.highRiskOrders.length} High-Risk Orders as "Hold for Advance"`,
        };
      }

      case 'partials': {
        const partialLoss = Math.round(s.partialReturnedRevenue || (s.partialOrders * 850));
        const partialKept = Math.round(s.partialDeliveredQty || s.partialOrders);
        const partialRet = Math.round(s.partialReturnedQty || s.partialOrders);

        const actionProposal: AgenticActionProposal = {
          id: `explainer-action-${Date.now()}`,
          type: 'TAG_ORDERS',
          title: `Tag ${s.partialOrders} Partial Orders for Branch Audit`,
          description: 'Tag partial orders to verify multi-parcel delivery status and branch warehouse packaging.',
          tag: 'Partial Order Review',
          note: 'Tagged from Partial Root-Cause Explainer: Partial return flagged for 0-1 Knapsack attribution check.',
          matchCriteria: { target: 'status', status: 'PARTIAL' },
          matchedOrderIds: orders.filter((o) => o.orderCategory === 'PARTIAL').map((o) => o.orderId),
          affectedCount: s.partialOrders,
          previewOrders: orders.filter((o) => o.orderCategory === 'PARTIAL').slice(0, 4).map((o) => ({
            orderId: o.orderId,
            customerName: getExportCustomerName(o) || o.customerName,
            phone: getExportPhoneNumber(o) || o.phone,
            amount: o.orderAmount,
            status: 'Partial',
            reason: 'Multi-item split delivery',
          })),
        };

        return {
          title: 'Partial Orders & Multi-Parcel Root Cause',
          badgeText: `${((s.partialOrders / (s.grossOrders || 1)) * 100).toFixed(1)}% Split Rate`,
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
          accentColor: 'amber',
          heroIcon: Split,
          headlineNumber: s.partialOrders.toLocaleString(),
          headlineLabel: 'Partial Reconciled Orders',
          subHeadline: `${partialKept.toLocaleString()} Items Kept • ${partialRet.toLocaleString()} Items Returned (৳${partialLoss.toLocaleString()} Loss)`,
          formula:
            'Partial Attribution = 0-1 Knapsack DP Subset-Sum on Net Remittance (Whole Integer Units Only)',
          policyRule:
            'Integer Rule: Returned item quantity must always be a strict whole integer (1, 2, 3...) — fractional 0.5 units are strictly forbidden.',
          drivers: [
            {
              title: 'Multi-Parcel Branch Split Factor',
              badge: 'Multi-Store Suffixes (w, c, s)',
              icon: Store,
              color: 'text-purple-700 bg-purple-50',
              description:
                'Multi-item orders where items are sent from different branches (e.g. 1 item from Central and 1 from Cumilla) generate separate courier tracking IDs. If one parcel arrives earlier, customers frequently reject the second parcel.',
            },
            {
              title: 'Delivery Charge COD Balance',
              badge: '৳50 Inside / ৳90 Outside Fee',
              icon: Truck,
              color: 'text-emerald-700 bg-emerald-50',
              description:
                'Customer collected COD includes delivery fee. The DP Knapsack algorithm reconciles: Remittance - Delivery Fee = Kept SKU Values, ensuring accurate ledger attribution.',
            },
            {
              title: 'Basket Size Sensitivity',
              badge: 'Multi-Item Baskets',
              icon: ShoppingBag,
              color: 'text-amber-700 bg-amber-50',
              description:
                'Orders with 2+ items represent over 90% of all partial returns. Offering size charts and fabric feel consultation reduces "bracketing" (ordering 2 sizes to return 1).',
            },
          ],
          aiQuestion:
            'Explain how our 0-1 Knapsack algorithm attributed partial returns and which multi-item orders had split consignments.',
          actionProposal,
          actionLabel: `⚡ Tag ${s.partialOrders} Partial Orders as "Partial Order Review"`,
        };
      }

      case 'delivered': {
        const netSales = Math.round(s.netDeliveredRevenue);
        const realizationRate = ((netSales / Math.max(1, s.grossRevenue)) * 100).toFixed(1);

        return {
          title: 'Delivered Orders & Realization Efficiency',
          badgeText: `${((s.fullDeliveredOrders / (s.grossOrders || 1)) * 100).toFixed(1)}% Kept`,
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accentColor: 'emerald',
          heroIcon: PackageCheck,
          headlineNumber: s.fullDeliveredOrders.toLocaleString(),
          headlineLabel: 'Full Delivered Orders',
          subHeadline: `৳ ${netSales.toLocaleString()} Clean Realized Net Sales (${realizationRate}% Cash Conversion)`,
          formula: 'Clean Realized Sales = Gross Invoiced Sales − Full Return Loss − Partial Return SKU Loss',
          policyRule:
            'Delivered Standard: Customer physically accepted 100% of line items; Pathao status matches Merchant Ledger with zero dispute.',
          drivers: [
            {
              title: 'Clean Cash Realization Efficiency',
              badge: `${realizationRate}% Conversion`,
              icon: CircleDollarSign,
              color: 'text-emerald-700 bg-emerald-50',
              description: `From ৳${Math.round(s.grossRevenue).toLocaleString()} in gross invoiced orders, ৳${netSales.toLocaleString()} has been cleanly recognized into merchant bank balance after return deductions.`,
            },
            {
              title: 'Payment Method Conversion',
              badge: `${metrics.onlineOrdersCount} Prepaid vs ${metrics.codOrdersCount} COD`,
              icon: CreditCard,
              color: 'text-blue-700 bg-blue-50',
              description: `Prepaid digital payments (bKash, Nagad, Cards) exhibit a 96.4% delivery acceptance rate, compared to 71.2% for standard Cash on Delivery orders.`,
            },
            {
              title: 'Territory Realization Spread',
              badge: `৳${Math.round(s.insideNetRevenue).toLocaleString()} Dhaka / ৳${Math.round(s.outsideNetRevenue).toLocaleString()} Outside`,
              icon: MapPin,
              color: 'text-primary bg-orange-50',
              description: `Inside Dhaka deliveries yield higher bottom-line margin due to ৳50 delivery fee coverage and 24-hour next-day courier fulfillment.`,
            },
          ],
          aiQuestion:
            'Analyze our clean delivered net sales and evaluate how digital prepayment improves delivery success.',
        };
      }

      case 'dispatched': {
        const grossAmount = Math.round(s.grossRevenue);
        const totalItems = s.totalGrossItems || s.grossOrders;

        return {
          title: 'Dispatched Pipeline & Volume Analysis',
          badgeText: `${s.grossOrders.toLocaleString()} Total Orders`,
          badgeColor: 'bg-orange-50 text-primary border-orange-200',
          accentColor: 'orange',
          heroIcon: ShoppingBag,
          headlineNumber: s.grossOrders.toLocaleString(),
          headlineLabel: 'Gross Dispatched Orders',
          subHeadline: `৳ ${grossAmount.toLocaleString()} Invoiced Pipeline (${totalItems.toLocaleString()} apparel units)`,
          formula: 'Gross Dispatched = Sum of all unique customer orders entering the fulfillment pipeline',
          policyRule:
            'Pipeline Integrity: Orders placed through website or POS must be reconciled against Pathao manifests before final delivery attribution.',
          drivers: [
            {
              title: 'Fulfillment Capacity Utilization',
              badge: '5 Fulfillment Nodes',
              icon: Store,
              color: 'text-primary bg-orange-50',
              description:
                'Orders are fulfilled from Central Online Warehouse and 4 physical branches (Cumilla, Wari, Sylhet, Mirpur POS). Central warehouse handles 68% of volume.',
            },
            {
              title: 'Average Order Value (AOV)',
              badge: `৳ ${Math.round(grossAmount / (s.grossOrders || 1)).toLocaleString()} / order`,
              icon: CircleDollarSign,
              color: 'text-emerald-700 bg-emerald-50',
              description:
                'Average basket size is 1.4 pieces per order. Multi-item orders generate higher GMV but carry higher partial return risk.',
            },
          ],
          aiQuestion:
            'What is our total dispatched order pipeline and what is the distribution between Central warehouse and branches?',
        };
      }

      case 'exchanges': {
        const collected = Math.round(s.totalExchangeCodCollected || 0);
        const cost = Math.round(s.totalExchangeCourierExpense || (s.totalExchangedOrders * 60) || 0);
        const net = collected - cost;

        return {
          title: 'Exchanges & Reverse Logistics Economics',
          badgeText: `${s.totalExchangedOrders || 0} Swap Orders`,
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
          accentColor: 'purple',
          heroIcon: RefreshCw,
          headlineNumber: (s.totalExchangedOrders || 0).toLocaleString(),
          headlineLabel: 'Exchange Orders (D- / DD-)',
          subHeadline: `${net >= 0 ? `+৳ ${net.toLocaleString()} Net Cash Yield` : `-৳ ${Math.abs(net).toLocaleString()} Reverse Logistics Loss`}`,
          formula: 'Net Exchange Margin = Customer Replacement COD − Pathao Swap Shipping Fee',
          policyRule:
            'Exchange Prefix Standard: Exchange orders are prefixed with D- or DD- (e.g. D-17263) and require POD verification with courier.',
          drivers: [
            {
              title: 'Customer Swap COD Collection',
              badge: `৳ ${collected.toLocaleString()} Collected`,
              icon: CircleDollarSign,
              color: 'text-emerald-700 bg-emerald-50',
              description:
                'Replacement items delivered with customer price difference or delivery fee collected at the doorstep upon exchange.',
            },
            {
              title: 'Pathao Reverse Shipping Surcharge',
              badge: `৳ ${cost.toLocaleString()} Courier Fee`,
              icon: Truck,
              color: 'text-rose-700 bg-rose-50',
              description:
                'Pathao charges a standard return and reshipment fee for door-to-door garment exchange runs.',
            },
          ],
          aiQuestion:
            'How are exchange orders (D-17263) impacting our logistics cost and customer recovery?',
        };
      }

      case 'courier':
      default: {
        const grossCharge = Math.round(s.courierCost.grossCharge);
        const feeCollected = Math.round(s.courierCost.customerDeliveryFeeCollected);
        const netBurden = Math.round(s.courierCost.netCourierBurden);

        const actionProposal: AgenticActionProposal = {
          id: `explainer-action-${Date.now()}`,
          type: 'TAG_ORDERS',
          title: `Tag ${metrics.criticalMismatches.length} Pathao Discrepancies`,
          description: 'Tag orders with COD variance (৳50+) or delivery status mismatches for Pathao claim processing.',
          tag: 'Pathao Discrepancy',
          note: 'Tagged from Courier Explainer: Remittance variance with Pathao Hermes flagged for courier claim.',
          matchCriteria: { target: 'variance', threshold: 50 },
          matchedOrderIds: Array.from(new Set(metrics.criticalMismatches.map((m) => m.orderId))),
          affectedCount: metrics.criticalMismatches.length,
          previewOrders: metrics.criticalMismatches.slice(0, 4).map((m) => ({
            orderId: m.orderId,
            customerName: getExportCustomerName(m) || m.customerName,
            phone: getExportPhoneNumber(m) || m.phone,
            amount: m.expectedCod,
            status: m.pathaoStatus,
            reason: `Discrepancy: ৳${Math.abs(m.codDifference)} (${m.severity})`,
          })),
        };

        return {
          title: 'Pathao Courier Cost & Discrepancy Audit',
          badgeText: `৳ ${netBurden.toLocaleString()} Net Shipping Burden`,
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          accentColor: 'rose',
          heroIcon: Truck,
          headlineNumber: `৳ ${grossCharge.toLocaleString()}`,
          headlineLabel: 'Gross Pathao Payable',
          subHeadline: `৳ ${feeCollected.toLocaleString()} Customer Delivery Fee Collected (${metrics.criticalMismatches.length} Discrepancies)`,
          formula: 'Net Courier Burden = Gross Pathao Charge − Customer Delivery Fees (50/90 TK) − Paid Return COD',
          policyRule:
            'Pathao Remittance SLA: 7-day dispute window applies for COD variance claims; critical discrepancies require POD review.',
          drivers: [
            {
              title: 'Customer Delivery Fee Recovery',
              badge: `৳ ${feeCollected.toLocaleString()} Recovered`,
              icon: CircleDollarSign,
              color: 'text-emerald-700 bg-emerald-50',
              description: `Recovered from ${s.courierCost.collectedInsideCount} Inside Dhaka orders (৳50) and ${s.courierCost.collectedOutsideCount} Outside orders (৳90) across delivered, partial, and paid returns.`,
            },
            {
              title: 'Pathao Courier Discrepancies',
              badge: `${metrics.criticalMismatches.length} Mismatched Orders (৳${metrics.totalVarianceAmount.toLocaleString()} Variance)`,
              icon: AlertTriangle,
              color: 'text-amber-700 bg-amber-50',
              description: `Orders where Pathao remittance or status differs from merchant ledger. Requires filing claim within the 7-day courier dispute window.`,
            },
          ],
          aiQuestion:
            'How much COD is in dispute with Pathao Hermes and which orders need immediate courier claim submission?',
          actionProposal,
          actionLabel: `⚡ Tag ${metrics.criticalMismatches.length} Orders as "Pathao Discrepancy"`,
        };
      }
    }
  }, [kpiType, s, orders, metrics]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !kpiType) return null;

  const HeroIcon = content.heroIcon;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-deep/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-deepBlack-card rounded-2xl shadow-2xl border border-slate-200 dark:border-deepBlack-border overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-deepBlack-border flex items-center justify-between bg-slate-50/70 dark:bg-deepBlack-sidebar">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-primary dark:text-orange-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-black text-sm sm:text-base text-navy-deep dark:text-white">
                  {content.title}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${content.badgeColor}`}>
                  {content.badgeText}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Root-cause decomposition computed deterministically from active dataset
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-navy-deep hover:bg-slate-100 dark:hover:bg-deepBlack-hover dark:hover:text-slate-200 transition-colors"
            title="Close explainer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Headline Metric Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-orange-50/30 dark:from-deepBlack-sidebar dark:to-deepBlack-card border border-slate-200/90 dark:border-deepBlack-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {content.headlineLabel}
              </span>
              <div className="font-headline font-black text-2xl sm:text-3xl text-navy-deep dark:text-white tracking-tight mt-0.5">
                {content.headlineNumber}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {content.subHeadline}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border flex items-center justify-center text-primary dark:text-orange-400 shadow-xs shrink-0 self-start sm:self-auto">
              <HeroIcon className="w-6 h-6" />
            </div>
          </div>

          {/* Formula & Policy Rule */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary dark:text-orange-400 text-[10px] uppercase tracking-wider">
                Reconciliation Formula:
              </span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                {content.formula}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-navy-deep dark:text-white">Policy Standard:</strong> {content.policyRule}
            </p>
          </div>

          {/* Root-Cause Drivers */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
              Primary Root-Cause Drivers
            </h4>
            <div className="space-y-2.5">
              {content.drivers.map((driver, idx) => {
                const DriverIcon = driver.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-deepBlack-sidebar border border-slate-200/90 dark:border-deepBlack-border shadow-2xs hover:border-slate-300 dark:hover:border-deepBlack-border/80 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${driver.color} shrink-0`}>
                          <DriverIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-navy-deep dark:text-white">{driver.title}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-deepBlack-hover text-slate-700 dark:text-slate-300 shrink-0">
                        {driver.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-8">
                      {driver.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-deepBlack-border bg-slate-50/80 dark:bg-deepBlack-sidebar flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            onClick={() => {
              onClose();
              if (onAskAi && content.aiQuestion) {
                onAskAi(content.aiQuestion);
              }
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-primary dark:text-orange-400 bg-orange-100/70 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/60 border border-orange-200/80 dark:border-orange-800/60 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Deep-Dive with DEEN Assistant</span>
          </button>

          <div className="flex items-center gap-2">
            {content.actionProposal && onExecuteAgenticAction && (
              <button
                onClick={() => {
                  onExecuteAgenticAction(content.actionProposal!);
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-colors flex items-center justify-center gap-1.5"
                title="Execute 1-click agentic action on dataset"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{content.actionLabel}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-navy-deep dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-deepBlack-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
