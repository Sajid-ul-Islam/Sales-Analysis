"use client";

import React, { useState, useMemo } from 'react';
import { LiveCategoryItem, DEFAULT_DEEN_OPS_CATEGORY_ITEMS } from '@/lib/liveOpsProcessor';

interface LiveVolumeBarChartProps {
  items: LiveCategoryItem[];
  avgUnitsSold: number;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export function LiveVolumeBarChart({
  items,
  avgUnitsSold,
  selectedCategory,
  onSelectCategory,
}: LiveVolumeBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If items has elements, use them; if empty with avgUnitsSold === 0, render empty state; otherwise fallback
  const sourceItems = useMemo(() => {
    const hasRealItems = Boolean(items && items.length > 0);
    return hasRealItems ? items : (avgUnitsSold === 0 ? [] : DEFAULT_DEEN_OPS_CATEGORY_ITEMS);
  }, [items, avgUnitsSold]);

  // Order categories: Strictly from large to small by volume (units sold)
  const displayItems = useMemo(() => {
    return [...sourceItems]
      .sort((a, b) => {
        if (b.volume !== a.volume) {
          return b.volume - a.volume;
        }
        return b.revenue - a.revenue;
      })
      .slice(0, 9);
  }, [sourceItems]);

  if (sourceItems.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center p-6 text-center select-none w-full min-h-[280px]">
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#1A1A1A] flex items-center justify-center text-2xl mb-2 text-slate-400">
          📊
        </div>
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          No volume data
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Zero items dispatched for category analysis
        </div>
      </div>
    );
  }

  const maxActualVolume = displayItems.reduce((max, item) => Math.max(max, item.volume), 0);
  const maxVolume = Math.max(14, Math.ceil(maxActualVolume / 2) * 2);
  const chartHeight = 310;
  const chartWidth = 560;
  const paddingLeft = 40;
  const paddingBottom = 55;
  const paddingTop = 22;
  const paddingRight = 48;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const slotWidth = innerWidth / (displayItems.length || 1);
  const barWidth = Math.min(42, slotWidth * 0.76);

  // Y-axis grid ticks (e.g. 0, 2, 4, 6, 8, 10, 12, 14)
  const yTicks = useMemo(() => {
    const step = maxVolume <= 14 ? 2 : Math.ceil(maxVolume / 7 / 2) * 2;
    const ticks: number[] = [];
    for (let t = 0; t <= maxVolume; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [maxVolume]);

  const getYCoord = (vol: number) => {
    return paddingTop + innerHeight - (vol / maxVolume) * innerHeight;
  };

  const effectiveAvg = avgUnitsSold > 0 ? avgUnitsSold : 3.8;
  const avgY = getYCoord(effectiveAvg);
  const active = hoveredIdx !== null ? displayItems[hoveredIdx] : null;

  const CANONICAL_BAR_COLORS: Record<string, string> = {
    'Jeans': '#f43f5e',
    'Twill Five Pockets': '#f97316',
    'Twill': '#f97316',
    'T-Shirt': '#e11d48',
    'Casual': '#a855f7',
    'Polo': '#60a5fa',
    'Cargo': '#14b8a6',
    'Hoodie': '#f59e0b',
    'Trousers': '#fb923c',
    'Denim Jacket': '#f43f5e',
    'Jacket': '#f43f5e',
  };

  return (
    <div className="relative flex flex-col p-2 select-none w-full">
      <div className="w-full overflow-x-auto min-w-0">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto max-h-[380px] overflow-visible"
        >
          {/* Y-axis gridlines and labels */}
          {yTicks.map((tick) => {
            const y = getYCoord(tick);
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="stroke-slate-200 dark:stroke-[#222222] text-slate-200 dark:text-[#222222]"
                  strokeWidth="0.8"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize="9.5"
                  fill="currentColor"
                  className="fill-slate-500 dark:fill-white text-slate-500 dark:text-white font-bold transition-colors"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y-axis Title */}
          <text
            x={12}
            y={chartHeight / 2 - 15}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fill="currentColor"
            className="fill-slate-500 dark:fill-white text-slate-500 dark:text-white font-bold transition-colors"
            transform={`rotate(-90, 12, ${chartHeight / 2 - 15})`}
          >
            Units Sold
          </text>

          {/* Average Benchmark Dashed Line (Avg: 3.8 un) */}
          <g>
            <line
              x1={paddingLeft}
              y1={avgY}
              x2={chartWidth - paddingRight}
              y2={avgY}
              stroke="currentColor"
              className="stroke-slate-500 dark:stroke-slate-400 text-slate-500 dark:text-slate-400"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.85"
            />
            <text
              x={chartWidth - paddingRight + 4}
              y={avgY}
              textAnchor="start"
              dominantBaseline="central"
              fontSize="9.5"
              fill="currentColor"
              className="fill-slate-600 dark:fill-white text-slate-600 dark:text-white font-bold transition-colors"
            >
              Avg: {effectiveAvg} un
            </text>
          </g>

          {/* Vertical Category Volume Bars */}
          {displayItems.map((item, idx) => {
            const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
            const totalVol = item.volume;
            const isStackedJeans = (item.displayName === 'Jeans' || item.name === 'Jeans') && item.selectsVolume > 0;
            const selVol = isStackedJeans ? item.selectsVolume : 0;
            const regVol = isStackedJeans ? (item.regularVolume || totalVol - selVol) : totalVol;

            const totalHeight = (totalVol / maxVolume) * innerHeight;
            const regHeight = (regVol / maxVolume) * innerHeight;
            const selHeight = (selVol / maxVolume) * innerHeight;

            const bottomY = paddingTop + innerHeight;
            const regY = bottomY - regHeight;
            const selY = regY - selHeight;

            const isHovered = hoveredIdx === idx;

            // X-axis label: Shorten "Twill Five Pockets" to "Twill", and show strictly "Jacket" (never "Denim Jacket")
            const rawLabel = item.displayName || item.name;
            let xLabel = rawLabel;
            if (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test(rawLabel.trim())) {
              xLabel = 'Twill';
            } else if (/^Denim\s+Jacket$/i.test(rawLabel.trim()) || rawLabel.trim() === 'Jacket') {
              xLabel = 'Jacket';
            }

            const isSelected = Boolean(
              selectedCategory &&
              selectedCategory !== 'ALL' &&
              (selectedCategory === item.name ||
                selectedCategory === item.displayName ||
                (selectedCategory === 'Twill' && /^Twill/i.test(rawLabel)) ||
                (selectedCategory === 'Jacket' && /Jacket/i.test(rawLabel)))
            );
            const isDimmed = Boolean(selectedCategory && selectedCategory !== 'ALL' && !isSelected);

            // Bar color
            const barFillColor = CANONICAL_BAR_COLORS[xLabel] || CANONICAL_BAR_COLORS[item.displayName] || CANONICAL_BAR_COLORS[item.name] || item.color;

            return (
              <g
                key={`bar-${item.name}-${idx}`}
                className="cursor-pointer transition-all duration-300"
                onClick={() => onSelectCategory && onSelectCategory(item.name)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Regular Volume Bar (Bottom Segment) */}
                {regVol > 0 && (
                  <rect
                    x={x}
                    y={regY}
                    width={barWidth}
                    height={regHeight}
                    rx={selVol > 0 ? 0 : 3}
                    fill={barFillColor}
                    opacity={isDimmed ? 0.35 : (isHovered || isSelected ? 1 : 0.95)}
                    filter={isHovered || isSelected ? 'brightness(1.1) drop-shadow(0 2px 6px rgba(0,0,0,0.2))' : undefined}
                  />
                )}

                {/* Selects Volume Bar (Top Stacked Segment - e.g. for Jeans) */}
                {selVol > 0 && (
                  <rect
                    x={x}
                    y={selY}
                    width={barWidth}
                    height={selHeight}
                    rx={3}
                    fill="#facc15"
                    opacity={isDimmed ? 0.35 : (isHovered || isSelected ? 1 : 0.95)}
                    filter={isHovered || isSelected ? 'brightness(1.1) drop-shadow(0 2px 6px rgba(0,0,0,0.2))' : undefined}
                  />
                )}

                {/* Inner text for Selects segment (e.g. '3' in yellow segment) */}
                {selVol > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={selY + selHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill="#713f12"
                  >
                    {selVol}
                  </text>
                )}

                {/* Inner text for Regular segment (e.g. '11' in red segment, or '5', '4', '3', '2', '1') */}
                {regVol > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={regY + regHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill="#ffffff"
                  >
                    {regVol}
                  </text>
                )}

                {/* X-axis Category Label (Rotated -45 degrees) */}
                <text
                  x={x + barWidth / 2}
                  y={bottomY + 12}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight={isHovered ? '900' : 'bold'}
                  fill="currentColor"
                  className={`${isHovered ? 'fill-slate-900 text-slate-900 font-black' : 'fill-slate-600 text-slate-600 font-bold'} dark:fill-white dark:text-white transition-colors`}
                  transform={`rotate(-45, ${x + barWidth / 2}, ${bottomY + 12})`}
                >
                  {xLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {active && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 text-white px-3 py-2 rounded-xl text-[11px] shadow-xl border border-slate-700/50 backdrop-blur-xs min-w-[150px] transition-all animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: '12px',
              right: '12px',
            }}
          >
            <div className="font-bold text-white flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1">
              <span>{/^Denim\s+Jacket$/i.test((active.displayName || active.name).trim()) ? 'Jacket' : (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test((active.displayName || active.name).trim()) ? 'Twill' : (active.displayName || active.name))}</span>
              <span className="text-amber-400 font-black">{active.volume} units</span>
            </div>
            <div className="space-y-0.5 text-slate-300">
              <div className="flex justify-between">
                <span>📦 Total Sold:</span>
                <span className="font-bold text-sky-300">{active.volume} units</span>
              </div>
              <div className="flex justify-between">
                <span>💎 Selects:</span>
                <span className="font-semibold text-emerald-400">{active.selectsVolume} units</span>
              </div>
              <div className="flex justify-between">
                <span>📦 Regular:</span>
                <span className="font-semibold text-blue-300">{active.regularVolume} units</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
