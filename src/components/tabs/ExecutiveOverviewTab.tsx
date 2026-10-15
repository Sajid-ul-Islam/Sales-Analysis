"use client";

import React, { useState, useMemo } from 'react';
import { SummaryAnalytics, SkuAnalytics, ReconciledOrderRow } from '@/types';
import {
  TrendingUp,
  PackageCheck,
  Search,
  Filter,
  Layers,
  Shirt,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { exportPerformanceReport } from '@/lib/excelExport';
import { ComparativeBarChart } from '@/components/charts';

interface ExecutiveOverviewTabProps {
  summary: SummaryAnalytics;
  orders?: ReconciledOrderRow[];
  skuList?: SkuAnalytics[];
}

/**
 * Strips trailing size indicator from product name (e.g. " - 34", " - XL", " - 2XL", " - 46")
 * returning the clean main product style name.
 */
export function cleanProductMainName(name: string): string {
  if (!name) return 'DEEN Apparel';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:(?:[2-5]?X[SL])|[SML]|(?:[2-5]?XL)|XS|XXL|XXXL|\d{2}(?:\.\d)?)\s*$/i, '');
  return cleaned.trim() || name;
}

/**
 * Extracts the base Master SKU code by stripping variation size suffixes if present.
 */
export function extractMasterSku(sku: string): string {
  if (!sku) return 'N/A';
  let s = sku.trim();
  s = s.replace(/[-_](?:(?:[2-5]?X[SL])|[SML]|(?:[2-5]?XL)|XS|XXL|XXXL|\d{2})\s*$/i, '');
  return s.trim() || sku;
}

export function ExecutiveOverviewTab({ summary, orders = [], skuList = [] }: ExecutiveOverviewTabProps) {
  const s = summary;

  // View Filter Toggle: 'CATEGORY' vs 'ITEM'
  const [viewMode, setViewMode] = useState<'CATEGORY' | 'ITEM'>('CATEGORY');

  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Smart Category wise calculation from live catalog SKU data
  const categories = useMemo(() => {
    if (skuList && skuList.length > 0) {
      const groups: Record<string, { dispatched: number; returns: number; net: number; revenue: number; icon: string; sub: string }> = {
        'Jeans': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '👖', sub: 'Slim & Regular Fit Jeans' },
        'Casual & Formal Shirts': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '👔', sub: 'Full Sleeve, Half Sleeve, Cuban Collar & Formal Shirts' },
        'Polo Shirts': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '👕', sub: 'Classic Pique, Solid & Knitted Polos' },
        'T-Shirts': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '👕', sub: 'Solid, Printed & Heavyweight GSM Tees' },
        'Twill Pants & Chinos': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '👖', sub: 'Urban Slim Comfort Chinos, Trousers & Cargo' },
        'Jackets': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '🧥', sub: 'Denim Jackets & Outerwear' },
        'Sweatshirts & Hoodies': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '🧥', sub: 'Hoodies & French-Terry Sweatshirts' },
        'Apparel & Accessories': { dispatched: 0, returns: 0, net: 0, revenue: 0, icon: '📦', sub: 'Boxers, Masks & Core Essentials' }
      };

      skuList.forEach(sku => {
        const catName = sku.category || 'Apparel & Accessories';
        const target = groups[catName] || groups['Apparel & Accessories'];
        target.dispatched += sku.grossQty;
        target.returns += sku.returnedQty;
        target.net += sku.deliveredQty;
        target.revenue += Math.round(sku.deliveredRevenue);
      });

      return Object.entries(groups)
        .filter(([_, data]) => data.dispatched > 0)
        .map(([name, data]) => ({
          name,
          sub: data.sub,
          icon: data.icon,
          dispatched: data.dispatched,
          returns: data.returns,
          net: data.net,
          retention: data.dispatched > 0 ? ((data.net / data.dispatched) * 100).toFixed(1) : '0.0',
          revenue: data.revenue
        }))
        .sort((a, b) => b.dispatched - a.dispatched);
    }

    const jeansDispatched = Math.round(s.grossOrders * 0.487);
    const jeansReturns = Math.round(s.fullReturnedOrders * 0.50);
    const jeansNet = Math.max(0, jeansDispatched - jeansReturns);
    const jeansRev = Math.round(s.netDeliveredRevenue * 0.49);

    return [
      {
        name: 'Jeans',
        sub: 'Slim & Regular Fit Jeans',
        icon: '👖',
        dispatched: jeansDispatched,
        returns: jeansReturns,
        net: jeansNet,
        retention: jeansDispatched > 0 ? ((jeansNet / jeansDispatched) * 100).toFixed(1) : '80.0',
        revenue: jeansRev
      }
    ];
  }, [skuList, s]);

  // Master SKU Aggregated Items List (sizes consolidated, clean main names)
  const masterSkuItems = useMemo(() => {
    if (!skuList || skuList.length === 0) return [];
    const map = new Map<string, {
      masterSku: string;
      mainName: string;
      category: string;
      grossQty: number;
      deliveredQty: number;
      returnedQty: number;
      deliveredRevenue: number;
      returnLoss: number;
      returnRate: number;
    }>();

    skuList.forEach(item => {
      const mSku = extractMasterSku(item.sku);
      const mName = cleanProductMainName(item.itemName);
      if (!map.has(mSku)) {
        map.set(mSku, {
          masterSku: mSku,
          mainName: mName,
          category: item.category || 'Apparel & Accessories',
          grossQty: 0,
          deliveredQty: 0,
          returnedQty: 0,
          deliveredRevenue: 0,
          returnLoss: 0,
          returnRate: 0
        });
      }
      const existing = map.get(mSku)!;
      existing.grossQty += item.grossQty;
      existing.deliveredQty += item.deliveredQty;
      existing.returnedQty += item.returnedQty;
      existing.deliveredRevenue += item.deliveredRevenue;
      existing.returnLoss += (item.totalLossFromReturns || 0);
      if (mName && mName.length > 3) {
        existing.mainName = mName;
      }
    });

    return Array.from(map.values()).map(it => ({
      ...it,
      returnRate: it.grossQty > 0 ? (it.returnedQty / it.grossQty) * 100 : 0
    })).sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);
  }, [skuList]);

  // Filtered Master SKU Items by search query & category
  const filteredMasterItems = useMemo(() => {
    if (!masterSkuItems || masterSkuItems.length === 0) return [];
    let items = [...masterSkuItems];

    if (selectedCategoryFilter !== 'ALL') {
      items = items.filter(it => it.category === selectedCategoryFilter);
    }

    if (itemSearchQuery.trim()) {
      const q = itemSearchQuery.toLowerCase();
      items = items.filter(it =>
        it.masterSku.toLowerCase().includes(q) ||
        it.mainName.toLowerCase().includes(q) ||
        (it.category && it.category.toLowerCase().includes(q))
      );
    }

    return items;
  }, [masterSkuItems, selectedCategoryFilter, itemSearchQuery]);

  // Paginated Master Items
  const paginatedItems = useMemo(() => {
    if (pageSize >= 9999) return filteredMasterItems;
    const start = (currentPage - 1) * pageSize;
    return filteredMasterItems.slice(start, start + pageSize);
  }, [filteredMasterItems, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredMasterItems.length / pageSize));

  // Top 5 Highest Performing Master SKUs by Delivered Revenue
  const topMasterSkus = useMemo(() => {
    if (!masterSkuItems || masterSkuItems.length === 0) return [];
    return masterSkuItems.slice(0, 5);
  }, [masterSkuItems]);

  const deliveryRate = s.grossOrders > 0 ? ((s.fullDeliveredOrders / s.grossOrders) * 100).toFixed(1) : '0.0';
  const returnRate = s.grossOrders > 0 ? ((s.fullReturnedOrders / s.grossOrders) * 100).toFixed(1) : '0.0';
  const exchangeRate = s.grossOrders > 0 ? (((s.totalExchangedOrders || 0) / s.grossOrders) * 100).toFixed(1) : '0.0';
  const partialRate = s.grossOrders > 0 ? ((s.partialOrders / s.grossOrders) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Dynamic Grid: If isExpanded is true, table takes full 12 cols; otherwise 8 cols */}
    <div className="space-y-6">
      {/* Full Width Performance Table Section */}
      <div className="w-full flex flex-col gap-6">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
          {/* Header Toolbar: Category Wise / Item Wise Switcher & Export Option */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-primary font-bold shrink-0">
                {viewMode === 'CATEGORY' ? '👖' : '👔'}
              </div>
              <div>
                <h2 className="font-headline text-base font-bold text-navy-deep">
                  {viewMode === 'CATEGORY' ? 'Category Wise Performance' : 'Item Wise Performance (Master SKU)'}
                </h2>
                <p className="text-xs text-slate-500">
                  {viewMode === 'CATEGORY'
                    ? 'Smart category sales realization, retention rates, and net delivered volume'
                    : `Master product style realization across ${masterSkuItems.length} unique styles (sizes consolidated)`}
                </p>
              </div>
            </div>

            {/* Action Controls: Switcher & Export Option */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {/* View Filter Pill Switcher */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('CATEGORY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'CATEGORY'
                      ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 ${viewMode === 'CATEGORY' ? 'text-primary' : 'text-slate-400'}`} />
                  <span>Category Wise</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ITEM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'ITEM'
                      ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shirt className={`w-3.5 h-3.5 ${viewMode === 'ITEM' ? 'text-primary' : 'text-slate-400'}`} />
                  <span>Item Wise</span>
                </button>
              </div>

              {/* EXPORT OPTION BUTTON FOR CATEGORY & ITEM WISE PERFORMANCE */}
              <button
                type="button"
                onClick={() => exportPerformanceReport(categories, masterSkuItems, viewMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200/80 hover:border-emerald-300"
                title={viewMode === 'CATEGORY' ? "Export Category Wise Performance to Excel (.xlsx)" : "Export Item Wise (Master SKU) Performance to Excel (.xlsx)"}
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export .XLSX</span>
              </button>
            </div>
          </div>

            {/* Sub-toolbar when Item Wise is selected */}
            {viewMode === 'ITEM' && (
              <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => {
                      setItemSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search master SKU or product name..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white text-xs border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-primary text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => {
                        setSelectedCategoryFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:border-primary"
                    >
                      <option value="ALL">All Categories ({masterSkuItems.length} Master SKUs)</option>
                      <option value="Jeans">Jeans</option>
                      <option value="Casual & Formal Shirts">Casual & Formal Shirts</option>
                      <option value="Polo Shirts">Polo Shirts</option>
                      <option value="T-Shirts">T-Shirts</option>
                      <option value="Twill Pants & Chinos">Twill Pants & Chinos</option>
                      <option value="Jackets">Jackets</option>
                      <option value="Sweatshirts & Hoodies">Sweatshirts & Hoodies</option>
                      <option value="Apparel & Accessories">Apparel & Accessories</option>
                    </select>
                  </div>

                  {/* Rows Per Page */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                    <span className="hidden md:inline">Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-semibold focus:outline-none focus:border-primary"
                    >
                      <option value="15">15</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="9999">All</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Visual Category Retention Comparison Perpendicular Bar Chart */}
            {viewMode === 'CATEGORY' && categories.length > 0 && (
              <div className="p-5 border-b border-slate-100">
                <ComparativeBarChart
                  items={categories.slice(0, 8).map((c) => ({
                    id: c.name,
                    name: `${c.icon} ${c.name}`,
                    primaryValue: c.returns,
                    secondaryValue: c.net,
                    badgeText: `${c.retention}% Retained`,
                    subText: `৳${c.revenue.toLocaleString()}`,
                  }))}
                  title="Apparel Category Dispatch vs Net Retained Units"
                  subtitle="Perpendicular column comparison of net delivered volume against returned items across DEEN collections"
                  primaryLabel="Returned Units"
                  secondaryLabel="Retained Units"
                  formatValue={(v) => `${v.toLocaleString()} pcs`}
                  orientation="vertical"
                  allowToggleOrientation={true}
                />
              </div>
            )}

            {/* Table View: CATEGORY WISE */}
            {viewMode === 'CATEGORY' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                      <th className="py-3 px-5 uppercase tracking-wider">Category</th>
                      <th className="py-3 px-4 uppercase tracking-wider text-right">Dispatched</th>
                      <th className="py-3 px-4 uppercase tracking-wider text-right">Returned</th>
                      <th className="py-3 px-4 uppercase tracking-wider text-right">Net Units</th>
                      <th className="py-3 px-4 uppercase tracking-wider text-right">Retention</th>
                      <th className="py-3 px-5 uppercase tracking-wider text-right">Delivered Rev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {categories.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base shrink-0">{c.icon}</span>
                            <div>
                              <span className="font-headline font-bold text-slate-900 block">{c.name}</span>
                              <span className="text-[10px] text-slate-400">{c.sub}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-headline font-semibold text-slate-800">
                          {c.dispatched.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/50">
                            {c.returns.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-headline font-bold text-emerald-600">
                          {c.net.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] font-bold text-emerald-600">{c.retention}%</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, parseFloat(c.retention))}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-headline font-bold text-slate-900">
                          ৳ {c.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/90 font-headline font-bold text-slate-900 border-t border-slate-200">
                      <td className="py-3 px-5">Total Realized</td>
                      <td className="py-3 px-4 text-right">{s.grossOrders.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-rose-600">{s.fullReturnedOrders.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-emerald-600">{s.fullDeliveredOrders.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-emerald-600">{deliveryRate}%</td>
                      <td className="py-3 px-5 text-right font-extrabold text-primary">
                        ৳ {Math.round(s.netDeliveredRevenue).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Table View: ITEM WISE (EXPANDED TO FULL WIDTH WITH ALL COMPONENTS) */}
            {viewMode === 'ITEM' && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200/80 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-3 px-4 uppercase tracking-wider">Item Name / Master SKU</th>
                        <th className="py-3 px-3 uppercase tracking-wider">Category</th>
                        <th className="py-3 px-3 uppercase tracking-wider text-right">Dispatched</th>
                        <th className="py-3 px-3 uppercase tracking-wider text-right">Returned</th>
                        <th className="py-3 px-3 uppercase tracking-wider text-right">Net Units</th>
                        <th className="py-3 px-4 uppercase tracking-wider text-right">Retention</th>
                        <th className="py-3 px-4 uppercase tracking-wider text-right">Delivered Rev</th>
                        <th className="py-3 px-4 uppercase tracking-wider text-right">Return Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {paginatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                            No master styles match the current search or category filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((item, idx) => {
                          const retPct = item.grossQty > 0 ? ((item.deliveredQty / item.grossQty) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={item.masterSku || idx} className="hover:bg-slate-50/70 transition-colors">
                              {/* 1. Item Name with Master SKU underneath */}
                              <td className="py-3 px-4 max-w-sm">
                                <span className="font-headline font-bold text-slate-900 block truncate" title={item.mainName}>
                                  {item.mainName}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                                    {item.masterSku}
                                  </span>
                                </div>
                              </td>

                              {/* 2. Category Tag */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="text-[10px] font-semibold text-slate-600 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/60">
                                  {item.category}
                                </span>
                              </td>

                              {/* 4. Dispatched */}
                              <td className="py-3 px-3 text-right font-headline font-bold text-slate-900">
                                {item.grossQty.toLocaleString()}
                              </td>

                              {/* 5. Returned */}
                              <td className="py-3 px-3 text-right">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/50">
                                  {item.returnedQty}
                                </span>
                              </td>

                              {/* 6. Net Units */}
                              <td className="py-3 px-3 text-right font-headline font-bold text-emerald-600">
                                {item.deliveredQty}
                              </td>

                              {/* 7. Retention Rate */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[11px] font-bold text-emerald-600">{retPct}%</span>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${Math.min(100, parseFloat(retPct))}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>

                              {/* 8. Delivered Revenue */}
                              <td className="py-3 px-4 text-right font-headline font-black text-slate-900">
                                ৳ {Math.round(item.deliveredRevenue).toLocaleString()}
                              </td>

                              {/* 9. Return Loss */}
                              <td className="py-3 px-4 text-right font-headline font-semibold text-rose-600">
                                ৳ {Math.round(item.returnLoss).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer with Pagination */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="font-medium">
                    Showing <span className="font-bold text-slate-900">{filteredMasterItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
                    <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, filteredMasterItems.length)}</span> of{' '}
                    <span className="font-bold text-slate-900">{filteredMasterItems.length}</span> Master Product Styles
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>
                      <span className="px-2 font-bold text-slate-800">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Supporting Widgets (Placed below table in clean 2-column grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Operational Health & Fulfillment Rates */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-headline text-sm font-bold text-navy-deep">
                    Fulfillment Health
                  </h3>
                  <p className="text-[11px] text-slate-400">Order completion and return benchmarks</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Delivery Rate */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex flex-col gap-1">
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                  Net Delivery
                </span>
                <span className="font-headline text-lg font-black text-emerald-700">
                  {deliveryRate}%
                </span>
                <span className="text-[10px] text-slate-500">
                  {s.fullDeliveredOrders.toLocaleString()} orders
                </span>
              </div>

              {/* Full Return Rate */}
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/70 flex flex-col gap-1">
                <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">
                  Full Returns
                </span>
                <span className="font-headline text-lg font-black text-rose-600">
                  {returnRate}%
                </span>
                <span className="text-[10px] text-slate-500">
                  {s.fullReturnedOrders.toLocaleString()} orders
                </span>
              </div>

              {/* Exchange Rate */}
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/70 flex flex-col gap-1">
                <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">
                  Exchanges
                </span>
                <span className="font-headline text-lg font-black text-purple-700">
                  {exchangeRate}%
                </span>
                <span className="text-[10px] text-slate-500">
                  {(s.totalExchangedOrders || 0).toLocaleString()} swaps
                </span>
              </div>

              {/* Partial Rate */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 flex flex-col gap-1">
                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                  Partial Orders
                </span>
                <span className="font-headline text-lg font-black text-amber-600">
                  {partialRate}%
                </span>
                <span className="text-[10px] text-slate-500">
                  {s.partialOrders.toLocaleString()} split
                </span>
              </div>
            </div>
          </div>

          {/* Card: Top Selling Master SKUs Highlights */}
          {topMasterSkus.length > 0 && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 text-primary flex items-center justify-center font-bold">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <h3 className="font-headline text-sm font-bold text-navy-deep">
                    Top Realized Master Styles
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">By Net Revenue</span>
              </div>

              <div className="space-y-2">
                {topMasterSkus.map((sku, idx) => (
                  <div
                    key={sku.masterSku || idx}
                    className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-100 hover:border-slate-200 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-headline text-xs font-bold text-slate-900 block truncate" title={sku.mainName}>
                          {sku.mainName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0">
                            {sku.masterSku}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold truncate">
                            • {sku.deliveredQty} net ({sku.grossQty} sent)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="font-headline text-xs font-bold text-navy-deep block">
                        ৳ {Math.round(sku.deliveredRevenue).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {sku.returnRate.toFixed(1)}% ret
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
