"use client";

import React, { useState, useMemo } from 'react';
import { LiveCategoryItem, DEFAULT_DEEN_OPS_CATEGORY_ITEMS } from '@/lib/liveOpsProcessor';

interface LiveRevenueDonutChartProps {
  items: LiveCategoryItem[];
  totalRevenue: number;
  selectsShare: number;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

// Canonical clockwise sequence matching the DEEN-OPS Screenshot degree-for-degree:
// 1. Jeans (48%) [starts 12:00, sweeps to 5:45]
// 2. Trousers (2%) [sweeps 5:45 to 6:00]
// 3. Jacket (4%) [sweeps 6:00 to 6:30]
// 4. Casual (6%) [sweeps 6:30 to 7:15]
// 5. Hoodie (6%) [sweeps 7:15 to 8:00]
// 6. T-Shirt (6%) [sweeps 8:00 to 8:45]
// 7. Cargo (7%) [sweeps 8:45 to 9:30]
// 8. Polo (7%) [sweeps 9:30 to 10:15]
// 9. Twill Five Pockets (14%) [sweeps 10:15 to 12:00]
const CANONICAL_CLOCKWISE_SEQUENCE: Record<string, number> = {
  'Jeans': 1,
  'Trousers': 2,
  'Jacket': 3,
  'Denim Jacket': 3,
  'Casual': 4,
  'Casual Shirt': 4,
  'Hoodie': 5,
  'T-Shirt': 6,
  'Cargo': 7,
  'Cargo Trouser': 7,
  'Polo': 8,
  'Polo Shirt': 8,
  'Twill Five Pockets': 9,
  'Twill': 9,
};

const CANONICAL_SLICE_COLORS: Record<string, string> = {
  'Jeans': '#f43f5e',
  'Trousers': '#fb923c',
  'Jacket': '#f43f5e',
  'Denim Jacket': '#f43f5e',
  'Casual': '#a855f7',
  'Hoodie': '#f59e0b',
  'T-Shirt': '#e11d48',
  'Cargo': '#14b8a6',
  'Polo': '#6366f1',
  'Twill Five Pockets': '#f97316',
  'Twill': '#f97316',
};

function formatShortCategoryName(name: string): string {
  const trimmed = name.trim();
  if (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test(trimmed)) {
    return 'Twill';
  }
  if (/^Denim\s+Jacket$/i.test(trimmed) || trimmed === 'Jacket') {
    return 'Jacket';
  }
  if (/^Casual\s+Shirt$/i.test(trimmed)) {
    return 'Casual';
  }
  if (/^Cargo\s+Trouser$/i.test(trimmed)) {
    return 'Cargo';
  }
  if (/^Polo\s+Shirt$/i.test(trimmed)) {
    return 'Polo';
  }
  return trimmed;
}

export function LiveRevenueDonutChart({
  items,
  totalRevenue,
  selectsShare,
  selectedCategory,
  onSelectCategory,
}: LiveRevenueDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If items has elements, use them; if empty with totalRevenue === 0, render empty state; otherwise fallback
  const hasRealItems = Boolean(items && items.length > 0);
  const sourceItems = useMemo(() => {
    return hasRealItems ? items : (totalRevenue === 0 ? [] : DEFAULT_DEEN_OPS_CATEGORY_ITEMS);
  }, [items, hasRealItems, totalRevenue]);

  // Slices to render (up to 10)
  const topSlices: LiveCategoryItem[] = sourceItems.slice(0, 10);
  const sumSliceRevenue = topSlices.reduce((sum, s) => sum + s.revenue, 0);
  const effectiveTotal = sumSliceRevenue > 0 ? sumSliceRevenue : (totalRevenue > 0 ? totalRevenue : 43273);
  const effectiveRevenue = totalRevenue > 0 ? totalRevenue : (effectiveTotal > 0 ? effectiveTotal : (hasRealItems ? 0 : 43273));
  const effectiveSelectsShare = selectsShare !== undefined && selectsShare !== null && selectsShare >= 0
    ? selectsShare
    : (sourceItems === DEFAULT_DEEN_OPS_CATEGORY_ITEMS ? 43.7 : 0);

  // Donut geometry: ViewBox = 320x320, Center = (160, 160), rOuter = 110, rInner = 64
  // Leaves 50px outer breathing room for clear external leader callouts without clipping
  const cx = 160;
  const cy = 160;
  const rOuter = 110;
  const rInner = 64;

  // Order slices to match DEEN-OPS Screenshot layout
  const orderedSlices = useMemo(() => {
    if (topSlices.length <= 1) return topSlices;
    return [...topSlices].sort((a, b) => {
      const pA = CANONICAL_CLOCKWISE_SEQUENCE[a.displayName] || CANONICAL_CLOCKWISE_SEQUENCE[a.name] || 99;
      const pB = CANONICAL_CLOCKWISE_SEQUENCE[b.displayName] || CANONICAL_CLOCKWISE_SEQUENCE[b.name] || 99;
      if (pA !== 99 && pB !== 99) return pA - pB;
      if (pA !== 99) return -1;
      if (pB !== 99) return 1;
      return b.revenue - a.revenue;
    });
  }, [topSlices]);

  if (sourceItems.length === 0 && effectiveRevenue === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center p-6 text-center select-none w-full min-h-[280px]">
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#1A1A1A] flex items-center justify-center text-2xl mb-2 text-slate-400">
          📦
        </div>
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
          No dispatches recorded
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Zero shipments dispatched on this operational date
        </div>
      </div>
    );
  }

  // Slices start from 12 o'clock (-PI / 2) and go clockwise
  let currentAngle = -Math.PI / 2;

  // Track small slices count to stagger leader line lengths and prevent collision
  let smallSliceCounter = 0;

  const slicePaths = orderedSlices.map((slice, idx) => {
    const share = slice.revenue / effectiveTotal;
    const angleDelta = share * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    // Outer arc coords
    const x1 = cx + rOuter * Math.cos(startAngle);
    const y1 = cy + rOuter * Math.sin(startAngle);
    const x2 = cx + rOuter * Math.cos(endAngle);
    const y2 = cy + rOuter * Math.sin(endAngle);

    // Inner arc coords
    const x3 = cx + rInner * Math.cos(endAngle);
    const y3 = cy + rInner * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(startAngle);
    const y4 = cy + rInner * Math.sin(startAngle);

    const largeArc = angleDelta > Math.PI ? 1 : 0;

    // SVG path string for an annular slice
    const d = [
      `M ${x1} ${y1}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');

    // Center point of the slice for percentage label
    const midAngle = startAngle + angleDelta / 2;
    const rMid = (rOuter + rInner) / 2;
    const lx = cx + rMid * Math.cos(midAngle);
    const ly = cy + rMid * Math.sin(midAngle);

    const isSmall = slice.revenueShare < 6;
    let smallOrder = 0;
    if (isSmall) {
      smallOrder = smallSliceCounter++;
    }

    const fillColor = CANONICAL_SLICE_COLORS[slice.displayName] || CANONICAL_SLICE_COLORS[slice.name] || slice.color;

    return {
      slice,
      d,
      lx,
      ly,
      midAngle,
      fillColor,
      sharePercent: slice.revenueShare,
      isHovered: hoveredIdx === idx,
      isSmall,
      smallOrder,
      idx,
    };
  });

  const active = hoveredIdx !== null ? orderedSlices[hoveredIdx] : null;

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none w-full">
      {/* Donut Chart Container */}
      <div className="relative w-full max-w-[420px] lg:max-w-[440px] aspect-square flex items-center justify-center">
        <svg
          viewBox="0 0 320 320"
          className="w-full h-full overflow-visible drop-shadow-xs"
        >
          {/* Slice Paths */}
          {slicePaths.map((sp) => {
            const rawName = sp.slice.displayName || sp.slice.name;
            const isSelected = Boolean(
              selectedCategory &&
              selectedCategory !== 'ALL' &&
              (selectedCategory === sp.slice.name ||
                selectedCategory === sp.slice.displayName ||
                (selectedCategory === 'Twill' && /^Twill/i.test(rawName)) ||
                (selectedCategory === 'Jacket' && /Jacket/i.test(rawName)))
            );
            const isDimmed = Boolean(selectedCategory && selectedCategory !== 'ALL' && !isSelected);

            return (
              <g key={`donut-slice-group-${sp.idx}-${sp.slice.name}`}>
                {/* Visible Annular Path */}
                <path
                  d={sp.d}
                  fill={sp.fillColor}
                  stroke="currentColor"
                  strokeWidth={isSelected ? '4' : '3'}
                  className="cursor-pointer transition-all duration-300 ease-out stroke-white dark:stroke-black text-white dark:text-black"
                  style={{
                    transformOrigin: '160px 160px',
                    transform: sp.isHovered || isSelected ? 'scale(1.055)' : 'scale(1)',
                    filter: sp.isHovered || isSelected ? 'brightness(1.15) drop-shadow(0 6px 14px rgba(0,0,0,0.35))' : 'none',
                    opacity: isDimmed ? 0.35 : 1,
                  }}
                  onClick={() => onSelectCategory && onSelectCategory(sp.slice.name)}
                  onMouseEnter={() => setHoveredIdx(sp.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {/* Generous touch/hover hit target for small slices to make hover/tap effortless */}
                {sp.isSmall && (
                  <path
                    d={sp.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    className="cursor-pointer"
                    onClick={() => onSelectCategory && onSelectCategory(sp.slice.name)}
                    onMouseEnter={() => setHoveredIdx(sp.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                )}
              </g>
            );
          })}

          {/* Leader Lines and External Callout Labels for Small Slices (< 6%) */}
          {slicePaths.map((sp) => {
            if (!sp.isSmall || sp.sharePercent < 1.2) return null;
            const rawName = sp.slice.displayName || sp.slice.name;
            const sliceLabel = formatShortCategoryName(rawName);

            // Stagger radius offset to prevent adjacent small slices from overlapping each other
            const radialOffset = sp.smallOrder % 2 === 0 ? 15 : 26;
            const rLeaderEnd = rOuter + radialOffset;

            const isRightSide = Math.cos(sp.midAngle) >= 0;
            const xAnchor = cx + (rOuter + 2) * Math.cos(sp.midAngle);
            const yAnchor = cy + (rOuter + 2) * Math.sin(sp.midAngle);

            const xKnee = cx + rLeaderEnd * Math.cos(sp.midAngle);
            const yKnee = cy + rLeaderEnd * Math.sin(sp.midAngle);

            const armLength = 12;
            const xEnd = isRightSide ? xKnee + armLength : xKnee - armLength;
            const yEnd = yKnee;

            const textX = isRightSide ? xEnd + 3 : xEnd - 3;
            const textY = yEnd;
            const textAnchor = isRightSide ? 'start' : 'end';

            const isSelected = Boolean(
              selectedCategory &&
              selectedCategory !== 'ALL' &&
              (selectedCategory === sp.slice.name ||
                selectedCategory === sp.slice.displayName ||
                (selectedCategory === 'Twill' && /^Twill/i.test(rawName)) ||
                (selectedCategory === 'Jacket' && /Jacket/i.test(rawName)))
            );
            const isDimmed = Boolean(selectedCategory && selectedCategory !== 'ALL' && !isSelected);

            return (
              <g
                key={`callout-small-${sp.idx}-${sp.slice.name}`}
                className="cursor-pointer transition-all duration-200"
                style={{
                  opacity: isDimmed ? 0.35 : 1,
                }}
                onClick={() => onSelectCategory && onSelectCategory(sp.slice.name)}
                onMouseEnter={() => setHoveredIdx(sp.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Leader line from outer arc edge out to external label */}
                <path
                  d={`M ${xAnchor} ${yAnchor} L ${xKnee} ${yKnee} L ${xEnd} ${yEnd}`}
                  stroke={sp.fillColor}
                  strokeWidth={sp.isHovered ? '2' : '1.5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className="transition-all duration-200"
                />

                {/* Dot at arc anchor point */}
                <circle
                  cx={xAnchor}
                  cy={yAnchor}
                  r={sp.isHovered ? '3' : '2'}
                  fill={sp.fillColor}
                  className="transition-all duration-200"
                />

                {/* External high-contrast label with rounded pill background for guaranteed contrast */}
                <text
                  x={textX}
                  y={textY}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fontSize={sp.isHovered ? '10' : '9'}
                  fontWeight="900"
                  fill="currentColor"
                  className="fill-slate-800 dark:fill-white font-headline transition-all duration-200"
                >
                  {sliceLabel} {Math.round(sp.sharePercent)}%
                </text>
              </g>
            );
          })}

          {/* Slices labels (Inside Slice) for Main Categories (>= 6% share) */}
          {slicePaths.map((sp) => {
            if (sp.isSmall) return null; // Small slices are rendered with callouts above
            const rawName = sp.slice.displayName || sp.slice.name;
            const sliceLabel = formatShortCategoryName(rawName);

            const hoverScale = sp.isHovered ? 1.25 : 1;
            return (
              <g
                key={`donut-label-${sp.idx}-${sp.slice.name}`}
                pointerEvents="none"
                style={{
                  transformOrigin: `${sp.lx}px ${sp.ly}px`,
                  transform: `scale(${hoverScale})`,
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                  opacity: selectedCategory && selectedCategory !== 'ALL' && !sp.isHovered ? 0.35 : 1,
                }}
              >
                <text
                  x={sp.lx}
                  y={sp.ly - 5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={sp.isHovered ? '11.5' : '9.5'}
                  fontWeight="bold"
                  fill="#ffffff"
                  className="drop-shadow-md font-sans transition-all duration-200"
                >
                  {sliceLabel}
                </text>
                <text
                  x={sp.lx}
                  y={sp.ly + 7}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={sp.isHovered ? '13.5' : '11'}
                  fontWeight="900"
                  fill="#ffffff"
                  className="drop-shadow-md font-sans transition-all duration-200"
                >
                  {Math.round(sp.sharePercent)}%
                </text>
              </g>
            );
          })}

          {/* Center Donut Annotation (Smooth dynamic interactive feedback on hover) */}
          <g pointerEvents="none" className="transition-all duration-300 ease-out">
            <circle
              cx="160"
              cy="160"
              r="62"
              fill="currentColor"
              className="fill-white dark:fill-black text-white dark:text-black transition-colors duration-300"
            />
            {active ? (
              <g
                key={`center-active-${active.name}`}
                style={{
                  transformOrigin: '160px 160px',
                  transform: 'scale(1.04)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <text
                  x="160"
                  y="138"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="22"
                  fontWeight="900"
                  fill="currentColor"
                  className="font-headline tracking-tight fill-slate-900 dark:fill-white transition-all duration-200"
                >
                  ৳ {active.revenue.toLocaleString()}
                </text>
                <text
                  x="160"
                  y="160"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="900"
                  letterSpacing="0.8"
                  fill={CANONICAL_SLICE_COLORS[active.displayName] || CANONICAL_SLICE_COLORS[active.name] || '#f43f5e'}
                  className="font-headline uppercase transition-colors duration-200"
                >
                  {formatShortCategoryName(active.displayName || active.name)}
                </text>
                <text
                  x="160"
                  y="178"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="bold"
                  fill="currentColor"
                  className="fill-slate-600 dark:fill-slate-300 transition-colors duration-200"
                >
                  {active.revenueShare}% Share • {active.volume} pcs
                </text>
              </g>
            ) : (
              <g
                key="center-default"
                style={{
                  transformOrigin: '160px 160px',
                  transform: 'scale(1)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <text
                  x="160"
                  y="142"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="20"
                  fontWeight="900"
                  fill="currentColor"
                  className="font-headline tracking-tight fill-slate-900 dark:fill-white text-slate-900 dark:text-white transition-colors duration-200"
                >
                  ৳ {effectiveRevenue.toLocaleString()}
                </text>
                <text
                  x="160"
                  y="161"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="8.5"
                  fontWeight="bold"
                  letterSpacing="0.8"
                  fill="currentColor"
                  className="fill-slate-500 dark:fill-white text-slate-500 dark:text-white transition-colors duration-200"
                >
                  TOTAL REVENUE
                </text>
                <text
                  x="160"
                  y="178"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill="currentColor"
                  className="fill-teal-700 dark:fill-white text-teal-700 dark:text-white transition-colors duration-200"
                >
                  💎 {effectiveSelectsShare}% Selects
                </text>
              </g>
            )}
          </g>
        </svg>

        {/* Floating Tooltip - Elevated with larger typography and smooth transitions */}
        {active && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 dark:bg-black/95 text-white px-3.5 py-2.5 rounded-2xl text-xs shadow-2xl border border-slate-700/60 dark:border-[#333333] backdrop-blur-md min-w-[170px] transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
            style={{
              bottom: '6px',
            }}
          >
            <div className="font-headline font-black text-white text-xs sm:text-sm flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
              <span>{formatShortCategoryName(active.displayName || active.name)}</span>
              <span className="text-amber-400 font-black text-sm">{active.revenueShare}%</span>
            </div>
            <div className="space-y-1 text-slate-300 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">💰 Revenue:</span>
                <span className="font-black text-emerald-400 text-xs sm:text-sm">৳ {active.revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">📦 Volume:</span>
                <span className="font-bold text-sky-300 text-xs sm:text-sm">{active.volume} units</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">🏷️ Avg Price:</span>
                <span className="font-medium text-slate-200 text-xs">৳ {active.avgUnitPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Category Breakdown & Quick-Filter Strip */}
      <div className="mt-3 w-full flex flex-wrap items-center justify-center gap-1.5 px-1 max-w-[460px]">
        {orderedSlices.map((slice, idx) => {
          const rawName = slice.displayName || slice.name;
          const shortName = formatShortCategoryName(rawName);
          const color = CANONICAL_SLICE_COLORS[slice.displayName] || CANONICAL_SLICE_COLORS[slice.name] || slice.color;
          const isSelected = Boolean(
            selectedCategory &&
            selectedCategory !== 'ALL' &&
            (selectedCategory === slice.name ||
              selectedCategory === slice.displayName ||
              (selectedCategory === 'Twill' && /^Twill/i.test(rawName)) ||
              (selectedCategory === 'Jacket' && /Jacket/i.test(rawName)))
          );
          const isHovered = hoveredIdx === idx;
          const isDimmed = Boolean(selectedCategory && selectedCategory !== 'ALL' && !isSelected);

          return (
            <button
              key={`cat-chip-${idx}-${slice.name}`}
              type="button"
              onClick={() => onSelectCategory && onSelectCategory(slice.name)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              title={`Click to filter by ${shortName} (${slice.revenueShare}% share, ৳${slice.revenue.toLocaleString()})`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-xs scale-105'
                  : isHovered
                    ? 'bg-slate-100 dark:bg-[#1A1A1A] border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white shadow-xs scale-102'
                    : isDimmed
                      ? 'bg-slate-50/50 dark:bg-[#0A0A0A] border-slate-200/50 dark:border-[#1F1F1F] text-slate-400 dark:text-slate-600 opacity-40'
                      : 'bg-slate-50 dark:bg-[#121212] border-slate-200/80 dark:border-[#1F1F1F] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: color }}
              />
              <span className="font-headline">{shortName}</span>
              <span className="text-[10px] px-1 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-black">
                {Math.round(slice.revenueShare)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
