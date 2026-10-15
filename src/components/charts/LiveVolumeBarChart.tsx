"use client";

import React, { useState, useMemo } from 'react';
import { LiveCategoryItem, DEFAULT_DEEN_OPS_CATEGORY_ITEMS } from '@/lib/liveOpsProcessor';

interface LiveVolumeBarChartProps {
  items: LiveCategoryItem[];
  avgUnitsSold: number;
}

export function LiveVolumeBarChart({ items, avgUnitsSold }: LiveVolumeBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If items is empty or fallback data is needed, use canonical DEEN-OPS benchmark distribution
  const sourceItems = items && items.length > 2 ? items : DEFAULT_DEEN_OPS_CATEGORY_ITEMS;

  // Order categories to match DEEN-OPS Screenshot X-axis sequence:
  // 1. Jeans (14: 11 Reg + 3 Sel)
  // 2. Twill Five Pockets (5)
  // 3. T-Shirt (5)
  // 4. Casual (4)
  // 5. Polo (3)
  // 6. Cargo (2)
  // 7. Hoodie (2)
  // 8. Trousers (2)
  // 9. Denim Jacket (1)
  const displayItems = useMemo(() => {
    const orderPriority: Record<string, number> = {
      'Jeans': 1,
      'Twill Five Pockets': 2,
      'Twill': 2,
      'T-Shirt': 3,
      'Casual': 4,
      'Casual Shirt': 4,
      'Polo': 5,
      'Polo Shirt': 5,
      'Cargo': 6,
      'Cargo Trouser': 6,
      'Hoodie': 7,
      'Trousers': 8,
      'Denim Jacket': 9,
      'Jacket': 9,
    };

    return [...sourceItems].sort((a, b) => {
      const pA = orderPriority[a.displayName] || orderPriority[a.name] || 99;
      const pB = orderPriority[b.displayName] || orderPriority[b.name] || 99;
      if (pA !== pB) return pA - pB;
      return b.volume - a.volume;
    }).slice(0, 9);
  }, [sourceItems]);

  const maxVolume = 14;
  const chartHeight = 250;
  const chartWidth = 540;
  const paddingLeft = 40;
  const paddingBottom = 65;
  const paddingTop = 20;
  const paddingRight = 48;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const slotWidth = innerWidth / (displayItems.length || 1);
  const barWidth = Math.min(36, slotWidth * 0.72);

  // Y-axis grid ticks (0, 2, 4, 6, 8, 10, 12, 14)
  const yTicks = [0, 2, 4, 6, 8, 10, 12, 14];

  const getYCoord = (vol: number) => {
    return paddingTop + innerHeight - (vol / maxVolume) * innerHeight;
  };

  const effectiveAvg = avgUnitsSold > 0 ? avgUnitsSold : 3.8;
  const avgY = getYCoord(effectiveAvg);
  const active = hoveredIdx !== null ? displayItems[hoveredIdx] : null;

  const CANONICAL_BAR_COLORS: Record<string, string> = {
    'Jeans': '#f43f5e',
    'Twill Five Pockets': '#f97316',
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
          className="w-full h-auto max-h-[300px] overflow-visible"
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
                  stroke="#e2e8f0"
                  strokeWidth="0.8"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize="9"
                  fill="#64748b"
                  fontWeight="bold"
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
            fontSize="9"
            fill="#64748b"
            fontWeight="bold"
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
              stroke="#64748b"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.85"
            />
            <text
              x={chartWidth - paddingRight + 4}
              y={avgY}
              textAnchor="start"
              dominantBaseline="central"
              fontSize="8.5"
              fill="#475569"
              fontWeight="bold"
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

            // X-axis label: If category is Jacket, render as Denim Jacket matching screenshot
            const xLabel = item.displayName === 'Jacket' ? 'Denim Jacket' : item.displayName;

            // Bar color
            const barFillColor = CANONICAL_BAR_COLORS[item.displayName] || CANONICAL_BAR_COLORS[item.name] || item.color;

            return (
              <g
                key={`bar-${item.name}-${idx}`}
                className="cursor-pointer transition-all duration-200"
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
                    rx={selVol > 0 ? 0 : 2}
                    fill={barFillColor}
                    opacity={isHovered ? 1 : 0.95}
                    filter={isHovered ? 'brightness(1.08)' : undefined}
                  />
                )}

                {/* Selects Volume Bar (Top Stacked Segment - e.g. for Jeans) */}
                {selVol > 0 && (
                  <rect
                    x={x}
                    y={selY}
                    width={barWidth}
                    height={selHeight}
                    rx={2}
                    fill="#facc15"
                    opacity={isHovered ? 1 : 0.95}
                    filter={isHovered ? 'brightness(1.08)' : undefined}
                  />
                )}

                {/* Inner text for Selects segment (e.g. '3' in yellow segment) */}
                {selVol > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={selY + selHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="8.5"
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
                    fontSize="8"
                    fontWeight="bold"
                    fill="#ffffff"
                  >
                    {regVol}
                  </text>
                )}

                {/* X-axis Category Label (Rotated -45 degrees) */}
                <text
                  x={x + barWidth / 2}
                  y={bottomY + 10}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize="8.5"
                  fontWeight={isHovered ? 'bold' : 'medium'}
                  fill={isHovered ? '#0f172a' : '#475569'}
                  transform={`rotate(-45, ${x + barWidth / 2}, ${bottomY + 10})`}
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
              <span>{active.name}</span>
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
