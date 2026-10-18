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

  const maxActualVolume = displayItems.reduce((max, item) => Math.max(max, item.volume), 0);
  const maxVolume = Math.max(14, Math.ceil(maxActualVolume / 2) * 2);

  // Y-axis grid ticks (e.g. 0, 2, 4, 6, 8, 10, 12, 14)
  const yTicks = useMemo(() => {
    const step = maxVolume <= 14 ? 2 : Math.ceil(maxVolume / 7 / 2) * 2;
    const ticks: number[] = [];
    for (let t = 0; t <= maxVolume; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [maxVolume]);

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

  const chartHeight = 340;
  const chartWidth = 580;
  const paddingLeft = 36;
  const paddingBottom = 58;
  const paddingTop = 22;
  const paddingRight = 48;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const slotWidth = innerWidth / (displayItems.length || 1);
  const barWidth = Math.min(48, slotWidth * 0.82);

  const getYCoord = (vol: number) => {
    return paddingTop + innerHeight - (vol / maxVolume) * innerHeight;
  };

  const effectiveAvg = avgUnitsSold > 0 ? avgUnitsSold : 3.8;
  const avgY = getYCoord(effectiveAvg);
  const active = hoveredIdx !== null ? displayItems[hoveredIdx] : null;

  const CANONICAL_BAR_COLORS: Record<string, string> = {
    'Jeans': '#f43f5e',
    'Twill Five Pockets': '#f97316',
    '5-Pocket Twill': '#f97316',
    'Twill': '#f97316',
    'T-Shirt': '#e11d48',
    'Casual': '#a855f7',
    'Polo': '#60a5fa',
    'Cargo': '#14b8a6',
    'Hoodie': '#f59e0b',
    'Trousers': '#fb923c',
    'Denim Jacket': '#f43f5e',
    'Jacket': '#f43f5e',
    'Wallet': '#d97706',
  };

  return (
    <div className="relative flex flex-col p-1 select-none w-full">
      <div className="w-full overflow-x-auto min-w-0">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto max-h-[420px] overflow-visible"
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
                  fontSize="10"
                  fill="currentColor"
                  className="fill-slate-500 dark:fill-white text-slate-500 dark:text-white font-black transition-colors"
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
            fontSize="10.5"
            fill="currentColor"
            className="fill-slate-500 dark:fill-white text-slate-500 dark:text-white font-black transition-colors"
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
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.85"
            />
            <text
              x={chartWidth - paddingRight + 4}
              y={avgY}
              textAnchor="start"
              dominantBaseline="central"
              fontSize="10.5"
              fill="currentColor"
              className="fill-slate-700 dark:fill-white text-slate-700 dark:text-white font-black transition-colors"
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
            const regHeight = (regVol / maxVolume) * innerHeight;
            const selHeight = (selVol / maxVolume) * innerHeight;

            const bottomY = paddingTop + innerHeight;
            const regY = bottomY - regHeight;
            const selY = regY - selHeight;

            const isHovered = hoveredIdx === idx;

            // X-axis label: Unify all Twill categories to strictly "Twill", and show strictly "Jacket" (never "Denim Jacket")
            const rawLabel = item.displayName || item.name;
            let xLabel = rawLabel;
            if (/^Twill(\s+(Five\s+Pockets?|5\s*Pockets?))?$/i.test(rawLabel.trim()) || /^5\s*Pockets?$/i.test(rawLabel.trim())) {
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
                    filter={isHovered || isSelected ? 'brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,0.25))' : undefined}
                    style={{
                      transformOrigin: `${x + barWidth / 2}px ${bottomY}px`,
                      transform: isHovered || isSelected ? 'scaleX(1.06) scaleY(1.02)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                    }}
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
                    filter={isHovered || isSelected ? 'brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,0.25))' : undefined}
                    style={{
                      transformOrigin: `${x + barWidth / 2}px ${bottomY}px`,
                      transform: isHovered || isSelected ? 'scaleX(1.06) scaleY(1.02)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                    }}
                  />
                )}

                {/* Overhead Floating Volume Pill Badge (Smoothly appears on hover) */}
                <g
                  pointerEvents="none"
                  style={{
                    transformOrigin: `${x + barWidth / 2}px ${Math.min(selY, regY) - 10}px`,
                    transform: isHovered ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(6px)',
                    opacity: isHovered ? 1 : 0,
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <rect
                    x={x + barWidth / 2 - 23}
                    y={Math.min(selY, regY) - 24}
                    width={46}
                    height={20}
                    rx={6}
                    className="fill-slate-900 dark:fill-white shadow-lg"
                  />
                  <text
                    x={x + barWidth / 2}
                    y={Math.min(selY, regY) - 14}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11.5"
                    fontWeight="900"
                    className="fill-white dark:fill-slate-900 font-headline"
                  >
                    {totalVol} un
                  </text>
                </g>

                {/* Inner text for Selects segment (Smoothly enlarges on hover) */}
                {selVol > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={selY + selHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isHovered ? "13.5" : "11"}
                    fontWeight="900"
                    fill="#713f12"
                    pointerEvents="none"
                    style={{
                      transformOrigin: `${x + barWidth / 2}px ${selY + selHeight / 2}px`,
                      transform: isHovered ? 'scale(1.22)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), font-size 0.2s ease',
                    }}
                  >
                    {selVol}
                  </text>
                )}

                {/* Inner text for Regular segment (Smoothly enlarges on hover) */}
                {regVol > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={regY + regHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isHovered ? "13.5" : "11"}
                    fontWeight="900"
                    fill="#ffffff"
                    pointerEvents="none"
                    className="drop-shadow-sm"
                    style={{
                      transformOrigin: `${x + barWidth / 2}px ${regY + regHeight / 2}px`,
                      transform: isHovered ? 'scale(1.22)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), font-size 0.2s ease',
                    }}
                  >
                    {regVol}
                  </text>
                )}

                {/* X-axis Category Label with Smooth Hover Scaling */}
                <g
                  pointerEvents="none"
                  style={{
                    transformOrigin: `${x + barWidth / 2}px ${bottomY + 12}px`,
                    transform: `rotate(-45deg) scale(${isHovered ? 1.25 : 1})`,
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <text
                    x={x + barWidth / 2}
                    y={bottomY + 12}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={isHovered ? "12.5" : "11"}
                    fontWeight={isHovered ? '900' : 'bold'}
                    fill="currentColor"
                    className={`${
                      isHovered
                        ? 'fill-blue-600 text-blue-600 dark:fill-sky-400 dark:text-sky-400 font-black'
                        : 'fill-slate-600 text-slate-600 font-bold'
                    } dark:fill-white dark:text-white transition-colors duration-200`}
                  >
                    {xLabel}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip - Elevated with larger typography and smooth transitions */}
        {active && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 dark:bg-black/95 text-white px-3.5 py-2.5 rounded-2xl text-xs shadow-2xl border border-slate-700/60 dark:border-[#333333] backdrop-blur-md min-w-[170px] transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
            style={{
              top: '12px',
              right: '12px',
            }}
          >
            <div className="font-headline font-black text-white text-xs sm:text-sm flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
              <span>
                {/^Denim\s+Jacket$/i.test((active.displayName || active.name).trim())
                  ? 'Jacket'
                  : (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test((active.displayName || active.name).trim())
                    ? 'Twill'
                    : (active.displayName || active.name))}
              </span>
              <span className="text-amber-400 font-black text-sm">{active.volume} units</span>
            </div>
            <div className="space-y-1 text-slate-300 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">📦 Total Sold:</span>
                <span className="font-black text-sky-400 text-xs sm:text-sm">{active.volume} units</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">💎 Selects:</span>
                <span className="font-bold text-emerald-400 text-xs sm:text-sm">{active.selectsVolume} units</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">📦 Regular:</span>
                <span className="font-semibold text-blue-300 text-xs">{active.regularVolume} units</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
