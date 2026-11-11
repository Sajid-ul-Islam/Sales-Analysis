"use client";

import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { ChannelBarData } from './ChannelComparisonBarChart';

export interface CategoryChannelStackRow {
  category: string;
  totalUnits: number;
  totalRevenue: number;
  channels: Record<string, { units: number; revenue: number }>;
}

interface ChannelCategoryStackedBarChartProps {
  categories: CategoryChannelStackRow[];
  channels: ChannelBarData[];
  title?: string;
  className?: string;
}

export function ChannelCategoryStackedBarChart({
  categories,
  channels,
  title = "Category Distribution Across Channels",
  className = "",
}: ChannelCategoryStackedBarChartProps) {
  const [metricMode, setMetricMode] = useState<'units' | 'revenue'>('units');
  const [hoveredInfo, setHoveredInfo] = useState<{
    cat: string;
    chKey: string;
    val: number;
    share: number;
  } | null>(null);

  const topCategories = categories.slice(0, 7);

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Breakdown of top apparel categories across retail branches & e-commerce
            </p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-0.5 border border-slate-200/80 dark:border-[#222222]">
          <button
            type="button"
            onClick={() => setMetricMode('units')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'units'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Units Sold
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('revenue')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'revenue'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Revenue ৳
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300 mb-4 px-1">
        {channels.map((ch) => (
          <div key={ch.key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: ch.color }}
            />
            <span className="text-[11px] font-semibold">{ch.shortLabel}</span>
          </div>
        ))}
      </div>

      {/* Stacked Bars List */}
      <div className="space-y-3">
        {topCategories.map((catRow) => {
          const total = metricMode === 'units' ? catRow.totalUnits : catRow.totalRevenue;

          return (
            <div key={catRow.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {catRow.category}
                </span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                  {metricMode === 'units'
                    ? `${catRow.totalUnits.toLocaleString()} pcs`
                    : `৳${Math.round(catRow.totalRevenue).toLocaleString()}`}
                </span>
              </div>

              {/* Segmented Bar */}
              <div className="h-6 w-full rounded-lg bg-slate-100 dark:bg-[#181818] overflow-hidden flex shadow-2xs">
                {channels.map((ch) => {
                  const chData = catRow.channels[ch.key];
                  const chVal = chData ? (metricMode === 'units' ? chData.units : chData.revenue) : 0;
                  const pct = total > 0 ? (chVal / total) * 100 : 0;

                  if (pct <= 0) return null;

                  return (
                    <div
                      key={ch.key}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: ch.color,
                      }}
                      className="h-full transition-all duration-300 hover:brightness-110 cursor-pointer relative group flex items-center justify-center text-[10px] font-mono font-bold text-white overflow-hidden px-0.5"
                      onMouseEnter={() =>
                        setHoveredInfo({
                          cat: catRow.category,
                          chKey: ch.shortLabel,
                          val: chVal,
                          share: pct,
                        })
                      }
                      onMouseLeave={() => setHoveredInfo(null)}
                      title={`${catRow.category} • ${ch.shortLabel}: ${
                        metricMode === 'units'
                          ? `${chVal.toLocaleString()} pcs`
                          : `৳${Math.round(chVal).toLocaleString()}`
                      } (${pct.toFixed(1)}%)`}
                    >
                      {pct >= 12 && (
                        <span className="truncate drop-shadow-xs">
                          {pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip feedback bar */}
      {hoveredInfo && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#161616] border border-slate-200/80 dark:border-[#222222] text-xs flex items-center justify-between font-mono animate-in fade-in duration-150">
          <span className="text-slate-700 dark:text-slate-300">
            {hoveredInfo.cat} • <span className="font-bold text-primary">{hoveredInfo.chKey}</span>
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            {metricMode === 'units'
              ? `${hoveredInfo.val.toLocaleString()} pcs`
              : `৳${Math.round(hoveredInfo.val).toLocaleString()}`}{' '}
            ({hoveredInfo.share.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}
