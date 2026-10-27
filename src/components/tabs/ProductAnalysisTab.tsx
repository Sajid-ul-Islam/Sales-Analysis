"use client";

import React, { useState, useMemo } from 'react';
import { ReconciledOrderRow } from '@/types';
import {
  computeProductAnalytics,
  ProductAnalyticsItem,
} from '@/lib/productAnalytics';
import {
  Search,
  Download,
  ShoppingBag,
  TrendingUp,
  Percent,
  Layers,
  Sparkles,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  X,
  ChevronRight,
  Scale
} from 'lucide-react';

interface ProductAnalysisTabProps {
  orders: ReconciledOrderRow[];
  cogsPercent?: number;
  dateScopeDays?: number;
  onSelectOrder?: (orderId: string) => void;
}

type AnalysisViewMode = 'matrix' | 'elasticity' | 'basket' | 'fit' | 'pareto';

export function ProductAnalysisTab({
  orders,
  cogsPercent = 42,
  dateScopeDays = 30,
  onSelectOrder: _onSelectOrder,
}: ProductAnalysisTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedAbc, setSelectedAbc] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<AnalysisViewMode>('matrix');
  const [sortBy, setSortBy] = useState<
    'deliveredRevenue' | 'totalGrossUnits' | 'returnRate' | 'avgSellingPrice' | 'dailyVelocity' | 'totalReturnLoss'
  >('deliveredRevenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selected product for deep-dive modal
  const [inspectingProduct, setInspectingProduct] = useState<ProductAnalyticsItem | null>(null);

  // Basket simulator selection
  const [simulatorProductTitle, setSimulatorProductTitle] = useState<string>('');

  // 1. Run Computation Engine
  const analysisResult = useMemo(() => {
    return computeProductAnalytics(orders, {
      cogsPercent,
      dateScopeDays,
    });
  }, [orders, cogsPercent, dateScopeDays]);

  const { products, summary, marketBasketPairs } = analysisResult;

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
        if (selectedTier !== 'ALL' && p.performanceTier !== selectedTier) return false;
        if (selectedAbc !== 'ALL' && p.abcCategory !== selectedAbc) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchesTitle = p.title.toLowerCase().includes(q);
          const matchesCategory = p.category.toLowerCase().includes(q);
          const matchesSku = p.skus.some((s) => s.toLowerCase().includes(q));
          if (!matchesTitle && !matchesCategory && !matchesSku) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'deliveredRevenue') diff = b.deliveredRevenue - a.deliveredRevenue;
        else if (sortBy === 'totalGrossUnits') diff = b.totalGrossUnits - a.totalGrossUnits;
        else if (sortBy === 'returnRate') diff = b.returnRate - a.returnRate;
        else if (sortBy === 'avgSellingPrice') diff = b.avgSellingPrice - a.avgSellingPrice;
        else if (sortBy === 'dailyVelocity') diff = b.dailyVelocity - a.dailyVelocity;
        else if (sortBy === 'totalReturnLoss') diff = b.totalReturnLoss - a.totalReturnLoss;
        return sortOrder === 'desc' ? diff : -diff;
      });
  }, [products, selectedCategory, selectedTier, selectedAbc, searchTerm, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Selected product for bundle simulator
  const activeSimulatorProduct = useMemo(() => {
    if (!simulatorProductTitle && products.length > 0) {
      return products[0];
    }
    return products.find((p) => p.title === simulatorProductTitle) || products[0] || null;
  }, [simulatorProductTitle, products]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Product Title',
      'Category',
      'ABC Class',
      'Performance Tier',
      'MRP (BDT)',
      'Avg Sold Price (BDT)',
      'Avg Discount (%)',
      'Gross Units Sold',
      'Delivered Units',
      'Returned Units',
      'Return Rate (%)',
      'Delivered Net Sales (BDT)',
      'Gross Margin (%)',
      'Daily Velocity (units/day)',
      'Sweet Spot Price (BDT)',
      'Active SKUs',
    ];

    const rows = filteredProducts.map((p) => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.abcCategory,
      p.performanceTier,
      p.mrp,
      p.avgSellingPrice,
      p.avgDiscountPercent,
      p.totalGrossUnits,
      p.totalDeliveredUnits,
      p.totalReturnedUnits,
      p.returnRate,
      p.deliveredRevenue,
      p.grossMarginPercent,
      p.dailyVelocity,
      p.optimalPricePoint?.price || p.mrp,
      `"${p.skus.join('; ')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DEEN_Product_Analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-primary-dark dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-headline text-slate-900 dark:text-white">
                Product & Merchandising Intelligence
              </h2>
              <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-primary/10 text-primary-dark dark:text-orange-400 border border-primary/20">
                {summary.totalProducts} Active Products
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Price elasticity curves, multi-item basket affinities, size fit anomalies & Pareto ABC distribution.
            </p>
          </div>
        </div>

        {/* View Mode Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'matrix'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Product Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('elasticity')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'elasticity'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
            <span>Price Elasticity</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('basket')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'basket'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-indigo-500" />
            <span>Market Basket</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('fit')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'fit'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-amber-500" />
            <span>Size Fit & Returns</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pareto')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'pareto'
                ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>ABC Pareto</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Overview Strip (5 Metric Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Units & Revenue */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Net Delivered Sales
            </span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-headline text-slate-900 dark:text-white">
              ৳{summary.totalDeliveredRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                {summary.totalDeliveredUnits.toLocaleString()} units
              </span>
              <span>delivered of {summary.totalUnitsSold.toLocaleString()} ordered</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Average Sold Price & MRP Spread */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Average Sold Price
            </span>
            <span className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Tag className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-headline text-slate-900 dark:text-white">
              ৳{summary.avgProductSellingPrice.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {summary.avgDiscountDepth}% avg discount
              </span>
              <span>across {summary.discountedProductsCount} sale items</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Multi-Item Basket Rate */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Multi-Item Basket Rate
            </span>
            <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShoppingBag className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-headline text-slate-900 dark:text-white font-mono">
              {summary.multiItemOrderRate}%
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                {summary.multiItemOrdersCount} orders
              </span>
              <span> contain 2 or more garments</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Top Performer Star */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Top Revenue Driver
            </span>
            <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2 min-w-0">
            <div className="text-sm sm:text-base font-bold font-headline text-slate-900 dark:text-white truncate" title={summary.topRevenueProduct?.title || 'N/A'}>
              {summary.topRevenueProduct?.title || 'N/A'}
            </div>
            <div className="flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ৳{summary.topRevenueProduct ? summary.topRevenueProduct.deliveredRevenue.toLocaleString() : '0'}
              </span>
              <span>({summary.topRevenueProduct?.totalGrossUnits || 0} units)</span>
            </div>
          </div>
        </div>

        {/* Metric 5: Pareto Class A Share */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pareto Class A (80% GMV)
            </span>
            <span className="p-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black font-headline text-slate-900 dark:text-white">
              {summary.abcSummary.classACount} Products
            </div>
            <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">৳{summary.abcSummary.classARevenue.toLocaleString()}</span> (80% of sales)
            </div>
          </div>
        </div>
      </div>

      {/* 3. Conditional Sub-View Rendering */}

      {/* VIEW 1: PRODUCT MATRIX (MASTER INVENTORY VIEW) */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              {/* Search */}
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search product, category, SKU..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#121212] text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#121212] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Performance Tier Filter */}
              <select
                value={selectedTier}
                onChange={(e) => {
                  setSelectedTier(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#121212] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Performance Tiers</option>
                <option value="TOP_PERFORMER">🌟 Top Performers</option>
                <option value="CORE_STABLE">⚡ Core Stable</option>
                <option value="HIGH_RETURN_RISK">⚠️ High Return Risk (&gt;25%)</option>
                <option value="LOW_PERFORMER">📉 Low Movers / Dead Stock</option>
              </select>

              {/* ABC Pareto Filter */}
              <select
                value={selectedAbc}
                onChange={(e) => {
                  setSelectedAbc(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#121212] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All ABC Classes</option>
                <option value="A">Class A (Top 80% Revenue)</option>
                <option value="B">Class B (Next 15% Revenue)</option>
                <option value="C">Class C (Bottom 5% Revenue)</option>
              </select>
            </div>

            {/* Actions: Export CSV & Page Size */}
            <div className="flex items-center gap-2 self-end lg:self-center">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#121212] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value={15}>15 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Export Product Analysis to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Master Product Table */}
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 dark:border-[#1F1F1F] bg-slate-50/75 dark:bg-[#0E0E0E] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-2xs">
                  <th className="py-3 px-3.5">ABC</th>
                  <th className="py-3 px-3.5">Product Title & Category</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleToggleSort('avgSellingPrice')}
                  >
                    <div className="flex items-center gap-1">
                      <span>MRP / Sold Price</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white text-center"
                    onClick={() => handleToggleSort('totalGrossUnits')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Units Sold</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                    onClick={() => handleToggleSort('deliveredRevenue')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Net Sales (Delivered)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white text-center"
                    onClick={() => handleToggleSort('returnRate')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Return Rate</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white text-center"
                    onClick={() => handleToggleSort('dailyVelocity')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Velocity</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3">Sweet Spot Price</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#171717]">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No products match the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p) => {
                    const isHighRisk = p.performanceTier === 'HIGH_RETURN_RISK';
                    const isTop = p.performanceTier === 'TOP_PERFORMER';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-[#121212]/80 transition-colors group cursor-pointer"
                        onClick={() => setInspectingProduct(p)}
                      >
                        {/* ABC Badge */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-2xs ${
                              p.abcCategory === 'A'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : p.abcCategory === 'B'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                            title={`Pareto Class ${p.abcCategory}: Cumulative revenue rank`}
                          >
                            {p.abcCategory}
                          </span>
                        </td>

                        {/* Title & Category */}
                        <td className="py-3 px-3.5 min-w-[200px] max-w-[280px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                              {p.title}
                            </span>
                            {isTop && (
                              <span className="shrink-0 px-1 py-0.2 rounded-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-3xs border border-amber-500/20">
                                Star
                              </span>
                            )}
                            {isHighRisk && (
                              <span className="shrink-0 px-1 py-0.2 rounded-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold text-3xs border border-rose-500/20">
                                High Return
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                            <span className="truncate">{p.category}</span>
                            <span>•</span>
                            <span className="font-mono">{p.variationsCount} sizes</span>
                          </div>
                        </td>

                        {/* Price Spread & MRP */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              ৳{p.avgSellingPrice.toLocaleString()}
                            </span>
                            {p.hasDiscount && (
                              <span className="text-2xs line-through text-slate-400">
                                ৳{p.mrp.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {p.hasDiscount ? (
                            <span className="inline-block text-2xs font-bold text-emerald-600 dark:text-emerald-400">
                              {p.avgDiscountPercent}% off
                            </span>
                          ) : (
                            <span className="text-2xs text-slate-400">Full Price (MRP)</span>
                          )}
                        </td>

                        {/* Gross / Delivered Units */}
                        <td className="py-3 px-3 whitespace-nowrap text-center font-mono">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {p.totalGrossUnits}
                          </span>
                          <div className="text-2xs text-slate-400">
                            {p.totalDeliveredUnits} del • {p.totalReturnedUnits} ret
                          </div>
                        </td>

                        {/* Delivered Net Sales */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ৳{p.deliveredRevenue.toLocaleString()}
                          </div>
                          <div className="text-2xs text-slate-400">
                            Margin: {p.grossMarginPercent}%
                          </div>
                        </td>

                        {/* Return Rate */}
                        <td className="py-3 px-3 whitespace-nowrap text-center font-mono">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-extrabold ${
                              p.returnRate >= 25
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                : p.returnRate >= 15
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                            }`}
                          >
                            {p.returnRate}%
                          </span>
                        </td>

                        {/* Velocity (units/day) */}
                        <td className="py-3 px-3 whitespace-nowrap text-center font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {p.dailyVelocity} <span className="text-2xs text-slate-400">/day</span>
                        </td>

                        {/* Sweet Spot Price */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono">
                          {p.optimalPricePoint ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-2xs border border-emerald-500/20">
                                ৳{p.optimalPricePoint.price.toLocaleString()}
                              </span>
                              {p.optimalPricePoint.discountPercent > 0 && (
                                <span className="text-2xs text-slate-400">
                                  ({p.optimalPricePoint.discountPercent}% off)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-2xs text-slate-400">৳{p.mrp}</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingProduct(p);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-primary hover:text-white dark:bg-[#1A1A1A] dark:hover:bg-primary text-slate-700 dark:text-slate-200 text-2xs font-bold transition-all cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} products
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#121212] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 font-medium cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#121212] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 font-medium cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PRICE ELASTICITY & DISCOUNT SENSITIVITY */}
      {viewMode === 'elasticity' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold font-headline text-slate-900 dark:text-white">
                Price Elasticity & Sweet-Spot Pricing Radar
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Examines how sales volume and return rates shift across different selling prices and discount depths from base MRP.
            </p>
          </div>

          {/* Cards for Multi-Priced Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {products
              .filter((p) => p.pricePoints.length > 1)
              .slice(0, 10)
              .map((p) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold font-headline text-slate-900 dark:text-white truncate">
                          {p.title}
                        </h4>
                        <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{p.category}</span>
                          <span>•</span>
                          <span>Base MRP: ৳{p.mrp.toLocaleString()}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-primary/10 text-primary-dark dark:text-orange-400 border border-primary/20">
                        {p.pricePoints.length} Price Tiers
                      </span>
                    </div>

                    {/* Price Points Table */}
                    <div className="mt-3.5 overflow-x-auto rounded-xl border border-slate-100 dark:border-[#171717]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/75 dark:bg-[#0E0E0E] text-2xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#171717]">
                          <tr>
                            <th className="py-2 px-2.5">Sold Price</th>
                            <th className="py-2 px-2 text-center">Discount</th>
                            <th className="py-2 px-2 text-center">Units Sold</th>
                            <th className="py-2 px-2">Net Sales</th>
                            <th className="py-2 px-2 text-center">Return %</th>
                            <th className="py-2 px-2.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#171717] font-mono text-2xs">
                          {p.pricePoints.map((pp) => (
                            <tr
                              key={pp.price}
                              className={pp.isSweetSpot ? 'bg-emerald-50/50 dark:bg-emerald-950/20 font-bold' : ''}
                            >
                              <td className="py-2 px-2.5 text-slate-900 dark:text-white">
                                ৳{pp.price.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                                {pp.discountPercent > 0 ? `${pp.discountPercent}%` : 'MRP'}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-900 dark:text-white font-bold">
                                {pp.grossUnits}
                              </td>
                              <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                ৳{pp.netRevenue.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                                {pp.returnRate}%
                              </td>
                              <td className="py-2 px-2.5 text-right">
                                {pp.isSweetSpot ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-500 text-white font-extrabold text-3xs">
                                    👑 Sweet Spot
                                  </span>
                                ) : (
                                  <span className="text-3xs text-slate-400">Secondary</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-[#171717] flex items-center justify-between text-2xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Recommendation: Optimal price point is{' '}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        ৳{p.optimalPricePoint?.price.toLocaleString()}
                      </span>{' '}
                      generating {p.optimalPricePoint?.grossUnits} units.
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectingProduct(p)}
                      className="font-bold text-primary hover:underline"
                    >
                      Deep Dive →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* VIEW 3: MARKET BASKET & BUNDLING INTELLIGENCE */}
      {viewMode === 'basket' && (
        <div className="space-y-5">
          {/* Basket Overview Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
              <span className="text-2xs font-bold uppercase text-slate-500">1 Item Only (Solo)</span>
              <div className="text-xl font-black font-headline text-slate-900 dark:text-white mt-1">
                {summary.basketSizeDistribution.singleItemOrders.toLocaleString()} Orders
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                {summary.totalOrdersCount > 0
                  ? (
                      (summary.basketSizeDistribution.singleItemOrders / summary.totalOrdersCount) *
                      100
                    ).toFixed(1)
                  : 0}
                % of total transactions
              </p>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
              <span className="text-2xs font-bold uppercase text-slate-500">2 Items (Duo Basket)</span>
              <div className="text-xl font-black font-headline text-indigo-600 dark:text-indigo-400 mt-1">
                {summary.basketSizeDistribution.twoItemOrders.toLocaleString()} Orders
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">Primary multi-item cross-sell target</p>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
              <span className="text-2xs font-bold uppercase text-slate-500">3 Items (Trio Bundle)</span>
              <div className="text-xl font-black font-headline text-purple-600 dark:text-purple-400 mt-1">
                {summary.basketSizeDistribution.threeItemOrders.toLocaleString()} Orders
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">High basket value transactions</p>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
              <span className="text-2xs font-bold uppercase text-slate-500">4+ Items (Bulk Basket)</span>
              <div className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-1">
                {summary.basketSizeDistribution.fourPlusItemOrders.toLocaleString()} Orders
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">VIP wardrobe shopper orders</p>
            </div>
          </div>

          {/* Interactive Bundle Simulator */}
          <div className="bg-white dark:bg-[#0A0A0A] p-5 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#1F1F1F]">
              <div>
                <h3 className="text-sm font-bold font-headline text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Frequently Bought Together Simulator</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select any primary product to instantly see empirical customer co-purchase affinities and bundle cross-sells.
                </p>
              </div>

              {/* Selector */}
              <select
                value={activeSimulatorProduct?.title || ''}
                onChange={(e) => setSimulatorProductTitle(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-slate-50 dark:bg-[#121212] text-xs font-semibold text-slate-900 dark:text-white max-w-xs truncate cursor-pointer"
              >
                {products.slice(0, 40).map((p) => (
                  <option key={p.id} value={p.title}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {activeSimulatorProduct && (
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                  Top Co-Purchased Items with &ldquo;{activeSimulatorProduct.title}&rdquo;:
                </div>

                {activeSimulatorProduct.topCompanionProducts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No multi-item companion orders recorded yet for this product.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeSimulatorProduct.topCompanionProducts.map((comp, idx) => (
                      <div
                        key={comp.targetProduct}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-2xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                            <span>Rank #{idx + 1} Cross-Sell</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              Lift {comp.lift}x
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                            {comp.targetProduct}
                          </div>
                          <div className="text-2xs text-slate-500 mt-0.5">
                            Category: {comp.targetCategory}
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-[#1E1E1E] flex items-center justify-between text-2xs font-mono">
                          <span className="text-slate-600 dark:text-slate-400">
                            {comp.pairCount} shared orders
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ৳{comp.avgCombinedOrderValue.toLocaleString()} basket
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Master Market Basket Pair Matrix */}
          <div className="bg-white dark:bg-[#0A0A0A] p-5 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
            <h3 className="text-sm font-bold font-headline text-slate-900 dark:text-white mb-3">
              Top Empirical Product Co-Occurrence Pairs (Apriori Rules)
            </h3>

            <div className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-[#1F1F1F]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 dark:bg-[#0E0E0E] text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1F1F1F]">
                  <tr>
                    <th className="py-2.5 px-3">Product A</th>
                    <th className="py-2.5 px-3">Product B</th>
                    <th className="py-2.5 px-2 text-center font-mono">Shared Orders</th>
                    <th className="py-2.5 px-2 text-center font-mono">Support</th>
                    <th className="py-2.5 px-2 text-center font-mono">Confidence</th>
                    <th className="py-2.5 px-2 text-center font-mono">Lift Score</th>
                    <th className="py-2.5 px-3 text-right font-mono">Avg Basket Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#171717] font-mono text-2xs">
                  {marketBasketPairs.slice(0, 15).map((pair, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans max-w-[200px] truncate">
                        {pair.itemA}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans max-w-[200px] truncate">
                        {pair.itemB}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-primary">
                        {pair.pairOrders}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-400">
                        {pair.support}%
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-600 dark:text-slate-400">
                        {pair.confidenceAtoB}%
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {pair.lift}x
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ৳{pair.avgOrderTotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: SIZE FIT & RETURN PROPENSITY MATRIX */}
      {viewMode === 'fit' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] shadow-2xs">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold font-headline text-slate-900 dark:text-white">
                Garment Sizing Distribution & Fit Defect Warnings
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Correlates return rates with garment sizes to detect sizing pattern inconsistencies and customer fit issues.
            </p>
          </div>

          {/* Size Anomalies Banner */}
          {summary.sizeReturnAnomalies.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                  Elevated Sizing Return Anomaly Detected
                </h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {summary.sizeReturnAnomalies.map((anom) => (
                    <span
                      key={anom.size}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-bold font-mono"
                    >
                      <span>Size {anom.size}:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-black">{anom.returnRate}% Returns</span>
                      <span className="text-2xs opacity-80">({anom.returnedUnits}/{anom.grossUnits} un)</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Per-Product Size Breakdown Table */}
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-[#0E0E0E] text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1F1F1F]">
                <tr>
                  <th className="py-3 px-3.5">Product Title</th>
                  <th className="py-3 px-3">Available Sizes & Quantities</th>
                  <th className="py-3 px-3 text-center">Top Size</th>
                  <th className="py-3 px-3 text-center">Return Risk by Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#171717]">
                {products.slice(0, 25).map((p) => {
                  const topSize = p.sizes[0];
                  const worstSize = [...p.sizes].sort((a, b) => b.returnRate - a.returnRate)[0];

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-[#121212]/80 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white max-w-[240px] truncate">
                        {p.title}
                        <div className="text-2xs text-slate-400 font-normal">{p.category}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {p.sizes.map((sz) => (
                            <span
                              key={sz.size}
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161616] text-slate-700 dark:text-slate-300 font-mono text-2xs"
                              title={`${sz.size}: ${sz.grossUnits} sold, ${sz.returnedUnits} returned (${sz.returnRate}%)`}
                            >
                              <strong className="text-slate-900 dark:text-white">{sz.size}</strong>: {sz.grossUnits}un
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        {topSize ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-2xs">
                            Size {topSize.size} ({topSize.sharePercent}%)
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        {worstSize && worstSize.returnedUnits > 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded-md text-2xs font-bold ${
                              worstSize.returnRate >= 25
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Size {worstSize.size}: {worstSize.returnRate}% ret
                          </span>
                        ) : (
                          <span className="text-2xs text-emerald-600 dark:text-emerald-400">0% Returns</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: ABC PARETO INVENTORY CATEGORIZATION */}
      {viewMode === 'pareto' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Class A Card */}
            <div className="bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-purple-600 text-white uppercase tracking-wider">
                  Class A • Star Core
                </span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 font-mono">80% GMV</span>
              </div>
              <div className="text-2xl font-black font-headline text-slate-900 dark:text-white mt-3">
                {summary.abcSummary.classACount} Products
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Generates <strong className="text-purple-700 dark:text-purple-300 font-mono">৳{summary.abcSummary.classARevenue.toLocaleString()}</strong> net delivered sales.
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-2 border-t border-purple-500/10 pt-2">
                Operational Rule: High inventory velocity. Must maintain zero out-of-stock buffer.
              </p>
            </div>

            {/* Class B Card */}
            <div className="bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/20 p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-sky-600 text-white uppercase tracking-wider">
                  Class B • Steady
                </span>
                <span className="text-xs font-bold text-sky-700 dark:text-sky-300 font-mono">15% GMV</span>
              </div>
              <div className="text-2xl font-black font-headline text-slate-900 dark:text-white mt-3">
                {summary.abcSummary.classBCount} Products
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Generates <strong className="text-sky-700 dark:text-sky-300 font-mono">৳{summary.abcSummary.classBRevenue.toLocaleString()}</strong> net delivered sales.
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-2 border-t border-sky-500/10 pt-2">
                Operational Rule: Moderate steady demand. Restock based on rolling 30-day velocity.
              </p>
            </div>

            {/* Class C Card */}
            <div className="bg-slate-500/5 dark:bg-slate-950/20 border border-slate-500/20 p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-600 text-white uppercase tracking-wider">
                  Class C • Long Tail
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">5% GMV</span>
              </div>
              <div className="text-2xl font-black font-headline text-slate-900 dark:text-white mt-3">
                {summary.abcSummary.classCCount} Products
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Generates <strong className="text-slate-700 dark:text-slate-300 font-mono">৳{summary.abcSummary.classCRevenue.toLocaleString()}</strong> net delivered sales.
              </div>
              <p className="text-2xs text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-500/10 pt-2">
                Operational Rule: Clearance / dead stock review candidate. Bundle with Class A.
              </p>
            </div>
          </div>

          {/* Pareto Distribution Table */}
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-[#0E0E0E] text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1F1F1F]">
                <tr>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Product Title</th>
                  <th className="py-2.5 px-3 text-right">Delivered Net Revenue</th>
                  <th className="py-2.5 px-3 text-center">Cumulative %</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#171717]">
                {products.slice(0, 30).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#121212] transition-colors">
                    <td className="py-2.5 px-3 font-bold font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-2xs font-black ${
                          p.abcCategory === 'A'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                            : p.abcCategory === 'B'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {p.abcCategory}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white max-w-[240px] truncate">
                      {p.title}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ৳{p.deliveredRevenue.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                      {p.cumulativeRevenuePercent}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {p.totalGrossUnits}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectingProduct(p)}
                        className="text-2xs font-bold text-primary hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PRODUCT DEEP-DIVE MODAL */}
      {inspectingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-[#222] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#1F1F1F]">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md font-black text-2xs ${
                      inspectingProduct.abcCategory === 'A'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                        : inspectingProduct.abcCategory === 'B'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Class {inspectingProduct.abcCategory}
                  </span>
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                    {inspectingProduct.category}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-headline text-slate-900 dark:text-white mt-1">
                  {inspectingProduct.title}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  SKUs: {inspectingProduct.skus.slice(0, 3).join(', ')}
                  {inspectingProduct.skus.length > 3 ? ` +${inspectingProduct.skus.length - 3} more` : ''}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectingProduct(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/60 dark:border-[#1E1E1E]">
                <div className="text-3xs font-extrabold uppercase text-slate-400">Base MRP</div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  ৳{inspectingProduct.mrp.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/60 dark:border-[#1E1E1E]">
                <div className="text-3xs font-extrabold uppercase text-slate-400">Net Sales</div>
                <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ৳{inspectingProduct.deliveredRevenue.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/60 dark:border-[#1E1E1E]">
                <div className="text-3xs font-extrabold uppercase text-slate-400">Units Sold</div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {inspectingProduct.totalGrossUnits} un
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/60 dark:border-[#1E1E1E]">
                <div className="text-3xs font-extrabold uppercase text-slate-400">Return Rate</div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {inspectingProduct.returnRate}%
                </div>
              </div>
            </div>

            {/* Price Points Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Price Elasticity Breakdown
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-[#1F1F1F]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#141414] text-2xs font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 px-2.5">Sold Price</th>
                      <th className="py-2 px-2 text-center">Discount</th>
                      <th className="py-2 px-2 text-center">Units Sold</th>
                      <th className="py-2 px-2">Net Sales</th>
                      <th className="py-2 px-2 text-center">Return %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#171717] font-mono text-2xs">
                    {inspectingProduct.pricePoints.map((pp) => (
                      <tr
                        key={pp.price}
                        className={pp.isSweetSpot ? 'bg-emerald-500/10 font-bold' : ''}
                      >
                        <td className="py-2 px-2.5 text-slate-900 dark:text-white">
                          ৳{pp.price.toLocaleString()} {pp.isSweetSpot ? '👑' : ''}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500">
                          {pp.discountPercent}%
                        </td>
                        <td className="py-2 px-2 text-center text-slate-900 dark:text-white font-bold">
                          {pp.grossUnits}
                        </td>
                        <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-bold">
                          ৳{pp.netRevenue.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                          {pp.returnRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Size Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Size Fit Distribution
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {inspectingProduct.sizes.map((sz) => (
                  <div
                    key={sz.size}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#1E1E1E] text-2xs font-mono"
                  >
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Size {sz.size}</span>
                      <span className="text-slate-400 font-normal">{sz.sharePercent}%</span>
                    </div>
                    <div className="text-slate-500 mt-1">
                      {sz.grossUnits} ordered • {sz.returnedUnits} ret ({sz.returnRate}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Companion Products */}
            {inspectingProduct.topCompanionProducts.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Frequently Bought Together
                </h4>
                <div className="space-y-1.5">
                  {inspectingProduct.topCompanionProducts.map((comp) => (
                    <div
                      key={comp.targetProduct}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#1E1E1E] flex items-center justify-between text-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-white truncate max-w-[320px]">
                        {comp.targetProduct}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-2xs shrink-0">
                        <span className="text-slate-400">{comp.pairCount} orders</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Lift {comp.lift}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-3 border-t border-slate-100 dark:border-[#1F1F1F] flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
