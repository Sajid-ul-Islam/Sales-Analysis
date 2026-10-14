"use client";

import React from 'react';
import { SummaryAnalytics } from '@/types';
import { Coins, TrendingUp, Truck, Package, DollarSign, Megaphone, Target, Sparkles } from 'lucide-react';

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Net Realized Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Realized Sales</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black text-emerald-600 font-headline">৳ {Math.round(u.netRealizedSales).toLocaleString()}</div>
            <span className="text-[11px] text-slate-500 block mt-0.5">Net Invoiced Cash</span>
          </div>
          <span className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 font-medium">
            Gross GMV: ৳ {Math.round(u.grossInvoicedSales).toLocaleString()}
          </span>
        </div>

        {/* 2. Estimated COGS */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">COGS (42%)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black text-amber-600 font-headline">৳ {Math.round(u.estimatedCogs).toLocaleString()}</div>
            <span className="text-[11px] text-slate-500 block mt-0.5">Fabric & Production</span>
          </div>
          <span className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 font-medium">
            Gross Margin: ৳ {Math.round(u.grossMargin).toLocaleString()} (58%)
          </span>
        </div>

        {/* 3. Courier Logistics Burden */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Courier Cost</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black text-blue-600 font-headline">৳ {Math.round(c.netCourierBurden).toLocaleString()}</div>
            <span className="text-[11px] text-slate-500 block mt-0.5">Net Payable Fee</span>
          </div>
          <span className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 font-medium">
            Paid Ret COD: +৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}
          </span>
        </div>

        {/* 4. Meta Performance Ads */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Meta Ads</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black text-purple-700 font-headline">৳ {Math.round(u.metaAdCost).toLocaleString()}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                {u.roas.toFixed(1)}x ROAS
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                ৳{Math.round(u.cac)} CAC
              </span>
            </div>
          </div>
          <span className="text-[10px] text-purple-700 pt-2 border-t border-slate-100 font-medium">
            Meta Ad Spend
          </span>
        </div>

        {/* 5. True Net Contribution Margin */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 rounded-2xl p-4 border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Contribution Margin</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black text-emerald-700 font-headline">৳ {Math.round(u.netContributionMargin).toLocaleString()}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-emerald-700">{u.netMarginPercentage.toFixed(1)}%</span>
              <span className="text-[11px] text-slate-500">Net Margin</span>
            </div>
          </div>
          <span className="text-[10px] text-emerald-700 pt-2 border-t border-emerald-100 font-semibold">
            Post-COGS, Courier & Ads
          </span>
        </div>
      </div>

      {/* Financial Statement & Courier Reconciliation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: E-Commerce P&L Statement */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">Consolidated Unit P&L Statement</h3>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                September 2024 Audit
              </span>
            </div>

            <div className="space-y-3 my-4 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 font-semibold">1. Gross Invoiced Revenue (GMV)</span>
                <span className="text-slate-900 font-bold">৳ {Math.round(u.grossInvoicedSales).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-rose-600">
                <span className="font-semibold">(-) Returns & Partial Deduction</span>
                <span className="font-bold">- ৳ {Math.round(u.grossInvoicedSales - u.netRealizedSales).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-100 font-bold bg-slate-50 px-3 rounded-lg">
                <span className="text-emerald-700">2. Clean Realized Net Sales</span>
                <span className="text-emerald-700 font-black">৳ {Math.round(u.netRealizedSales).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-amber-700">
                <span className="font-semibold">(-) Estimated COGS (Fabric & Production @ 42%)</span>
                <span className="font-bold">- ৳ {Math.round(u.estimatedCogs).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-slate-600 font-semibold">
                <span>3. Gross Margin (58%)</span>
                <span className="text-slate-900 font-bold">৳ {Math.round(u.grossMargin).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-rose-600">
                <span className="font-semibold">(-) Total Courier Fee (Net Payable)</span>
                <span className="font-bold">- ৳ {Math.round(u.totalCourierExpense).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-rose-600">
                <span className="font-semibold">(-) Packaging & Inspection Loss (৳25/return)</span>
                <span className="font-bold">- ৳ {Math.round(u.packagingLoss).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-slate-700 font-semibold">
                <span>4. Pre-Marketing Margin (CM2)</span>
                <span className="text-slate-900 font-bold">৳ {Math.round(preAdMargin).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-200/60">
                <span className="flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  (-) Meta Ad Performance Spend (Facebook / IG)
                </span>
                <span>- ৳ {Math.round(u.metaAdCost).toLocaleString()}</span>
              </div>
            </div>

            {/* Performance Marketing & Unit Yield Summary Banner */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] mb-4">
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">Blended ROAS</span>
                <span className="font-black text-purple-700 font-headline">{u.roas.toFixed(1)}x</span>
              </div>
              <div className="text-center border-x border-slate-200">
                <span className="text-slate-400 block text-[10px]">Blended CAC</span>
                <span className="font-black text-slate-700 font-headline">৳{Math.round(u.cac)}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">Yield / Kept Ord</span>
                <span className="font-black text-emerald-700 font-headline">
                  ৳{s.fullDeliveredOrders > 0 ? Math.round(u.netContributionMargin / s.fullDeliveredOrders).toLocaleString() : '0'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-slate-100 bg-emerald-50/50 p-4 rounded-xl flex items-center justify-between border border-emerald-200/70">
            <div>
              <span className="text-xs uppercase font-extrabold text-emerald-800 tracking-wider block">Net Contribution Margin (CM3)</span>
              <span className="text-[11px] text-slate-500">After COGS, Logistics, Packaging & Meta Ads</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-emerald-700">৳ {Math.round(u.netContributionMargin).toLocaleString()}</span>
              <span className="text-xs text-emerald-700 block font-bold">{u.netMarginPercentage.toFixed(1)}% True Net</span>
            </div>
          </div>
        </div>

        {/* Right: Pathao & Courier Cost Reconciliation Audit */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">Pathao Logistics Cost Reconciliation</h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {c.consignmentsCount} Consignments
              </span>
            </div>

            <div className="space-y-3.5 my-5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 font-semibold">Pathao Gross Invoice (`Charge` Column)</span>
                <span className="text-slate-900 font-bold">৳ {Math.round(c.grossCharge).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-emerald-700">
                <span className="font-semibold">Courier Promotional Discount (`Discount`)</span>
                <span className="font-bold">- ৳ {Math.round(c.discount).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-100 font-bold bg-slate-50 px-3 rounded-lg">
                <span className="text-slate-900">Net Courier Payable to Pathao</span>
                <span className="text-slate-900 font-black">৳ {Math.round(c.netCharge).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-1 text-emerald-700">
                <span className="font-semibold">Paid Return COD Recovered from Customers</span>
                <span className="font-bold">+ ৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 mt-3">
                <span className="font-bold text-blue-900 block mb-1">Key Reconciliation Insight:</span>
                DEEN recovered <strong className="text-slate-900">৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}</strong> in return delivery fees from 156 Paid Return orders. This covered <strong className="text-slate-900">{((c.paidReturnCollectedCod / (c.netCharge || 1)) * 100).toFixed(0)}%</strong> of DEEN&apos;s entire monthly courier invoice!
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-slate-100 bg-slate-50 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-extrabold text-blue-700 tracking-wider block">Net Company Shipping Burden</span>
              <span className="text-[11px] text-slate-500">Net Courier Payable minus Paid Return COD</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-900">৳ {Math.round(c.netCourierBurden).toLocaleString()}</span>
              <span className="text-[11px] text-emerald-700 block font-semibold">Low Logistics Burn</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
