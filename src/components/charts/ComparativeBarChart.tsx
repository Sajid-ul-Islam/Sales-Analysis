"use client";

import React from 'react';
import { Target, Zap } from 'lucide-react';

export interface ComparativeItem {
  id: string;
  name: string;
  status?: string;
  primaryValue: number; // e.g. Ad Spend
  secondaryValue: number; // e.g. Revenue
  badgeText?: string;
  subText?: string;
}

interface ComparativeBarChartProps {
  items: ComparativeItem[];
  title: string;
  subtitle?: string;
  primaryLabel: string;
  secondaryLabel: string;
  formatValue?: (v: number) => string;
}

export function ComparativeBarChart({
  items,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  formatValue = (v) => `৳${Math.round(v).toLocaleString()}`,
}: ComparativeBarChartProps) {
  // Find maximum across all secondaryValues to scale bars
  const maxBarValue = Math.max(
    ...items.map((i) => Math.max(i.primaryValue, i.secondaryValue)),
    1
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-headline text-sm font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>{primaryLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{secondaryLabel}</span>
          </div>
        </div>
      </div>

      {/* Bar List */}
      <div className="space-y-4">
        {items.map((item) => {
          const primaryPercent = Math.min(100, Math.max(3, (item.primaryValue / maxBarValue) * 100));
          const secondaryPercent = Math.min(100, Math.max(3, (item.secondaryValue / maxBarValue) * 100));
          const roasRatio = item.primaryValue > 0 ? (item.secondaryValue / item.primaryValue).toFixed(1) : null;

          return (
            <div key={item.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 space-y-2 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">{item.name}</span>
                  {item.status && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                      item.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  )}
                </div>

                {/* ROAS Badge */}
                {(item.badgeText || roasRatio) && (
                  <span className="font-headline font-bold text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 shrink-0 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-purple-600" />
                    {item.badgeText || `${roasRatio}x ROAS`}
                  </span>
                )}
              </div>

              {/* Comparative Dual Bar */}
              <div className="space-y-1.5">
                {/* Secondary Bar (Revenue) */}
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

                {/* Primary Bar (Spend) */}
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
    </div>
  );
}
