"use client";

import React, { useState, useMemo } from 'react';
import {
  ProductStockRow,
  InventorySummaryMetrics,
  InventoryLocationId,
  computeSizeStockBreakdown,
  SizeStockBreakdown,
} from '@/lib/inventoryEngine';
import { CATEGORY_COLOR_MAP } from '@/lib/liveCategoryEngine';
import {
  Warehouse,
  Store,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart3,
  PieChart,
  Boxes,
  DollarSign,
  Ruler,
  SlidersHorizontal,
  X
} from 'lucide-react';

interface StockAnalyticsChartsProps {
  metrics: InventorySummaryMetrics;
  rows: ProductStockRow[];
  selectedLocation: InventoryLocationId;
  onSelectLocation: (loc: InventoryLocationId) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedSize: string;
  onSelectSize: (size: string) => void;
  selectedStatus: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  onSelectStatus: (status: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK') => void;
}

export function StockAnalyticsCharts({
  metrics,
  rows,
  selectedLocation,
  onSelectLocation,
  selectedCategory,
  onSelectCategory,
  selectedSize,
  onSelectSize,
  selectedStatus,
  onSelectStatus,
}: StockAnalyticsChartsProps) {
  // Toggle between Units (Pcs) and Valuation (BDT)
  const [metricMode, setMetricMode] = useState<'UNITS' | 'VALUE'>('UNITS');
  // Toggle breakdown view between Categories, Size Curve (Variations), and Combined
  const [distributionTab, setDistributionTab] = useState<'CATEGORY' | 'SIZE'>('SIZE');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // 1. Location Breakdown Data
  const locationBreakdown = useMemo(() => {
    let warehouseVal = 0;
    let mirpurVal = 0;
    let cumillaVal = 0;
    let wariVal = 0;
    let sylhetVal = 0;

    rows.forEach((r) => {
      warehouseVal += r.stock.warehouse * r.unitPrice;
      mirpurVal += r.stock.mirpur * r.unitPrice;
      cumillaVal += r.stock.cumilla * r.unitPrice;
      wariVal += r.stock.wari * r.unitPrice;
      sylhetVal += r.stock.sylhet * r.unitPrice;
    });

    const totalVal = warehouseVal + mirpurVal + cumillaVal + wariVal + sylhetVal;
    const totalUnits = metrics.totalUnits;

    const nodes = [
      {
        id: 'warehouse' as InventoryLocationId,
        label: 'Central Warehouse',
        subLabel: 'Online Fulfillment Hub',
        units: metrics.locationTotals.warehouse,
        value: warehouseVal,
        color: '#3b82f6', // Blue
        icon: Warehouse,
      },
      {
        id: 'mirpur' as InventoryLocationId,
        label: 'Mirpur Outlet',
        subLabel: 'Retail Store POS',
        units: metrics.locationTotals.mirpur,
        value: mirpurVal,
        color: '#a855f7', // Purple
        icon: Store,
      },
      {
        id: 'cumilla' as InventoryLocationId,
        label: 'Cumilla Branch',
        subLabel: 'Retail Store POS',
        units: metrics.locationTotals.cumilla,
        value: cumillaVal,
        color: '#10b981', // Emerald
        icon: Store,
      },
      {
        id: 'wari' as InventoryLocationId,
        label: 'Wari Branch',
        subLabel: 'Retail Store POS',
        units: metrics.locationTotals.wari,
        value: wariVal,
        color: '#0ea5e9', // Sky
        icon: Store,
      },
      {
        id: 'sylhet' as InventoryLocationId,
        label: 'Sylhet Branch',
        subLabel: 'Retail Store POS',
        units: metrics.locationTotals.sylhet,
        value: sylhetVal,
        color: '#f59e0b', // Amber
        icon: Store,
      },
    ];

    let accumulatedPct = 0;
    const segments = nodes.map((node) => {
      const metricVal = metricMode === 'UNITS' ? node.units : node.value;
      const baseTotal = metricMode === 'UNITS' ? totalUnits : totalVal;
      const pct = baseTotal > 0 ? (metricVal / baseTotal) * 100 : 0;
      const offset = -accumulatedPct;
      accumulatedPct += pct;

      return {
        ...node,
        percentage: pct,
        offset,
      };
    });

    return { segments, totalUnits, totalVal };
  }, [rows, metrics, metricMode]);

  // 2. Category Inventory Breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { units: number; value: number; skuCount: number }>();

    rows.forEach((r) => {
      const cat = r.category || 'General Apparel';
      if (!catMap.has(cat)) {
        catMap.set(cat, { units: 0, value: 0, skuCount: 0 });
      }
      const item = catMap.get(cat)!;
      item.units += r.totalStock;
      item.value += r.retailValuation;
      item.skuCount += 1;
    });

    const list = Array.from(catMap.entries()).map(([category, data]) => ({
      category,
      units: data.units,
      value: data.value,
      skuCount: data.skuCount,
      color: CATEGORY_COLOR_MAP[category] || '#64748b',
    }));

    list.sort((a, b) => (metricMode === 'UNITS' ? b.units - a.units : b.value - a.value));

    const maxMetricVal = Math.max(
      ...list.map((c) => (metricMode === 'UNITS' ? c.units : c.value)),
      1
    );

    return {
      topCategories: list.slice(0, 8),
      maxMetricVal,
    };
  }, [rows, metricMode]);

  // 3. Size-Wise (Variation-Wise) Breakdown & Curve
  const sizeBreakdownData = useMemo(() => {
    // If a specific category is active, evaluate sizes for that category, else across whole catalog
    const relevantRows =
      selectedCategory !== 'ALL'
        ? rows.filter((r) => r.category === selectedCategory)
        : rows;

    const list = computeSizeStockBreakdown(relevantRows);

    const maxMetricVal = Math.max(
      ...list.map((s) => (metricMode === 'UNITS' ? s.units : s.value)),
      1
    );

    // Identify critical stockout sizes (stockout rate > 25%)
    const highStockoutSizes = list
      .filter((s) => s.stockoutRate > 25 && s.skuCount >= 3)
      .map((s) => s.size);

    return {
      sizes: list,
      maxMetricVal,
      highStockoutSizes,
    };
  }, [rows, selectedCategory, metricMode]);

  // 4. Stock Health & Reorder Urgency
  const healthSegments = useMemo(() => {
    const total = metrics.totalSkus || 1;
    const inStockPct = (metrics.inStockCount / total) * 100;
    const lowStockPct = (metrics.lowStockCount / total) * 100;
    const outOfStockPct = (metrics.outOfStockCount / total) * 100;

    return [
      {
        status: 'IN_STOCK' as const,
        label: 'Healthy Stock',
        sub: '>5 Units',
        count: metrics.inStockCount,
        pct: inStockPct,
        color: '#10b981',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      },
      {
        status: 'LOW_STOCK' as const,
        label: 'Low Stock Alert',
        sub: '1-5 Units Left',
        count: metrics.lowStockCount,
        pct: lowStockPct,
        color: '#f59e0b',
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      },
      {
        status: 'OUT_OF_STOCK' as const,
        label: 'Out of Stock',
        sub: '0 Units (Stockout)',
        count: metrics.outOfStockCount,
        pct: outOfStockPct,
        color: '#ef4444',
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      },
    ];
  }, [metrics]);

  // 5. Critical Reorder vs Overstock Extremes
  const { topOverstocked, topCriticalStockouts } = useMemo(() => {
    const overstocked = [...rows]
      .sort((a, b) => b.totalStock - a.totalStock)
      .slice(0, 5);

    const critical = [...rows]
      .filter((r) => r.totalStock <= 5 && r.recentSalesVelocity > 0)
      .sort((a, b) => b.recentSalesVelocity - a.recentSalesVelocity)
      .slice(0, 5);

    return {
      topOverstocked: overstocked,
      topCriticalStockouts: critical,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Visual Analytics Header & Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0A0A0A] p-3.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Stock Visual Analytics & Variation Curve
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline">
            • Size-wise variation breakdown, fulfillment node allocations & category volumes
          </span>
        </div>

        {/* View Controls: Units vs Valuation */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141414] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMetricMode('UNITS')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                metricMode === 'UNITS'
                  ? 'bg-white dark:bg-[#202020] text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Units (Pcs)</span>
            </button>
            <button
              onClick={() => setMetricMode('VALUE')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                metricMode === 'VALUE'
                  ? 'bg-white dark:bg-[#202020] text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Valuation (৳)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Visual Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* CARD 1: Location Distribution (Donut & Node Allocations) - 5 Columns      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Location Stock Breakdown
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {metricMode === 'UNITS'
                  ? `${metrics.totalUnits.toLocaleString()} Pcs`
                  : `৳${metrics.totalRetailValue.toLocaleString()}`}
              </span>
            </div>

            {/* Donut Chart & Center Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  {locationBreakdown.segments.map((seg) => {
                    const isHovered = hoveredNodeId === seg.id;
                    const isSelected = selectedLocation === seg.id;
                    return (
                      <circle
                        key={seg.id}
                        cx="21"
                        cy="21"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={isHovered || isSelected ? 5.8 : 4.5}
                        strokeDasharray={`${seg.percentage.toFixed(2)} ${(100 - seg.percentage).toFixed(2)}`}
                        strokeDashoffset={seg.offset.toFixed(2)}
                        strokeLinecap="butt"
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredNodeId(seg.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => onSelectLocation(selectedLocation === seg.id ? 'ALL' : seg.id)}
                      />
                    );
                  })}
                </svg>

                {/* Donut Center Info */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                    {hoveredNodeId
                      ? locationBreakdown.segments.find((s) => s.id === hoveredNodeId)?.label
                      : 'All Nodes'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {hoveredNodeId
                      ? `${locationBreakdown.segments.find((s) => s.id === hoveredNodeId)?.percentage.toFixed(1)}%`
                      : '100%'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {hoveredNodeId
                      ? metricMode === 'UNITS'
                        ? `${locationBreakdown.segments.find((s) => s.id === hoveredNodeId)?.units.toLocaleString()} pcs`
                        : `৳${Math.round((locationBreakdown.segments.find((s) => s.id === hoveredNodeId)?.value || 0) / 1000)}k`
                      : '5 Outlets'}
                  </span>
                </div>
              </div>

              {/* Interactive Node List */}
              <div className="flex-1 w-full space-y-1.5">
                {locationBreakdown.segments.map((node) => {
                  const isSelected = selectedLocation === node.id;
                  const isHovered = hoveredNodeId === node.id;

                  return (
                    <div
                      key={node.id}
                      onClick={() => onSelectLocation(isSelected ? 'ALL' : node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`flex items-center justify-between p-1.5 px-2.5 rounded-lg text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                          : isHovered
                          ? 'bg-slate-50 dark:bg-[#141414] border-slate-200 dark:border-slate-800'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#121212]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: node.color }}
                        />
                        <span className="font-medium text-slate-900 dark:text-white truncate">
                          {node.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                          {metricMode === 'UNITS'
                            ? `${node.units.toLocaleString()} pcs`
                            : `৳${Math.round(node.value / 1000).toLocaleString()}k`}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-10 text-right">
                          {node.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-[#1A1A1A]">
            <span>💡 Click any outlet node to filter stock list</span>
            {selectedLocation !== 'ALL' && (
              <button
                onClick={() => onSelectLocation('ALL')}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                Clear Node Filter
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: Dual Breakdown: Size-Wise (Variations) vs Category-Wise - 7 Cols  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                {distributionTab === 'SIZE' ? (
                  <Ruler className="w-4 h-4 text-blue-500" />
                ) : (
                  <Layers className="w-4 h-4 text-indigo-500" />
                )}
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {distributionTab === 'SIZE'
                    ? 'Size-Wise (Variation) Stock Distribution'
                    : 'Category Stock Volume & Valuation'}
                </h3>
                {selectedCategory !== 'ALL' && distributionTab === 'SIZE' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    {selectedCategory}
                  </span>
                )}
              </div>

              {/* View Selector: Size-Wise vs Category-Wise */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141414] p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setDistributionTab('SIZE')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    distributionTab === 'SIZE'
                      ? 'bg-white dark:bg-[#202020] text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Ruler className="w-3 h-3" />
                  <span>Size Curve (Variations)</span>
                </button>

                <button
                  onClick={() => setDistributionTab('CATEGORY')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    distributionTab === 'CATEGORY'
                      ? 'bg-white dark:bg-[#202020] text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Categories</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT A: SIZE-WISE (VARIATION-WISE) STOCK CURVE */}
            {distributionTab === 'SIZE' && (
              <div className="py-3 space-y-3">
                {/* Horizontal scrollable visual size curve columns */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-2">
                  {sizeBreakdownData.sizes.map((s) => {
                    const metricVal = metricMode === 'UNITS' ? s.units : s.value;
                    const heightPct = Math.max(
                      14,
                      Math.round((metricVal / sizeBreakdownData.maxMetricVal) * 100)
                    );
                    const isSelected = selectedSize.toUpperCase() === s.size.toUpperCase();
                    const hasHighStockout = s.stockoutRate > 25 && s.skuCount >= 3;

                    return (
                      <div
                        key={s.size}
                        onClick={() => onSelectSize(isSelected ? 'ALL' : s.size)}
                        className={`group p-2.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 ring-2 ring-blue-500 shadow-2xs'
                            : 'bg-slate-50/60 dark:bg-[#121212] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Top: Size Badge & SKUs count */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {s.size}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            {s.skuCount} skus
                          </span>
                        </div>

                        {/* Middle: Visual Bar Indicator */}
                        <div className="my-2 h-16 flex items-end justify-center bg-slate-100/80 dark:bg-[#181818] rounded-md p-1">
                          <div
                            className={`w-full rounded-sm transition-all duration-300 ${
                              hasHighStockout
                                ? 'bg-amber-500/85 hover:bg-amber-600'
                                : 'bg-blue-500/85 hover:bg-blue-600'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>

                        {/* Bottom: Units & Stockout status */}
                        <div className="text-center pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                          <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                            {metricMode === 'UNITS'
                              ? `${s.units.toLocaleString()} pcs`
                              : `৳${Math.round(s.value / 1000)}k`}
                          </div>
                          <div
                            className={`text-[9px] font-semibold mt-0.5 ${
                              s.stockoutRate > 25
                                ? 'text-rose-600 dark:text-rose-400'
                                : s.stockoutRate > 10
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {s.outOfStockCount > 0 ? `${s.outOfStockCount} zero stock` : 'Healthy stock'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Size Curve Reorder Callout */}
                {sizeBreakdownData.highStockoutSizes.length > 0 && (
                  <div className="p-2.5 px-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Size curve alert: Sizes{' '}
                        <strong>{sizeBreakdownData.highStockoutSizes.join(', ')}</strong> have elevated
                        stockout rates. Prioritize these variations for Central Warehouse replenishment.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT B: CATEGORY-WISE STOCK */}
            {distributionTab === 'CATEGORY' && (
              <div className="space-y-2.5 py-3">
                {categoryBreakdown.topCategories.map((c) => {
                  const metricVal = metricMode === 'UNITS' ? c.units : c.value;
                  const barWidth = `${Math.max(6, Math.round((metricVal / categoryBreakdown.maxMetricVal) * 100))}%`;
                  const isSelected = selectedCategory === c.category;

                  return (
                    <div
                      key={c.category}
                      onClick={() => onSelectCategory(isSelected ? 'ALL' : c.category)}
                      className={`group p-2 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 shadow-2xs'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#121212]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {c.category}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            ({c.skuCount} SKUs)
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-slate-900 dark:text-white font-mono">
                            {metricMode === 'UNITS'
                              ? `${c.units.toLocaleString()} pcs`
                              : `৳${c.value.toLocaleString()}`}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {metricMode === 'UNITS'
                              ? `৳${Math.round(c.value / 1000)}k`
                              : `${c.units.toLocaleString()} pcs`}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: barWidth,
                            backgroundColor: c.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-[#1A1A1A]">
            <span>
              {distributionTab === 'SIZE'
                ? '💡 Click any size column to filter variations'
                : '💡 Click any category bar to filter stock table'}
            </span>
            {(selectedSize !== 'ALL' || selectedCategory !== 'ALL') && (
              <div className="flex items-center gap-2">
                {selectedSize !== 'ALL' && (
                  <button
                    onClick={() => onSelectSize('ALL')}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                  >
                    Clear Size ({selectedSize})
                  </button>
                )}
                {selectedCategory !== 'ALL' && (
                  <button
                    onClick={() => onSelectCategory('ALL')}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Clear Category ({selectedCategory})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: Stock Health Breakdown & Reorder Pipeline - 6 Columns             */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Stock Health & Reorder Urgency
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total: {metrics.totalSkus.toLocaleString()} SKUs
              </span>
            </div>

            {/* Health Stack Progress Bar */}
            <div className="py-3">
              <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${healthSegments[0].pct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Healthy Stock: ${healthSegments[0].count} SKUs (${healthSegments[0].pct.toFixed(1)}%)`}
                />
                <div
                  style={{ width: `${healthSegments[1].pct}%` }}
                  className="bg-amber-500 h-full transition-all duration-300"
                  title={`Low Stock: ${healthSegments[1].count} SKUs (${healthSegments[1].pct.toFixed(1)}%)`}
                />
                <div
                  style={{ width: `${healthSegments[2].pct}%` }}
                  className="bg-rose-500 h-full transition-all duration-300"
                  title={`Out of Stock: ${healthSegments[2].count} SKUs (${healthSegments[2].pct.toFixed(1)}%)`}
                />
              </div>

              {/* Status Badges Cards */}
              <div className="grid grid-cols-3 gap-2.5 mt-3.5">
                {healthSegments.map((item) => {
                  const isSelected = selectedStatus === item.status;
                  return (
                    <div
                      key={item.status}
                      onClick={() => onSelectStatus(isSelected ? 'ALL' : item.status)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                          : item.bg
                      }`}
                    >
                      <div className="text-lg font-bold font-mono">{item.count}</div>
                      <div className="text-[11px] font-semibold mt-0.5">{item.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{item.pct.toFixed(1)}% of SKUs</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-[#1A1A1A]">
            <span>💡 Click a health card to inspect matching products</span>
            {selectedStatus !== 'ALL' && (
              <button
                onClick={() => onSelectStatus('ALL')}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                Clear Health Filter
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 4: Inventory Extremes (Top Overstocked vs High-Velocity Low Stock) - 6 Columns */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Critical Shortages & High Stock
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Operational Triage
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
              {/* Critical Stockouts (Urgent Reorder) */}
              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40">
                <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300 mb-2">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Urgent Replenish</span>
                  </div>
                  <span className="text-[10px] font-normal">Fast Velocity</span>
                </div>

                <div className="space-y-1.5">
                  {topCriticalStockouts.length === 0 ? (
                    <div className="text-[11px] text-slate-500 py-3 text-center">
                      No fast-selling items with critical shortages.
                    </div>
                  ) : (
                    topCriticalStockouts.map((item) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between text-[11px] bg-white/80 dark:bg-[#111] p-1.5 px-2 rounded-lg border border-rose-100 dark:border-rose-900/20"
                      >
                        <div className="truncate max-w-[120px] font-medium text-slate-800 dark:text-slate-200">
                          {item.productTitle}
                          <span className="ml-1 text-[10px] font-bold text-slate-500">
                            ({item.size})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.recentSalesVelocity} sold
                          </span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                            {item.totalStock} left
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Overstocked Items (Capital Tie-up) */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40">
                <div className="flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Highest Stock</span>
                  </div>
                  <span className="text-[10px] font-normal">Surplus Units</span>
                </div>

                <div className="space-y-1.5">
                  {topOverstocked.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center justify-between text-[11px] bg-white/80 dark:bg-[#111] p-1.5 px-2 rounded-lg border border-blue-100 dark:border-blue-900/20"
                    >
                      <div className="truncate max-w-[120px] font-medium text-slate-800 dark:text-slate-200">
                        {item.productTitle}
                        <span className="ml-1 text-[10px] font-bold text-slate-500">
                          ({item.size})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">
                          ৳{Math.round(item.retailValuation / 1000)}k
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                          {item.totalStock} pcs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-[#1A1A1A]">
            <span>💡 Identifies surplus capital vs fast-moving stockouts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
