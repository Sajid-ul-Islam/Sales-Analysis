"use client";

import React from 'react';

export interface DonutArc {
  pct: number;
  colorClass: string;
}

export interface MiniDonutChartProps {
  size?: number;
  strokeWidth?: number;
  trackColorClass?: string;
  arcs: DonutArc[];
  tooltip?: string;
  centerText?: string;
  centerTextClass?: string;
  strokeLinecap?: 'round' | 'butt';
  className?: string;
}

/**
 * Responsive, fail-safe SVG donut chart for small KPI cards.
 * Enforces explicit width/height and shrink-0 to prevent viewport distortion (AGENTS.md rule).
 */
export function MiniDonutChart({
  size = 44,
  strokeWidth = 4.5,
  trackColorClass = 'text-slate-100 dark:text-[#222222]',
  arcs,
  tooltip,
  centerText,
  centerTextClass = 'text-slate-700 dark:text-white',
  strokeLinecap,
  className = '',
}: MiniDonutChartProps) {
  let accumulatedOffset = 0;

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={tooltip}
    >
      <svg
        className="-rotate-90 transform shrink-0"
        viewBox="0 0 36 36"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      >
        {/* Base Track */}
        <path
          className={trackColorClass}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />

        {/* Dynamic Arcs */}
        {arcs.map((arc, index) => {
          if (arc.pct <= 0) return null;
          const strokeDash = `${arc.pct} ${100 - arc.pct}`;
          const offset = -accumulatedOffset;
          accumulatedOffset += arc.pct;

          return (
            <path
              key={index}
              className={`${arc.colorClass} transition-all duration-500 ease-out`}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              strokeDashoffset={offset}
              strokeLinecap={strokeLinecap}
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          );
        })}
      </svg>

      {centerText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`text-[10px] font-black font-headline leading-none ${centerTextClass}`}>
            {centerText}
          </span>
        </div>
      )}
    </div>
  );
}
