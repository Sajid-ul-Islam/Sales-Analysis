"use client";

import React, { useState, useMemo } from 'react';
import { SkuAnalytics, ReconciledOrderRow } from '@/types';
import { SkuHistoryModal } from '@/components/SkuHistoryModal';
import {
  Search,
  Download,
  Shirt,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PackageCheck,
  RotateCcw,
  Tag,
  Filter,
  DollarSign,
  Eye
} from 'lucide-react';

interface SkuPerformanceTabProps {
  skuList: SkuAnalytics[];
  allOrderItems?: ReconciledOrderRow[];
  onSelectOrder?: (orderId: string) => void;
}

export function SkuPerformanceTab({ skuList, allOrderItems = [], onSelectOrder }: SkuPerformanceTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'returnRate' | 'deliveredRevenue' | 'returnedQty' | 'totalLoss' | 'grossQty'>('returnedQty');
  const [filterHighReturnOnly, setFilterHighReturnOnly] = useState(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedSkuData, setSelectedSkuData] = useState<SkuAnalytics | null>(null);
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);

  // Available Categories from Data
  const categories = useMemo(() => {
    const set = new Set<string>();
    skuList.forEach(s => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [skuList]);

  const filteredSkus = useMemo(() => {
    return skuList
      .filter(s => {
        if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchesSku = s.sku.toLowerCase().includes(q);
          const matchesName = s.itemName.toLowerCase().includes(q);
          const matchesCat = (s.category || '').toLowerCase().includes(q);
          if (!matchesSku && !matchesName && !matchesCat) return false;
        }
        if (filterHighReturnOnly && s.returnRate < 15) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'returnRate') return b.returnRate - a.returnRate;
        if (sortBy === 'deliveredRevenue') return b.deliveredRevenue - a.deliveredRevenue;
        if (sortBy === 'returnedQty') return b.returnedQty - a.returnedQty;
        if (sortBy === 'totalLoss') return b.totalLossFromReturns - a.totalLossFromReturns;
        if (sortBy === 'grossQty') return b.grossQty - a.grossQty;
        return 0;
      });
  }, [skuList, searchTerm, selectedCategory, sortBy, filterHighReturnOnly]);

  const totalPages = Math.ceil(filteredSkus.length / pageSize) || 1;
  const paginatedSkus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSkus.slice(start, start + pageSize);
  }, [filteredSkus, currentPage, pageSize]);

  // Aggregate Metrics
  const topReturnedSku = useMemo(() => {
    if (!skuList.length) return null;
    return [...skuList].sort((a, b) => b.returnedQty - a.returnedQty)[0];
  }, [skuList]);

  const topRevenueSku = useMemo(() => {
    if (!skuList.length) return null;
    return [...skuList].sort((a, b) => b.deliveredRevenue - a.deliveredRevenue)[0];
  }, [skuList]);

  const totalReturnLoss = useMemo(() => {
    return skuList.reduce((acc, s) => acc + s.totalLossFromReturns, 0);
  }, [skuList]);

  const totalDispatchedUnits = useMemo(() => {
    return skuList.reduce((acc, s) => acc + s.grossQty, 0);
  }, [skuList]);

  const totalDeliveredUnits = useMemo(() => {
    return skuList.reduce((acc, s) => acc + s.deliveredQty, 0);
  }, [skuList]);

  const avgReturnRate = useMemo(() => {
    return totalDispatchedUnits > 0
      ? (((totalDispatchedUnits - totalDeliveredUnits) / totalDispatchedUnits) * 100).toFixed(1)
      : '0.0';
  }, [totalDispatchedUnits, totalDeliveredUnits]);

  // CSV Export Function
  const handleExportCsv = () => {
    const headers = ['SKU Code', 'Item Description', 'Category', 'Unit Price', 'Gross Dispatched', 'Delivered Qty', 'Returned Qty', 'Return Rate (%)', 'Delivered Net Sales (BDT)', 'Return Loss (BDT)'];
    const rows = filteredSkus.map(s => [
      `"${s.sku}"`,
      `"${s.itemName.replace(/"/g, '""')}"`,
      `"${s.category || 'N/A'}"`,
      s.unitPrice || 0,
      s.grossQty,
      s.deliveredQty,
      s.returnedQty,
      s.returnRate.toFixed(2),
      Math.round(s.deliveredRevenue),
      Math.round(s.totalLossFromReturns)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DEEN_SKU_Performance_Analysis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-primary font-bold">
              <Shirt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                Item & Product Catalog Intelligence
              </span>
              <h2 className="font-headline text-base sm:text-lg font-bold text-navy-deep">
                SKU Performance & Category Return Analysis
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live SKU unit realization, return rates, and revenue impact across all {skuList.length} catalog items. Identifies high-risk sizing discrepancies and top revenue drivers.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export SKU CSV</span>
        </button>
      </div>

      {/* SKU Executive Summary Cards (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Top Revenue SKU */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Top Revenue SKU</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-base font-black text-emerald-600 font-mono truncate" title={topRevenueSku?.sku}>
              {topRevenueSku?.sku || 'N/A'}
            </div>
            <div className="text-[11px] text-slate-600 truncate mt-0.5" title={topRevenueSku?.itemName}>
              {topRevenueSku?.itemName || '—'}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{topRevenueSku?.deliveredQty || 0} units</span>
            <span className="font-bold text-emerald-600">৳ {Math.round(topRevenueSku?.deliveredRevenue || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Card 2: Highest Return SKU */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Highest Returns</span>
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-base font-black text-rose-600 font-mono truncate" title={topReturnedSku?.sku}>
              {topReturnedSku?.sku || 'N/A'}
            </div>
            <div className="text-[11px] text-slate-600 truncate mt-0.5" title={topReturnedSku?.itemName}>
              {topReturnedSku?.itemName || '—'}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{topReturnedSku?.returnedQty || 0} ret</span>
            <span className="font-bold text-rose-600">{(topReturnedSku?.returnRate || 0).toFixed(1)}% rate</span>
          </div>
        </div>

        {/* Card 3: Total Return Value Loss */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Return Revenue Loss</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 font-headline">
              ৳ {Math.round(totalReturnLoss).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Value of uncollected returned items</p>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Across {skuList.length} catalog styles
          </div>
        </div>

        {/* Card 4: Total Units Audited */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Total Units Audited</span>
            <PackageCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-navy-deep font-headline">
              {totalDispatchedUnits.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Dispatched inventory items</p>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{totalDeliveredUnits.toLocaleString()} kept</span>
            <span className="font-bold text-emerald-600">
              {totalDispatchedUnits > 0 ? ((totalDeliveredUnits / totalDispatchedUnits) * 100).toFixed(0) : 0}% kept
            </span>
          </div>
        </div>

        {/* Card 5: Catalog Return Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Catalog Return Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-primary font-headline">
              {avgReturnRate}%
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Weighted average return incidence</p>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            {skuList.filter(s => s.returnRate > 15).length} styles &gt;15% return rate
          </div>
        </div>
      </div>

      {/* Category Pills & Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => { setSelectedCategory('ALL'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-primary text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories ({skuList.length})
          </button>
          {categories.map((cat) => {
            const count = skuList.filter(s => s.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-lg">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU code (101-0100), product name, wash, fit..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-colors"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none shrink-0">
              <input
                type="checkbox"
                checked={filterHighReturnOnly}
                onChange={(e) => { setFilterHighReturnOnly(e.target.checked); setCurrentPage(1); }}
                className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
              />
              <span>High Return (&gt;15%)</span>
            </label>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-[11px] text-slate-500 font-medium">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-primary focus:bg-white"
            >
              <option value="returnedQty">Highest Returned Units</option>
              <option value="returnRate">Highest Return Rate %</option>
              <option value="deliveredRevenue">Highest Realized Revenue</option>
              <option value="grossQty">Highest Dispatched Units</option>
              <option value="totalLoss">Highest Revenue Lost</option>
            </select>
          </div>
        </div>
      </div>

      {/* SKU Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-3">Product Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-center">Gross Dispatched</th>
                <th className="py-3 px-3 text-center">Delivered</th>
                <th className="py-3 px-3 text-center">Returned</th>
                <th className="py-3 px-3 text-center">Return Rate</th>
                <th className="py-3 px-4 text-right">Delivered Net Sales</th>
                <th className="py-3 px-4 text-right">Return Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedSkus.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Shirt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No SKU items match your search or filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing the category filter or searching by code.</p>
                  </td>
                </tr>
              ) : (
                paginatedSkus.map((s, idx) => {
                  const rateColor =
                    s.returnRate > 25
                      ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                      : s.returnRate > 15
                      ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/60';

                  return (
                    <tr
                      key={`${s.sku}-${idx}`}
                      onClick={() => {
                        setSelectedSku(s.sku);
                        setSelectedSkuData(s);
                        setIsSkuModalOpen(true);
                      }}
                      className="hover:bg-orange-50/40 cursor-pointer transition-colors group"
                      title="Click to view all orders and delivery history for this SKU"
                    >
                      {/* SKU Code */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="text-primary font-bold group-hover:underline flex items-center gap-1.5">
                          {s.sku}
                          <Eye className="w-3 h-3 text-slate-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </td>

                      {/* Product Description */}
                      <td className="py-3 px-3 max-w-[260px]">
                        <span className="text-slate-800 font-semibold block truncate" title={s.itemName}>
                          {s.itemName || 'DEEN Denim Apparel'}
                        </span>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/50">
                          {s.category || 'Apparel'}
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        ৳ {s.unitPrice ? s.unitPrice.toLocaleString() : '—'}
                      </td>

                      {/* Gross Dispatched */}
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        {s.grossQty}
                      </td>

                      {/* Delivered Units */}
                      <td className="py-3 px-3 text-center font-bold text-emerald-600">
                        {s.deliveredQty}
                      </td>

                      {/* Returned Units */}
                      <td className="py-3 px-3 text-center font-bold text-rose-600">
                        {s.returnedQty}
                      </td>

                      {/* Return Rate */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${rateColor}`}>
                          {s.returnRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* Delivered Net Sales */}
                      <td className="py-3 px-4 text-right font-black text-emerald-600 whitespace-nowrap font-mono">
                        ৳ {Math.round(s.deliveredRevenue).toLocaleString()}
                      </td>

                      {/* Return Loss */}
                      <td className="py-3 px-4 text-right font-bold text-rose-600 whitespace-nowrap font-mono">
                        {s.totalLossFromReturns > 0 ? `৳ ${Math.round(s.totalLossFromReturns).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="bg-slate-50/60 px-4 py-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredSkus.length)} - {Math.min(currentPage * pageSize, filteredSkus.length)} of {filteredSkus.length} styles
            </span>
            <span className="text-slate-300">•</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-600"
            >
              <option value={15}>15 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-40 text-xs font-semibold hover:bg-slate-50"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-40 text-xs font-semibold hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SKU Order History Drill-Down Modal */}
      <SkuHistoryModal
        sku={selectedSku}
        skuData={selectedSkuData}
        allOrderItems={allOrderItems}
        isOpen={isSkuModalOpen}
        onClose={() => setIsSkuModalOpen(false)}
        onSelectOrder={onSelectOrder}
      />
    </div>
  );
}
