"use client";

import React, { useState } from 'react';

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  subLabel?: string;
}

interface InteractiveDonutChartProps {
  slices: DonutSlice[];
  title?: string;
  subtitle?: string;
  centerTotalLabel?: string;
  formatValue?: (v: number) => string;
  size?: number; // Default 160
  strokeWidth?: number; // Default 4
  showLegend?: boolean;
}

export function InteractiveDonutChart({
  slices,
  title,
  subtitle,
  centerTotalLabel = 'Total',
  formatValue = (v) => v.toLocaleString(),
  size = 180,
  strokeWidth = 4,
  showLegend = true,
}: InteractiveDonutChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const totalValue = slices.reduce((acc, s) => acc + s.value, 0);

  // Compute percentage and stroke-dash segments (Circumference of r=15.9155 is exactly 100)
  let accumulatedPercent = 0;
  const segments = slices.map((slice) => {
    const sharePercent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0;
    const dashArray = `${sharePercent.toFixed(2)} ${(100 - sharePercent).toFixed(2)}`;
    const dashOffset = -(accumulatedPercent).toFixed(2);
    accumulatedPercent += sharePercent;

    return {
      ...slice,
      sharePercent,
      dashArray,
      dashOffset,
    };
  });

  const activeSlice = hoveredId ? segments.find((s) => s.id === hoveredId) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {(title || subtitle) && (
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            {title && <h3 className="font-headline text-sm font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
            {formatValue(totalValue)}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        {/* SVG Donut */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
          <svg
            className="-rotate-90 transform shrink-0 w-full h-full"
            viewBox="0 0 36 36"
            width={size}
            height={size}
          >
            {/* Background Empty Ring */}
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />

            {/* Colored Segment Arcs */}
            {segments.map((seg) => {
              const isHovered = hoveredId === seg.id;
              const isAnyHovered = hoveredId !== null;

              return (
                <circle
                  key={seg.id}
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 1.2 : strokeWidth}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    opacity: isAnyHovered && !isHovered ? 0.35 : 1,
                  }}
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              );
            })}
          </svg>

          {/* Center Callout Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 line-clamp-1">
              {activeSlice ? activeSlice.label : centerTotalLabel}
            </span>
            <span className="font-headline text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
              {activeSlice ? formatValue(activeSlice.value) : formatValue(totalValue)}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {activeSlice ? `${activeSlice.sharePercent.toFixed(1)}%` : '100%'}
            </span>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="w-full space-y-2 text-xs">
            {segments.map((seg) => {
              const isHovered = hoveredId === seg.id;

              return (
                <div
                  key={seg.id}
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`p-2 rounded-xl transition-all cursor-pointer border ${
                    isHovered
                      ? 'bg-slate-50 border-slate-300 shadow-2xs'
                      : 'border-transparent hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-semibold text-slate-800 truncate">{seg.label}</span>
                    </div>
                    <div className="text-right shrink-0 font-mono flex items-center gap-2">
                      <span className="font-bold text-slate-900">{formatValue(seg.value)}</span>
                      <span className="text-[11px] text-slate-400 font-medium w-10 text-right">
                        {seg.sharePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, seg.sharePercent))}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
