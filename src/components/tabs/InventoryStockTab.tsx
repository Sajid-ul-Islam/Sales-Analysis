"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { ReconciledOrderRow } from '@/types';
import {
  Boxes,
  Warehouse,
  Store,
  Search,
  Download,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  FileSpreadsheet,
  FileText,
  Building2,
  DollarSign,
  Layers,
  ArrowUpDown,
  Tag,
  Package,
  BarChart3,
  Ruler
} from 'lucide-react';
import {
  buildInventoryDataset,
  filterInventoryRows,
  exportInventoryToExcel,
  exportInventoryToCsv,
  InventoryLocationId,
  ProductStockRow,
  LocationStockBreakdown,
  compareSizes,
  groupInventoryByProduct,
  ParentProductStockGroup,
} from '@/lib/inventoryEngine';
import { CATEGORY_COLOR_MAP } from '@/lib/liveCategoryEngine';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';
import { StockAnalyticsCharts } from '@/components/charts';

interface InventoryStockTabProps {
  orders?: ReconciledOrderRow[];
  onSelectOrder?: (orderId: string) => void;
}

export function InventoryStockTab({ orders = [] }: InventoryStockTabProps) {
  // 1. Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocationId>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [sortBy, setSortBy] = useState<'totalStock' | 'selectedLocation' | 'sku' | 'title' | 'category' | 'size' | 'unitPrice' | 'retailValuation' | 'velocity'>('totalStock');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'VARIATION' | 'STYLE_MATRIX'>('VARIATION');

  // Live stock sync state
  const [liveStockMap, setLiveStockMap] = useState<Record<string, LocationStockBreakdown> | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [showCharts, setShowCharts] = useState<boolean>(true);

  // 2. Build Inventory Dataset
  const { rows: allRows, metrics } = useMemo(() => {
    return buildInventoryDataset(orders, liveStockMap || undefined);
  }, [orders, liveStockMap]);

  // 3. Extract Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [allRows]);

  // 4. Extract Available Sizes (sorted logically: S, M, L, XL, XXL, 30, 32, etc.)
  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      if (r.size) set.add(r.size);
    });
    return Array.from(set).sort(compareSizes);
  }, [allRows]);

  // 5. Filter and Sort Rows
  const filteredRows = useMemo(() => {
    return filterInventoryRows(allRows, {
      searchTerm,
      location: selectedLocation,
      category: selectedCategory,
      size: selectedSize,
      status: selectedStatus,
      sortBy,
      sortOrder,
    });
  }, [allRows, searchTerm, selectedLocation, selectedCategory, selectedSize, selectedStatus, sortBy, sortOrder]);

  // 6. Grouped Style Matrix View Data
  const parentStyleGroups = useMemo(() => {
    return groupInventoryByProduct(filteredRows);
  }, [filteredRows]);

  // 7. Pagination Slicing
  const activeTotalCount = viewMode === 'VARIATION' ? filteredRows.length : parentStyleGroups.length;
  const totalPages = Math.ceil(activeTotalCount / pageSize) || 1;

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const paginatedStyleGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return parentStyleGroups.slice(start, start + pageSize);
  }, [parentStyleGroups, currentPage, pageSize]);

  // Handle Sort Change
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Live Sync Trigger
  const handleLiveStockSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await fetch('/api/sync/woocommerce/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuthHeaders(),
        },
        body: JSON.stringify({ maxPages: 5 }),
      });
      const data = await res.json();
      if (data.success && data.data?.stockBySku) {
        setLiveStockMap(data.data.stockBySku);
        setSyncToast(data.message || 'Stock counts synchronized successfully.');
      } else {
        setSyncToast(data.message || 'Stock refreshed using baseline inventory snapshot.');
      }
    } catch {
      setSyncToast('Stock refreshed using local store inventory model.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 4500);
    }
  }, []);

  // Export Handlers
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const ts = new Date().toISOString().slice(0, 10);
      const filename = `DEEN_Stock_Inventory_${selectedLocation.toUpperCase()}_${ts}.xlsx`;
      await exportInventoryToExcel(filteredRows, filename);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCsv = () => {
    const ts = new Date().toISOString().slice(0, 10);
    const filename = `DEEN_Stock_Inventory_${selectedLocation.toUpperCase()}_${ts}.csv`;
    exportInventoryToCsv(filteredRows, filename);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedLocation('ALL');
    setSelectedCategory('ALL');
    setSelectedSize('ALL');
    setSelectedStatus('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {syncToast && (
        <div className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-xl text-sm shadow-xs transition-all">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-medium">{syncToast}</span>
          </div>
          <button
            onClick={() => setSyncToast(null)}
            className="p-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 rounded-md cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0A0A0A] p-5 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Stock & Inventory Management
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                5 Fulfillment Nodes
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live inventory tracking across Central Warehouse and 4 physical retail outlet branches.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCharts((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors border cursor-pointer ${
              showCharts
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900/60'
                : 'bg-white dark:bg-[#111] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#181818]'
            }`}
            title="Toggle inventory analytics charts and graphs"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{showCharts ? 'Hide Charts' : 'Show Charts'}</span>
          </button>

          <button
            onClick={handleLiveStockSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-60 cursor-pointer"
            title="Refresh stock from WooCommerce API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Stock'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white hover:bg-slate-50 dark:bg-[#111] dark:hover:bg-[#1a1a1a] text-slate-700 dark:text-slate-200 rounded-lg transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs"
            title="Export filtered stock data to CSV"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            title="Export full inventory workbook to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExportingExcel ? 'Generating...' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total SKUs */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Total SKUs</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {metrics.totalSkus.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Catalog Variations
          </div>
        </div>

        {/* Total Units */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Units on Hand</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {metrics.totalUnits.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Across All 5 Nodes
          </div>
        </div>

        {/* Warehouse Units */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Warehouse</span>
            <Warehouse className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {metrics.locationTotals.warehouse.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Central Online Hub
          </div>
        </div>

        {/* Retail Outlets Units */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Outlet Branches</span>
            <Store className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {(
              metrics.locationTotals.mirpur +
              metrics.locationTotals.cumilla +
              metrics.locationTotals.wari +
              metrics.locationTotals.sylhet
            ).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            4 Physical Stores
          </div>
        </div>

        {/* Retail Valuation */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Stock Value (Retail)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            ৳{Math.round(metrics.totalRetailValue / 1000).toLocaleString()}k
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            ৳{metrics.totalRetailValue.toLocaleString()}
          </div>
        </div>

        {/* Health Status Alerts */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Stock Health</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 font-semibold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {metrics.inStockCount}
            </span>
            <span className="text-xs px-2 py-0.5 font-semibold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {metrics.lowStockCount}
            </span>
            <span className="text-xs px-2 py-0.5 font-semibold rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {metrics.outOfStockCount}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>Healthy</span>
            <span>Low (1-5)</span>
            <span>Zero</span>
          </div>
        </div>
      </div>

      {/* Interactive Visual Graphs & Charts for Stock (Includes Location & Size Variation Curves) */}
      {showCharts && (
        <StockAnalyticsCharts
          metrics={metrics}
          rows={allRows}
          selectedLocation={selectedLocation}
          onSelectLocation={(loc) => {
            setSelectedLocation(loc);
            setCurrentPage(1);
          }}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setCurrentPage(1);
          }}
          selectedSize={selectedSize}
          onSelectSize={(sz) => {
            setSelectedSize(sz);
            setCurrentPage(1);
          }}
          selectedStatus={selectedStatus}
          onSelectStatus={(st) => {
            setSelectedStatus(st);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Location Filter Rail */}
      <div className="bg-white dark:bg-[#0A0A0A] p-2 rounded-xl border border-slate-200 dark:border-[#1F1F1F] flex items-center gap-1.5 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 flex items-center gap-1.5 shrink-0">
          <Building2 className="w-3.5 h-3.5" />
          <span>Fulfillment Node:</span>
        </span>

        {[
          { id: 'ALL', label: 'All Locations', count: metrics.totalUnits, icon: Boxes },
          { id: 'warehouse', label: 'Central Warehouse (Online)', count: metrics.locationTotals.warehouse, icon: Warehouse },
          { id: 'mirpur', label: 'Mirpur Outlet', count: metrics.locationTotals.mirpur, icon: Store },
          { id: 'cumilla', label: 'Cumilla Branch', count: metrics.locationTotals.cumilla, icon: Store },
          { id: 'wari', label: 'Wari Branch', count: metrics.locationTotals.wari, icon: Store },
          { id: 'sylhet', label: 'Sylhet Branch', count: metrics.locationTotals.sylhet, icon: Store },
        ].map((loc) => {
          const isActive = selectedLocation === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => {
                setSelectedLocation(loc.id as InventoryLocationId);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <loc.icon className="w-3.5 h-3.5 shrink-0" />
              <span>{loc.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-blue-700/80 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {loc.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Instant Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search SKU, style title, size..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Size / Variation Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Size:</span>
            <select
              value={selectedSize}
              onChange={(e) => {
                setSelectedSize(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Sizes ({availableSizes.length})</option>
              {availableSizes.map((s) => (
                <option key={s} value={s}>
                  Size {s}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Health Level Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Stock Level:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as typeof selectedStatus);
                setCurrentPage(1);
              }}
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock (&gt;5 units)</option>
              <option value="LOW_STOCK">Low Stock (1-5 units)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchTerm || selectedCategory !== 'ALL' || selectedSize !== 'ALL' || selectedStatus !== 'ALL' || selectedLocation !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* View Mode Switcher & Page Size */}
        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141414] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                setViewMode('VARIATION');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'VARIATION'
                  ? 'bg-white dark:bg-[#202020] text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Show individual variation SKUs"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SKUs</span>
            </button>
            <button
              onClick={() => {
                setViewMode('STYLE_MATRIX');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'STYLE_MATRIX'
                  ? 'bg-white dark:bg-[#202020] text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Group by master product style with size curve matrix"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Style Matrix</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: GRANULAR SKU / VARIATION TABLE                                    */}
      {/* ========================================================================= */}
      {viewMode === 'VARIATION' && (
        <div className="overflow-x-auto min-w-0 w-full rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#141414] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 select-none">
                <th
                  onClick={() => handleSort('sku')}
                  className="py-3 px-3.5 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>SKU / Barcode</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('title')}
                  className="py-3 px-3 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Product Title</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('size')}
                  className="py-3 px-3 font-semibold text-center cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Size (Variation)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('category')}
                  className="py-3 px-3 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('unitPrice')}
                  className="py-3 px-3 font-semibold text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Price (৳)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* Central Warehouse */}
                <th
                  className={`py-3 px-3 font-semibold text-center ${
                    selectedLocation === 'warehouse'
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : ''
                  }`}
                >
                  Warehouse
                </th>

                {/* Mirpur Outlet */}
                <th
                  className={`py-3 px-3 font-semibold text-center ${
                    selectedLocation === 'mirpur'
                      ? 'bg-purple-50/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                      : ''
                  }`}
                >
                  Mirpur
                </th>

                {/* Cumilla Branch */}
                <th
                  className={`py-3 px-3 font-semibold text-center ${
                    selectedLocation === 'cumilla'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : ''
                  }`}
                >
                  Cumilla
                </th>

                {/* Wari Branch */}
                <th
                  className={`py-3 px-3 font-semibold text-center ${
                    selectedLocation === 'wari'
                      ? 'bg-sky-50/80 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                      : ''
                  }`}
                >
                  Wari
                </th>

                {/* Sylhet Branch */}
                <th
                  className={`py-3 px-3 font-semibold text-center ${
                    selectedLocation === 'sylhet'
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : ''
                  }`}
                >
                  Sylhet
                </th>

                {/* Total Stock */}
                <th
                  onClick={() => handleSort('totalStock')}
                  className="py-3 px-3.5 font-semibold text-center cursor-pointer hover:text-slate-900 dark:hover:text-white bg-slate-100/60 dark:bg-[#181818]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Total Stock</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* Retail Valuation */}
                <th
                  onClick={() => handleSort('retailValuation')}
                  className="py-3 px-3.5 font-semibold text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Retail Value</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                {/* Stock Status */}
                <th className="py-3 px-3.5 font-semibold text-center">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No matching products found</p>
                      <p className="text-xs">Try clearing or adjusting your search, size, category, or stock level filters.</p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const catColor = CATEGORY_COLOR_MAP[r.category] || '#64748b';

                  return (
                    <tr
                      key={r.sku}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#121212] transition-colors"
                    >
                      {/* SKU */}
                      <td className="py-2.5 px-3.5 font-mono text-slate-900 dark:text-white font-medium whitespace-nowrap">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                          {r.sku}
                        </span>
                      </td>

                      {/* Product Title */}
                      <td className="py-2.5 px-3 max-w-[240px]">
                        <div className="font-medium text-slate-900 dark:text-white truncate" title={r.productTitle}>
                          {r.productTitle}
                        </div>
                        {r.subCategory && r.subCategory !== r.category && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] mt-0.5">
                            {r.subCategory}
                          </div>
                        )}
                      </td>

                      {/* Size / Variation Pill (Clickable) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedSize(r.size);
                            setCurrentPage(1);
                          }}
                          className={`text-xs px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                            selectedSize.toUpperCase() === r.size.toUpperCase()
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                          }`}
                          title={`Filter to size ${r.size}`}
                        >
                          {r.size}
                        </button>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${catColor}15`,
                            color: catColor,
                            border: `1px solid ${catColor}30`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: catColor }}
                          />
                          {r.category}
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        ৳{r.unitPrice.toLocaleString()}
                      </td>

                      {/* Central Warehouse */}
                      <td
                        className={`py-2.5 px-3 text-center whitespace-nowrap ${
                          selectedLocation === 'warehouse'
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 font-bold text-blue-700 dark:text-blue-300'
                            : ''
                        }`}
                      >
                        <StockBadge count={r.stock.warehouse} />
                      </td>

                      {/* Mirpur Outlet */}
                      <td
                        className={`py-2.5 px-3 text-center whitespace-nowrap ${
                          selectedLocation === 'mirpur'
                            ? 'bg-purple-50/50 dark:bg-purple-950/20 font-bold text-purple-700 dark:text-purple-300'
                            : ''
                        }`}
                      >
                        <StockBadge count={r.stock.mirpur} />
                      </td>

                      {/* Cumilla Branch */}
                      <td
                        className={`py-2.5 px-3 text-center whitespace-nowrap ${
                          selectedLocation === 'cumilla'
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 font-bold text-emerald-700 dark:text-emerald-300'
                            : ''
                        }`}
                      >
                        <StockBadge count={r.stock.cumilla} />
                      </td>

                      {/* Wari Branch */}
                      <td
                        className={`py-2.5 px-3 text-center whitespace-nowrap ${
                          selectedLocation === 'wari'
                            ? 'bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300'
                            : ''
                        }`}
                      >
                        <StockBadge count={r.stock.wari} />
                      </td>

                      {/* Sylhet Branch */}
                      <td
                        className={`py-2.5 px-3 text-center whitespace-nowrap ${
                          selectedLocation === 'sylhet'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 font-bold text-amber-700 dark:text-amber-300'
                            : ''
                        }`}
                      >
                        <StockBadge count={r.stock.sylhet} />
                      </td>

                      {/* Total Stock */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap bg-slate-50/50 dark:bg-[#161616]">
                        <span className="text-xs font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/60">
                          {r.totalStock}
                        </span>
                      </td>

                      {/* Retail Valuation */}
                      <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        ৳{r.retailValuation.toLocaleString()}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {r.stockStatus === 'IN_STOCK' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>In Stock</span>
                          </span>
                        ) : r.stockStatus === 'LOW_STOCK' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Low Stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            <span>Out of Stock</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: PARENT PRODUCT STYLE SIZE MATRIX VIEW                             */}
      {/* ========================================================================= */}
      {viewMode === 'STYLE_MATRIX' && (
        <div className="overflow-x-auto min-w-0 w-full rounded-xl border border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#0A0A0A] shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#141414] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 select-none">
                <th className="py-3 px-3.5 font-semibold">Master Style & SKU</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold text-right">Price (৳)</th>
                <th className="py-3 px-3.5 font-semibold">Size Variation Matrix (Units by Size)</th>
                <th className="py-3 px-3 font-semibold text-center">Warehouse</th>
                <th className="py-3 px-3 font-semibold text-center">Outlets</th>
                <th className="py-3 px-3.5 font-semibold text-center bg-slate-100/60 dark:bg-[#181818]">Total Pcs</th>
                <th className="py-3 px-3.5 font-semibold text-right">Stock Value</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginatedStyleGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Ruler className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No matching product styles found</p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStyleGroups.map((g) => {
                  const catColor = CATEGORY_COLOR_MAP[g.category] || '#64748b';
                  const totalOutlets =
                    g.stock.mirpur + g.stock.cumilla + g.stock.wari + g.stock.sylhet;

                  return (
                    <tr
                      key={g.masterSku || g.productTitle}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#121212] transition-colors"
                    >
                      {/* Master SKU & Title */}
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                          {g.masterSku}
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white truncate mt-0.5" title={g.productTitle}>
                          {g.productTitle}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${catColor}15`,
                            color: catColor,
                            border: `1px solid ${catColor}30`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: catColor }}
                          />
                          {g.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        ৳{g.unitPrice.toLocaleString()}
                      </td>

                      {/* Size Variation Matrix Badges */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {g.variations.map((v) => (
                            <div
                              key={v.sku}
                              onClick={() => {
                                setSelectedSize(v.size);
                                setViewMode('VARIATION');
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                                v.stockStatus === 'IN_STOCK'
                                  ? 'bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100'
                                  : v.stockStatus === 'LOW_STOCK'
                                  ? 'bg-amber-50/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
                                  : 'bg-rose-50/80 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/80 hover:bg-rose-100'
                              }`}
                              title={`Size ${v.size} (SKU: ${v.sku}): Wh ${v.stock.warehouse} | Mir ${v.stock.mirpur} | Cum ${v.stock.cumilla} | War ${v.stock.wari} | Syl ${v.stock.sylhet}`}
                            >
                              <span className="font-bold">{v.size}:</span>
                              <span>{v.totalStock} pcs</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Warehouse Stock */}
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {g.stock.warehouse.toLocaleString()}
                      </td>

                      {/* Outlet Branches Stock */}
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {totalOutlets.toLocaleString()}
                      </td>

                      {/* Total Style Units */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap bg-slate-50/50 dark:bg-[#161616]">
                        <span className="text-xs font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/60 font-mono">
                          {g.totalStock.toLocaleString()}
                        </span>
                      </td>

                      {/* Retail Value */}
                      <td className="py-3 px-3.5 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        ৳{g.retailValuation.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, activeTotalCount)} of {activeTotalCount}{' '}
            {viewMode === 'VARIATION' ? 'SKUs' : 'Product Styles'}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121212] text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 font-semibold text-slate-900 dark:text-white">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#121212] text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Clean sub-component to render quantity badge with health-conscious color coding.
 */
function StockBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-block text-[11px] font-semibold text-slate-400 dark:text-slate-600 font-mono">
        0
      </span>
    );
  }

  if (count <= 2) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 font-mono">
        {count}
      </span>
    );
  }

  return (
    <span className="inline-block text-[11px] font-medium text-slate-700 dark:text-slate-300 font-mono">
      {count}
    </span>
  );
}
