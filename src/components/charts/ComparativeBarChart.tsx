"use client";

import React, { useState } from 'react';
import { Target, Zap, BarChart2, AlignLeft } from 'lucide-react';

export interface ComparativeItem {
  id: string;
  name: string;
  status?: string;
  primaryValue: number; // e.g. Returned Units or Ad Spend
  secondaryValue: number; // e.g. Retained Units or Revenue
  badgeText?: string;
  subText?: string;
}

export interface ComparativeBarChartProps {
  items: ComparativeItem[];
  title: string;
  subtitle?: string;
  primaryLabel: string;
  secondaryLabel: string;
  formatValue?: (v: number) => string;
  orientation?: 'vertical' | 'horizontal';
  allowToggleOrientation?: boolean;
}

export function ComparativeBarChart({
  items,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  formatValue = (v) => `৳${Math.round(v).toLocaleString()}`,
  orientation = 'horizontal',
  allowToggleOrientation = true,
}: ComparativeBarChartProps) {
  const [currentOrientation, setCurrentOrientation] = useState<'vertical' | 'horizontal'>(orientation);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Find maximum across all values to scale bars/columns
  const rawMaxValue = Math.max(
    ...items.map((i) => Math.max(i.primaryValue, i.secondaryValue)),
    1
  );

  // Add 18% headroom for vertical column charts so top numbers and bars have clean breathing room
  const maxBarValue = currentOrientation === 'vertical' ? Math.ceil(rawMaxValue * 1.18) : rawMaxValue;

  // Compute 4 grid intervals for the perpendicular chart Y-axis
  const yTicks = [
    Math.round(maxBarValue),
    Math.round(maxBarValue * 0.75),
    Math.round(maxBarValue * 0.5),
    Math.round(maxBarValue * 0.25),
    0
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {/* Header with Title, Legend & Orientation Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-headline text-sm font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>{secondaryLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>{primaryLabel}</span>
            </div>
          </div>

          {/* Orientation Toggle Switcher */}
          {allowToggleOrientation && (
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setCurrentOrientation('vertical')}
                className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentOrientation === 'vertical'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Perpendicular Vertical Column Chart"
              >
                <BarChart2 className="w-3.5 h-3.5 text-primary rotate-90" />
                <span className="hidden md:inline text-[11px]">Columns</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentOrientation('horizontal')}
                className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentOrientation === 'horizontal'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Horizontal Bar Chart"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Horizontal</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. PERPENDICULAR (VERTICAL COLUMN) CHART VIEW */}
      {currentOrientation === 'vertical' ? (
        <div className="pt-4 pb-2">
          {/* Chart Canvas with Y-Axis and Dotted Reference Grid */}
          <div className="relative min-w-0">
            {/* Background Grid Lines & Y-Axis Labels */}
            <div className="absolute inset-x-0 top-6 bottom-24 flex flex-col justify-between pointer-events-none z-0">
              {yTicks.map((tick, idx) => (
                <div key={idx} className="flex items-center w-full">
                  <span className="text-[10px] font-mono text-slate-400 w-11 text-right pr-2 shrink-0 select-none">
                    {tick.toLocaleString()}
                  </span>
                  <div className="w-full border-b border-dashed border-slate-200/90 h-px" />
                </div>
              ))}
            </div>

            {/* Perpendicular Columns Container */}
            <div className="relative z-10 pl-12 pt-6 overflow-x-auto min-w-0">
              <div className="flex items-end justify-between gap-3 sm:gap-5 min-w-[580px] pb-1">
                {items.map((item) => {
                  const primaryHeightPercent = Math.min(100, Math.max(4, (item.primaryValue / maxBarValue) * 100));
                  const secondaryHeightPercent = Math.min(100, Math.max(4, (item.secondaryValue / maxBarValue) * 100));
                  const isHovered = hoveredItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      className="group flex flex-col items-center flex-1 min-w-[76px] max-w-[130px] transition-all"
                    >
                      {/* Vertical Column Cluster Container */}
                      <div className="h-52 w-full flex items-end justify-center gap-1.5 sm:gap-2 px-1 relative">
                        {/* Hover Tooltip Info */}
                        {isHovered && (
                          <div className="absolute -top-14 bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg shadow-xl z-30 pointer-events-none whitespace-nowrap animate-in fade-in duration-100 flex flex-col items-center">
                            <span className="font-bold">{item.name}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-slate-300">
                              <span className="text-emerald-400 font-semibold">{secondaryLabel}: {item.secondaryValue}</span>
                              <span>•</span>
                              <span className="text-orange-400 font-semibold">{primaryLabel}: {item.primaryValue}</span>
                            </div>
                            <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1" />
                          </div>
                        )}

                        {/* Secondary Column: Retained Units (Emerald) */}
                        <div className="flex flex-col items-center h-full justify-end relative flex-1 max-w-[32px]">
                          <span className="text-[10px] font-mono font-bold text-emerald-700 mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            {item.secondaryValue > 0 ? item.secondaryValue : ''}
                          </span>
                          <div
                            style={{ height: `${secondaryHeightPercent}%` }}
                            className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 shadow-2xs group-hover:brightness-110 group-hover:shadow-md transition-all duration-300"
                            title={`${secondaryLabel}: ${formatValue(item.secondaryValue)}`}
                          />
                        </div>

                        {/* Primary Column: Returned Units (Orange) */}
                        <div className="flex flex-col items-center h-full justify-end relative flex-1 max-w-[32px]">
                          <span className="text-[10px] font-mono font-bold text-orange-700 mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            {item.primaryValue > 0 ? item.primaryValue : ''}
                          </span>
                          <div
                            style={{ height: `${primaryHeightPercent}%` }}
                            className="w-full rounded-t-lg bg-gradient-to-t from-orange-600 via-orange-500 to-orange-400 shadow-2xs group-hover:brightness-110 group-hover:shadow-md transition-all duration-300"
                            title={`${primaryLabel}: ${formatValue(item.primaryValue)}`}
                          />
                        </div>
                      </div>

                      {/* X-Axis Baseline Rule */}
                      <div className="w-full h-0.5 bg-slate-300 rounded-full mt-2" />

                      {/* X-Axis Category Name, Retention Badge & Subtext */}
                      <div className="flex flex-col items-center text-center mt-2 w-full px-0.5">
                        <span
                          className={`text-xs font-bold truncate max-w-full transition-colors ${
                            isHovered ? 'text-primary' : 'text-slate-800'
                          }`}
                          title={item.name}
                        >
                          {item.name}
                        </span>

                        {item.badgeText && (
                          <span className="mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            {item.badgeText}
                          </span>
                        )}

                        {item.subText && (
                          <span className="mt-0.5 text-[10px] font-mono text-slate-500 font-medium truncate max-w-full">
                            {item.subText}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 2. HORIZONTAL BAR LIST VIEW */
        <div className="space-y-4">
          {items.map((item) => {
            const primaryPercent = Math.min(100, Math.max(3, (item.primaryValue / maxBarValue) * 100));
            const secondaryPercent = Math.min(100, Math.max(3, (item.secondaryValue / maxBarValue) * 100));
            const roasRatio = item.primaryValue > 0 ? (item.secondaryValue / item.primaryValue).toFixed(1) : null;

            return (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 space-y-2 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                      {item.name}
                    </span>
                    {item.status && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    )}
                  </div>

                  {(item.badgeText || roasRatio) && (
                    <span className="font-headline font-bold text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 shrink-0 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-600" />
                      {item.badgeText || `${roasRatio}x ROAS`}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-16 shrink-0">{secondaryLabel}</span>
                    <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${secondaryPercent}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-700 w-24 text-right shrink-0">
                      {formatValue(item.secondaryValue)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-16 shrink-0">{primaryLabel}</span>
                    <div className="w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-orange-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${primaryPercent}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-700 w-24 text-right shrink-0">
                      {formatValue(item.primaryValue)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
