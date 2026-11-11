"use client";

import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign, Layers } from 'lucide-react';

export interface ChannelBarData {
  key: string;
  label: string;
  shortLabel: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  units: number;
  color: string;
}

interface ChannelComparisonBarChartProps {
  channels: ChannelBarData[];
  title?: string;
  className?: string;
}

type MetricMode = 'all' | 'revenue' | 'profit' | 'units';

export function ChannelComparisonBarChart({
  channels,
  title = "5-Channel Commercial Performance Comparison",
  className = "",
}: ChannelComparisonBarChartProps) {
  const [metricMode, setMetricMode] = useState<MetricMode>('all');
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  const maxVal = useMemo(() => {
    if (channels.length === 0) return 1;
    if (metricMode === 'units') {
      return Math.max(...channels.map((c) => c.units), 10);
    }
    if (metricMode === 'profit') {
      return Math.max(...channels.map((c) => c.profit), 1000);
    }
    if (metricMode === 'revenue') {
      return Math.max(...channels.map((c) => c.revenue), 1000);
    }
    return Math.max(...channels.map((c) => Math.max(c.revenue, c.cogs, c.profit)), 1000);
  }, [channels, metricMode]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.key === hoveredChannel),
    [channels, hoveredChannel]
  );

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Online E-Commerce vs Mirpur, Cumilla, Wari, and Sylhet Outlets
            </p>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-0.5 border border-slate-200/80 dark:border-[#222222] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricMode('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'all'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Overview (Sales/Cost/Profit)
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
            Sales (৳)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('profit')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'profit'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Profit (৳)
          </button>
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
        </div>
      </div>

      {/* Chart Legend */}
      {metricMode === 'all' && (
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-500 dark:bg-sky-400" />
            <span>Net Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700" />
            <span>COGS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
            <span>Gross Profit</span>
          </div>
        </div>
      )}

      {/* Visual Bars Container */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
        {channels.map((ch) => {
          const revPct = Math.min(100, Math.round((ch.revenue / maxVal) * 100));
          const cogsPct = Math.min(100, Math.round((ch.cogs / maxVal) * 100));
          const profitPct = Math.min(100, Math.round((ch.profit / maxVal) * 100));
          const unitsPct = Math.min(100, Math.round((ch.units / maxVal) * 100));
          const isHovered = hoveredChannel === ch.key;

          return (
            <div
              key={ch.key}
              onMouseEnter={() => setHoveredChannel(ch.key)}
              onMouseLeave={() => setHoveredChannel(null)}
              className={`relative flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-orange-50/50 dark:bg-orange-950/20 border-primary shadow-xs'
                  : 'bg-slate-50/60 dark:bg-[#121212] border-slate-200/70 dark:border-[#1F1F1F] hover:border-slate-300 dark:hover:border-[#333333]'
              }`}
            >
              {/* Top Header */}
              <div className="flex items-center justify-between gap-1 mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {ch.shortLabel}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: `${ch.color}15`,
                    color: ch.color,
                  }}
                >
                  {(ch.margin * 100).toFixed(1)}% Mgn
                </span>
              </div>

              {/* Bar visualization area (Height ~140px) */}
              <div className="h-32 flex items-end justify-center gap-1.5 py-1">
                {metricMode === 'all' && (
                  <>
                    {/* Revenue Bar */}
                    <div className="w-1/3 flex flex-col items-center h-full justify-end group">
                      <span className="text-[9px] font-mono font-bold text-slate-500 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        ৳{Math.round(ch.revenue / 1000)}k
                      </span>
                      <div
                        style={{ height: `${Math.max(8, revPct)}%` }}
                        className="w-full bg-sky-500 dark:bg-sky-400 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        title={`Net Sales: ৳${Math.round(ch.revenue).toLocaleString()}`}
                      />
                    </div>

                    {/* COGS Bar */}
                    <div className="w-1/3 flex flex-col items-center h-full justify-end group">
                      <span className="text-[9px] font-mono font-bold text-slate-500 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        ৳{Math.round(ch.cogs / 1000)}k
                      </span>
                      <div
                        style={{ height: `${Math.max(8, cogsPct)}%` }}
                        className="w-full bg-slate-300 dark:bg-slate-700 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        title={`COGS: ৳${Math.round(ch.cogs).toLocaleString()}`}
                      />
                    </div>

                    {/* Profit Bar */}
                    <div className="w-1/3 flex flex-col items-center h-full justify-end group">
                      <span className="text-[9px] font-mono font-bold text-slate-500 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        ৳{Math.round(ch.profit / 1000)}k
                      </span>
                      <div
                        style={{ height: `${Math.max(8, profitPct)}%` }}
                        className="w-full bg-emerald-500 dark:bg-emerald-400 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                        title={`Gross Profit: ৳${Math.round(ch.profit).toLocaleString()}`}
                      />
                    </div>
                  </>
                )}

                {metricMode === 'revenue' && (
                  <div className="w-full flex flex-col items-center h-full justify-end">
                    <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 mb-1">
                      ৳{Math.round(ch.revenue).toLocaleString()}
                    </span>
                    <div
                      style={{ height: `${Math.max(10, revPct)}%` }}
                      className="w-10 bg-sky-500 dark:bg-sky-400 rounded-t-md transition-all duration-300 shadow-2xs"
                    />
                  </div>
                )}

                {metricMode === 'profit' && (
                  <div className="w-full flex flex-col items-center h-full justify-end">
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      ৳{Math.round(ch.profit).toLocaleString()}
                    </span>
                    <div
                      style={{ height: `${Math.max(10, profitPct)}%` }}
                      className="w-10 bg-emerald-500 dark:bg-emerald-400 rounded-t-md transition-all duration-300 shadow-2xs"
                    />
                  </div>
                )}

                {metricMode === 'units' && (
                  <div className="w-full flex flex-col items-center h-full justify-end">
                    <span className="text-[10px] font-mono font-bold text-primary mb-1">
                      {ch.units.toLocaleString()} pcs
                    </span>
                    <div
                      style={{ height: `${Math.max(10, unitsPct)}%` }}
                      className="w-10 bg-primary rounded-t-md transition-all duration-300 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              {/* Bottom Quick Card Footer */}
              <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-[#222222] flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Net Sales:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  ৳{Math.round(ch.revenue).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hover Info Tooltip Bar */}
      {activeChannel && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-[#222222] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeChannel.color }} />
            <span className="font-bold text-slate-900 dark:text-white font-headline">
              {activeChannel.label}:
            </span>
            <span className="text-slate-500">
              {activeChannel.units.toLocaleString()} units sold
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <span className="text-sky-600 dark:text-sky-400">
              Sales: ৳{Math.round(activeChannel.revenue).toLocaleString()}
            </span>
            <span className="text-slate-400">
              COGS: ৳{Math.round(activeChannel.cogs).toLocaleString()}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Profit: ৳{Math.round(activeChannel.profit).toLocaleString()} ({(activeChannel.margin * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
