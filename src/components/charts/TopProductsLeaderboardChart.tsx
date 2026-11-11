"use client";

import React, { useState } from 'react';
import { ShoppingBag, TrendingUp, AlertTriangle } from 'lucide-react';
import { ProductAnalyticsItem } from '@/lib/productAnalytics';

interface TopProductsLeaderboardChartProps {
  products: ProductAnalyticsItem[];
  title?: string;
  limit?: number;
  className?: string;
  onSelectProduct?: (product: ProductAnalyticsItem) => void;
}

export function TopProductsLeaderboardChart({
  products,
  title = "Top Revenue & Volume Generating Products",
  limit = 10,
  className = "",
  onSelectProduct,
}: TopProductsLeaderboardChartProps) {
  const [metric, setMetric] = useState<'revenue' | 'units'>('revenue');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const topItems = [...products]
    .sort((a, b) =>
      metric === 'revenue'
        ? b.deliveredRevenue - a.deliveredRevenue
        : b.totalDeliveredUnits - a.totalDeliveredUnits
    )
    .slice(0, limit);

  const maxVal = topItems.length > 0
    ? metric === 'revenue'
      ? Math.max(...topItems.map((p) => p.deliveredRevenue), 1)
      : Math.max(...topItems.map((p) => p.totalDeliveredUnits), 1)
    : 1;

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Ranked by net delivered volume and revenue realization
            </p>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-0.5 border border-slate-200/80 dark:border-[#222222] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric('revenue')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metric === 'revenue'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Delivered Revenue (৳)
          </button>
          <button
            type="button"
            onClick={() => setMetric('units')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metric === 'units'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Units Sold (pcs)
          </button>
        </div>
      </div>

      {/* Horizontal Leaderboard Bars */}
      <div className="space-y-2.5">
        {topItems.map((prod, idx) => {
          const val = metric === 'revenue' ? prod.deliveredRevenue : prod.totalDeliveredUnits;
          const pct = Math.min(100, Math.round((val / maxVal) * 100));
          const isHovered = hoveredId === prod.id;
          const isHighReturn = prod.returnRate >= 30;

          return (
            <div
              key={prod.id}
              onMouseEnter={() => setHoveredId(prod.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectProduct?.(prod)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-orange-50/40 dark:bg-orange-950/20 border-primary shadow-xs'
                  : 'bg-slate-50/50 dark:bg-[#121212] border-slate-200/60 dark:border-[#1F1F1F] hover:border-slate-300 dark:hover:border-[#333333]'
              }`}
            >
              {/* Product Info Row */}
              <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="w-5 h-5 rounded-md bg-slate-200/80 dark:bg-[#222222] text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white truncate font-headline">
                    {prod.title}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 shrink-0 font-medium border border-slate-200/60 dark:border-[#262626]">
                    {prod.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isHighReturn && (
                    <span
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-900/50"
                      title={`High Return Rate: ${prod.returnRate.toFixed(1)}%`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>{prod.returnRate.toFixed(1)}% RTO</span>
                    </span>
                  )}
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {metric === 'revenue'
                      ? `৳${Math.round(prod.deliveredRevenue).toLocaleString()}`
                      : `${prod.totalDeliveredUnits.toLocaleString()} pcs`}
                  </span>
                </div>
              </div>

              {/* Progress Bar with Return Loss Segment */}
              <div className="h-2.5 w-full bg-slate-100 dark:bg-[#181818] rounded-full overflow-hidden flex shadow-2xs">
                <div
                  style={{ width: `${pct}%` }}
                  className="h-full bg-primary rounded-full transition-all duration-300"
                />
              </div>

              {/* Subtitle / Details on Hover */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>
                  Delivered: {prod.totalDeliveredUnits} pcs • Returned: {prod.totalReturnedUnits} pcs
                </span>
                <span>
                  Gross Margin: {(prod.grossMarginPercent).toFixed(1)}% • AOV: ৳{Math.round(prod.avgSellingPrice)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
