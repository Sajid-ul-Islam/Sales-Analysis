"use client";

import React from 'react';
import { SummaryAnalytics } from '@/types';
import { Coins, TrendingUp, Truck, Package, DollarSign } from 'lucide-react';

interface UnitEconomicsTabProps {
  summary: SummaryAnalytics;
}

export function UnitEconomicsTab({ summary: s }: UnitEconomicsTabProps) {
  const u = s.unitEconomics;
  const c = s.courierCost;

  return (
    <div className="space-y-6">
      {/* Financial Executive Waterfall Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Realized Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Clean Realized Net Sales</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-emerald-600">৳ {Math.round(u.netRealizedSales).toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">Post-Return Net Cash Recognized</span>
          </div>
          <span className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Gross GMV: ৳ {Math.round(u.grossInvoicedSales).toLocaleString()}
          </span>
        </div>

        {/* Estimated COGS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated COGS (42%)</span>
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-amber-600">৳ {Math.round(u.estimatedCogs).toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">Denim Fabric & Manufacturing Cost</span>
          </div>
          <span className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Gross Product Margin: ৳ {Math.round(u.grossMargin).toLocaleString()} (58%)
          </span>
        </div>

        {/* Courier Logistics Burden */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Courier Burden</span>
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-blue-600">৳ {Math.round(c.netCourierBurden).toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">Post-COD Recovery Net Shipping</span>
          </div>
          <span className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Paid Return Recovered: ৳ {Math.round(c.paidReturnCollectedCod).toLocaleString()}
          </span>
        </div>

        {/* Net Contribution Margin */}
        <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 rounded-2xl p-5 border border-emerald-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">True Contribution Margin</span>
            <Coins className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-emerald-700">৳ {Math.round(u.netContributionMargin).toLocaleString()}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-emerald-700">{u.netMarginPercentage.toFixed(1)}%</span>
              <span className="text-xs text-slate-500">Net Profit Margin</span>
            </div>
          </div>
          <span className="text-[11px] text-emerald-700 pt-2 border-t border-emerald-100 font-semibold">
            Bottom-Line Operating Yield
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
              <span className="text-xs font-bold text-slate-500">September 2024 Audit</span>
            </div>

            <div className="space-y-3.5 my-5 text-xs">
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
            </div>
          </div>

          <div className="pt-4 border-t-2 border-slate-100 bg-slate-50 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-extrabold text-primary tracking-wider block">Net Contribution Margin</span>
              <span className="text-[11px] text-slate-500">After COGS, Courier Logistics & Packaging</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-emerald-600">৳ {Math.round(u.netContributionMargin).toLocaleString()}</span>
              <span className="text-xs text-emerald-700 block font-bold">{u.netMarginPercentage.toFixed(1)}% Margin</span>
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
