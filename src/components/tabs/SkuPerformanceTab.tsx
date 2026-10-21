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
  Eye,
  ArrowUpRight
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
      <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-primary dark:text-orange-400 font-bold">
              <Shirt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-primary dark:text-orange-400 font-bold">
                Item & Product Catalog Intelligence
              </span>
              <h2 className="font-headline text-base sm:text-lg font-bold text-navy-deep dark:text-white">
                SKU Performance & Category Return Analysis
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Live SKU unit realization, return rates, and revenue impact across all {skuList.length} catalog items. Identifies high-risk sizing discrepancies and top revenue drivers.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2 rounded-lg bg-white dark:bg-deepBlack-elevated border border-slate-200/80 dark:border-deepBlack-border hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Export SKU CSV</span>
        </button>
      </div>

      {/* SKU Executive Summary Cards (Interactive Drilldowns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* Card 1: Top Revenue SKU */}
        <div
          onClick={() => {
            setSortBy('deliveredRevenue');
            if (topRevenueSku) setSearchTerm(topRevenueSku.sku);
          }}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
            sortBy === 'deliveredRevenue'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-emerald-300 dark:hover:border-emerald-500/50'
          }`}
          title="Click to sort by Top Revenue and view this SKU"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Top Revenue SKU</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${sortBy === 'deliveredRevenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono truncate" title={topRevenueSku?.sku}>
              {topRevenueSku?.sku || 'N/A'}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1" title={topRevenueSku?.itemName}>
              {topRevenueSku?.itemName || '—'}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{topRevenueSku?.deliveredQty || 0} units kept</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs">
              ৳ {Math.round(topRevenueSku?.deliveredRevenue || 0).toLocaleString()}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* Card 2: Highest Return SKU */}
        <div
          onClick={() => {
            setSortBy('returnedQty');
            if (topReturnedSku) setSearchTerm(topReturnedSku.sku);
          }}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
            sortBy === 'returnedQty'
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-rose-300 dark:hover:border-rose-500/50'
          }`}
          title="Click to sort by Return Volume and view this SKU"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Highest Returns</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs group-hover:scale-105 transition-transform">
                <RotateCcw className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${sortBy === 'returnedQty' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono truncate" title={topReturnedSku?.sku}>
              {topReturnedSku?.sku || 'N/A'}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1" title={topReturnedSku?.itemName}>
              {topReturnedSku?.itemName || '—'}
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{topReturnedSku?.returnedQty || 0} returned</span>
            <span className="font-bold text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 shadow-2xs">
              {(topReturnedSku?.returnRate || 0).toFixed(1)}% rate
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* Card 3: Total Return Value Loss */}
        <div
          onClick={() => setSortBy('totalLoss')}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
            sortBy === 'totalLoss'
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-rose-300 dark:hover:border-rose-500/50'
          }`}
          title="Click to sort catalog by highest Return Financial Loss"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Return Revenue Loss</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs group-hover:scale-105 transition-transform">
                <TrendingDown className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${sortBy === 'totalLoss' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-rose-600 dark:text-rose-400 font-headline tracking-tight">
              ৳ {Math.round(totalReturnLoss).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Value of uncollected returned items</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Across {skuList.length} catalog styles</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sortBy === 'totalLoss' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300' : 'text-slate-400 dark:text-slate-500'}`}>
              {sortBy === 'totalLoss' ? 'Sorted' : 'Impact'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* Card 4: Total Units Audited */}
        <div
          onClick={() => setSortBy('grossQty')}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
            sortBy === 'grossQty'
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-blue-300 dark:hover:border-blue-500/50'
          }`}
          title="Click to sort catalog by Gross Dispatched Volume"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Total Units Audited</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs group-hover:scale-105 transition-transform">
                <PackageCheck className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${sortBy === 'grossQty' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-navy-deep dark:text-white font-headline tracking-tight">
              {totalDispatchedUnits.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dispatched inventory items</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">{totalDeliveredUnits.toLocaleString()} kept</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs">
              {totalDispatchedUnits > 0 ? ((totalDeliveredUnits / totalDispatchedUnits) * 100).toFixed(0) : 0}% kept
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
        </div>

        {/* Card 5: Catalog Return Rate */}
        <div
          onClick={() => {
            setFilterHighReturnOnly(!filterHighReturnOnly);
            setSortBy('returnRate');
          }}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
            filterHighReturnOnly
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm bg-amber-50/20 dark:bg-amber-950/20'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-amber-300 dark:hover:border-amber-500/50'
          }`}
          title="Click to toggle filter for items with >15% return rate"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Catalog Return Rate</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${filterHighReturnOnly ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-amber-600 dark:text-amber-400 font-headline tracking-tight">
              {avgReturnRate}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Weighted return incidence</p>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{skuList.filter(s => s.returnRate > 15).length} items &gt; 15% RTO</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${filterHighReturnOnly ? 'bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200' : 'bg-slate-100 dark:bg-deepBlack-elevated text-slate-600 dark:text-slate-400'}`}>
              {filterHighReturnOnly ? 'Filtered >15%' : 'Click to filter'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>
      </div>

      {/* Category Pills & Filters Bar */}
      <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border p-4 shadow-xs flex flex-col gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => { setSelectedCategory('ALL'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-primary text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-deepBlack-hover'
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
                    : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-deepBlack-hover'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-deepBlack-border">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-lg">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU code (101-0100), product name, wash, fit..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-lg pl-8 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-colors"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none shrink-0">
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
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'returnRate' | 'deliveredRevenue' | 'returnedQty' | 'totalLoss' | 'grossQty')}
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas"
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
      <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border shadow-xs overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to inspect unit economics</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">SKU pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0 max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-deepBlack-border">
              <tr>
                <th className="py-3 px-4 bg-slate-50 dark:bg-deepBlack-sidebar sticky top-0 left-0 z-20 min-w-[130px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">SKU Code</th>
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
            <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-700 dark:text-slate-200">
              {paginatedSkus.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Shirt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">No SKU items match your search or filter</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try clearing the category filter or searching by code.</p>
                  </td>
                </tr>
              ) : (
                paginatedSkus.map((s, idx) => {
                  const rateColor =
                    s.returnRate > 25
                       ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/50'
                      : s.returnRate > 15
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/50'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/50';

                  return (
                    <tr
                      key={`${s.sku}-${idx}`}
                      onClick={() => {
                        setSelectedSku(s.sku);
                        setSelectedSkuData(s);
                        setIsSkuModalOpen(true);
                      }}
                      className="hover:bg-orange-50/40 dark:hover:bg-deepBlack-hover cursor-pointer transition-colors group"
                      title="Click to view all orders and delivery history for this SKU"
                    >
                      {/* SKU Code */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap sticky left-0 bg-white dark:bg-deepBlack-card group-hover:bg-[#FFF7ED] dark:group-hover:bg-deepBlack-hover z-10 min-w-[130px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                        <span className="text-primary font-bold group-hover:underline flex items-center gap-1.5">
                          {s.sku}
                          <Eye className="w-3 h-3 text-slate-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </td>

                      {/* Product Description */}
                      <td className="py-3 px-3 max-w-[260px]">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold block truncate" title={s.itemName}>
                          {s.itemName || 'DEEN Denim Apparel'}
                        </span>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-deepBlack-sidebar text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-deepBlack-border">
                          {s.category || 'Apparel'}
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        ৳ {s.unitPrice ? s.unitPrice.toLocaleString() : '—'}
                      </td>

                      {/* Gross Dispatched */}
                      <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">
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
        <div className="bg-slate-50/60 dark:bg-deepBlack-sidebar/60 px-4 py-3 border-t border-slate-200/80 dark:border-deepBlack-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredSkus.length)} - {Math.min(currentPage * pageSize, filteredSkus.length)} of {filteredSkus.length} styles
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border rounded px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300"
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
                className="px-2.5 py-1 rounded bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border text-slate-700 dark:text-slate-300 disabled:opacity-40 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-deepBlack-hover"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border text-slate-700 dark:text-slate-300 disabled:opacity-40 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-deepBlack-hover"
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
