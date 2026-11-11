"use client";

import React, { useState } from 'react';
import { DollarSign, TrendingDown, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export interface WaterfallStep {
  label: string;
  subLabel?: string;
  amount: number;
  type: 'initial' | 'deduction' | 'total';
}

interface FinancialLeakageWaterfallChartProps {
  steps?: WaterfallStep[];
  grossDispatched?: number;
  fullReturnLoss?: number;
  partialReturnLoss?: number;
  courierCharges?: number;
  packagingLoss?: number;
  netRetained?: number;
  title?: string;
  className?: string;
}

export function FinancialLeakageWaterfallChart({
  steps: customSteps,
  grossDispatched = 2348200,
  fullReturnLoss = 345000,
  partialReturnLoss = 88748,
  courierCharges = 98450,
  packagingLoss = 12750,
  netRetained,
  title = "Cash Flow & COD Return Leakage Waterfall",
  className = "",
}: FinancialLeakageWaterfallChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const resolvedNet = netRetained ?? Math.max(0, grossDispatched - fullReturnLoss - partialReturnLoss - courierCharges - packagingLoss);

  const steps: WaterfallStep[] = customSteps || [
    {
      label: 'Gross Dispatched',
      subLabel: 'Total Invoiced Potential',
      amount: grossDispatched,
      type: 'initial',
    },
    {
      label: 'Full Returns',
      subLabel: '100% Rejected Parcels',
      amount: fullReturnLoss,
      type: 'deduction',
    },
    {
      label: 'Partial Lost Items',
      subLabel: 'Rejected in Split Parcels',
      amount: partialReturnLoss,
      type: 'deduction',
    },
    {
      label: 'Courier Return Fee',
      subLabel: 'Pathao Delivery Penalty',
      amount: courierCharges,
      type: 'deduction',
    },
    {
      label: 'Packaging Sunk Cost',
      subLabel: '৳25 Box & Poly Loss/Unit',
      amount: packagingLoss,
      type: 'deduction',
    },
    {
      label: 'Net Realized Cash',
      subLabel: 'Bank Deposited Settled Cash',
      amount: resolvedNet,
      type: 'total',
    },
  ];

  const maxVal = Math.max(...steps.map((s) => s.amount), 1);

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Step-by-step financial erosion from gross dispatch to actual bank-settled cash
            </p>
          </div>
        </div>

        {/* Realization Rate Pill */}
        <div className="flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <span>Realization Rate:</span>
          <span className="text-sm">
            {((resolvedNet / (grossDispatched || 1)) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Waterfall Visual Bars */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2">
        {steps.map((step, idx) => {
          const isInitial = step.type === 'initial';
          const isDeduction = step.type === 'deduction';
          const isTotal = step.type === 'total';
          const heightPct = Math.min(100, Math.round((step.amount / maxVal) * 100));
          const isHovered = hoveredIdx === idx;

          let barColor = 'bg-sky-500 dark:bg-sky-400';
          let textColor = 'text-sky-600 dark:text-sky-400';
          let borderHighlight = 'border-sky-300 dark:border-sky-800';

          if (isDeduction) {
            barColor = 'bg-rose-500 dark:bg-rose-400';
            textColor = 'text-rose-600 dark:text-rose-400';
            borderHighlight = 'border-rose-300 dark:border-rose-800';
          } else if (isTotal) {
            barColor = 'bg-emerald-500 dark:bg-emerald-400';
            textColor = 'text-emerald-600 dark:text-emerald-400';
            borderHighlight = 'border-emerald-300 dark:border-emerald-800';
          }

          return (
            <div
              key={step.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex flex-col justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? `bg-slate-100/80 dark:bg-[#181818] ${borderHighlight} shadow-xs`
                  : 'bg-slate-50/60 dark:bg-[#121212] border-slate-200/70 dark:border-[#1F1F1F]'
              }`}
            >
              {/* Header */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Step {idx + 1}
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate font-headline mt-0.5">
                  {step.label}
                </p>
                {step.subLabel && (
                  <p className="text-[10px] text-slate-400 truncate">
                    {step.subLabel}
                  </p>
                )}
              </div>

              {/* Vertical Step Bar (Height ~140px) */}
              <div className="h-32 flex flex-col items-center justify-end my-2">
                <span className={`text-[10px] font-mono font-bold mb-1 ${textColor}`}>
                  {isDeduction ? '-' : ''}৳{Math.round(step.amount / 1000)}k
                </span>
                <div
                  style={{ height: `${Math.max(12, heightPct)}%` }}
                  className={`w-12 rounded-t-lg transition-all duration-300 shadow-2xs ${barColor}`}
                  title={`${step.label}: ৳${Math.round(step.amount).toLocaleString()}`}
                />
              </div>

              {/* Step Footer with exact amount */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-[#222222] text-center">
                <span className="text-xs font-mono font-black text-slate-900 dark:text-white">
                  {isDeduction ? '-' : ''}৳{Math.round(step.amount).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
