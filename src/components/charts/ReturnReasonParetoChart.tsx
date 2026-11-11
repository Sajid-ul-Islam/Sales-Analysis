"use client";

import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface ReturnReasonItem {
  reason: string;
  count: number;
  value: number;
  share: number;
  cumulativeShare: number;
}

interface ReturnReasonParetoChartProps {
  reasons?: ReturnReasonItem[];
  title?: string;
  className?: string;
}

export function ReturnReasonParetoChart({
  reasons: customReasons,
  title = "Return Reasons Pareto Analysis (80/20 Defect Rule)",
  className = "",
}: ReturnReasonParetoChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const defaultReasons: ReturnReasonItem[] = [
    {
      reason: 'Size & Fit Mismatch',
      count: 142,
      value: 184600,
      share: 42.5,
      cumulativeShare: 42.5,
    },
    {
      reason: 'Fabric / Color Dissatisfaction',
      count: 81,
      value: 105300,
      share: 24.3,
      cumulativeShare: 66.8,
    },
    {
      reason: 'Courier Delay / Customer Unreachable',
      count: 61,
      value: 79300,
      share: 18.2,
      cumulativeShare: 85.0,
    },
    {
      reason: 'Customer Changed Mind / Cash Shortage',
      count: 38,
      value: 49400,
      share: 11.4,
      cumulativeShare: 96.4,
    },
    {
      reason: 'Wrong Item / Defect in Stitching',
      count: 12,
      value: 15148,
      share: 3.6,
      cumulativeShare: 100.0,
    },
  ];

  const reasons = customReasons || defaultReasons;
  const maxCount = Math.max(...reasons.map((r) => r.count), 10);

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 flex items-center justify-center shrink-0">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Pareto distribution: Top 2 return causes account for 66.8% of total inventory returns
            </p>
          </div>
        </div>

        {/* 80/20 Threshold Pill */}
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/60">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>80% Defect Barrier: Top 3 Causes</span>
        </div>
      </div>

      {/* Bars & Cumulative Curve */}
      <div className="space-y-3 pt-1">
        {reasons.map((item, idx) => {
          const barWidth = Math.min(100, Math.round((item.count / maxCount) * 100));
          const isHovered = hoveredIdx === idx;
          const isDominant = item.cumulativeShare <= 80 || idx < 3;

          return (
            <div
              key={item.reason}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 shadow-xs'
                  : 'bg-slate-50/60 dark:bg-[#121212] border-slate-200/70 dark:border-[#1F1F1F]'
              }`}
            >
              {/* Text row */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="w-5 h-5 rounded-md bg-slate-200/80 dark:bg-[#202020] text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white truncate font-headline">
                    {item.reason}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {item.count} returns (৳{Math.round(item.value).toLocaleString()})
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {item.share.toFixed(1)}% Share
                  </span>
                  <span className="text-slate-400 text-[10px] w-14 text-right">
                    Cumul: {item.cumulativeShare.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Stacked Progress Bar */}
              <div className="h-2.5 w-full bg-slate-100 dark:bg-[#181818] rounded-full overflow-hidden flex shadow-2xs">
                <div
                  style={{ width: `${barWidth}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isDominant
                      ? 'bg-rose-500 dark:bg-rose-400'
                      : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
