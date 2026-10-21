"use client";

import React, { useState, useMemo } from 'react';
import { SummaryAnalytics, ReconciledOrderRow } from '@/types';
import { DateScope, DateScopeCounts, CustomDateRange, FileWeek, AvailableMonth } from '@/lib/dateFilter';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import {
  ShoppingBag,
  CircleDollarSign,
  Truck,
  RotateCcw,
  Split,
  PackageCheck,
  Compass,
  Coins,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  Scale,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { MiniDonutChart } from '@/components/kpi/MiniDonutChart';
import { AIKpiExplainerModal, KpiExplainerType } from '@/components/ai/AIKpiExplainerModal';
import { SkuAnalytics, CustomerRiskProfile, CourierMismatchRecord, AgenticActionProposal } from '@/types';

export interface KpiOverviewProps {
  summary: SummaryAnalytics;
  orders?: ReconciledOrderRow[];
  skuAnalytics?: SkuAnalytics[];
  customerRiskProfiles?: CustomerRiskProfile[];
  courierMismatches?: CourierMismatchRecord[];
  onQuickRecalc?: () => void;
  onExport?: () => void;
  onSync?: () => void;
  activeDateScope?: DateScope;
  customDateRange?: CustomDateRange;
  onDateRangeSelect?: (range: DateScope) => void;
  onScopeChange?: (scope: DateScope, customRange?: CustomDateRange) => void;
  dateScopeCounts?: DateScopeCounts;
  dateScopeLabel?: string;
  dateScopeSubLabel?: string;
  minDateIso?: string;
  maxDateIso?: string;
  fileWeeks?: FileWeek[];
  availableMonths?: AvailableMonth[];
  activeSourceMode?: 'UPLOAD' | 'API';
  dataSourceName?: string;
  onSwitchSourceMode?: (mode: 'UPLOAD' | 'API') => void;
  hasCloudData?: boolean;
  onKpiClick?: (targetTab: string, statusFilter?: string, territoryFilter?: string) => void;
  onOpenComparison?: (mode?: 'week' | 'month') => void;
  onAskAi?: (prompt: string) => void;
  onExecuteAgenticAction?: (proposal: AgenticActionProposal) => void;
}

export function KpiOverview({
  summary,
  orders = [],
  skuAnalytics = [],
  customerRiskProfiles = [],
  courierMismatches = [],
  onQuickRecalc: _onQuickRecalc,
  onExport: _onExport,
  onSync: _onSync,
  activeDateScope = '30d',
  customDateRange,
  onDateRangeSelect,
  onScopeChange,
  dateScopeCounts,
  dateScopeLabel: _dateScopeLabel,
  dateScopeSubLabel,
  minDateIso,
  maxDateIso,
  fileWeeks,
  availableMonths,
  activeSourceMode = 'UPLOAD',
  dataSourceName,
  onSwitchSourceMode: _onSwitchSourceMode,
  hasCloudData: _hasCloudData = false,
  onKpiClick,
  onOpenComparison,
  onAskAi,
  onExecuteAgenticAction
}: KpiOverviewProps) {
  const s = summary;
  const [explainerKpi, setExplainerKpi] = useState<KpiExplainerType | null>(null);

  // Dynamic COD vs Online Paid metrics for Payment Settlement Ratio KPI card
  const paymentMetrics = useMemo(() => {
    if (!orders || orders.length === 0) {
      const hasGross = s.grossOrders > 0;
      return {
        codOrders: Math.round(s.grossOrders * 0.76),
        onlineOrders: Math.round(s.grossOrders * 0.24),
        totalOrders: s.grossOrders || 0,
        codPct: hasGross ? 76 : 0,
        onlinePct: hasGross ? 24 : 0,
        ratioInt: hasGross ? 3 : 0,
        ratioFormatted: hasGross ? '3 : 1' : '0 : 0',
        codRevenue: Math.round(s.grossRevenue * 0.76),
        onlineRevenue: Math.round(s.grossRevenue * 0.24),
      };
    }

    const orderMap = new Map<string, {
      orderId: string;
      paymentMethod: string;
      orderAmount: number;
      isDelivered: boolean;
      isReturned: boolean;
    }>();

    orders.forEach(r => {
      const oid = r.orderId;
      if (!orderMap.has(oid)) {
        orderMap.set(oid, {
          orderId: oid,
          paymentMethod: r.paymentMethod || 'Cash on delivery',
          orderAmount: r.orderAmount || 0,
          isDelivered: r.orderCategory === 'DELIVERED',
          isReturned: r.orderCategory === 'FULL_RETURN',
        });
      }
    });

    const uniqueOrders = Array.from(orderMap.values());
    const totalOrders = uniqueOrders.length;

    let codCount = 0;
    let onlineCount = 0;
    let codRevenue = 0;
    let onlineRevenue = 0;

    uniqueOrders.forEach(o => {
      const pm = (o.paymentMethod || '').toLowerCase().trim();
      const isOnline = /bkash|nagad|rocket|upay|ssl|sslcommerz|pay\s*online|card|bank|dbbl|ucb|ecom|visa|mastercard|city\s*bank|prepaid|advance/i.test(pm);
      if (isOnline) {
        onlineCount++;
        onlineRevenue += o.orderAmount;
      } else {
        codCount++;
        codRevenue += o.orderAmount;
      }
    });

    const codPct = totalOrders > 0 ? Math.round((codCount / totalOrders) * 100) : 0;
    const onlinePct = totalOrders > 0 ? 100 - codPct : 0;
    const ratioInt = onlineCount > 0 ? Math.round(codCount / onlineCount) : (codCount > 0 ? codCount : 0);
    const ratioFormatted = totalOrders > 0 ? `${ratioInt} : 1` : '0 : 0';

    return {
      codOrders: codCount,
      onlineOrders: onlineCount,
      totalOrders,
      codPct,
      onlinePct,
      ratioInt,
      ratioFormatted,
      codRevenue: Math.round(codRevenue),
      onlineRevenue: Math.round(onlineRevenue),
    };
  }, [orders, s]);

  // Safe percentage calculation
  const deliverySuccessRate = s.grossOrders > 0
    ? ((s.fullDeliveredOrders / s.grossOrders) * 100).toFixed(1)
    : '0.0';

  const returnPercentage = s.grossOrders > 0
    ? ((s.fullReturnedOrders / s.grossOrders) * 100).toFixed(1)
    : '0.0';

  const partialPercentage = s.grossOrders > 0
    ? ((s.partialOrders / s.grossOrders) * 100).toFixed(1)
    : '0.0';

  const exchangePercentage = s.grossOrders > 0
    ? (((s.totalExchangedOrders || 0) / s.grossOrders) * 100).toFixed(1)
    : '0.0';

  // Financial amounts for KPI cards
  const grossSalesAmount = Math.round(s.grossRevenue || s.unitEconomics?.grossInvoicedSales || 0);
  const deliveredSalesAmount = Math.round(s.netDeliveredRevenue || 0);
  const totalReturnedAmount = Math.round(s.totalReturnedRevenue || Math.max(0, grossSalesAmount - deliveredSalesAmount) || 0);
  const partialReturnedAmount = Math.round(
    s.partialReturnedRevenue ||
    (s.totalReturnedQty > 0 ? (s.partialReturnedQty / s.totalReturnedQty) * totalReturnedAmount : 0) ||
    0
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Clean Executive Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-7 bg-primary rounded-full shrink-0"></div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-headline text-lg sm:text-2xl font-black text-navy-deep dark:text-white tracking-tight">
                Sales & Operations Dashboard
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                activeSourceMode === 'API'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-orange-50 dark:bg-orange-950/40 text-primary dark:text-orange-400 border-orange-200 dark:border-orange-800/60'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeSourceMode === 'API' ? 'bg-emerald-500 animate-pulse' : 'bg-primary'}`}></span>
                {activeSourceMode === 'API' ? 'Live Cloud API' : (dataSourceName || 'Spreadsheets')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Unit reconciliation, return leakages, and revenue realization.
            </p>
          </div>
        </div>

        {/* Active Period & Scope Indicator (Local Context Date Range Selector) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 self-start sm:self-auto shrink-0">
          {(onScopeChange || onDateRangeSelect) && (
            <DateRangeSelector
              activeScope={activeDateScope}
              customRange={customDateRange}
              onScopeChange={(scope, customRange) => {
                if (onScopeChange) {
                  onScopeChange(scope, customRange);
                } else if (onDateRangeSelect) {
                  onDateRangeSelect(scope);
                }
              }}
              counts={dateScopeCounts}
              subLabel={dateScopeSubLabel}
              minDateIso={minDateIso}
              maxDateIso={maxDateIso}
              fileWeeks={fileWeeks}
              availableMonths={availableMonths}
              onOpenComparison={onOpenComparison}
              align="right"
            />
          )}

          {onOpenComparison && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenComparison('week')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#0E0E0E] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-[#1F1F1F] hover:border-slate-300 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                title="Compare Performance Between Weeks (WoW Analysis)"
              >
                <Scale className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Week vs Week</span>
                <span className="sm:hidden">WoW</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenComparison('month')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#0E0E0E] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-[#1F1F1F] hover:border-slate-300 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                title="Compare Performance Between Months (MoM Analysis, e.g. Oct vs Sep)"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Month vs Month</span>
                <span className="sm:hidden">MoM</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. CORE EXECUTIVE ORDER & ITEM RECONCILIATION KPI CARDS (Interactive Funnel Flow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* 1. Gross Dispatched Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabOrders', 'ALL')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          title="Click to view all orders in Orders Ledger"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/40 flex items-center justify-center text-primary dark:text-orange-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <ShoppingBag className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">Dispatched</span>
                <span className="text-[10px] text-orange-700 dark:text-orange-300 font-bold bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full border border-orange-200/60 dark:border-orange-800/40 inline-block mt-0.5">
                  Pipeline
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExplainerKpi('dispatched');
                }}
                className="p-1 rounded-md hover:bg-orange-100 dark:hover:bg-orange-950/60 text-primary dark:text-orange-400 transition-colors flex items-center"
                title="AI Root-Cause Explainer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-elevated flex items-center justify-center text-slate-300 dark:text-slate-500 group-hover:text-primary dark:group-hover:text-orange-400 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 transition-all">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {(() => {
            const deliveredCount = s.fullDeliveredOrders || 0;
            const returnedCount = s.fullReturnedOrders || 0;
            const partialCount = s.partialOrders || 0;
            const exchangeCount = s.totalExchangedOrders || (orders.filter(o => o.orderCategory === 'EXCHANGE').length) || 0;
            const totalDispatched = s.grossOrders || 1;

            // Fulfillment Category Percentages (r = 15.9155 => circumference = 100)
            const delivPct = Math.min(100, Math.max(0, Math.round((deliveredCount / totalDispatched) * 100)));
            const returnPct = Math.min(100, Math.max(0, Math.round((returnedCount / totalDispatched) * 100)));
            const partialPct = Math.min(100, Math.max(0, Math.round((partialCount / totalDispatched) * 100)));
            const exchangePct = Math.min(100, Math.max(0, Math.round((exchangeCount / totalDispatched) * 100)));
            return (
              <div className="my-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-headline font-black text-xl sm:text-2xl xl:text-3xl text-navy-deep dark:text-white">
                        {s.grossOrders.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                      <span className="font-bold text-navy-deep dark:text-slate-200">৳ {grossSalesAmount.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">gross</span>
                    </div>
                  </div>

                  {/* Multi-category Fulfillment Donut Chart (Delivered Focus) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <MiniDonutChart
                      tooltip={`Fulfillment Breakdown: ${deliveredCount.toLocaleString()} Delivered (${delivPct}%) • ${returnedCount.toLocaleString()} Returned (${returnPct}%) • ${partialCount.toLocaleString()} Partial (${partialPct}%) • ${exchangeCount.toLocaleString()} Exchange (${exchangePct}%)`}
                      centerText={`${delivPct}%`}
                      centerTextClass="text-emerald-600 dark:text-emerald-400"
                      arcs={[
                        { pct: delivPct, colorClass: 'text-emerald-500' },
                        { pct: returnPct, colorClass: 'text-rose-500' },
                        { pct: partialPct, colorClass: 'text-amber-500' },
                        { pct: exchangePct, colorClass: 'text-indigo-500' },
                      ]}
                    />

                    {/* Semantic Category Micro-Metrics beside Donut */}
                    <div className="flex flex-col text-[11px] font-black leading-tight">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`${deliveredCount.toLocaleString()} Delivered Orders (${delivPct}%)`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>{deliveredCount.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">Deliv</span>
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`${returnedCount.toLocaleString()} Returned Orders (${returnPct}%)`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span>{returnedCount.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">Return</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Granular Category Breakdown Micro-Pills */}
                <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-[#1F1F1F] text-[10px] font-bold overflow-x-auto no-scrollbar">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0" title={`Delivered: ${deliveredCount.toLocaleString()}`}>
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    <span>{deliveredCount.toLocaleString()} Kept</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-1 shrink-0" title={`Full Returns: ${returnedCount.toLocaleString()} (${s.paidReturnsCount || 0} Paid, ${s.unpaidReturnsCount || 0} Unpaid)`}>
                    <span className="w-1 h-1 rounded-full bg-rose-500" />
                    <span>{returnedCount.toLocaleString()} Ret</span>
                  </span>
                  {partialCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-1 shrink-0" title={`Partial Delivery: ${partialCount.toLocaleString()}`}>
                      <span className="w-1 h-1 rounded-full bg-amber-500" />
                      <span>{partialCount.toLocaleString()} Part</span>
                    </span>
                  )}
                  {exchangeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 shrink-0" title={`Exchange Orders: ${exchangeCount.toLocaleString()}`}>
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                      <span>{exchangeCount.toLocaleString()} Exch</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-xs" title={`SKU Flow: ${s.totalItemsDelivered.toLocaleString()} Kept + ${s.totalReturnedQty.toLocaleString()} Ret = ${(s.totalGrossItems || s.grossOrders).toLocaleString()} Units`}>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total Flow</span>
            <span className="font-bold text-primary dark:text-orange-400 px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 shadow-2xs">
              {(s.totalGrossItems || s.grossOrders).toLocaleString()} pcs
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-b-2xl"></div>
        </div>

        {/* 2. Net Delivered Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabOrders', 'DELIVERED')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          title="Click to view Delivered orders in Orders Ledger"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <PackageCheck className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">Delivered</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 inline-block mt-0.5">
                  {deliverySuccessRate}% Kept
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExplainerKpi('delivered');
                }}
                className="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 transition-colors flex items-center"
                title="AI Root-Cause Explainer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-elevated flex items-center justify-center text-slate-300 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 transition-all">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {(() => {
            const deliveredCount = s.fullDeliveredOrders || 0;
            const lossCount = Math.max(0, (s.grossOrders || 0) - deliveredCount);
            const totalPipeline = (deliveredCount + lossCount) || s.grossOrders || 0;
            const delivPct = totalPipeline > 0 ? Math.min(100, Math.max(0, Math.round((deliveredCount / totalPipeline) * 100))) : 0;
            const lossPct = totalPipeline > 0 ? 100 - delivPct : 0;

            return (
              <div className="my-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-headline font-black text-xl sm:text-2xl xl:text-3xl text-emerald-700 dark:text-emerald-400">
                        {s.fullDeliveredOrders.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">৳ {deliveredSalesAmount.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">net</span>
                    </div>
                  </div>

                  {/* Donut Chart with Numbers directly attached */}
                  <div className="flex items-center gap-2 shrink-0">
                    <MiniDonutChart
                      tooltip={`Delivery Yield: ${deliveredCount.toLocaleString()} Kept (${delivPct}%) • ${lossCount.toLocaleString()} Lost (${lossPct}%)`}
                      trackColorClass="text-rose-200 dark:text-rose-950/50"
                      strokeLinecap="round"
                      centerText={`${delivPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: delivPct, colorClass: 'text-emerald-500' }]}
                    />

                    {/* Number Rendering with Donut Chart with Semantic Labels */}
                    <div className="flex flex-col text-[11px] font-black leading-tight">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`${deliveredCount.toLocaleString()} Delivered / Kept Orders`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>{deliveredCount.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">Kept</span>
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`${lossCount.toLocaleString()} Return / Lost Orders`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span>{lossCount.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">Loss</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="pt-2 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Kept Items</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs">
              {s.totalItemsDelivered.toLocaleString()} pcs
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* 3. Returned Orders & Items (with Paid vs Unpaid Return Split) */}
        <div
          onClick={() => onKpiClick?.('tabItemReturns')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-rose-300 dark:hover:border-rose-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          title="Click to view Returned Items & RTO breakdown"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs group-hover:scale-105 transition-transform">
                <RotateCcw className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-bold text-navy-deep dark:text-white">Returns</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 text-rose-600 dark:text-rose-400">
                {returnPercentage}% RTO
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExplainerKpi('returns');
                }}
                className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition-colors flex items-center"
                title="AI Root-Cause Explainer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const paidCount = s.paidReturnsCount ?? (orders.length > 0 ? (new Set(orders.filter(o => o.orderCategory === 'FULL_RETURN' && o.isPaidReturn).map(o => o.orderId)).size) : 0);
            const unpaidCount = s.unpaidReturnsCount ?? Math.max(0, (s.fullReturnedOrders || 0) - paidCount);
            const totalRetOrders = (paidCount + unpaidCount) || s.fullReturnedOrders || 0;
            const paidPct = totalRetOrders > 0 ? Math.round((paidCount / totalRetOrders) * 100) : 0;
            const unpaidPct = totalRetOrders > 0 ? 100 - paidPct : 0;

            const rtoQty = Math.round(s.regularReturnedQty || s.fullReturnedOrders || 0);
            const partialQty = Math.round(s.partialReturnedQty || s.partialOrders || 0);
            const totalRetQty = Math.round(s.totalReturnedQty || (rtoQty + partialQty) || 0);

            return (
              <>
                <div className="my-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-rose-600 dark:text-rose-400 tracking-tight">
                          {s.fullReturnedOrders.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 whitespace-nowrap">
                        <span className="font-bold text-rose-600 dark:text-rose-400">৳ {totalReturnedAmount.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">loss</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Return Split: ${paidCount} Paid (${paidPct}%) • ${unpaidCount} Unpaid (${unpaidPct}%)`}
                      trackColorClass="text-rose-200 dark:text-rose-950/50"
                      strokeLinecap="round"
                      centerText={`${paidPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: paidPct, colorClass: 'text-emerald-500' }]}
                    />

                      {/* Number Rendering with Donut Chart with Semantic Labels */}
                      <div className="flex flex-col text-[11px] font-black leading-tight">
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`${paidCount} Paid (Delivery Fee Recovered)`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>{paidCount}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">Paid</span>
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`${unpaidCount} Unpaid (Brand Loss)`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          <span>{unpaidCount}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">Unpaid</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Total Returns</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 shadow-2xs">
                      {totalRetQty.toLocaleString()} pcs
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between text-[10px] px-2 py-0.5 rounded-md bg-slate-50 dark:bg-deepBlack-elevated border border-slate-100 dark:border-deepBlack-border text-slate-600 dark:text-slate-300 font-medium"
                    title={`SKU Return Balance: ${rtoQty.toLocaleString()} pcs RTO + ${partialQty.toLocaleString()} pcs Partials = ${totalRetQty.toLocaleString()} pcs Total Returns`}
                  >
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{rtoQty.toLocaleString()} RTO</span>
                    <span className="text-slate-300 dark:text-slate-600 font-bold">+</span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold">{partialQty.toLocaleString()} Partials</span>
                    <span className="text-slate-300 dark:text-slate-600 font-bold">=</span>
                    <span className="text-navy-deep dark:text-white font-bold">{totalRetQty.toLocaleString()} pcs</span>
                  </div>
                </div>
              </>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* 4. Partial Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabOrders', 'PARTIAL')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          title="Click to view Partial orders in Orders Ledger"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Split className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-bold text-navy-deep dark:text-white">Partials</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-600 dark:text-amber-400">
                {partialPercentage}% Split
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExplainerKpi('partials');
                }}
                className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-600 dark:text-amber-400 transition-colors flex items-center"
                title="AI Root-Cause Explainer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const partialKept = Math.round(s.partialDeliveredQty || 0);
            const partialRet = Math.round(s.partialReturnedQty || s.partialOrders || 0);
            const partialTotal = (partialKept + partialRet) || 0;
            const keptPct = partialTotal > 0 ? Math.round((partialKept / partialTotal) * 100) : 0;
            const retPct = partialTotal > 0 ? 100 - keptPct : 0;

            return (
              <>
                <div className="my-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-amber-600 dark:text-amber-400 tracking-tight">
                          {s.partialOrders.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 whitespace-nowrap">
                        <span className="font-bold text-rose-600 dark:text-rose-400">৳ {partialReturnedAmount.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">loss</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Partial Split: ${partialKept} Kept (${keptPct}%) • ${partialRet} Returned (${retPct}%)`}
                      trackColorClass="text-rose-200 dark:text-rose-950/50"
                      strokeLinecap="round"
                      centerText={`${keptPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: keptPct, colorClass: 'text-emerald-500' }]}
                    />

                      {/* Number Rendering with Donut Chart with Semantic Labels */}
                      <div className="flex flex-col text-[11px] font-black leading-tight">
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`${partialKept} Kept Items`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>{partialKept}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">Kept</span>
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`${partialRet} Returned Items`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          <span>{partialRet}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">Ret</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Split Items</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 shadow-2xs">
                    {partialTotal.toLocaleString()} pcs
                  </span>
                </div>
              </>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* 5. Exchange Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabExchanges')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
          title="Click to view Exchanged Orders log"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-2xs group-hover:scale-105 transition-transform">
                <RefreshCw className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-bold text-navy-deep dark:text-white">Exchanges</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 text-purple-700 dark:text-purple-300">
                {exchangePercentage}% Swap
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExplainerKpi('exchanges');
                }}
                className="p-1 rounded-md hover:bg-purple-100 dark:hover:bg-purple-950/60 text-purple-700 dark:text-purple-400 transition-colors flex items-center"
                title="AI Root-Cause Explainer"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const exchangeCollected = Math.round(s.totalExchangeCodCollected || 0);
            const exchangePathaoCharge = Math.round(
              s.totalExchangeCourierExpense || (s.totalExchangedOrders ? s.totalExchangedOrders * 60 : 0)
            );
            const totalExFlow = (exchangeCollected + exchangePathaoCharge) || 0;
            const collectPct = totalExFlow > 0 ? Math.round((exchangeCollected / totalExFlow) * 100) : 0;
            const chargePct = totalExFlow > 0 ? 100 - collectPct : 0;
            const netExchange = exchangeCollected - exchangePathaoCharge;

            return (
              <>
                <div className="my-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-purple-700 dark:text-purple-400 tracking-tight">
                          {(s.totalExchangedOrders || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 whitespace-nowrap">
                        <span className={`font-bold ${netExchange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {netExchange >= 0 ? `+৳ ${netExchange.toLocaleString()}` : `-৳ ${Math.abs(netExchange).toLocaleString()}`}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">net</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Exchange Split: ৳ ${exchangeCollected.toLocaleString()} Collected (${collectPct}%) • ৳ ${exchangePathaoCharge.toLocaleString()} Pathao Charged (${chargePct}%)`}
                      trackColorClass="text-rose-200 dark:text-rose-950/50"
                      strokeLinecap="round"
                      centerText={`${collectPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: collectPct, colorClass: 'text-emerald-500' }]}
                    />

                      {/* Number Rendering with Donut Chart with Semantic Labels */}
                      <div className="flex flex-col text-[11px] font-black leading-tight">
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`৳ ${exchangeCollected.toLocaleString()} Collected from Customer`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>৳{exchangeCollected.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">COD</span>
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`৳ ${exchangePathaoCharge.toLocaleString()} Charged by Pathao Courier`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          <span>৳{exchangePathaoCharge.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">Cost</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Swap Items</span>
            <span className="font-bold text-purple-700 dark:text-purple-400 px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 shadow-2xs">
              {(s.totalExchangedItemsQty || s.totalExchangedOrders || 0).toLocaleString()} pcs
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500"></div>
        </div>
      </div>

      {/* 4. EXECUTIVE FINANCIALS, LOGISTICS, TERRITORY & PAYMENT RATIO METRICS (Consolidated 5-Card Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* 1. Realized Net Revenue with Realization Rate & Return Leakage Donut */}
        <div
          onClick={() => onKpiClick?.('tabExecutive')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          title="Click to view Executive Performance Breakdown"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
              Realized Revenue
            </span>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform">
                <CircleDollarSign className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const deliveredRev = Math.round(s.netDeliveredRevenue);
            const leakageRev = Math.round(s.grossRevenue - s.netDeliveredRevenue);
            const totalPipelineRev = Math.round(s.grossRevenue) || 0;
            const realizationPct = totalPipelineRev > 0 ? Math.min(100, Math.max(0, Math.round((deliveredRev / totalPipelineRev) * 100))) : 0;
            const leakagePct = totalPipelineRev > 0 ? 100 - realizationPct : 0;

            return (
              <div className="my-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-navy-deep dark:text-white font-headline tracking-tight">
                      ৳ {deliveredRev.toLocaleString()}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 whitespace-nowrap">
                      <span>Avg ৳{s.fullDeliveredOrders > 0 ? Math.round(deliveredRev / s.fullDeliveredOrders).toLocaleString() : '0'}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">/ kept</span>
                    </div>
                  </div>

                  {/* Donut Chart with Numbers directly attached */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Revenue Realization: ৳${deliveredRev.toLocaleString()} Realized (${realizationPct}%) • ৳${leakageRev.toLocaleString()} Loss (${leakagePct}%)`}
                      trackColorClass="text-rose-200 dark:text-rose-950/50"
                      strokeLinecap="round"
                      centerText={`${realizationPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: realizationPct, colorClass: 'text-emerald-500' }]}
                    />

                    {/* Number Rendering with Donut Chart with Semantic Labels */}
                    <div className="flex flex-col text-[11px] font-black leading-tight">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`৳ ${deliveredRev.toLocaleString()} Realized Cash`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>৳{deliveredRev >= 1000000 ? `${(deliveredRev / 1000000).toFixed(2)}M` : `${Math.round(deliveredRev / 1000)}k`}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Realized</span>
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`৳ ${leakageRev.toLocaleString()} Return Leakage Loss`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span>৳{leakageRev >= 1000000 ? `${(leakageRev / 1000000).toFixed(2)}M` : `${Math.round(leakageRev / 1000)}k`}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Loss</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-deepBlack-border text-xs">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
              Gross: ৳ {Math.round(s.grossRevenue).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 font-medium transition-colors">
              Details →
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* 2. Net Contribution Margin with Donut Chart & Unit Profit */}
        <div
          onClick={() => onKpiClick?.('tabUnitEconomics')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          title="Click to view Unit Economics & Sales Calculation"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
              Contribution Margin
            </span>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Coins className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const netMarginAmount = Math.round(s.unitEconomics.netContributionMargin);
            const marginPct = Math.min(100, Math.max(0, Math.round(s.unitEconomics.netMarginPercentage)));
            const costPct = 100 - marginPct;
            const roasVal = s.unitEconomics.roas ? s.unitEconomics.roas.toFixed(1) : '0.0';

            return (
              <div className="my-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-headline tracking-tight">
                      ৳ {netMarginAmount.toLocaleString()}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 whitespace-nowrap">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        ৳ {s.fullDeliveredOrders > 0 ? Math.round(netMarginAmount / s.fullDeliveredOrders).toLocaleString() : '700'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">/ kept</span>
                    </div>
                  </div>

                  {/* Donut Chart with Numbers directly attached */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Margin Yield: ${marginPct}% Net Profit • ${costPct}% COGS, Logistics & Ads`}
                      trackColorClass="text-amber-100 dark:text-amber-950/40"
                      strokeLinecap="round"
                      centerText={`${marginPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: marginPct, colorClass: 'text-emerald-500' }]}
                    />

                    {/* Number Rendering with Donut Chart with Semantic Labels */}
                    <div className="flex flex-col text-[11px] font-black leading-tight">
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`৳ ${netMarginAmount.toLocaleString()} Net Cash Yield`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>৳{netMarginAmount >= 1000000 ? `${(netMarginAmount / 1000000).toFixed(2)}M` : `${Math.round(netMarginAmount / 1000)}k`}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Net</span>
                      </span>
                      <span className="text-purple-700 dark:text-purple-400 flex items-center gap-1 mt-1" title={`${roasVal}x Return on Ad Spend`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>
                        <span>{roasVal}x</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">ROAS</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>After COGS, Courier & Ads</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-amber-700 dark:group-hover:text-amber-400 font-medium transition-colors">
              Details →
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* 3. Pathao Courier Cost & Fee Recovery */}
        <div
          onClick={() => onKpiClick?.('tabCourierMismatch')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          title="Click to view Pathao Courier Audit & manifests"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
              Courier Cost
            </span>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Truck className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const netCharge = Math.round(s.courierCost.netCharge || 0);
            const feeCollected = Math.round(s.courierCost.customerDeliveryFeeCollected || 0);
            const netCost = Math.max(0, netCharge - feeCollected);
            const recoveryPct = netCharge > 0 ? Math.min(100, Math.round((feeCollected / netCharge) * 100)) : 0;

            return (
              <>
                <div className="my-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-400 font-headline tracking-tight">
                        ৳ {netCharge.toLocaleString()}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 whitespace-nowrap" title={`Dhaka (৳50): ${s.courierCost.collectedInsideCount} • Outside (৳90): ${s.courierCost.collectedOutsideCount}`}>
                        <span className="font-bold text-slate-700 dark:text-slate-200">৳ {netCost.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">net fee</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Courier Fee Recovery: ৳ ${feeCollected.toLocaleString()} Collected (${recoveryPct}%) of ৳ ${netCharge.toLocaleString()} Courier Cost`}
                      trackColorClass="text-rose-200 dark:text-rose-950/50"
                      strokeLinecap="round"
                      centerText={`${recoveryPct}%`}
                      centerTextClass="text-emerald-700 dark:text-emerald-400"
                      arcs={[{ pct: recoveryPct, colorClass: 'text-emerald-500' }]}
                    />

                      {/* Number Rendering with Donut Chart with Semantic Labels */}
                      <div className="flex flex-col text-[11px] font-black leading-tight">
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1" title={`+৳ ${feeCollected.toLocaleString()} Delivery Fee Collected from Customers`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>৳{feeCollected.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Fee</span>
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1" title={`৳ ${netCharge.toLocaleString()} Total Pathao Courier Charge`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          <span>৳{netCharge.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Bill</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
                  <span title={`Fee: ${s.courierCost.collectedInsideCount} Dhaka (৳50) • ${s.courierCost.collectedOutsideCount} Outside (৳90)`}>
                    Dhaka: {s.courierCost.collectedInsideCount} • Out: {s.courierCost.collectedOutsideCount}
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40">
                    {recoveryPct}% recovered
                  </span>
                </div>
              </>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
        </div>

        {/* 4. Territory Outside vs Inside with Donut Chart and Integers */}
        <div
          onClick={() => onKpiClick?.('tabTerritory')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          title="Click to view Territory Performance"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
              Territory
            </span>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Compass className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          {(() => {
            const totalTerritory = (s.outsideOrders + s.insideOrders) || s.grossOrders || 0;
            const outsidePct = totalTerritory > 0 ? Math.round((s.outsideOrders / totalTerritory) * 100) : 0;
            const insidePct = totalTerritory > 0 ? 100 - outsidePct : 0;
            const ratioInt = s.insideOrders > 0 ? Math.round(s.outsideOrders / s.insideOrders) : (s.outsideOrders > 0 ? s.outsideOrders : 0);
            const ratioFormatted = totalTerritory > 0 ? `${ratioInt} : 1` : '0 : 0';

            return (
              <>
                <div className="my-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-navy-deep dark:text-white font-headline tracking-tight">
                      {ratioFormatted}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Outside vs Inside
                    </div>
                  </div>

                  {/* SVG Donut Chart with Semantic Labels */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <MiniDonutChart
                      tooltip={`Territory Split: ${Math.round(s.outsideOrders)} Outside (${outsidePct}%) • ${Math.round(s.insideOrders)} Inside (${insidePct}%)`}
                      trackColorClass="text-amber-200 dark:text-amber-950/50"
                      strokeLinecap="round"
                      centerText={`${outsidePct}%`}
                      centerTextClass="text-indigo-700 dark:text-indigo-400"
                      arcs={[{ pct: outsidePct, colorClass: 'text-indigo-600' }]}
                    />

                    {/* Number Rendering with Semantic Labels */}
                    <div className="flex flex-col text-[11px] font-black leading-tight">
                      <span className="text-indigo-700 dark:text-indigo-400 flex items-center gap-1" title={`${Math.round(s.outsideOrders).toLocaleString()} Outside Dhaka`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                        <span>{Math.round(s.outsideOrders).toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Out</span>
                      </span>
                      <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-1" title={`${Math.round(s.insideOrders).toLocaleString()} Inside Dhaka`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                        <span>{Math.round(s.insideOrders).toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">In</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
                  <span>Outside: <strong className="text-indigo-700 dark:text-indigo-400 font-bold">{outsidePct}%</strong></span>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Inside: <strong className="text-amber-700 dark:text-amber-400 font-bold">{insidePct}%</strong></span>
                </div>
              </>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"></div>
        </div>

        {/* 5. Payment Settlement Ratio: COD vs Online Paid with Donut Chart */}
        <div
          onClick={() => onKpiClick?.('tabStatus')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          title="Click to view Status Matrix & Payment Breakdown"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
              Payment Ratio
            </span>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-2xs group-hover:scale-105 transition-transform">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>

          <div className="my-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-navy-deep dark:text-white font-headline tracking-tight">
                {paymentMetrics.ratioFormatted}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                COD vs Online Paid
              </div>
            </div>

            {/* SVG Donut Chart with Semantic Labels */}
            <div className="flex items-center gap-2.5 shrink-0">
              <MiniDonutChart
                tooltip={`Payment Settlement: ${paymentMetrics.codOrders.toLocaleString()} COD (${paymentMetrics.codPct}%) • ${paymentMetrics.onlineOrders.toLocaleString()} Online Paid (${paymentMetrics.onlinePct}%)`}
                trackColorClass="text-sky-200 dark:text-sky-950/50"
                strokeLinecap="round"
                centerText={`${paymentMetrics.codPct}%`}
                centerTextClass="text-orange-600 dark:text-orange-400"
                arcs={[{ pct: paymentMetrics.codPct, colorClass: 'text-orange-500' }]}
              />

              {/* Number Rendering with Semantic Labels */}
              <div className="flex flex-col text-[11px] font-black leading-tight">
                <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1" title={`${paymentMetrics.codOrders.toLocaleString()} COD Orders`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                  <span>{paymentMetrics.codOrders.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">COD</span>
                </span>
                <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-1" title={`${paymentMetrics.onlineOrders.toLocaleString()} Online Prepaid Orders`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                  <span>{paymentMetrics.onlineOrders.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">Paid</span>
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>COD: <strong className="text-orange-600 dark:text-orange-400 font-bold">{paymentMetrics.codPct}%</strong></span>
            <span className="text-slate-400 dark:text-slate-500 font-medium">Online: <strong className="text-sky-600 dark:text-sky-400 font-bold">{paymentMetrics.onlinePct}%</strong></span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500"></div>
        </div>
      </div>

      {/* Pattern 2: KPI Root-Cause Explainer Modal */}
      <AIKpiExplainerModal
        isOpen={explainerKpi !== null}
        onClose={() => setExplainerKpi(null)}
        kpiType={explainerKpi}
        summary={s}
        orders={orders}
        skuAnalytics={skuAnalytics}
        customerRiskProfiles={customerRiskProfiles}
        courierMismatches={courierMismatches}
        onAskAi={onAskAi}
        onExecuteAgenticAction={onExecuteAgenticAction}
      />
    </div>
  );
}
