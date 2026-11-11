"use client";

import React, { useState, useMemo } from 'react';
import { Ruler, AlertCircle } from 'lucide-react';
import { ProductAnalyticsItem } from '@/lib/productAnalytics';

interface SizeRunHistogramChartProps {
  products: ProductAnalyticsItem[];
  title?: string;
  className?: string;
}

interface AggregatedSize {
  size: string;
  delivered: number;
  returned: number;
  total: number;
  returnRate: number;
}

export function SizeRunHistogramChart({
  products,
  title = "Omnichannel Size Run & Fit Return Distribution",
  className = "",
}: SizeRunHistogramChartProps) {
  const [sizeType, setSizeType] = useState<'all' | 'waist' | 'alpha'>('all');

  // Aggregate size metrics from all products
  const aggregatedSizes = useMemo(() => {
    const map = new Map<string, { delivered: number; returned: number }>();

    products.forEach((p) => {
      if (p.sizes && p.sizes.length > 0) {
        p.sizes.forEach((s) => {
          const raw = s.size.trim().toUpperCase();
          if (!map.has(raw)) {
            map.set(raw, { delivered: 0, returned: 0 });
          }
          const cur = map.get(raw)!;
          cur.delivered += s.deliveredUnits;
          cur.returned += s.returnedUnits;
        });
      }
    });

    const list: AggregatedSize[] = [];
    map.forEach((val, size) => {
      const total = val.delivered + val.returned;
      const returnRate = total > 0 ? (val.returned / total) * 100 : 0;
      list.push({
        size,
        delivered: Math.max(0, val.delivered),
        returned: val.returned,
        total,
        returnRate,
      });
    });

    // Custom sorting: Numeric sizes first (28, 30, 32, 34, 36, 38), then Alpha (XS, S, M, L, XL, XXL, 3XL)
    const alphaOrder: Record<string, number> = {
      XS: 1,
      S: 2,
      M: 3,
      L: 4,
      XL: 5,
      XXL: 6,
      '2XL': 6,
      '3XL': 7,
      '4XL': 8,
    };

    return list.sort((a, b) => {
      const aNum = parseInt(a.size, 10);
      const bNum = parseInt(b.size, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum) && isNaN(bNum)) return -1;
      if (isNaN(aNum) && !isNaN(bNum)) return 1;
      return (alphaOrder[a.size] || 99) - (alphaOrder[b.size] || 99);
    });
  }, [products]);

  // Filter based on sizeType tab
  const filteredSizes = useMemo(() => {
    if (sizeType === 'waist') {
      return aggregatedSizes.filter((s) => !isNaN(parseInt(s.size, 10)));
    }
    if (sizeType === 'alpha') {
      return aggregatedSizes.filter((s) => isNaN(parseInt(s.size, 10)));
    }
    return aggregatedSizes.slice(0, 12);
  }, [aggregatedSizes, sizeType]);

  const maxUnits = useMemo(() => {
    return Math.max(...filteredSizes.map((s) => s.total), 10);
  }, [filteredSizes]);

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Units sold vs returned by apparel size to pinpoint fit & sizing defects
            </p>
          </div>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-[#141414] rounded-xl p-0.5 border border-slate-200/80 dark:border-[#222222] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSizeType('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sizeType === 'all'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Sizes
          </button>
          <button
            type="button"
            onClick={() => setSizeType('waist')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sizeType === 'waist'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Waist (28–38)
          </button>
          <button
            type="button"
            onClick={() => setSizeType('alpha')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sizeType === 'alpha'
                ? 'bg-white dark:bg-[#202020] text-primary shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tops (S–XXL)
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
          <span>Delivered / Kept</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-rose-500 dark:bg-rose-400" />
          <span>Returned (RTO)</span>
        </div>
      </div>

      {/* Histogram Bars */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 pt-2">
        {filteredSizes.map((s) => {
          const delivPct = Math.min(100, Math.round((s.delivered / maxUnits) * 100));
          const retPct = Math.min(100, Math.round((s.returned / maxUnits) * 100));
          const isHighReturn = s.returnRate >= 25;

          return (
            <div
              key={s.size}
              className="flex flex-col items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-[#121212] border border-slate-200/70 dark:border-[#1F1F1F] hover:border-slate-300 dark:hover:border-[#333333] transition-all"
            >
              {/* Return Rate Pill */}
              <span
                className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded mb-1 ${
                  isHighReturn
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-slate-200/70 text-slate-600 dark:bg-[#202020] dark:text-slate-400'
                }`}
                title={`Return Rate: ${s.returnRate.toFixed(1)}%`}
              >
                {s.returnRate.toFixed(0)}%
              </span>

              {/* Vertical Stacked/Dual Bars (Height ~100px) */}
              <div className="h-24 w-full flex items-end justify-center gap-1 py-1">
                {/* Delivered Bar */}
                <div
                  style={{ height: `${Math.max(8, delivPct)}%` }}
                  className="w-1/2 bg-emerald-500 dark:bg-emerald-400 rounded-t-sm transition-all duration-300"
                  title={`Delivered: ${s.delivered} pcs`}
                />
                {/* Returned Bar */}
                <div
                  style={{ height: `${Math.max(8, retPct)}%` }}
                  className="w-1/2 bg-rose-500 dark:bg-rose-400 rounded-t-sm transition-all duration-300"
                  title={`Returned: ${s.returned} pcs`}
                />
              </div>

              {/* Size Label */}
              <span className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1.5">
                {s.size}
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                {s.total} pcs
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
