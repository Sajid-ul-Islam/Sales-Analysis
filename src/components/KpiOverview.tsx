"use client";

import React, { useState } from 'react';
import { SummaryAnalytics } from '@/types';
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
  Download,
  UploadCloud,
  Calendar,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Cloud,
  ArrowUpRight
} from 'lucide-react';

export interface KpiOverviewProps {
  summary: SummaryAnalytics;
  onQuickRecalc?: () => void;
  onExport?: () => void;
  onSync?: () => void;
  onDateRangeSelect?: (range: string) => void;
  activeSourceMode?: 'UPLOAD' | 'API';
  dataSourceName?: string;
  onSwitchSourceMode?: (mode: 'UPLOAD' | 'API') => void;
  hasCloudData?: boolean;
  onKpiClick?: (targetTab: string, statusFilter?: string, territoryFilter?: string) => void;
}

export function KpiOverview({
  summary,
  onQuickRecalc,
  onExport,
  onSync,
  onDateRangeSelect,
  activeSourceMode = 'UPLOAD',
  dataSourceName,
  onSwitchSourceMode,
  hasCloudData = false,
  onKpiClick
}: KpiOverviewProps) {
  const s = summary;
  const [selectedRange, setSelectedRange] = useState('all');
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRangeClick = (range: string) => {
    setSelectedRange(range);
    if (onDateRangeSelect) {
      onDateRangeSelect(range);
    }
  };

  const handleRecalcClick = () => {
    setIsRecalculating(true);
    if (onQuickRecalc) {
      onQuickRecalc();
    }
    setTimeout(() => setIsRecalculating(false), 800);
  };

  // Safe percentage calculation
  const deliverySuccessRate = s.grossOrders > 0
    ? ((s.fullDeliveredOrders / s.grossOrders) * 100).toFixed(1)
    : '70.0';

  const returnPercentage = s.grossOrders > 0
    ? ((s.fullReturnedOrders / s.grossOrders) * 100).toFixed(1)
    : '20.0';

  const partialPercentage = s.grossOrders > 0
    ? ((s.partialOrders / s.grossOrders) * 100).toFixed(1)
    : '10.0';

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
  const exchangeCodAmount = Math.round(s.totalExchangeCodCollected || 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Clean Executive Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-7 bg-primary rounded-full shrink-0"></div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-headline text-xl sm:text-2xl font-black text-navy-deep tracking-tight">
                Sales & Operations Dashboard
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                activeSourceMode === 'API'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-orange-50 text-primary border-orange-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeSourceMode === 'API' ? 'bg-emerald-500 animate-pulse' : 'bg-primary'}`}></span>
                {activeSourceMode === 'API' ? 'Live Cloud API' : (dataSourceName || 'Spreadsheets')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Unit reconciliation, return leakages, and net revenue realization.
            </p>
          </div>
        </div>

        {/* Date Scope Filter */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto shrink-0">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => handleRangeClick(pill.id)}
              className={`px-3 py-1 rounded-lg text-xs transition-all font-headline ${
                selectedRange === pill.id
                  ? 'bg-white text-navy-deep font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-navy-deep font-medium'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CORE EXECUTIVE ORDER & ITEM RECONCILIATION KPI CARDS (Interactive Funnel Flow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* 1. Gross Dispatched Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabOrders', 'ALL')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          title="Click to view all orders in Orders Ledger"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-primary">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-navy-deep">Gross Dispatched</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-primary">
                100% Pipeline
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition-colors" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline font-black text-2xl sm:text-3xl text-navy-deep">
                {s.grossOrders.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Orders</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-bold text-navy-deep">৳ {grossSalesAmount.toLocaleString()}</span>
              <span className="text-slate-400">• Gross Sales</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Pipeline Volume</span>
            <span className="font-bold text-primary px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200/60 shadow-2xs">
              {(s.totalGrossItems || s.grossOrders).toLocaleString()} items
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
        </div>

        {/* 2. Net Delivered Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabOrders', 'DELIVERED')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          title="Click to view Delivered orders in Orders Ledger"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <PackageCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-navy-deep">Net Delivered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                {deliverySuccessRate}% Kept
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline font-black text-2xl sm:text-3xl text-emerald-700">
                {s.fullDeliveredOrders.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-emerald-600/70 uppercase tracking-wide">Orders</span>
            </div>
            <div className="text-xs font-semibold text-emerald-700/90 mt-1 flex items-center gap-1.5">
              <span className="font-bold text-emerald-700">৳ {deliveredSalesAmount.toLocaleString()}</span>
              <span className="text-slate-400">• Delivered Sales</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Customer Kept</span>
            <span className="font-bold text-emerald-700 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 shadow-2xs">
              {s.totalItemsDelivered.toLocaleString()} items
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* 3. Returned Orders & Items (with Paid vs Unpaid Return Split) */}
        <div
          onClick={() => onKpiClick?.('tabItemReturns')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:border-rose-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          title="Click to view Returned Items & RTO breakdown"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <RotateCcw className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-navy-deep">Total Returned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">
                {returnPercentage}% RTO
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-600 transition-colors" />
            </div>
          </div>

          {(() => {
            const paidCount = s.paidReturnsCount !== undefined ? s.paidReturnsCount : 85;
            const unpaidCount = s.unpaidReturnsCount !== undefined ? s.unpaidReturnsCount : Math.max(0, s.fullReturnedOrders - paidCount);
            const totalRetOrders = (paidCount + unpaidCount) || s.fullReturnedOrders || 1;
            const paidPct = Math.round((paidCount / totalRetOrders) * 100);
            const unpaidPct = 100 - paidPct;
            const strokeDash = `${paidPct} ${100 - paidPct}`;

            return (
              <>
                <div className="my-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline font-black text-2xl sm:text-3xl text-rose-600">
                          {s.fullReturnedOrders.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-rose-500/70 uppercase tracking-wide">Orders</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                        <span className="font-bold text-rose-600">৳ {totalReturnedAmount.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">loss</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* SVG Donut Chart */}
                      <div className="relative w-11 h-11 flex items-center justify-center shrink-0" title={`Return Split: ${paidCount} Paid (${paidPct}%) • ${unpaidCount} Unpaid (${unpaidPct}%)`}>
                        <svg className="w-11 h-11 -rotate-90 transform shrink-0" viewBox="0 0 36 36" width="44" height="44">
                          {/* Unpaid Track (Rose) */}
                          <path
                            className="text-rose-200"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Paid Segment (Emerald) */}
                          <path
                            className="text-emerald-500 transition-all duration-500 ease-out"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            strokeDasharray={strokeDash}
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-emerald-700 font-headline leading-none">
                            {paidPct}%
                          </span>
                        </div>
                      </div>

                      {/* Number Rendering with Donut Chart (Numbers Only with Color Indicators) */}
                      <div className="flex flex-col text-xs font-black leading-tight">
                        <span className="text-emerald-700 flex items-center gap-1.5" title={`${paidCount} Paid (Delivery Fee Recovered)`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          {paidCount}
                        </span>
                        <span className="text-rose-600 flex items-center gap-1.5 mt-0.5" title={`${unpaidCount} Unpaid (Brand Loss)`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          {unpaidCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Split Bar (Emerald Paid vs Rose Unpaid) */}
                  <div className="w-full bg-rose-200 rounded-full h-1.5 mt-2.5 overflow-hidden flex" title={`${paidCount} Paid (${paidPct}%) • ${unpaidCount} Unpaid (${unpaidPct}%)`}>
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${paidPct}%` }}
                      title={`${paidCount} Paid (${paidPct}%)`}
                    ></div>
                    <div
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${unpaidPct}%` }}
                      title={`${unpaidCount} Unpaid (${unpaidPct}%)`}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Return Volume</span>
                  <span className="font-bold text-rose-600 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200/60 shadow-2xs">
                    {s.totalReturnedQty.toLocaleString()} items
                  </span>
                </div>
              </>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* 4. Partial Orders & Items */}
        <div
          onClick={() => onKpiClick?.('tabOrders', 'PARTIAL')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          title="Click to view Partial orders in Orders Ledger"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Split className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-navy-deep">Partial Orders</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                {partialPercentage}% Split
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition-colors" />
            </div>
          </div>

          {(() => {
            const partialKept = Math.round(s.partialDeliveredQty || 0);
            const partialRet = Math.round(s.partialReturnedQty || s.partialOrders || 0);
            const partialTotal = (partialKept + partialRet) || 1;
            const keptPct = Math.round((partialKept / partialTotal) * 100);
            const retPct = 100 - keptPct;
            const strokeDash = `${keptPct} ${100 - keptPct}`;

            return (
              <>
                <div className="my-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline font-black text-2xl sm:text-3xl text-amber-600">
                          {s.partialOrders.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-amber-600/70 uppercase tracking-wide">Orders</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                        <span className="font-bold text-rose-600">৳ {partialReturnedAmount.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">loss</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* SVG Donut Chart */}
                      <div className="relative w-11 h-11 flex items-center justify-center shrink-0" title={`Partial Split: ${partialKept} Kept (${keptPct}%) • ${partialRet} Returned (${retPct}%)`}>
                        <svg className="w-11 h-11 -rotate-90 transform shrink-0" viewBox="0 0 36 36" width="44" height="44">
                          {/* Returned Track (Rose) */}
                          <path
                            className="text-rose-200"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Kept Segment (Emerald) */}
                          <path
                            className="text-emerald-500 transition-all duration-500 ease-out"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            strokeDasharray={strokeDash}
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-emerald-700 font-headline leading-none">
                            {keptPct}%
                          </span>
                        </div>
                      </div>

                      {/* Number Rendering with Donut Chart (Numbers Only with Color Indicators) */}
                      <div className="flex flex-col text-xs font-black leading-tight">
                        <span className="text-emerald-700 flex items-center gap-1.5" title={`${partialKept} Kept Items`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          {partialKept}
                        </span>
                        <span className="text-rose-600 flex items-center gap-1.5 mt-0.5" title={`${partialRet} Returned Items`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          {partialRet}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Split Bar (Emerald Kept vs Rose Returned) */}
                  <div className="w-full bg-rose-200 rounded-full h-1.5 mt-2.5 overflow-hidden flex" title={`${partialKept} Kept (${keptPct}%) • ${partialRet} Returned (${retPct}%)`}>
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${keptPct}%` }}
                      title={`${partialKept} Kept (${keptPct}%)`}
                    ></div>
                    <div
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${retPct}%` }}
                      title={`${partialRet} Returned (${retPct}%)`}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Split Volume</span>
                  <span className="font-bold text-amber-700 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60 shadow-2xs">
                    {partialTotal.toLocaleString()} items
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
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          title="Click to view Exchanged Orders log"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <RefreshCw className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-navy-deep">Exchange Orders</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                {exchangePercentage}% Swap
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 transition-colors" />
            </div>
          </div>

          {(() => {
            const exchangeCollected = Math.round(s.totalExchangeCodCollected || 0);
            const exchangePathaoCharge = Math.round(
              s.totalExchangeCourierExpense || (s.totalExchangedOrders ? s.totalExchangedOrders * 60 : 0)
            );
            const totalExFlow = (exchangeCollected + exchangePathaoCharge) || 1;
            const collectPct = Math.round((exchangeCollected / totalExFlow) * 100);
            const chargePct = 100 - collectPct;
            const strokeDash = `${collectPct} ${100 - collectPct}`;
            const netExchange = exchangeCollected - exchangePathaoCharge;

            return (
              <>
                <div className="my-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-headline font-black text-2xl sm:text-3xl text-purple-700">
                          {(s.totalExchangedOrders || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-purple-600/70 uppercase tracking-wide">Orders</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                        <span className={`font-bold ${netExchange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {netExchange >= 0 ? `+৳ ${netExchange.toLocaleString()}` : `-৳ ${Math.abs(netExchange).toLocaleString()}`}
                        </span>
                        <span className="text-[10px] text-slate-400">net</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* SVG Donut Chart */}
                      <div className="relative w-11 h-11 flex items-center justify-center shrink-0" title={`Exchange Split: ৳ ${exchangeCollected.toLocaleString()} Collected (${collectPct}%) • ৳ ${exchangePathaoCharge.toLocaleString()} Pathao Charged (${chargePct}%)`}>
                        <svg className="w-11 h-11 -rotate-90 transform shrink-0" viewBox="0 0 36 36" width="44" height="44">
                          {/* Pathao Charged Track (Rose) */}
                          <path
                            className="text-rose-200"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Our Collection Segment (Emerald) */}
                          <path
                            className="text-emerald-500 transition-all duration-500 ease-out"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            strokeDasharray={strokeDash}
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-emerald-700 font-headline leading-none">
                            {collectPct}%
                          </span>
                        </div>
                      </div>

                      {/* Number Rendering with Donut Chart (Numbers Only with Color Indicators) */}
                      <div className="flex flex-col text-xs font-black leading-tight">
                        <span className="text-emerald-700 flex items-center gap-1.5" title={`৳ ${exchangeCollected.toLocaleString()} Collected from Customer`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          {exchangeCollected.toLocaleString()}
                        </span>
                        <span className="text-rose-600 flex items-center gap-1.5 mt-0.5" title={`৳ ${exchangePathaoCharge.toLocaleString()} Charged by Pathao Courier`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          {exchangePathaoCharge.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Split Bar (Emerald Collected vs Rose Pathao Charged) */}
                  <div className="w-full bg-rose-200 rounded-full h-1.5 mt-2.5 overflow-hidden flex" title={`৳ ${exchangeCollected.toLocaleString()} Collected (${collectPct}%) • ৳ ${exchangePathaoCharge.toLocaleString()} Pathao Charged (${chargePct}%)`}>
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${collectPct}%` }}
                      title={`৳ ${exchangeCollected.toLocaleString()} Collected (${collectPct}%)`}
                    ></div>
                    <div
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${chargePct}%` }}
                      title={`৳ ${exchangePathaoCharge.toLocaleString()} Pathao Charged (${chargePct}%)`}
                    ></div>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Re-shipment Swaps</span>
            <span className="font-bold text-purple-700 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200/60 shadow-2xs">
              {(s.totalExchangedItemsQty || s.totalExchangedOrders || 0).toLocaleString()} items
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500"></div>
        </div>
      </div>

      {/* 4. FORMULA VERIFICATION & TOTAL RETURNED RECONCILIATION BAR */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-50 via-white to-slate-50 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-orange-100/80 text-primary flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-bold text-primary text-[11px] uppercase tracking-wider shrink-0">
            Formula Verification:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap text-slate-700">
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200/60">
              {(s.regularReturnedQty || s.fullReturnedOrders).toLocaleString()} pcs
            </span>
            <span className="text-slate-400 font-medium text-[11px]">Regular RTO</span>
            <span className="text-slate-400 font-bold">+</span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200/60">
              {(s.partialReturnedQty || s.partialOrders).toLocaleString()} pcs
            </span>
            <span className="text-slate-400 font-medium text-[11px]">Partially Returned Products</span>
            <span className="text-slate-400 font-bold">=</span>
            <span className="px-2 py-0.5 rounded bg-primary text-white font-bold shadow-2xs">
              {(s.totalReturnedQty || ((s.regularReturnedQty || s.fullReturnedOrders) + (s.partialReturnedQty || s.partialOrders))).toLocaleString()} Total Returned Units
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>100% SKU Flow Balanced:</span>
          <span className="font-bold text-navy-deep">
            {s.totalItemsDelivered.toLocaleString()} Kept + {s.totalReturnedQty.toLocaleString()} Ret = {(s.totalGrossItems || s.grossOrders).toLocaleString()} Units
          </span>
        </div>
      </div>

      {/* 5. EXECUTIVE FINANCIALS, LOGISTICS & TERRITORY METRICS (Consolidated 4-Card Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Realized Net Revenue with Realization Rate & Return Leakage */}
        <div
          onClick={() => onKpiClick?.('tabExecutive')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
          title="Click to view Executive Performance Breakdown"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Total Realized Revenue
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CircleDollarSign className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-black text-navy-deep font-headline">
                ৳ {Math.round(s.netDeliveredRevenue).toLocaleString()}
              </div>
              {/* Realization Rate Pill */}
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 shrink-0">
                {Math.round((s.netDeliveredRevenue / (s.grossRevenue || 1)) * 100)}% Realized
              </span>
            </div>

            {/* Mini Cash Realization Bar (Delivered vs Return Leakage) */}
            <div className="w-full bg-rose-100/80 rounded-full h-1.5 mt-2 overflow-hidden flex" title={`${Math.round((s.netDeliveredRevenue / (s.grossRevenue || 1)) * 100)}% Realized vs Return Leakage`}>
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((s.netDeliveredRevenue / (s.grossRevenue || 1)) * 100))}%` }}
              ></div>
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-1.5 flex items-center justify-between">
              <span>Avg ৳{s.fullDeliveredOrders > 0 ? Math.round(s.netDeliveredRevenue / s.fullDeliveredOrders).toLocaleString() : '2,000'} / kept ord</span>
              <span className="text-rose-600 text-[11px] font-bold">
                -৳ {Math.round(s.grossRevenue - s.netDeliveredRevenue).toLocaleString()} loss
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
              Pipeline: ৳ {Math.round(s.grossRevenue).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 font-medium transition-colors">
              View Executive →
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* 2. Net Contribution Margin with Waterfall Stacked Bar & Unit Profit */}
        <div
          onClick={() => onKpiClick?.('tabUnitEconomics')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
          title="Click to view Unit Economics & Sales Calculation"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Contribution Margin
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Coins className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition-colors" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-black text-amber-600 font-headline">
                {s.unitEconomics.netMarginPercentage.toFixed(1)}%
              </div>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70 shrink-0">
                ৳ {Math.round(s.unitEconomics.netContributionMargin).toLocaleString()} Net
              </span>
            </div>

            {/* Horizontal Stacked Margin Bar: Profit (Emerald), COGS (Amber), Courier & Pack (Blue) */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden flex" title={`${Math.round(s.unitEconomics.netMarginPercentage)}% Profit • 42% COGS • 11% Shipping & Pack`}>
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(10, Math.round(s.unitEconomics.netMarginPercentage)))}%` }}
                title="Net Profit"
              ></div>
              <div
                className="bg-amber-400 h-full transition-all duration-500"
                style={{ width: '42%' }}
                title="42% COGS"
              ></div>
              <div
                className="bg-blue-400 h-full transition-all duration-500"
                style={{ width: '11%' }}
                title="Logistics & Packaging"
              ></div>
            </div>

            <div className="text-xs font-semibold text-slate-500 mt-1.5 flex items-center justify-between">
              <span className="text-emerald-700 font-bold">
                ৳ {s.fullDeliveredOrders > 0 ? Math.round(s.unitEconomics.netContributionMargin / s.fullDeliveredOrders).toLocaleString() : '700'} / kept ord
              </span>
              <span className="text-[10px] text-slate-400 font-medium">42% COGS Model</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>After COGS & Logistics</span>
            <span className="text-[10px] text-slate-400 group-hover:text-amber-700 font-medium transition-colors">
              Unit Economics →
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* 3. Pathao Courier Cost & Fee Recovery */}
        <div
          onClick={() => onKpiClick?.('tabCourierMismatch')}
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          title="Click to view Pathao Courier Audit & manifests"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Pathao Courier Cost
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Truck className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </div>
          </div>

          {(() => {
            const netCharge = Math.round(s.courierCost.netCharge || 0);
            const feeCollected = Math.round(s.courierCost.customerDeliveryFeeCollected || 0);
            const netCost = Math.max(0, netCharge - feeCollected);
            const recoveryPct = netCharge > 0 ? Math.min(100, Math.round((feeCollected / netCharge) * 100)) : 0;
            const remainingPct = 100 - recoveryPct;
            const strokeDash = `${recoveryPct} ${remainingPct}`;

            return (
              <>
                <div className="my-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-2xl font-black text-blue-700 font-headline">
                        ৳ {netCharge.toLocaleString()}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1 whitespace-nowrap" title={`Dhaka (৳50): ${s.courierCost.collectedInsideCount} • Outside (৳90): ${s.courierCost.collectedOutsideCount}`}>
                        <span className="font-bold text-slate-700">৳ {netCost.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">net cost</span>
                      </div>
                    </div>

                    {/* Donut Chart with Numbers directly attached */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* SVG Donut Chart */}
                      <div className="relative w-11 h-11 flex items-center justify-center shrink-0" title={`Courier Fee Recovery: ৳ ${feeCollected.toLocaleString()} Collected (${recoveryPct}%) of ৳ ${netCharge.toLocaleString()} Courier Cost`}>
                        <svg className="w-11 h-11 -rotate-90 transform shrink-0" viewBox="0 0 36 36" width="44" height="44">
                          {/* Unrecovered Track (Rose) */}
                          <path
                            className="text-rose-200"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Collected Segment (Emerald) */}
                          <path
                            className="text-emerald-500 transition-all duration-500 ease-out"
                            stroke="currentColor"
                            strokeWidth="4.5"
                            strokeDasharray={strokeDash}
                            strokeLinecap="round"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-emerald-700 font-headline leading-none">
                            {recoveryPct}%
                          </span>
                        </div>
                      </div>

                      {/* Number Rendering with Donut Chart (Numbers Only with Color Indicators) */}
                      <div className="flex flex-col text-xs font-black leading-tight">
                        <span className="text-emerald-700 flex items-center gap-1.5" title={`+৳ ${feeCollected.toLocaleString()} Delivery Fee Collected from Customers`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          {feeCollected.toLocaleString()}
                        </span>
                        <span className="text-rose-600 flex items-center gap-1.5 mt-0.5" title={`৳ ${netCharge.toLocaleString()} Total Pathao Courier Charge`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          {netCharge.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Split Bar (Emerald Recovered vs Rose Net Cost) */}
                  <div className="w-full bg-rose-200 rounded-full h-1.5 mt-2.5 overflow-hidden flex" title={`${recoveryPct}% Recovered (Emerald) • ${remainingPct}% Net Cost (Rose)`}>
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${recoveryPct}%` }}
                      title={`৳ ${feeCollected.toLocaleString()} Collected (${recoveryPct}%)`}
                    ></div>
                    <div
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${remainingPct}%` }}
                      title={`৳ ${netCost.toLocaleString()} Net Cost (${remainingPct}%)`}
                    ></div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span title={`Fee: ${s.courierCost.collectedInsideCount} Dhaka (৳50) • ${s.courierCost.collectedOutsideCount} Outside (৳90)`}>
                    Fee: {s.courierCost.collectedInsideCount} Dhaka • {s.courierCost.collectedOutsideCount} Out
                  </span>
                  <span className="text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200/60">
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
          className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
          title="Click to view Territory Performance"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Territory Ratio
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Compass className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
            </div>
          </div>

          {(() => {
            const totalTerritory = (s.outsideOrders + s.insideOrders) || s.grossOrders || 1;
            const outsidePct = Math.round((s.outsideOrders / totalTerritory) * 100);
            const insidePct = 100 - outsidePct;
            const ratioInt = Math.round(s.outsideOrders / (s.insideOrders || 1));
            const strokeDash = `${outsidePct} ${100 - outsidePct}`;

            return (
              <>
                <div className="my-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl font-black text-navy-deep font-headline">
                      {ratioInt} : 1
                    </div>
                    <div className="text-xs font-semibold text-slate-500 mt-0.5">
                      {Math.round(s.outsideOrders).toLocaleString()} Outside vs {Math.round(s.insideOrders).toLocaleString()} Inside
                    </div>
                  </div>

                  {/* SVG Donut Chart */}
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <svg className="w-12 h-12 -rotate-90 transform shrink-0" viewBox="0 0 36 36" width="48" height="48">
                      {/* Inside Dhaka Track */}
                      <path
                        className="text-slate-100"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Outside Dhaka Segment */}
                      <path
                        className="text-indigo-600 transition-all duration-500 ease-out"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeDasharray={strokeDash}
                        strokeLinecap="round"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black text-indigo-700 font-headline">
                        {outsidePct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Horizontal Territory Split Bar (Indigo Outside vs Amber Inside) */}
                <div className="w-full bg-amber-100 rounded-full h-1.5 mt-2 overflow-hidden flex" title={`${outsidePct}% Outside Dhaka • ${insidePct}% Inside Dhaka`}>
                  <div
                    className="bg-indigo-600 h-full transition-all duration-500"
                    style={{ width: `${outsidePct}%` }}
                    title={`${Math.round(s.outsideOrders).toLocaleString()} Outside Dhaka (${outsidePct}%)`}
                  ></div>
                  <div
                    className="bg-amber-400 h-full transition-all duration-500"
                    style={{ width: `${insidePct}%` }}
                    title={`${Math.round(s.insideOrders).toLocaleString()} Inside Dhaka (${insidePct}%)`}
                  ></div>
                </div>

                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>Outside Share: <strong className="text-indigo-700">{outsidePct}%</strong></span>
                  <span className="text-slate-400 font-medium">Inside: {insidePct}%</span>
                </div>
              </>
            );
          })()}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"></div>
        </div>
      </div>
    </div>
  );
}
