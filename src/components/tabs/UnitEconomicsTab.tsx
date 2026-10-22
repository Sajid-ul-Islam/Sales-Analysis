"use client";

import React from 'react';
import { SummaryAnalytics } from '@/types';
import { Coins, TrendingUp, Truck, Package, DollarSign, Megaphone } from 'lucide-react';

interface UnitEconomicsTabProps {
  summary: SummaryAnalytics;
}

export function UnitEconomicsTab({ summary: s }: UnitEconomicsTabProps) {
  const u = s.unitEconomics;
  const c = s.courierCost;
  const preAdMargin = u.grossMargin - u.totalCourierExpense - u.packagingLoss + (c.paidReturnCollectedCod || 0);

  return (
    <div className="space-y-6">
      {/* Financial Executive Waterfall Cards (5-Metric Omnichannel Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* 1. Net Realized Revenue */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Realized Sales</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5 sm:my-3 min-w-0">
            <div
              className="text-xl sm:text-2xl xl:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-headline tracking-tight truncate block"
              title={`৳ ${Math.round(u.netRealizedSales).toLocaleString()}`}
            >
              ৳ {Math.round(u.netRealizedSales).toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1 truncate">Net Invoiced Cash</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-deepBlack-border flex flex-wrap items-center justify-between gap-1 font-medium min-w-0">
            <span className="truncate">Gross: ৳ {Math.round(u.grossInvoicedSales).toLocaleString()}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 shrink-0">
              Net Invoiced
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* 2. Estimated COGS */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">COGS (42%)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Package className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5 sm:my-3 min-w-0">
            <div
              className="text-xl sm:text-2xl xl:text-3xl font-black text-amber-600 dark:text-amber-400 font-headline tracking-tight truncate block"
              title={`৳ ${Math.round(u.estimatedCogs).toLocaleString()}`}
            >
              ৳ {Math.round(u.estimatedCogs).toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1 truncate">Fabric & Production</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-deepBlack-border flex flex-wrap items-center justify-between gap-1 font-medium min-w-0">
            <span className="truncate">Gross Margin: ৳ {Math.round(u.grossMargin).toLocaleString()}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 shrink-0">
              58% Margin
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* 3. Courier Logistics Burden */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Courier Cost</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Truck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5 sm:my-3 min-w-0">
            <div
              className="text-xl sm:text-2xl xl:text-3xl font-black text-blue-600 dark:text-blue-400 font-headline tracking-tight truncate block"
              title={`৳ ${Math.round(c.netCourierBurden).toLocaleString()}`}
            >
              ৳ {Math.round(c.netCourierBurden).toLocaleString()}
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1 truncate">Net Payable Fee</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-deepBlack-border flex flex-wrap items-center justify-between gap-1 font-medium min-w-0">
            <span className="truncate">COD Rec: +৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 shrink-0">
              Logistics
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
        </div>

        {/* 4. Meta Performance Ads */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider truncate">Meta Ads</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Megaphone className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5 sm:my-3 min-w-0">
            <div
              className="text-xl sm:text-2xl xl:text-3xl font-black text-purple-700 dark:text-purple-400 font-headline tracking-tight truncate block"
              title={`৳ ${Math.round(u.metaAdCost).toLocaleString()}`}
            >
              ৳ {Math.round(u.metaAdCost).toLocaleString()}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 min-w-0">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs shrink-0">
                {u.roas.toFixed(1)}x ROAS
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                ৳{Math.round(u.cac)} CAC
              </span>
            </div>
          </div>
          <div className="text-[11px] text-purple-700 dark:text-purple-400 pt-2.5 border-t border-slate-100 dark:border-deepBlack-border flex flex-wrap items-center justify-between gap-1 font-medium min-w-0">
            <span className="truncate">Meta Ad Spend</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 shrink-0">
              Paid Acquisition
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500"></div>
        </div>

        {/* 5. True Net Contribution Margin */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/30 dark:via-deepBlack-card dark:to-emerald-950/10 rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border border-emerald-200/90 dark:border-emerald-800/40 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider truncate">Contribution Margin</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-700/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Coins className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-2.5 sm:my-3 min-w-0">
            <div
              className="text-xl sm:text-2xl xl:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-headline tracking-tight truncate block"
              title={`৳ ${Math.round(u.netContributionMargin).toLocaleString()}`}
            >
              ৳ {Math.round(u.netContributionMargin).toLocaleString()}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 min-w-0">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700/50 shadow-2xs shrink-0">{u.netMarginPercentage.toFixed(1)}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">True Net Yield</span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-2.5 border-t border-emerald-100 dark:border-deepBlack-border flex flex-wrap items-center justify-between gap-1 font-semibold min-w-0">
            <span className="truncate">Post-COGS, Courier & Ads</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 shrink-0">
              Net CM3
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>
      </div>

      {/* Financial Statement & Courier Reconciliation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: E-Commerce P&L Statement */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-deepBlack-border">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Consolidated Unit P&L Statement</h3>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border px-2.5 py-0.5 rounded-full">
                Reconciled Statement
              </span>
            </div>

            <div className="space-y-3 my-4 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">1. Gross Invoiced Revenue (GMV)</span>
                <span className="text-slate-900 dark:text-white font-bold">৳ {Math.round(u.grossInvoicedSales).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-rose-600 dark:text-rose-400">
                <span className="font-semibold">(-) Returns & Partial Deduction</span>
                <span className="font-bold">- ৳ {Math.round(u.grossInvoicedSales - u.netRealizedSales).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-100 dark:border-deepBlack-border font-bold bg-slate-50 dark:bg-deepBlack-sidebar px-3 rounded-lg">
                <span className="text-emerald-700 dark:text-emerald-400">2. Clean Realized Net Sales</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-black">৳ {Math.round(u.netRealizedSales).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-amber-700 dark:text-amber-400">
                <span className="font-semibold">(-) Estimated COGS (Fabric & Production @ 42%)</span>
                <span className="font-bold">- ৳ {Math.round(u.estimatedCogs).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300 font-semibold">
                <span>3. Gross Margin (58%)</span>
                <span className="text-slate-900 dark:text-white font-bold">৳ {Math.round(u.grossMargin).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-rose-600 dark:text-rose-400">
                <span className="font-semibold">(-) Total Courier Fee (Net Payable)</span>
                <span className="font-bold">- ৳ {Math.round(u.totalCourierExpense).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-rose-600 dark:text-rose-400">
                <span className="font-semibold">(-) Packaging & Inspection Loss (৳25/return)</span>
                <span className="font-bold">- ৳ {Math.round(u.packagingLoss).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-slate-700 dark:text-slate-300 font-semibold">
                <span>4. Pre-Marketing Margin (CM2)</span>
                <span className="text-slate-900 dark:text-white font-bold">৳ {Math.round(preAdMargin).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/60 dark:border-purple-800/40">
                <span className="flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  (-) Meta Ad Performance Spend (Facebook / IG)
                </span>
                <span>- ৳ {Math.round(u.metaAdCost).toLocaleString()}</span>
              </div>
            </div>

            {/* Performance Marketing & Unit Yield Summary Banner */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border text-[11px] mb-4">
              <div className="text-center">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Blended ROAS</span>
                <span className="font-black text-purple-700 dark:text-purple-400 font-headline">{u.roas.toFixed(1)}x</span>
              </div>
              <div className="text-center border-x border-slate-200 dark:border-deepBlack-border">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Blended CAC</span>
                <span className="font-black text-slate-700 dark:text-slate-200 font-headline">৳{Math.round(u.cac)}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Yield / Kept Ord</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400 font-headline">
                  ৳{s.fullDeliveredOrders > 0 ? Math.round(u.netContributionMargin / s.fullDeliveredOrders).toLocaleString() : '0'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-slate-100 dark:border-deepBlack-border bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl flex items-center justify-between border border-emerald-200/70 dark:border-emerald-800/40">
            <div>
              <span className="text-xs uppercase font-extrabold text-emerald-800 dark:text-emerald-300 tracking-wider block">Net Contribution Margin (CM3)</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">After COGS, Logistics, Packaging & Meta Ads</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">৳ {Math.round(u.netContributionMargin).toLocaleString()}</span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 block font-bold">{u.netMarginPercentage.toFixed(1)}% True Net</span>
            </div>
          </div>
        </div>

        {/* Right: Pathao & Courier Cost Reconciliation Audit */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-deepBlack-border">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Pathao Logistics Cost Reconciliation</h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                {c.consignmentsCount} Consignments
              </span>
            </div>

            <div className="space-y-3.5 my-5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">Pathao Gross Invoice (`Charge` Column)</span>
                <span className="text-slate-900 dark:text-white font-bold">৳ {Math.round(c.grossCharge).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-emerald-700 dark:text-emerald-400">
                <span className="font-semibold">Courier Promotional Discount (`Discount`)</span>
                <span className="font-bold">- ৳ {Math.round(c.discount).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-100 dark:border-deepBlack-border font-bold bg-slate-50 dark:bg-deepBlack-sidebar px-3 rounded-lg">
                <span className="text-slate-900 dark:text-white">Net Courier Payable to Pathao</span>
                <span className="text-slate-900 dark:text-white font-black">৳ {Math.round(c.netCharge).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-emerald-700 dark:text-emerald-400">
                <span className="font-semibold">Paid Return COD Recovered from Customers</span>
                <span className="font-bold">+ ৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 mt-3">
                <span className="font-bold text-blue-900 dark:text-blue-200 block mb-1">Key Reconciliation Insight:</span>
                DEEN recovered <strong className="text-slate-900 dark:text-white">৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}</strong> in return delivery fees from {s.paidReturnsCount || 0} Paid Return orders. This covered <strong className="text-slate-900 dark:text-white">{((c.paidReturnCollectedCod / (c.netCharge || 1)) * 100).toFixed(0)}%</strong> of DEEN&apos;s entire courier invoice!
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-slate-100 dark:border-deepBlack-border bg-slate-50 dark:bg-deepBlack-sidebar p-4 rounded-xl flex items-center justify-between border border-slate-200/80 dark:border-deepBlack-border">
            <div>
              <span className="text-xs uppercase font-extrabold text-blue-700 dark:text-blue-400 tracking-wider block">Net Company Shipping Burden</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Net Courier Payable minus Paid Return COD</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-900 dark:text-white">৳ {Math.round(c.netCourierBurden).toLocaleString()}</span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-semibold">Low Logistics Burn</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
