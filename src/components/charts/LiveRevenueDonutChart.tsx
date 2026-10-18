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

  // Donut geometry: Center = (140, 140), rOuter = 120, rInner = 68 (Expanded to dynamically fill container)
  const cx = 140;
  const cy = 140;
  const rOuter = 120;
  const rInner = 68;

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
      idx,
    };
  });

  const active = hoveredIdx !== null ? orderedSlices[hoveredIdx] : null;

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none w-full">
      <div className="relative w-full max-w-[420px] lg:max-w-[440px] aspect-square flex items-center justify-center">
        <svg
          viewBox="0 0 280 280"
          className="w-full h-full overflow-visible drop-shadow-xs"
        >
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
              <path
                key={`donut-slice-${sp.idx}-${sp.slice.name}`}
                d={sp.d}
                fill={sp.fillColor}
                stroke="currentColor"
                strokeWidth={isSelected ? '4' : '3'}
                className="cursor-pointer transition-all duration-300 ease-out stroke-white dark:stroke-black text-white dark:text-black"
                style={{
                  transformOrigin: '140px 140px',
                  transform: sp.isHovered || isSelected ? 'scale(1.045)' : 'scale(1)',
                  filter: sp.isHovered || isSelected ? 'brightness(1.12) drop-shadow(0 6px 12px rgba(0,0,0,0.3))' : 'none',
                  opacity: isDimmed ? 0.35 : 1,
                }}
                onClick={() => onSelectCategory && onSelectCategory(sp.slice.name)}
                onMouseEnter={() => setHoveredIdx(sp.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}

          {/* Slices labels (Name and percentage inside slice) with smooth hover scaling */}
          {slicePaths.map((sp) => {
            if (sp.sharePercent < 1.8) return null;
            const isSmall = sp.sharePercent < 5; // e.g. Jacket (4%), Trousers (2%)
            const rawName = sp.slice.displayName || sp.slice.name;
            let sliceLabel = rawName;
            if (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test(rawName.trim())) {
              sliceLabel = 'Twill';
            } else if (/^Denim\s+Jacket$/i.test(rawName.trim()) || rawName.trim() === 'Jacket') {
              sliceLabel = 'Jacket';
            }

            // Radial rotation for small slices (Jacket 4%, Trousers 2%) so single line fits along the spoke
            const angleDeg = (sp.midAngle * 180) / Math.PI;

            if (isSmall) {
              const hoverScale = sp.isHovered ? 1.35 : 1;
              return (
                <g
                  key={`donut-label-${sp.idx}-${sp.slice.name}`}
                  pointerEvents="none"
                  style={{
                    transformOrigin: `${sp.lx}px ${sp.ly}px`,
                    transform: `rotate(${angleDeg}deg) scale(${hoverScale})`,
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                    opacity: selectedCategory && selectedCategory !== 'ALL' && !sp.isHovered ? 0.35 : 1,
                  }}
                >
                  <text
                    x={sp.lx}
                    y={sp.ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={sp.isHovered ? "8.5" : "7"}
                    fontWeight="900"
                    fill="#ffffff"
                    className="drop-shadow-md font-sans transition-all duration-200"
                  >
                    {sliceLabel} {Math.round(sp.sharePercent)}%
                  </text>
                </g>
              );
            }

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
                  fontSize={sp.isHovered ? "11.5" : "9.5"}
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
                  fontSize={sp.isHovered ? "13.5" : "11"}
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
              cx="140"
              cy="140"
              r="66"
              fill="currentColor"
              className="fill-white dark:fill-black text-white dark:text-black transition-colors duration-300"
            />
            {active ? (
              <g
                key={`center-active-${active.name}`}
                style={{
                  transformOrigin: '140px 140px',
                  transform: 'scale(1.04)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <text
                  x="140"
                  y="120"
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
                  x="140"
                  y="142"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="900"
                  letterSpacing="0.8"
                  fill={CANONICAL_SLICE_COLORS[active.displayName] || CANONICAL_SLICE_COLORS[active.name] || '#f43f5e'}
                  className="font-headline uppercase transition-colors duration-200"
                >
                  {/^Denim\s+Jacket$/i.test((active.displayName || active.name).trim())
                    ? 'Jacket'
                    : (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test((active.displayName || active.name).trim())
                      ? 'Twill'
                      : (active.displayName || active.name))}
                </text>
                <text
                  x="140"
                  y="160"
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
                  transformOrigin: '140px 140px',
                  transform: 'scale(1)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <text
                  x="140"
                  y="124"
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
                  x="140"
                  y="143"
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
                  x="140"
                  y="160"
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
              <span>
                {/^Denim\s+Jacket$/i.test((active.displayName || active.name).trim())
                  ? 'Jacket'
                  : (/^Twill(\s+Five\s+Pockets?|5\s*Pockets?)?$/i.test((active.displayName || active.name).trim())
                    ? 'Twill'
                    : (active.displayName || active.name))}
              </span>
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
    </div>
  );
}
