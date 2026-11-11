"use client";

import React, { useState, useMemo } from 'react';
import { PieChart, DollarSign, Package } from 'lucide-react';
import { ChannelBarData } from './ChannelComparisonBarChart';

interface ChannelContributionDonutChartProps {
  channels: ChannelBarData[];
  title?: string;
  className?: string;
}

export function ChannelContributionDonutChart({
  channels,
  title = "Omnichannel Market Share Breakdown",
  className = "",
}: ChannelContributionDonutChartProps) {
  const [metricMode, setMetricMode] = useState<'revenue' | 'units'>('revenue');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const totalValue = useMemo(() => {
    return channels.reduce(
      (sum, ch) => sum + (metricMode === 'revenue' ? ch.revenue : ch.units),
      0
    );
  }, [channels, metricMode]);

  // SVG Donut calculation
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo(() => {
    let accumulatedAngle = 0;
    return channels.map((ch) => {
      const val = metricMode === 'revenue' ? ch.revenue : ch.units;
      const share = totalValue > 0 ? val / totalValue : 0;
      const strokeLength = share * circumference;
      const strokeDashoffset = -accumulatedAngle;
      accumulatedAngle += strokeLength;

      return {
        ...ch,
        val,
        share,
        strokeLength,
        strokeDashoffset,
      };
    });
  }, [channels, metricMode, totalValue, circumference]);

  const activeSlice = useMemo(() => {
    return slices.find((s) => s.key === hoveredKey) || slices[0];
  }, [slices, hoveredKey]);

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header & Toggle */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {metricMode === 'revenue' ? 'Sales Revenue Contribution (BDT)' : 'Volume Contribution (Units Sold)'}
            </p>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-0.5 border border-slate-200/80 dark:border-[#222222]">
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
          <button
            type="button"
            onClick={() => setMetricMode('units')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'units'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Units (pcs)
          </button>
        </div>
      </div>

      {/* Main Content: SVG Donut + Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* SVG Donut */}
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="text-slate-100 dark:text-[#181818]"
              stroke="currentColor"
              strokeWidth="20"
              fill="transparent"
            />
            {slices.map((slice) => {
              const isSelected = hoveredKey === slice.key;
              return (
                <circle
                  key={slice.key}
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={isSelected ? 24 : 20}
                  strokeDasharray={`${slice.strokeLength} ${circumference}`}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="butt"
                  fill="transparent"
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHoveredKey(slice.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })}
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {activeSlice ? activeSlice.shortLabel : 'Total'}
            </span>
            <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
              {activeSlice ? `${(activeSlice.share * 100).toFixed(1)}%` : '100%'}
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {activeSlice
                ? metricMode === 'revenue'
                  ? `৳${Math.round(activeSlice.val).toLocaleString()}`
                  : `${activeSlice.val.toLocaleString()} pcs`
                : ''}
            </span>
          </div>
        </div>

        {/* Legend & Channel Slices List */}
        <div className="flex-1 w-full space-y-2">
          {slices.map((slice) => {
            const isHovered = hoveredKey === slice.key;
            return (
              <div
                key={slice.key}
                onMouseEnter={() => setHoveredKey(slice.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                  isHovered
                    ? 'bg-slate-100 dark:bg-[#181818]'
                    : 'hover:bg-slate-50 dark:hover:bg-[#121212]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-3 h-3 rounded-md shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {slice.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    {metricMode === 'revenue'
                      ? `৳${Math.round(slice.val).toLocaleString()}`
                      : `${slice.val.toLocaleString()} pcs`}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400 w-12 text-right">
                    {(slice.share * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
