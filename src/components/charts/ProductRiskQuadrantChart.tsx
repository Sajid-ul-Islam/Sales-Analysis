"use client";

import React, { useState, useMemo } from 'react';
import { Target, Star, AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import { ProductAnalyticsItem } from '@/lib/productAnalytics';

interface ProductRiskQuadrantChartProps {
  products: ProductAnalyticsItem[];
  title?: string;
  className?: string;
  onSelectProduct?: (product: ProductAnalyticsItem) => void;
}

export function ProductRiskQuadrantChart({
  products,
  title = "Product Portfolio Matrix (Volume vs Return Rate)",
  className = "",
  onSelectProduct,
}: ProductRiskQuadrantChartProps) {
  const [hoveredProduct, setHoveredProduct] = useState<ProductAnalyticsItem | null>(null);

  // Return rate threshold (standard 25% in Bangladesh omnichannel apparel)
  const returnThreshold = 25;

  // Calculate median volume for balanced quadrant division
  const volumes = useMemo(
    () => products.map((p) => p.totalDeliveredUnits).sort((a, b) => a - b),
    [products]
  );
  const medianVolume = useMemo(() => {
    if (volumes.length === 0) return 10;
    const mid = Math.floor(volumes.length / 2);
    return volumes[mid] > 5 ? volumes[mid] : 10;
  }, [volumes]);

  const maxVolume = useMemo(() => {
    return Math.max(...products.map((p) => p.totalDeliveredUnits), 20);
  }, [products]);

  const maxReturnRate = useMemo(() => {
    return Math.max(...products.map((p) => p.returnRate), 60);
  }, [products]);

  // Categorize products into 4 quadrants
  const { stars, riskAlerts, niche, discontinue } = useMemo(() => {
    const s: ProductAnalyticsItem[] = [];
    const r: ProductAnalyticsItem[] = [];
    const n: ProductAnalyticsItem[] = [];
    const d: ProductAnalyticsItem[] = [];

    products.forEach((p) => {
      const isHighVol = p.totalDeliveredUnits >= medianVolume;
      const isHighReturn = p.returnRate >= returnThreshold;

      if (isHighVol && !isHighReturn) s.push(p);
      else if (isHighVol && isHighReturn) r.push(p);
      else if (!isHighVol && !isHighReturn) n.push(p);
      else d.push(p);
    });

    return { stars: s, riskAlerts: r, niche: n, discontinue: d };
  }, [products, medianVolume, returnThreshold]);

  // SVG Chart Dimensions
  const width = 580;
  const height = 320;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const xSplit = padLeft + (medianVolume / maxVolume) * chartW;
  const ySplit = padTop + chartH - (returnThreshold / maxReturnRate) * chartH;

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Identifies core volume drivers vs high-RTO sizing defect items
            </p>
          </div>
        </div>

        {/* Quadrant Count Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
            <Star className="w-3 h-3 text-emerald-500" />
            <span>{stars.length} Stars</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/60">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>{riskAlerts.length} Sizing Alerts</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/60">
            <Trash2 className="w-3 h-3 text-amber-500" />
            <span>{discontinue.length} Drops</span>
          </span>
        </div>
      </div>

      {/* SVG Scatter Plot Container */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto text-slate-400 dark:text-slate-600 select-none"
        >
          {/* Quadrant Background Tints */}
          {/* Top-Right: Sizing / Defect Alert (High Vol, High Return) */}
          <rect
            x={xSplit}
            y={padTop}
            width={chartW - (xSplit - padLeft)}
            height={ySplit - padTop}
            className="fill-rose-500/5 dark:fill-rose-500/10"
          />
          {/* Top-Left: Drop / Discontinue (Low Vol, High Return) */}
          <rect
            x={padLeft}
            y={padTop}
            width={xSplit - padLeft}
            height={ySplit - padTop}
            className="fill-amber-500/5 dark:fill-amber-500/10"
          />
          {/* Bottom-Right: Stars (High Vol, Low Return) */}
          <rect
            x={xSplit}
            y={ySplit}
            width={chartW - (xSplit - padLeft)}
            height={chartH - (ySplit - padTop)}
            className="fill-emerald-500/5 dark:fill-emerald-500/10"
          />
          {/* Bottom-Left: Niche (Low Vol, Low Return) */}
          <rect
            x={padLeft}
            y={ySplit}
            width={xSplit - padLeft}
            height={chartH - (ySplit - padTop)}
            className="fill-slate-500/5 dark:fill-slate-500/10"
          />

          {/* Threshold Divider Dashed Lines */}
          <line
            x1={xSplit}
            y1={padTop}
            x2={xSplit}
            y2={padTop + chartH}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-slate-300 dark:text-slate-700"
          />
          <line
            x1={padLeft}
            y1={ySplit}
            x2={padLeft + chartW}
            y2={ySplit}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-slate-300 dark:text-slate-700"
          />

          {/* Quadrant Watermark Labels */}
          <text
            x={padLeft + 8}
            y={padTop + 16}
            className="text-[10px] font-bold fill-amber-600 dark:fill-amber-400 opacity-60"
          >
            DISCONTINUE CANDIDATES
          </text>
          <text
            x={xSplit + 8}
            y={padTop + 16}
            className="text-[10px] font-bold fill-rose-600 dark:fill-rose-400 opacity-60"
          >
            ⚠️ SIZING & DEFECT ALERTS (High Volume)
          </text>
          <text
            x={padLeft + 8}
            y={padTop + chartH - 8}
            className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400 opacity-60"
          >
            NICHE CATALOG
          </text>
          <text
            x={xSplit + 8}
            y={padTop + chartH - 8}
            className="text-[10px] font-bold fill-emerald-600 dark:fill-emerald-400 opacity-60"
          >
            ⭐ CORE REVENUE STARS
          </text>

          {/* Y Axis Line & Ticks (Return Rate %) */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={padTop + chartH}
            stroke="currentColor"
            className="text-slate-200 dark:text-[#262626]"
          />
          <text
            x={padLeft - 6}
            y={padTop + 10}
            textAnchor="end"
            className="text-[9px] font-mono fill-slate-400"
          >
            {Math.round(maxReturnRate)}%
          </text>
          <text
            x={padLeft - 6}
            y={ySplit + 3}
            textAnchor="end"
            className="text-[9px] font-mono font-bold fill-rose-500"
          >
            {returnThreshold}%
          </text>
          <text
            x={padLeft - 6}
            y={padTop + chartH}
            textAnchor="end"
            className="text-[9px] font-mono fill-slate-400"
          >
            0%
          </text>

          {/* X Axis Line & Ticks (Volume) */}
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={padLeft + chartW}
            y2={padTop + chartH}
            stroke="currentColor"
            className="text-slate-200 dark:text-[#262626]"
          />
          <text
            x={padLeft}
            y={padTop + chartH + 16}
            textAnchor="start"
            className="text-[9px] font-mono fill-slate-400"
          >
            0 pcs
          </text>
          <text
            x={xSplit}
            y={padTop + chartH + 16}
            textAnchor="middle"
            className="text-[9px] font-mono fill-slate-500 font-bold"
          >
            {medianVolume} pcs (Median)
          </text>
          <text
            x={padLeft + chartW}
            y={padTop + chartH + 16}
            textAnchor="end"
            className="text-[9px] font-mono fill-slate-400"
          >
            {maxVolume} pcs
          </text>

          {/* Product Data Points (Bubbles) */}
          {products.map((p) => {
            const cx = padLeft + (p.totalDeliveredUnits / maxVolume) * chartW;
            const cy = padTop + chartH - (p.returnRate / maxReturnRate) * chartH;
            const isHovered = hoveredProduct?.id === p.id;

            let fillColor = '#10b981'; // emerald
            if (p.returnRate >= returnThreshold && p.totalDeliveredUnits >= medianVolume) {
              fillColor = '#f43f5e'; // rose (high risk)
            } else if (p.returnRate >= returnThreshold) {
              fillColor = '#f59e0b'; // amber
            } else if (p.totalDeliveredUnits < medianVolume) {
              fillColor = '#64748b'; // slate
            }

            return (
              <circle
                key={p.id}
                cx={Math.max(padLeft + 6, Math.min(padLeft + chartW - 6, cx))}
                cy={Math.max(padTop + 6, Math.min(padTop + chartH - 6, cy))}
                r={isHovered ? 8 : 5}
                fill={fillColor}
                fillOpacity={isHovered ? 1 : 0.75}
                stroke={isHovered ? '#ffffff' : 'transparent'}
                strokeWidth={2}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredProduct(p)}
                onMouseLeave={() => setHoveredProduct(null)}
                onClick={() => onSelectProduct?.(p)}
              />
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Card */}
      {hoveredProduct && (
        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/90 dark:border-[#222222] flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
          <div>
            <span className="font-bold text-slate-900 dark:text-white font-headline">
              {hoveredProduct.title}
            </span>
            <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-slate-200/80 dark:bg-[#202020] text-slate-600 dark:text-slate-400">
              {hoveredProduct.category}
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono font-bold text-xs">
            <span className="text-primary">
              Volume: {hoveredProduct.totalDeliveredUnits} pcs
            </span>
            <span
              className={
                hoveredProduct.returnRate >= returnThreshold
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }
            >
              RTO: {hoveredProduct.returnRate.toFixed(1)}%
            </span>
            <span className="text-slate-800 dark:text-slate-200">
              Delivered Rev: ৳{Math.round(hoveredProduct.deliveredRevenue).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
