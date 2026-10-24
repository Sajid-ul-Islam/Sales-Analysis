"use client";

import React, { useState, useMemo } from 'react';
import { LiveCategoryItem, DEFAULT_DEEN_OPS_CATEGORY_ITEMS } from '@/lib/liveOpsProcessor';

interface LiveRevenueDonutChartProps {
  items: LiveCategoryItem[];
  totalRevenue: number;
  selectsShare: number;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  isSubCategory?: boolean;
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
  '5-Pocket Twill': '#f97316',
  'Twill': '#f97316',
  'Wallet': '#d97706',
};

function formatShortCategoryName(name: string): string {
  const trimmed = name.trim();
  if (/^Twill(\s+(Five\s+Pockets?|5\s*Pockets?))?$/i.test(trimmed) || /^5\s*Pockets?$/i.test(trimmed)) {
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
  isSubCategory = false,
}: LiveRevenueDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If items has elements, use them; if empty with totalRevenue === 0, render empty state; otherwise fallback
  const sourceItems = useMemo(() => {
    const hasRealItems = Boolean(items && items.length > 0);
    return hasRealItems ? items : (totalRevenue === 0 ? [] : DEFAULT_DEEN_OPS_CATEGORY_ITEMS);
  }, [items, totalRevenue]);

  // Slices to render (up to 10)
  const topSlices: LiveCategoryItem[] = sourceItems.slice(0, 10);
  const sumSliceRevenue = topSlices.reduce((sum, s) => sum + s.revenue, 0);
  const effectiveTotal = sumSliceRevenue > 0 ? sumSliceRevenue : (totalRevenue > 0 ? totalRevenue : 43273);
  const effectiveRevenue = totalRevenue > 0 ? totalRevenue : (effectiveTotal > 0 ? effectiveTotal : (items && items.length > 0 ? 0 : 43273));
  const effectiveSelectsShare = selectsShare !== undefined && selectsShare !== null && selectsShare >= 0
    ? selectsShare
    : (sourceItems === DEFAULT_DEEN_OPS_CATEGORY_ITEMS ? 43.7 : 0);

  // Donut geometry: ViewBox = 340x340, Center = (170, 170), rOuter = 138, rInner = 74
  // Maximizes chart capability and visual presence across card space
  const cx = 170;
  const cy = 170;
  const rOuter = 138;
  const rInner = 74;

  // Order slices: In Category view match DEEN-OPS Screenshot canonical layout; in Sub-Category view sort by revenue
  const orderedSlices = useMemo(() => {
    if (topSlices.length <= 1) return topSlices;
    if (isSubCategory) {
      return [...topSlices].sort((a, b) => b.revenue - a.revenue);
    }
    return [...topSlices].sort((a, b) => {
      const pA = CANONICAL_CLOCKWISE_SEQUENCE[a.displayName] || CANONICAL_CLOCKWISE_SEQUENCE[a.name] || 99;
      const pB = CANONICAL_CLOCKWISE_SEQUENCE[b.displayName] || CANONICAL_CLOCKWISE_SEQUENCE[b.name] || 99;
      if (pA !== 99 && pB !== 99) return pA - pB;
      if (pA !== 99) return -1;
      if (pB !== 99) return 1;
      return b.revenue - a.revenue;
    });
  }, [topSlices, isSubCategory]);

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

    const isSmall = slice.revenueShare < 5;
    let smallOrder = 0;
    if (isSmall) {
      smallOrder = smallSliceCounter++;
    }

    const fillColor = isSubCategory
      ? (slice.color || CANONICAL_SLICE_COLORS[slice.displayName] || CANONICAL_SLICE_COLORS[slice.name])
      : (CANONICAL_SLICE_COLORS[slice.displayName] || CANONICAL_SLICE_COLORS[slice.name] || slice.color);

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
    <div className="relative flex flex-col p-1 select-none w-full h-full justify-between">
      {/* Top/Main Container: On larger screens (e.g. xl: / 2xl:), display Donut + Interactive Category Distribution Ledger side-by-side; on mobile/tablet, stack them */}
      <div className="w-full flex-1 flex flex-col xl:flex-row items-center xl:items-center justify-between gap-4">
        {/* Donut Chart Container - dynamically sized to fill space without hard cap */}
        <div className="relative w-full max-w-[340px] sm:max-w-[380px] xl:max-w-[420px] 2xl:max-w-[460px] aspect-square flex items-center justify-center shrink-0 mx-auto">
          <svg
            viewBox="0 0 340 340"
            className="w-full h-full overflow-visible drop-shadow-xs"
          >
            {/* Slice Paths */}
            {slicePaths.map((sp) => {
              const rawName = sp.slice.displayName || sp.slice.name;
              const sliceLabel = isSubCategory ? rawName : formatShortCategoryName(rawName);
              const isSelected = Boolean(
                selectedCategory &&
                selectedCategory !== 'ALL' &&
                (selectedCategory === sp.slice.name ||
                  selectedCategory === sp.slice.displayName ||
                  selectedCategory === sliceLabel ||
                  (!isSubCategory && selectedCategory === 'Twill' && /^Twill/i.test(rawName)) ||
                  (!isSubCategory && selectedCategory === 'Jacket' && /Jacket/i.test(rawName)))
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
                      transformOrigin: `${cx}px ${cy}px`,
                      transform: sp.isHovered || isSelected ? 'scale(1.05)' : 'scale(1)',
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

            {/* Leader Lines and External Callout Labels for Slices */}
            {slicePaths.map((sp) => {
              const rawName = sp.slice.displayName || sp.slice.name;
              const sliceLabel = isSubCategory ? rawName : formatShortCategoryName(rawName);

              const isSelected = Boolean(
                selectedCategory &&
                selectedCategory !== 'ALL' &&
                (selectedCategory === sp.slice.name ||
                  selectedCategory === sp.slice.displayName ||
                  selectedCategory === sliceLabel ||
                  (!isSubCategory && selectedCategory === 'Twill' && /^Twill/i.test(rawName)) ||
                  (!isSubCategory && selectedCategory === 'Jacket' && /Jacket/i.test(rawName)))
              );
              const isDimmed = Boolean(selectedCategory && selectedCategory !== 'ALL' && !isSelected);

              // Small slices (< 6%):
              // If hovered or selected: ALWAYS show callout line and enlarged label with high contrast
              // If at rest (not hovered/selected): only show callout if slice is >= 5% to prevent cluster collisions
              const isCalloutVisible = sp.isHovered || isSelected || (sp.isSmall && sp.sharePercent >= 5);
              if (!sp.isSmall || !isCalloutVisible) return null;

              // Stagger radius offset to prevent adjacent small slices from overlapping each other
              const radialOffset = sp.smallOrder % 2 === 0 ? 12 : 20;
              const rLeaderEnd = rOuter + radialOffset;

              const isRightSide = Math.cos(sp.midAngle) >= 0;
              const xAnchor = cx + (rOuter + 2) * Math.cos(sp.midAngle);
              const yAnchor = cy + (rOuter + 2) * Math.sin(sp.midAngle);

              const xKnee = cx + rLeaderEnd * Math.cos(sp.midAngle);
              const yKnee = cy + rLeaderEnd * Math.sin(sp.midAngle);

              const armLength = sp.isHovered ? 14 : 10;
              const xEnd = isRightSide ? xKnee + armLength : xKnee - armLength;
              const yEnd = yKnee;

              const textX = isRightSide ? xEnd + 4 : xEnd - 4;
              const textY = yEnd;
              const textAnchor = isRightSide ? 'start' : 'end';

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
                    strokeWidth={sp.isHovered ? '2.5' : '1.5'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className="transition-all duration-200"
                  />

                  {/* Dot at arc anchor point */}
                  <circle
                    cx={xAnchor}
                    cy={yAnchor}
                    r={sp.isHovered ? '3.5' : '2'}
                    fill={sp.fillColor}
                    className="transition-all duration-200"
                  />

                  {/* External high-contrast label with smooth hover enlargement */}
                  <text
                    x={textX}
                    y={textY}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fontSize={sp.isHovered ? '12.5' : '9.5'}
                    fontWeight="900"
                    fill="currentColor"
                    className="fill-slate-900 dark:fill-white font-headline transition-all duration-200"
                    style={{
                      transformOrigin: `${textX}px ${textY}px`,
                      transform: sp.isHovered ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
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
              const sliceLabel = isSubCategory ? rawName : formatShortCategoryName(rawName);

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
                    y={sp.ly - 7}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={sp.isHovered ? '13' : '11'}
                    fontWeight="900"
                    fill="#ffffff"
                    className="drop-shadow-md font-headline transition-all duration-200"
                  >
                    {sliceLabel}
                  </text>
                  <text
                    x={sp.lx}
                    y={sp.ly + 8}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={sp.isHovered ? '14' : '11.5'}
                    fontWeight="900"
                    fill="#ffffff"
                    className="drop-shadow-md font-headline transition-all duration-200"
                  >
                    {Math.round(sp.sharePercent)}%
                  </text>
                </g>
              );
            })}

            {/* Center Donut Annotation (Smooth dynamic interactive feedback on hover) */}
            <g pointerEvents="none" className="transition-all duration-300 ease-out">
              <circle
                cx={cx}
                cy={cy}
                r={rInner - 3}
                fill="currentColor"
                className="fill-white dark:fill-black text-white dark:text-black transition-colors duration-300"
              />
              {active ? (
                <g
                  key={`center-active-${active.name}`}
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: 'scale(1.04)',
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <text
                    x={cx}
                    y={cy - 22}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="24"
                    fontWeight="900"
                    fill="currentColor"
                    className="font-headline tracking-tight fill-slate-900 dark:fill-white transition-all duration-200"
                  >
                    ৳ {active.revenue.toLocaleString()}
                  </text>
                  <text
                    x={cx}
                    y={cy + 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="12"
                    fontWeight="900"
                    letterSpacing="0.8"
                    fill={CANONICAL_SLICE_COLORS[active.displayName] || CANONICAL_SLICE_COLORS[active.name] || '#f43f5e'}
                    className="font-headline uppercase transition-colors duration-200"
                  >
                    {formatShortCategoryName(active.displayName || active.name)}
                  </text>
                  <text
                    x={cx}
                    y={cy + 23}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10.5"
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
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: 'scale(1.02)',
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <text
                    x={cx}
                    y={cy - 20}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="23"
                    fontWeight="900"
                    fill="currentColor"
                    className="font-headline tracking-tight fill-slate-900 dark:fill-white text-slate-900 dark:text-white transition-colors duration-200"
                  >
                    ৳ {effectiveRevenue.toLocaleString()}
                  </text>
                  <text
                    x={cx}
                    y={cy + 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9.5"
                    fontWeight="bold"
                    letterSpacing="0.9"
                    fill="currentColor"
                    className="fill-slate-500 dark:fill-white text-slate-500 dark:text-white transition-colors duration-200"
                  >
                    TOTAL REVENUE
                  </text>
                  <text
                    x={cx}
                    y={cy + 22}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10.5"
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
                top: '12px',
                right: '12px',
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

        {/* Dynamic Category Revenue & Share Ledger (Uses the extra blank screen dynamically) */}
        <div className="w-full xl:w-[280px] 2xl:w-[320px] flex flex-col justify-center min-w-0 flex-1">
          <div className="flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 px-1 border-b border-slate-100 dark:border-[#1F1F1F] pb-1.5">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <span>🏆</span>
              <span>{isSubCategory ? 'Sub-Category Ranking' : 'Category Ranking'}</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {orderedSlices.length} Families
            </span>
          </div>

          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 select-none custom-scrollbar">
            {orderedSlices.map((slice, idx) => {
              const rawName = slice.displayName || slice.name;
              const sliceLabel = isSubCategory ? rawName : formatShortCategoryName(rawName);
              const isHovered = hoveredIdx === idx;
              const isSelected = Boolean(
                selectedCategory &&
                selectedCategory !== 'ALL' &&
                (selectedCategory === slice.name ||
                  selectedCategory === slice.displayName ||
                  selectedCategory === sliceLabel ||
                  (!isSubCategory && selectedCategory === 'Twill' && /^Twill/i.test(rawName)) ||
                  (!isSubCategory && selectedCategory === 'Jacket' && /Jacket/i.test(rawName)))
              );
              const isDimmed = Boolean(selectedCategory && selectedCategory !== 'ALL' && !isSelected);
              const color = isSubCategory
                ? (slice.color || CANONICAL_SLICE_COLORS[slice.displayName] || CANONICAL_SLICE_COLORS[slice.name] || '#f43f5e')
                : (CANONICAL_SLICE_COLORS[slice.displayName] || CANONICAL_SLICE_COLORS[slice.name] || slice.color || '#f43f5e');

              return (
                <div
                  key={`legend-row-${slice.name}-${idx}`}
                  onClick={() => onSelectCategory && onSelectCategory(slice.name)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 shadow-xs'
                      : isHovered
                        ? 'bg-slate-100 dark:bg-[#1A1A1A] border-slate-300 dark:border-[#333333] translate-x-1'
                        : 'bg-slate-50/70 dark:bg-[#0D0D0D] border-slate-200/60 dark:border-[#1F1F1F] hover:bg-slate-100 dark:hover:bg-[#1A1A1A]'
                  } ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
                >
                  {/* Left: Rank & Color dot & Name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 w-3.5 text-center">
                      #{idx + 1}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate font-headline group-hover:text-primary transition-colors">
                      {sliceLabel}
                    </span>
                  </div>

                  {/* Right: Revenue, Share % & Volume */}
                  <div className="flex items-center gap-2 text-right shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                        ৳{slice.revenue.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {slice.volume} pcs
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-black px-1.5 py-0.5 rounded-md min-w-[38px] text-center font-mono shadow-2xs"
                      style={{
                        backgroundColor: `${color}18`,
                        color: color,
                      }}
                    >
                      {Math.round(slice.revenueShare)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
