"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Package,
  Truck,
  TrendingUp,
  ShoppingBag,
  Users,
  RefreshCw,
  Search,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  X,
  FileSpreadsheet,
  MessageSquare,
  Copy,
  Check,
  Flame,
  Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { RawOrderRow } from '@/types';
import { dispatchSyncNotification } from '@/components/notifications/SyncNotificationCenter';
import {
  processLiveOpsData,
  LiveOpsReport,
  isOrderProcessing,
  isOrderOnHold,
  isOrderShipped,
  generateWhatsAppConfirmationUrl,
  formatBangladeshPhoneNumber,
} from '@/lib/liveOpsProcessor';
import { LiveRevenueDonutChart } from '@/components/charts/LiveRevenueDonutChart';
import { LiveVolumeBarChart } from '@/components/charts/LiveVolumeBarChart';
import { KpiSparkline } from '@/components/charts/KpiSparkline';
import { classifyProductLine } from '@/lib/selectsAnalytics';
import { getCategoryForSales, getSubCategoryForSales } from '@/lib/liveCategoryEngine';
import {
  LiveTerminalStats,
  DiscrepancyAlert,
  StandardCourierStatus,
  cleanOrderId,
  detectFulfillmentBranch,
  CourierDiscrepancyType,
} from '@/lib/sync/liveTerminalSync';
import { loadAppSettings } from '@/lib/settingsStore';
import { getCacheItem, setCacheItem, DEEN_CACHE_KEYS } from '@/lib/cacheManager';

interface LiveTerminalCacheEnvelope {
  orders: RawOrderRow[];
  stats: LiveTerminalStats;
  discrepancies: DiscrepancyAlert[];
  wcConnected: boolean;
  pathaoConnected: boolean;
  lastSyncTime: string;
}

interface LiveOpsTabProps {
  orders: RawOrderRow[];
  onSelectOrder?: (orderId: string) => void;
  onRefreshLive?: (fetchedOrders?: RawOrderRow[], provenance?: any) => Promise<void> | void;
  isSyncing?: boolean;
}

export function LiveOpsTab({
  orders = [],
  onSelectOrder,
  onRefreshLive,
  isSyncing = false,
}: LiveOpsTabProps) {
  // Navigation & View state
  const [selectedView, setSelectedView] = useState<'Today Shipped' | "Today's Orders" | 'Queue'>('Today Shipped');
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [showSubCategory, setShowSubCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [courierFilter, setCourierFilter] = useState<string>('ALL');
  const [pipelineFilter, setPipelineFilter] = useState<'ALL' | 'PROCESSING' | 'HOLD' | 'SHIPPED_TODAY'>('ALL');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [localSyncing, setLocalSyncing] = useState(false);

  // Live Sync & Telemetry State — SWR: Instant mount from local cache
  const [liveOrders, setLiveOrders] = useState<RawOrderRow[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    return cached?.orders || [];
  });
  const [courierStats, setCourierStats] = useState<LiveTerminalStats | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    return cached?.stats || null;
  });
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyAlert[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    return cached?.discrepancies || [];
  });
  const [wcConnected, setWcConnected] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    return !!cached?.wcConnected;
  });
  const [pathaoConnected, setPathaoConnected] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    return !!cached?.pathaoConnected;
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    return cached?.lastSyncTime || null;
  });

  // Track previous discrepancies count to only alert on genuinely new issues
  const discrepanciesRef = React.useRef(discrepancies);
  useEffect(() => {
    discrepanciesRef.current = discrepancies;
  }, [discrepancies]);

  // Auto-dismiss transient sync message to remove UI clutter
  useEffect(() => {
    if (!syncStatusMsg) return;
    const timer = setTimeout(() => {
      setSyncStatusMsg(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [syncStatusMsg]);

  // Inspection modal state
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<RawOrderRow | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // 7-Day History selection & Executive Briefing State
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);
  const [briefingCopied, setBriefingCopied] = useState(false);
  const [activeAnalyticsView, setActiveAnalyticsView] = useState<'category' | 'spotlight'>('category');

  // Auto-refresh timer countdown (60s loop)
  const [countdown, setCountdown] = useState(60);

  // Guard to prevent concurrent sync loops
  const isSyncingRef = React.useRef(false);

  // Active dataset for processing (prefer live synced orders if available)
  const activeDataset = liveOrders.length > 0 ? liveOrders : orders;

  // Process live operational data
  const report: LiveOpsReport = useMemo(() => {
    return processLiveOpsData(activeDataset, {
      view: selectedHistoricalDate ? 'Today Shipped' : selectedView,
      onlineOnly,
      customDate: selectedHistoricalDate || undefined,
    });
  }, [activeDataset, selectedView, onlineOnly, selectedHistoricalDate]);

  const activeCategoryItems = showSubCategory ? report.subCategoryItems : report.categoryItems;

  // Filter out Friday if closed (0 dispatches). Show Friday only if open with shipped parcels.
  // In Bangladesh fulfillment operations, orders placed on Friday are dispatched on Saturday.
  const displayHistoryDays = useMemo(() => {
    return report.last7DaysHistory.filter((day) => {
      const isFriday = day.dayName.toLowerCase().startsWith('fri');
      if (isFriday && (day.isFridayClosed || day.orderCount === 0)) {
        return false;
      }
      return true;
    });
  }, [report.last7DaysHistory]);

  // Manual & Automated Trigger for Live Sync (WooCommerce REST API + Pathao Aladdin API)
  const handleSyncNow = useCallback(async (isManual: boolean = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (isManual) {
      setLocalSyncing(true);
      setSyncStatusMsg('Syncing with WooCommerce REST API & Pathao Hermes API...');
    }
    try {
      const appSettings = typeof window !== 'undefined' ? loadAppSettings() : null;
      const payload: any = {
        limitConsignments: 35,
        fetchLiveWc: true,
      };

      if (appSettings?.wcConsumerKey) {
        payload.wcCredentials = {
          store_url: appSettings.wcStoreUrl || 'https://deencommerce.com',
          consumer_key: appSettings.wcConsumerKey,
          consumer_secret: appSettings.wcConsumerSecret,
        };
      }
      if (appSettings?.pathaoClientId) {
        payload.pathaoCredentials = {
          base_url: appSettings.pathaoBaseUrl || 'https://api-hermes.pathao.com',
          client_id: appSettings.pathaoClientId,
          client_secret: appSettings.pathaoClientSecret,
          username: appSettings.pathaoUsername,
        };
      }

      const res = await fetch('/api/sync/live-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }

      if (data && data.success && data.orders && data.orders.length > 0) {
        setLiveOrders(data.orders);
        setCourierStats(data.stats);
        setDiscrepancies(data.discrepancies || []);
        setWcConnected(!!data.wcConnected);
        setPathaoConnected(!!data.pathaoConnected);
        const syncTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(syncTimeStr);

        // Persist to local cache for 0ms instant reload on next tab visit
        setCacheItem<LiveTerminalCacheEnvelope>(
          DEEN_CACHE_KEYS.LIVE_TERMINAL,
          {
            orders: data.orders,
            stats: data.stats,
            discrepancies: data.discrepancies || [],
            wcConnected: !!data.wcConnected,
            pathaoConnected: !!data.pathaoConnected,
            lastSyncTime: syncTimeStr
          },
          { ttlMs: 30 * 60 * 1000, tag: 'api' }
        );

        if (isManual) {
          setSyncStatusMsg(
            data.wcConnected
              ? `Live Sync Active: ${data.stats.totalOrders} live WooCommerce orders synchronized (${data.orders.length} items, ${data.stats.discrepancyCount} discrepancies).`
              : `Snapshot Active: ${data.stats.totalOrders} orders loaded (${data.orders.length} items).`
          );
        }

        if (onRefreshLive) {
          // Pass fetched data directly to parent so parent doesn't make an extra network request
          await onRefreshLive(data.orders, data.provenance);
        }

        // Only dispatch floating notification on user-initiated manual click or when a new discrepancy appears
        const prevDiscCount = discrepanciesRef.current?.length || 0;
        const newDiscCount = data.discrepancies?.length || 0;
        const hasNewDiscrepancy = newDiscCount > prevDiscCount;

        if (isManual || hasNewDiscrepancy) {
          dispatchSyncNotification({
            type: newDiscCount > 0 ? 'discrepancy_detected' : 'orders_synced',
            title: data.wcConnected ? 'Live WooCommerce & Hermes Synced' : 'Terminal Snapshot Loaded',
            description: `${data.stats?.totalOrders || data.orders.length} orders synchronized (${data.orders.length} items). ${newDiscCount} courier discrepancies identified.`,
            targetTab: newDiscCount > 0 ? 'tabCourierMismatch' : 'tabLiveOps'
          });
        }
      } else if (data && data.message) {
        if (isManual) setSyncStatusMsg(`Notice: ${data.message}`);
        if (data.wcConnected !== undefined) setWcConnected(data.wcConnected);
        if (data.pathaoConnected !== undefined) setPathaoConnected(data.pathaoConnected);
      } else {
        if (isManual) setSyncStatusMsg('Operational snapshot active (WooCommerce REST API & Pathao Hermes).');
      }
      setCountdown(60);
    } catch (e: any) {
      if (isManual) {
        setSyncStatusMsg(`Sync notice: ${e?.message || 'Using current snapshot'}`);
        dispatchSyncNotification({
          type: 'error',
          title: 'Live Sync Notice',
          description: e?.message || 'Failed to complete live sync. Using current cached snapshot.',
          targetTab: 'tabSettings'
        });
      }
    } finally {
      if (isManual) {
        setLocalSyncing(false);
      }
      isSyncingRef.current = false;
    }
  }, [onRefreshLive]);

  // SWR: Silent background revalidation on mount
  useEffect(() => {
    handleSyncNow(false);
  }, [handleSyncNow]);

  // Automated 60-second periodic background revalidation (quiet, no toast noise)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleSyncNow(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [handleSyncNow]);

  // Filtered orders list for ledger table
  const filteredOrders = useMemo(() => {
    return report.activeOrders.filter((o) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const oid = String(o['Order ID'] || o.orderId || '').toLowerCase();
        const cname = String(o['Customer Name'] || '').toLowerCase();
        const phone = String(o.Phone || '').toLowerCase();
        const item = String(o['Item Name'] || '').toLowerCase();
        const sku = String(o.SKU || '').toLowerCase();
        const cid = String(o['Consignment ID'] || o.consignmentId || '').toLowerCase();
        if (
          !oid.includes(q) &&
          !cname.includes(q) &&
          !phone.includes(q) &&
          !item.includes(q) &&
          !sku.includes(q) &&
          !cid.includes(q)
        ) {
          return false;
        }
      }

      if (categoryFilter !== 'ALL') {
        const cat = getCategoryForSales(o['Item Name']);
        if (cat !== categoryFilter) return false;
      }

      if (courierFilter !== 'ALL') {
        if (courierFilter === 'DISCREPANCY_ONLY') {
          if (!o.hasDiscrepancy) return false;
        } else if (
          courierFilter === 'RETURNED_BUT_SHIPPED' ||
          courierFilter === 'DELIVERED_BUT_PROCESSING' ||
          courierFilter === 'COD_MISMATCH' ||
          courierFilter === 'UNCOLLECTED_COD' ||
          courierFilter === 'DOUBLE_COLLECTION_RISK'
        ) {
          if (!o.hasDiscrepancy || o.discrepancyType !== courierFilter) return false;
        } else {
          const cStatus = o['Courier Status'] || o.courierStatus || 'Untracked';
          if (cStatus !== courierFilter) return false;
        }
      }

      if ((selectedView === "Today's Orders" || (selectedView as string) === 'All Orders') && pipelineFilter !== 'ALL') {
        if (pipelineFilter === 'PROCESSING' && !isOrderProcessing(o)) return false;
        if (pipelineFilter === 'HOLD' && !isOrderOnHold(o)) return false;
        if (pipelineFilter === 'SHIPPED_TODAY' && !isOrderShipped(o)) return false;
      }

      return true;
    });
  }, [report.activeOrders, searchQuery, categoryFilter, courierFilter, selectedView, pipelineFilter]);

  // Unique categories for table filter dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const o of report.activeOrders) {
      set.add(getCategoryForSales(o['Item Name']));
    }
    return Array.from(set).sort();
  }, [report.activeOrders]);

  // Export current table to Excel with full courier details
  const handleExportExcel = () => {
    const exportData = filteredOrders.map((o) => {
      const isSelects = classifyProductLine(o['Item Name'], o.SKU, getCategoryForSales(o['Item Name'])) === 'DEEN Selects';
      return {
        'Order ID': o['Order ID'] || o.orderId,
        'Date': o['Order Date'],
        'Customer Name': o['Customer Name'],
        'Phone': o.Phone,
        'City': o.City,
        'Item Name': o['Item Name'],
        'SKU': o.SKU,
        'Category': getCategoryForSales(o['Item Name']),
        'Sub-Category': getSubCategoryForSales(o['Item Name']),
        'Collection Line': isSelects ? 'DEEN Selects' : 'DEEN Regular',
        'Quantity': o.Quantity || 1,
        'Unit Cost (TK)': o['Item Cost'] || 0,
        'Order Amount (TK)': o['Order Amount'] || 0,
        'WooCommerce Status': o['Delivery Status'] || (o as any).status || 'shipped',
        'Pathao Courier Status': o['Courier Status'] || o.courierStatus || 'Untracked',
        'Pathao Consignment ID': o['Consignment ID'] || o.consignmentId || 'N/A',
        'Collected Amount (TK)': o.collectedAmount || 0,
        'Courier Discrepancy': o.hasDiscrepancy ? `Yes (${o.discrepancyType})` : 'None',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shipped Orders & Telemetry');
    XLSX.writeFile(wb, `DEEN_Live_Shipped_Orders_${report.referenceDate}.xlsx`);
  };

  const handleExportCsv = () => {
    const exportData = filteredOrders.map((o) => {
      const isSelects = classifyProductLine(o['Item Name'], o.SKU, getCategoryForSales(o['Item Name'])) === 'DEEN Selects';
      return {
        'Order ID': o['Order ID'] || o.orderId,
        'Date': o['Order Date'],
        'Customer Name': o['Customer Name'],
        'Phone': o.Phone,
        'City': o.City,
        'Item Name': o['Item Name'],
        'SKU': o.SKU,
        'Category': getCategoryForSales(o['Item Name']),
        'Collection': isSelects ? 'DEEN Selects' : 'DEEN Regular',
        'Quantity': o.Quantity || 1,
        'Unit Cost': o['Item Cost'] || 0,
        'Order Total': o['Order Amount'] || 0,
        'WooCommerce Status': o['Delivery Status'] || 'shipped',
        'Courier Status': o['Courier Status'] || o.courierStatus || 'Untracked',
        'Consignment ID': o['Consignment ID'] || o.consignmentId || '',
        'Discrepancy': o.hasDiscrepancy ? 'YES' : 'NO',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DEEN_Live_Shipped_Orders_${report.referenceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isActuallySyncing = isSyncing || localSyncing;

  return (
    <div className="space-y-6">
      {/* ── Operational Banner & Mode Navigation ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-headline">
                Live Shipped & Orders Terminal
              </h1>

              {/* Real-time Connection Status Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
                    wcConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/90 dark:border-emerald-800/80 shadow-2xs'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/90 dark:border-amber-800/80'
                  }`}
                  title={wcConnected ? 'Connected to live WooCommerce REST API' : 'WooCommerce unconfigured or using snapshot'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      wcConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>{wcConnected ? 'WooCommerce API Live' : 'WooCommerce Snapshot'}</span>
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
                    pathaoConnected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/90 dark:border-blue-800/80 shadow-2xs'
                      : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#222222]'
                  }`}
                  title={pathaoConnected ? 'Connected to Pathao Hermes courier API' : 'Pathao unconfigured or using local telemetry'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      pathaoConnected ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{pathaoConnected ? 'Pathao Aladdin Live' : 'Pathao Telemetry (Sim)'}</span>
                </span>

                {liveOrders.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/90 dark:border-purple-800/80 flex items-center gap-1 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span>{liveOrders.length} Items Synced</span>
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Operational snapshot: <strong className="text-slate-700 dark:text-slate-200">{report.refDayName} ({report.referenceDate})</strong></span>
              <span>•</span>
              <span>Baseline: <strong className="text-slate-700 dark:text-slate-200">7-Day Daily Avg ({report.avg7dMetrics.items} pkgs/day, ৳{report.avg7dMetrics.revenue.toLocaleString()})</strong></span>
              {lastSyncTime && (
                <>
                  <span>•</span>
                  <span className="text-slate-400 dark:text-slate-500">Synced at {lastSyncTime}</span>
                </>
              )}
              {report.isFallbackDate && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                  (Displaying latest recorded dispatches)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Switcher Pills */}
            <div className="inline-flex bg-slate-100 dark:bg-[#121212] p-1 rounded-2xl border border-slate-200 dark:border-[#1F1F1F] text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setSelectedHistoricalDate(null);
                  setSelectedView('Today Shipped');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  selectedView === 'Today Shipped' && !selectedHistoricalDate
                    ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🚚</span>
                <span>Today Shipped</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedHistoricalDate(null);
                  setSelectedView("Today's Orders");
                  setPipelineFilter('ALL');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  selectedView === "Today's Orders" && !selectedHistoricalDate
                    ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Today's Orders = Shipped today + all orders with Processing status"
              >
                <span>📦</span>
                <span>Today&apos;s Orders</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/60">
                  Active
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedHistoricalDate(null);
                  setSelectedView('Queue');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  selectedView === 'Queue' && !selectedHistoricalDate
                    ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>📋</span>
                <span>Queue</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-[#222222] text-slate-700 dark:text-slate-300 font-semibold">
                  {report.allOrdersBreakdown.processingCount + report.allOrdersBreakdown.holdCount}
                </span>
              </button>
            </div>

            {/* Online Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200/80 dark:border-[#1F1F1F] px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#171717] transition-colors">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(e) => setOnlineOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Online Only</span>
            </label>

            {/* Live Dual Refresh Button */}
            <button
              type="button"
              onClick={() => handleSyncNow(true)}
              disabled={isActuallySyncing}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all shadow-xs disabled:opacity-50"
              title={`Next auto-sync in ${countdown}s`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isActuallySyncing ? 'animate-spin' : ''}`} />
              <span>{isActuallySyncing ? 'Syncing...' : 'Sync Now (WC + Pathao)'}</span>
              <span className="text-[10px] text-slate-400 font-mono">({countdown}s)</span>
            </button>
          </div>
        </div>

        {/* Sync status alert notification */}
        {syncStatusMsg && (
          <div className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-slate-700">
            <span className="font-medium flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{syncStatusMsg}</span>
            </span>
            <button onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">✕</button>
          </div>
        )}
      </div>

      {/* ── 7-Day Dispatch History Strip ── */}
      <div className="bg-white dark:bg-black border border-slate-200/90 dark:border-[#1F1F1F] rounded-3xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm">🗓️</span>
            <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Last 7 Days Dispatch History
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              • Click any date to audit that day&apos;s shipped orders • Friday shown only when open with dispatches
            </span>
          </div>
          {selectedHistoricalDate && (
            <button
              type="button"
              onClick={() => {
                setSelectedHistoricalDate(null);
                setSelectedView('Today Shipped');
              }}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-200/80 dark:border-blue-800/60 transition-colors"
            >
              ↺ Reset to Today
            </button>
          )}
        </div>

        <div
          className={`grid gap-2 ${
            displayHistoryDays.length <= 6
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
              : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-7'
          }`}
        >
          {displayHistoryDays.map((day) => {
            const isSelected = selectedHistoricalDate
              ? selectedHistoricalDate === day.dateIso
              : day.isToday && selectedView === 'Today Shipped';
            return (
              <button
                key={day.dateIso}
                type="button"
                onClick={() => {
                  setSelectedHistoricalDate(day.dateIso);
                  setSelectedView('Today Shipped');
                }}
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-[#0A0A0A] border-slate-200 dark:border-[#1F1F1F] hover:bg-slate-100 dark:hover:bg-[#121212] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black ${isSelected ? 'text-blue-900 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    {day.dayName.slice(0, 3)}
                  </span>
                  {day.isToday && (
                    <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded-full">
                      Today
                    </span>
                  )}
                  {day.isPrevDay && !day.isToday && (
                    <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-0.2 rounded-full">
                      Prev
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {day.dateLabel.includes(',') ? day.dateLabel.split(',')[1].trim() : day.dateIso.slice(5)}
                </div>
                <div className="mt-1 flex items-baseline justify-between text-[11px]">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    📦 {day.orderCount}
                  </span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    ৳{Math.round(day.revenue / 1000)}k
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 5 Operational KPI Cards (Top Row: Pixel-Matched to DEEN-OPS Screenshot) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: SHIPPED ITEMS - TODAY */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedView === "Today's Orders" ? "Today's Items - Total" : 'Shipped Items - Today'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              📦
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline">
              {report.shippedItems.value}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#171717] text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                📊 {report.prevDayName}: {report.shippedItems.prevValue}
              </span>
            </div>

            <div className="mt-1.5">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  report.shippedItems.isPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80'
                }`}
              >
                {report.shippedItems.deltaFormatted}
              </span>
            </div>
          </div>

          <div className="pt-1 -mx-2 -mb-2">
            <KpiSparkline
              data={report.shippedItems.sparkline}
              color="#f97316"
              gradientId="kpi-sparkline-items"
              fillOpacity={0.25}
              height={32}
            />
          </div>
        </div>

        {/* Card 2: SALES REVENUE */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedView === "Today's Orders" ? "Today's Revenue - Total" : 'Sales Revenue - Today'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-2xs">
              ৳
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline">
              {report.salesRevenue.value}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#171717] text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                📊 {report.prevDayName}: {report.salesRevenue.prevValue}
              </span>
            </div>

            <div className="mt-1.5">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  report.salesRevenue.isPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80'
                }`}
              >
                {report.salesRevenue.deltaFormatted}
              </span>
            </div>
          </div>

          <div className="pt-1 -mx-2 -mb-2">
            <KpiSparkline
              data={report.salesRevenue.sparkline}
              color="#e11d48"
              gradientId="kpi-sparkline-revenue"
              fillOpacity={0.25}
              height={32}
            />
          </div>
        </div>

        {/* Card 3: SHIPPED ORDERS */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedView === "Today's Orders" ? "Today's Orders - Total" : 'Shipped Orders - Today'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              🚚
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline">
              {report.shippedOrders.value}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#171717] text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                📊 {report.prevDayName}: {report.shippedOrders.prevValue}
              </span>
            </div>

            <div className="mt-1.5">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  report.shippedOrders.isPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80'
                }`}
              >
                {report.shippedOrders.deltaFormatted}
              </span>
            </div>
          </div>

          <div className="pt-1 -mx-2 -mb-2">
            <KpiSparkline
              data={report.shippedOrders.sparkline}
              color="#3b82f6"
              gradientId="kpi-sparkline-orders"
              fillOpacity={0.25}
              height={32}
            />
          </div>
        </div>

        {/* Card 4: BASKET SIZE */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Basket Size
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              🛍️
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline">
              {report.basketSize.value}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#171717] text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                📊 {report.prevDayName}: {report.basketSize.prevValue}
              </span>
            </div>

            <div className="mt-1.5">
              <span
                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  report.basketSize.isPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80'
                }`}
              >
                {report.basketSize.deltaFormatted}
              </span>
            </div>
          </div>

          <div className="pt-1 -mx-2 -mb-2">
            <KpiSparkline
              data={report.basketSize.sparkline}
              color="#eab308"
              gradientId="kpi-sparkline-basket"
              fillOpacity={0.25}
              height={32}
            />
          </div>
        </div>

        {/* Card 5: CUSTOMER MIX */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Customer Mix
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              👥
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-2xl sm:text-[24px] font-black text-slate-900 dark:text-white tracking-tight font-headline">
              {report.customerMix.newCount} New / {report.customerMix.retCount} Ret
            </div>

            <div className="mt-1.5">
              <span className="inline-block text-[9.5px] font-black px-2 py-0.5 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xs tracking-wide">
                {report.customerMix.newPercent}% New || {report.customerMix.retPercent}% Returning
              </span>
            </div>

            <div className="mt-1.5">
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80">
                {report.customerMix.deltaNew >= 0 ? '▲ +' : '▼ '}{report.customerMix.deltaNew} New vs 7D Avg ({report.customerMix.prevNew}N / {report.customerMix.prevRet}R)
              </span>
            </div>
          </div>

          <div className="pt-1 -mx-2 -mb-2">
            <KpiSparkline
              data={report.customerMix.sparkline}
              color="#a855f7"
              gradientId="kpi-sparkline-cust"
              fillOpacity={0.3}
              height={32}
            />
          </div>
        </div>
      </div>

      {/* ── Performance Outlook & Category Analytics (Directly Below KPI Cards: Pixel-Matched to DEEN-OPS Screenshot) ── */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight font-headline">
              Performance Outlook & Category Analytics
            </h2>
          </div>

          {/* Show Sub-Category View Toggle (Red switch on the LEFT of text matching screenshot) */}
          <div className="flex items-center gap-2 select-none">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setShowSubCategory((prev) => !prev)}
                className="w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 bg-rose-500"
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    showSubCategory ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Show Sub-Category View</span>
            </label>
            <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help text-xs" title="Toggle between top-level store categories and detailed garment sub-types">
              (?)
            </span>
          </div>
        </div>

        {/* Dual Split Ratio Progress Bars (DEEN Selects vs DEEN Regular) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Split Bar */}
          <div className="space-y-1.5 px-0.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span>💎 Selects:</span>
                <strong>৳ {report.selectsStats.selectsRevenue.toLocaleString()}</strong>
                <span className="text-slate-500 dark:text-slate-400 font-normal">({report.selectsStats.selectsQty} pcs · {report.selectsStats.selectsRevShare}%)</span>
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400 font-normal">({report.selectsStats.regularRevShare}% · {report.selectsStats.regularQty} pcs)</span>
                <strong>৳ {report.selectsStats.regularRevenue.toLocaleString()}</strong>
                <span>📦 Regular</span>
              </span>
            </div>
            {/* Visual Dual Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-[#1F1F1F] rounded-full h-1.5 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${report.selectsStats.selectsRevShare}%` }}
                title={`DEEN Selects Revenue: ${report.selectsStats.selectsRevShare}%`}
              />
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${report.selectsStats.regularRevShare}%` }}
                title={`DEEN Regular Revenue: ${report.selectsStats.regularRevShare}%`}
              />
            </div>
          </div>

          {/* Volume Split Bar */}
          <div className="space-y-1.5 px-0.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span>💎 Selects:</span>
                <strong>{report.selectsStats.selectsQty} pcs</strong>
                <span className="text-slate-500 dark:text-slate-400 font-normal">({report.selectsStats.selectsQtyShare}% · ৳{report.selectsStats.selectsRevenue.toLocaleString()})</span>
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400 font-normal">(৳{report.selectsStats.regularRevenue.toLocaleString()} · {report.selectsStats.regularQtyShare}%)</span>
                <strong>{report.selectsStats.regularQty} pcs</strong>
                <span>📦 Regular</span>
              </span>
            </div>
            {/* Visual Dual Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-[#1F1F1F] rounded-full h-1.5 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${report.selectsStats.selectsQtyShare}%` }}
                title={`DEEN Selects Volume: ${report.selectsStats.selectsQtyShare}%`}
              />
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${report.selectsStats.regularQtyShare}%` }}
                title={`DEEN Regular Volume: ${report.selectsStats.regularQtyShare}%`}
              />
            </div>
          </div>
        </div>

        {/* Side-by-Side Charts (Donut & Volume Bar) - ALWAYS VISIBLE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Chart: Revenue Share (TK) Donut */}
          <div className="bg-white dark:bg-black border border-slate-200/90 dark:border-[#1F1F1F] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white tracking-tight font-headline flex items-center gap-1.5">
                <span>🔥</span>
                <span>Revenue Share (TK)</span>
              </h3>
            </div>

            <LiveRevenueDonutChart
              items={activeCategoryItems}
              totalRevenue={report.salesRevenue.rawValue}
              selectsShare={report.selectsStats.selectsRevShare}
            />
          </div>

          {/* Right Chart: Sales Volume by Category Bar Chart */}
          <div className="bg-white dark:bg-black border border-slate-200/90 dark:border-[#1F1F1F] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white tracking-tight font-headline flex items-center gap-1.5">
                <span>📦</span>
                <span>Sales Volume by Category</span>
              </h3>
            </div>

            <LiveVolumeBarChart
              items={activeCategoryItems}
              avgUnitsSold={report.avgUnitsSold}
            />
          </div>
        </div>
      </div>

      {/* ── Today's Orders Pipeline Status Strip (Only when Today's Orders view is selected) ── */}
      {(selectedView === "Today's Orders" || (selectedView as string) === 'All Orders') && report.allOrdersBreakdown && (
        <div className="bg-slate-50 border border-slate-200/90 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight font-headline flex items-center gap-2">
                  <span>Today&apos;s Orders Operational Pipeline</span>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-100 text-blue-800">
                    Shipped Today + Processing + Hold
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Active orders placed from online store checkout: {report.allOrdersBreakdown.totalActiveCount} orders (৳ {report.allOrdersBreakdown.totalActiveAmount.toLocaleString()})
                </p>
              </div>
            </div>

            {/* Pipeline quick filter buttons */}
            <div className="inline-flex bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPipelineFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  pipelineFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({report.allOrdersBreakdown.totalActiveCount})
              </button>
              <button
                type="button"
                onClick={() => setPipelineFilter('PROCESSING')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  pipelineFilter === 'PROCESSING'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ Processing ({report.allOrdersBreakdown.processingCount})
              </button>
              <button
                type="button"
                onClick={() => setPipelineFilter('HOLD')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  pipelineFilter === 'HOLD'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⏳ On-Hold ({report.allOrdersBreakdown.holdCount})
              </button>
              <button
                type="button"
                onClick={() => setPipelineFilter('SHIPPED_TODAY')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  pipelineFilter === 'SHIPPED_TODAY'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚚 Today Shipped ({report.allOrdersBreakdown.todayShippedCount})
              </button>
            </div>
          </div>

          {/* 3 Pipeline Segment Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => setPipelineFilter(pipelineFilter === 'PROCESSING' ? 'ALL' : 'PROCESSING')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                pipelineFilter === 'PROCESSING'
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200/80 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  ⚡ Processing Queue
                </span>
                <span className="text-[10px] text-slate-400 font-medium">To Pack</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 font-headline">
                  {report.allOrdersBreakdown.processingCount} <span className="text-xs font-normal text-slate-500">orders</span>
                </span>
                <span className="text-xs font-bold text-blue-700">
                  ৳ {report.allOrdersBreakdown.processingAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div
              onClick={() => setPipelineFilter(pipelineFilter === 'HOLD' ? 'ALL' : 'HOLD')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                pipelineFilter === 'HOLD'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                  : 'bg-white border-slate-200/80 hover:border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  ⏳ On-Hold (Verification)
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Advance / Confirm</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 font-headline">
                  {report.allOrdersBreakdown.holdCount} <span className="text-xs font-normal text-slate-500">orders</span>
                </span>
                <span className="text-xs font-bold text-amber-700">
                  ৳ {report.allOrdersBreakdown.holdAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div
              onClick={() => setPipelineFilter(pipelineFilter === 'SHIPPED_TODAY' ? 'ALL' : 'SHIPPED_TODAY')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                pipelineFilter === 'SHIPPED_TODAY'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200/80 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  🚚 Today Shipped / Completed
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Handed Over</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 font-headline">
                  {report.allOrdersBreakdown.todayShippedCount} <span className="text-xs font-normal text-slate-500">orders</span>
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  ৳ {report.allOrdersBreakdown.todayShippedAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Courier Verification & Telemetry Strip (Pathao Hermes Integration) ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 shadow-sm space-y-4 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-2xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight font-headline">
                  Pathao Courier Telemetry & Live Handover Audit
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Hermes Live
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Real-time parcel delivery status, collected cash on delivery, and courier discrepancy audit.
                {courierStats && (Boolean(courierStats.branchOrderCount) || Boolean(courierStats.exchangeOrderCount)) && (
                  <span className="ml-1 text-amber-300 font-semibold">
                    (Tracking includes {courierStats.branchOrderCount || 0} outlet dispatches & {courierStats.exchangeOrderCount || 0} replacements)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Discrepancy indicator pill */}
          {courierStats && courierStats.discrepancyCount > 0 ? (
            <button
              type="button"
              onClick={() => setCourierFilter('DISCREPANCY_ONLY')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/40 text-xs font-bold hover:bg-rose-500/30 transition-all animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{courierStats.discrepancyCount} Discrepancies Detected</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Courier Statuses Reconciled</span>
            </div>
          )}
        </div>

        {/* 4 Telemetry Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
              Handed Over to Pathao
            </span>
            <div className="mt-1">
              <div className="text-2xl font-black text-white font-headline">
                {courierStats ? `${courierStats.handedOverRate}%` : '94.2%'}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {courierStats ? `${courierStats.handedOverCount} of ${courierStats.totalOrders} parcels tracked` : 'Tracked via Courier API'}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-blue-400 uppercase tracking-wider">
              In-Transit With Courier
            </span>
            <div className="mt-1">
              <div className="text-2xl font-black text-blue-300 font-headline">
                {courierStats ? courierStats.inTransitCount : 18} parcels
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Moving to customer address
              </p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-emerald-400 uppercase tracking-wider">
              Delivered by Pathao
            </span>
            <div className="mt-1">
              <div className="text-2xl font-black text-emerald-300 font-headline">
                {courierStats ? courierStats.deliveredCount : 28} parcels
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                COD Collected: ৳ {courierStats ? courierStats.totalCodCollected.toLocaleString() : '58,400'}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-rose-400 uppercase tracking-wider">
              Returned / RTO
            </span>
            <div className="mt-1">
              <div className="text-2xl font-black text-rose-300 font-headline">
                {courierStats ? courierStats.returnedCount : 4} parcels
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Returned to Mirpur Warehouse
              </p>
            </div>
          </div>
        </div>

        {/* Discrepancy Banner Alert if any exist */}
        {discrepancies.length > 0 && (
          <div className="bg-rose-950/60 border border-rose-800/70 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-start sm:items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <strong className="text-white">{discrepancies.length} Courier Reconciliation Discrepancies:</strong>{' '}
                {(() => {
                  const uniqueTypes = Array.from(new Set(discrepancies.map((d) => d.type)));
                  const typeLabels = uniqueTypes.map((t) => {
                    if (t === 'RETURNED_BUT_SHIPPED') return 'Returned but Shipped';
                    if (t === 'DELIVERED_BUT_PROCESSING') return 'Delivered but Processing';
                    if (t === 'UNCOLLECTED_COD') return 'Uncollected COD';
                    if (t === 'DOUBLE_COLLECTION_RISK') return 'Double Collection Risk';
                    if (t === 'COD_MISMATCH') return 'COD Amount Mismatch';
                    return t;
                  });
                  return `Identified ${typeLabels.join(', ')}. Review flags before invoice settlement.`;
                })()}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCourierFilter('DISCREPANCY_ONLY')}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-colors shadow-2xs"
              >
                Filter All Discrepancies
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Executive Operations Briefing Panel (7-Day Performance Analysis) ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-700/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-lg">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white font-headline">
                  Executive Operations Briefing
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {selectedHistoricalDate ? 'Historical Audit' : 'Live Status'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {report.executiveBriefing.dateFormatted} • Operational Summary &amp; Performance vs 7-Day Average
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(report.executiveBriefing.clipboardText);
                  setBriefingCopied(true);
                  setTimeout(() => setBriefingCopied(false), 2500);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{briefingCopied ? 'Copied to Clipboard! ✓' : 'Copy Briefing'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {report.referenceDate} Excel</span>
            </button>
          </div>
        </div>

        {/* 4 Executive Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Dispatched Volume
            </span>
            <div className="text-lg sm:text-xl font-black text-white font-headline mt-0.5">
              {report.executiveBriefing.totalOrders} <span className="text-xs font-normal text-slate-400">orders</span>
            </div>
            <div className="text-[11px] text-slate-300">
              {report.executiveBriefing.totalItems} items dispatched
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Gross Value &amp; AOV
            </span>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-headline mt-0.5">
              ৳ {report.executiveBriefing.totalRevenue.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-300">
              AOV: ৳ {report.executiveBriefing.aov.toLocaleString()}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              vs 7-Day Daily Avg
            </span>
            <div className={`text-lg sm:text-xl font-black font-headline mt-0.5 ${(report.executiveBriefing.vs7dVolumePct || 0) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {(report.executiveBriefing.vs7dVolumePct || 0) >= 0 ? '+' : ''}{report.executiveBriefing.vs7dVolumePct}% items
            </div>
            <div className="text-[11px] text-slate-300">
              {(report.executiveBriefing.vs7dRevenuePct || 0) >= 0 ? '+' : ''}{report.executiveBriefing.vs7dRevenuePct}% revenue
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Top Category &amp; SKU
            </span>
            <div className="text-sm font-black text-sky-300 truncate mt-0.5" title={report.executiveBriefing.topCategory.name}>
              {report.executiveBriefing.topCategory.name} ({report.executiveBriefing.topCategory.volume} pcs)
            </div>
            <div className="text-[11px] text-slate-300 truncate" title={report.executiveBriefing.topProduct.name}>
              {report.executiveBriefing.topProduct.name}
            </div>
          </div>
        </div>

        {/* Executive Takeaway Bullet Points */}
        <div className="bg-black/25 rounded-2xl p-3.5 border border-white/5 space-y-1.5 text-xs text-slate-200">
          <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider mb-1">
            Operational Highlights &amp; Analysis:
          </div>
          {report.executiveBriefing.summaryPoints.map((pt, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-indigo-400 text-xs leading-relaxed">•</span>
              <span className="leading-relaxed">{pt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Product Demand & Velocity Spotlight Leaderboard ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-headline">
                Product Demand & Velocity Spotlight ({report.topProducts.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Top selling products and SKUs in active orders flow. Click any product to isolate all corresponding parcels in the ledger below.
              </p>
            </div>
          </div>
          <span className="font-semibold text-slate-500 text-xs shrink-0">
            Sorted by units & velocity
          </span>
        </div>

        <div className="overflow-x-auto min-w-0 border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/90 text-[10.5px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-center">Rank</th>
                <th className="py-2.5 px-3">Product Name & SKU</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">Collection</th>
                <th className="py-2.5 px-3 text-center">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                <th className="py-2.5 px-3 text-center">Rev Share</th>
                <th className="py-2.5 px-3 text-center">Velocity</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    No product sales recorded in current operational view.
                  </td>
                </tr>
              ) : (
                report.topProducts.map((p) => {
                  const maxUnits = report.topProducts[0]?.unitsSold || 1;
                  const unitPct = Math.min(100, Math.round((p.unitsSold / maxUnits) * 100));
                  return (
                    <tr
                      key={`spotlight-${p.rank}-${p.sku}`}
                      onClick={() => setSearchQuery(p.productName)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 text-center font-bold">
                        {p.rank === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center justify-center font-black text-xs shadow-2xs">
                            🥇
                          </span>
                        ) : p.rank === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 border border-slate-300 inline-flex items-center justify-center font-black text-xs shadow-2xs">
                            🥈
                          </span>
                        ) : p.rank === 3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-900 border border-amber-200 inline-flex items-center justify-center font-black text-xs shadow-2xs">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">#{p.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[240px]">
                        <div className="group-hover:text-blue-600 transition-colors truncate" title={p.productName}>
                          {p.productName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {p.isSelects ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            💎 Selects
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            📦 Regular
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-slate-900 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{p.unitsSold} pcs</span>
                          <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${unitPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                        ৳ {p.revenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600 whitespace-nowrap">
                        {p.revenueShare}%
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {p.velocityScore === 'HOT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                            🔥 HOT
                          </span>
                        ) : p.velocityScore === 'FAST' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            ⚡ FAST
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            📦 STEADY
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery(p.productName);
                          }}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10.5px] transition-colors"
                        >
                          Filter Orders
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Real-Time Orders Manifest & Shipped Ledger ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight font-headline flex items-center gap-2">
              <span>📋</span>
              <span>Everyday Dispatched Orders Ledger</span>
              <span className="text-xs font-normal text-slate-500">
                ({filteredOrders.length} orders displayed)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Granular record of all customer orders matching the active shift view with live Pathao delivery status.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Courier Telemetry Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Courier Filter:
          </span>
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'Delivered', label: '✓ Delivered' },
            { id: 'In Transit', label: '🚚 In Transit' },
            { id: 'Returned', label: '⚠ Returned' },
            { id: 'Untracked', label: '○ Untracked' },
            { id: 'DISCREPANCY_ONLY', label: '🚨 Discrepancies Only' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setCourierFilter(pill.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                courierFilter === pill.id
                  ? pill.id === 'DISCREPANCY_ONLY'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Filters Bar: Search & Category Dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, Consignment ID, Customer, Phone, SKU, or Product..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories ({uniqueCategories.length})</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table with Pathao Courier Status & Consignment ID */}
        <div className="overflow-x-auto min-w-0 rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3.5">Order ID</th>
                <th className="py-3 px-3.5">Date & Time</th>
                <th className="py-3 px-3.5">Customer & Phone</th>
                <th className="py-3 px-3.5">Product & SKU</th>
                <th className="py-3 px-3.5 text-center">Collection</th>
                <th className="py-3 px-3.5 text-center">Qty</th>
                <th className="py-3 px-3.5 text-right">Unit Price</th>
                <th className="py-3 px-3.5 text-right">Order Total</th>
                <th className="py-3 px-3.5 text-center">WC Status</th>
                <th className="py-3 px-3.5 text-center">Courier Status (Pathao)</th>
                <th className="py-3 px-3.5 text-center">Consignment ID</th>
                <th className="py-3 px-3.5 text-center">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">No orders found matching the filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.slice(0, 100).map((row, idx) => {
                  const oid = String(row['Order ID'] || row.orderId || '');
                  const prodName = row['Item Name'] || 'Apparel Item';
                  const cat = getCategoryForSales(prodName);
                  const isSelects = classifyProductLine(prodName, row.SKU, cat) === 'DEEN Selects';
                  const qty = Number(row.Quantity) || 1;
                  const itemCost = Number(row['Item Cost']) || 0;
                  const orderAmt = Number(row['Order Amount']) || itemCost * qty;
                  const wcStatus = String(row['Delivery Status'] || (row as any).status || 'shipped');
                  const courierStatus = String(row['Courier Status'] || row.courierStatus || 'Untracked');
                  const consignmentId = String(row['Consignment ID'] || row.consignmentId || '').trim();
                  const hasDiscrepancy = Boolean(row.hasDiscrepancy);

                  return (
                    <tr
                      key={`live-order-row-${oid}-${idx}`}
                      onClick={() => setSelectedDetailOrder(row)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        hasDiscrepancy ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3.5 font-bold text-blue-600 font-mono whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="group-hover:underline">{oid}</span>
                            {hasDiscrepancy && (
                              <span title={`Discrepancy: ${row.discrepancyType || 'Status mismatch'}`} className="text-rose-500">
                                <AlertTriangle className="w-3.5 h-3.5 inline" />
                              </span>
                            )}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {(() => {
                            const branch = detectFulfillmentBranch(row);
                            if (!branch.isBranchFulfillment) return null;
                            const badgeColor =
                              branch.branchCode === 'MIRPUR'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : branch.branchCode === 'CUMILLA'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : branch.branchCode === 'WARI'
                                ? 'bg-teal-100 text-teal-800 border-teal-200'
                                : branch.branchCode === 'SYLHET'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                : branch.branchCode === 'EXCHANGE'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <span
                                className={`inline-block self-start px-1.5 py-0.2 rounded text-[9.5px] font-bold tracking-tight border font-sans ${badgeColor}`}
                                title={`Fulfillment: ${branch.branchName}`}
                              >
                                {branch.branchCode === 'EXCHANGE'
                                  ? 'Exchange'
                                  : branch.branchName.replace(' Branch', '').replace(' Outlet POS', ' POS')}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                        {String(row['Order Date'] || '').slice(0, 16)}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-slate-800 truncate max-w-[140px]" title={row['Customer Name']}>
                          {row['Customer Name'] || 'Customer'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {row.Phone || 'N/A'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 max-w-[220px]">
                        <div className="font-semibold text-slate-800 truncate" title={prodName}>
                          {prodName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                          <span>SKU: {row.SKU || 'N/A'}</span>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">{cat}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {isSelects ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            💎 Selects
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            📦 Regular
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">
                        {qty}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-medium text-slate-600">
                        ৳ {itemCost.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-slate-900">
                        ৳ {orderAmt.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {wcStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {courierStatus === 'Delivered' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Delivered</span>
                          </span>
                        ) : courierStatus === 'In Transit' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>In Transit</span>
                          </span>
                        ) : courierStatus === 'Returned' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Returned</span>
                          </span>
                        ) : courierStatus === 'Pending Pickup' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Untracked
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-mono text-[11px] whitespace-nowrap">
                        {consignmentId ? (
                          <a
                            href={`https://pathao.com/courier/tracking/?consignment_id=${encodeURIComponent(consignmentId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                            title="Open Pathao Tracking"
                          >
                            <span>{consignmentId}</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const wa = generateWhatsAppConfirmationUrl(row, {
                            type: isOrderOnHold(row) ? 'address_verification' : 'general',
                          });
                          if (!wa.url) {
                            return <span className="text-slate-300 text-xs">—</span>;
                          }
                          return (
                            <a
                              href={wa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10.5px] font-bold transition-all shadow-2xs"
                              title={`Send ${isOrderOnHold(row) ? 'Address Verification' : 'Confirmation'} to ${wa.formattedPhone}`}
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order Telemetry Inspection Modal ── */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 font-headline">
                    Order #{selectedDetailOrder['Order ID'] || selectedDetailOrder.orderId}
                  </h3>
                  {(() => {
                    const branch = detectFulfillmentBranch(selectedDetailOrder);
                    if (!branch.isBranchFulfillment) return null;
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {branch.branchName}
                      </span>
                    );
                  })()}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    WC: {selectedDetailOrder['Delivery Status'] || 'shipped'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Pathao: {selectedDetailOrder['Courier Status'] || selectedDetailOrder.courierStatus || 'Untracked'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Placed on {String(selectedDetailOrder['Order Date'] || '')} • Customer: {selectedDetailOrder['Customer Name']}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Discrepancy Alert Banner inside Modal if applicable */}
            {selectedDetailOrder.hasDiscrepancy && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-bold text-rose-900">
                    Courier Discrepancy Detected ({selectedDetailOrder.discrepancyType})
                  </h4>
                  <p className="text-rose-700 mt-0.5">
                    {selectedDetailOrder.discrepancyMessage ||
                      'The status recorded in WooCommerce differs from the courier return status received from Pathao Hermes API.'}
                  </p>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Product Info */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-500">
                  <Package className="w-3.5 h-3.5" /> Product & Apparel Line
                </h4>
                <div>
                  <div className="font-bold text-slate-900">{selectedDetailOrder['Item Name']}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">SKU: {selectedDetailOrder.SKU || 'N/A'}</div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-slate-600">
                  <span>Quantity:</span>
                  <span className="font-bold text-slate-900">{selectedDetailOrder.Quantity || 1} pcs</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Order Total:</span>
                  <span className="font-bold text-slate-900">৳ {Number(selectedDetailOrder['Order Amount'] || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Pathao Telemetry */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-500">
                  <Truck className="w-3.5 h-3.5" /> Pathao Courier Telemetry
                </h4>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Consignment ID:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {selectedDetailOrder['Consignment ID'] || selectedDetailOrder.consignmentId || 'Untracked'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Courier Status:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDetailOrder['Courier Status'] || selectedDetailOrder.courierStatus || 'Untracked'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">COD Collected:</span>
                  <span className="font-bold text-slate-900">
                    ৳ {Number(selectedDetailOrder.collectedAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Fulfillment Hub:</span>
                  <span className="font-bold text-slate-800">
                    {detectFulfillmentBranch(selectedDetailOrder).branchName}
                  </span>
                </div>
                {selectedDetailOrder['Consignment ID'] && (
                  <div className="pt-2">
                    <a
                      href={`https://pathao.com/courier/tracking/?consignment_id=${encodeURIComponent(
                        selectedDetailOrder['Consignment ID']
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow-2xs"
                    >
                      <span>Track on Pathao</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Customer & Delivery Address */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1.5 text-xs">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider text-slate-500">
                Customer & Delivery Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Name:</span>
                  <span className="font-semibold">{selectedDetailOrder['Customer Name'] || 'Customer'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Phone:</span>
                  <span className="font-semibold">{selectedDetailOrder.Phone || 'N/A'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px]">City / Area:</span>
                  <span className="font-semibold">{selectedDetailOrder.City || 'Dhaka'}</span>
                </div>
                {selectedDetailOrder['Order Notes'] && (
                  <div className="col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400 block text-[10px]">Customer Note:</span>
                    <span className="italic text-slate-600">{selectedDetailOrder['Order Notes']}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 1-Click WhatsApp Quick Action Hub inside Modal */}
            {(() => {
              const waVerify = generateWhatsAppConfirmationUrl(selectedDetailOrder, { type: 'address_verification' });
              const waAdvance = generateWhatsAppConfirmationUrl(selectedDetailOrder, { type: 'advance_token', advanceAmount: 200 });
              const orderId = String(selectedDetailOrder['Order ID'] || selectedDetailOrder.orderId || '');

              return (
                <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-3 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp Customer Operations</span>
                    </h4>
                    <span className="text-[11px] text-emerald-800 font-mono font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      {waVerify.formattedPhone ? `+${waVerify.formattedPhone}` : 'No phone provided'}
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-800">
                    Send one-click pre-composed WhatsApp message to confirm customer shipping address or request bKash advance delivery fee before courier cut-off.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {waVerify.url ? (
                      <a
                        href={waVerify.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send Address Verification</span>
                      </a>
                    ) : null}

                    {waAdvance.url ? (
                      <a
                        href={waAdvance.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors shadow-2xs"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>Request BDT 200 Advance (bKash)</span>
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        if (waVerify.message) {
                          navigator.clipboard.writeText(waVerify.message);
                          setCopiedOrderId(orderId);
                          setTimeout(() => setCopiedOrderId(null), 2500);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-800 font-bold text-xs transition-colors shadow-2xs"
                    >
                      {copiedOrderId === orderId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copy Message Text</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onSelectOrder) onSelectOrder(String(selectedDetailOrder['Order ID'] || selectedDetailOrder.orderId));
                  setSelectedDetailOrder(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
              >
                Inspect in Reconciled Ledger
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
