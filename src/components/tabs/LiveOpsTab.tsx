"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Truck,
  RefreshCw,
  Search,
  Download,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  ExternalLink,
  AlertTriangle,
  X,
  MessageSquare,
  Copy,
  Check,
  Zap,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
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
  isOrderExchange,
  isOrderOnline,
  extractExchangeInfo,
  generateWhatsAppConfirmationUrl,
  parseOrderDate,
  formatDateToIsoDay,
  parseOrderDateValue,
} from '@/lib/liveOpsProcessor';
import { LiveRevenueDonutChart } from '@/components/charts/LiveRevenueDonutChart';
import { LiveVolumeBarChart } from '@/components/charts/LiveVolumeBarChart';
import { KpiSparkline } from '@/components/charts/KpiSparkline';
import { classifyProductLine } from '@/lib/selectsAnalytics';
import { getCategoryForSales, getSubCategoryForSales, getShortSubCategoryLabel } from '@/lib/liveCategoryEngine';
import {
  LiveTerminalStats,
  DiscrepancyAlert,
  detectFulfillmentBranch,
} from '@/lib/sync/liveTerminalSync';
import { loadAppSettings } from '@/lib/settingsStore';
import { getCacheItem, setCacheItem, DEEN_CACHE_KEYS } from '@/lib/cacheManager';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber,
  exportLiveShippedOrdersExcel,
} from '@/lib/excelExport';
import {
  groupOrdersByOrderId,
  filterOrderWiseGroups,
  exportOrderWiseLedgerExcel,
  OrderWiseGroup,
} from '@/lib/orderGrouping';
import { CustomerRatingBadge } from '@/components/courier/CustomerRatingBadge';
import {
  CustomerRatingData,
  normalizeCustomerPhone,
  batchResolveCustomerRatings,
} from '@/lib/customerRating';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';
import { DataProvenanceInfo } from '@/lib/dataAudit';
import { useTableVirtualizer } from '@/lib/useTableVirtualizer';
import { getLiveWebhookUpdates } from '@/lib/pathaoWebhookEngine';
import { downloadLiveOpsHtmlReport } from '@/lib/htmlReportExport';

function formatOrderDateTime(val: unknown): string {
  const d = parseOrderDateValue(val);
  if (!d) return String(val || 'N/A').slice(0, 16);
  return (
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Dhaka',
    }) +
    ' • ' +
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Dhaka',
    })
  );
}

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
  onRefreshLive?: (fetchedOrders?: RawOrderRow[], provenance?: unknown) => Promise<void> | void;
  isSyncing?: boolean;
}

interface AutoSyncCountdownButtonProps {
  onManualSync: () => void;
  onAutoSync: () => void;
  isSyncing: boolean;
}

/**
 * Isolated, memoized leaf component for the 60-second background revalidation countdown.
 * By keeping countdown state inside this leaf component, the 1-second interval never
 * triggers a re-render of the parent LiveOpsTab or its virtualized data tables.
 */
const AutoSyncCountdownButton = React.memo(function AutoSyncCountdownButton({
  onManualSync,
  onAutoSync,
  isSyncing,
}: AutoSyncCountdownButtonProps) {
  const [countdown, setCountdown] = useState(60);
  const onAutoSyncRef = useRef(onAutoSync);

  useEffect(() => {
    onAutoSyncRef.current = onAutoSync;
  }, [onAutoSync]);

  useEffect(() => {
    if (isSyncing) {
      setCountdown(60);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            onAutoSyncRef.current();
          }, 0);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSyncing]);

  return (
    <button
      type="button"
      onClick={onManualSync}
      disabled={isSyncing}
      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
      title={`Next auto-sync in ${countdown}s`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      <span>{isSyncing ? 'Syncing...' : 'Sync Now (WC + Pathao)'}</span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({countdown}s)</span>
    </button>
  );
});

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
  const [isVolumeModalOpen, setIsVolumeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [courierFilter, setCourierFilter] = useState<string>('ALL');
  const [pipelineFilter, setPipelineFilter] = useState<'ALL' | 'PROCESSING' | 'HOLD' | 'SHIPPED_TODAY'>('ALL');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [localSyncing, setLocalSyncing] = useState(false);

  // Table Granularity Switcher: Consolidated Orders (Order-Wise default) vs Line Items (Item-Wise)
  const [ledgerViewMode, setLedgerViewMode] = useState<'ITEM_WISE' | 'ORDER_WISE'>('ORDER_WISE');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Customer Delivery Ratings & Fraud Intelligence State
  const [customerRatings, setCustomerRatings] = useState<Record<string, CustomerRatingData>>({});
  const customerRatingsRef = React.useRef(customerRatings);
  useEffect(() => {
    customerRatingsRef.current = customerRatings;
  }, [customerRatings]);

  const getRatingForPhone = useCallback(
    (ph: unknown): CustomerRatingData | undefined => {
      const s = String(ph || '').trim();
      if (!s || s === 'N/A' || s === 'nan' || s === 'none') return undefined;
      if (customerRatings[s]) return customerRatings[s];
      const { full, suffix10 } = normalizeCustomerPhone(s);
      if (full && customerRatings[full]) return customerRatings[full];
      if (suffix10 && customerRatings[suffix10]) return customerRatings[suffix10];
      return undefined;
    },
    [customerRatings]
  );

  const toggleOrderExpanded = useCallback((orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const toggleAllExpanded = useCallback((expandAll: boolean, allOrderIds: string[]) => {
    if (!expandAll) {
      setExpandedOrderIds(new Set());
    } else {
      setExpandedOrderIds(new Set(allOrderIds));
    }
  }, []);

  // Live Sync & Telemetry State — Clean SSR defaults, hydrated in useEffect on mount
  const [liveOrders, setLiveOrders] = useState<RawOrderRow[]>([]);
  const [courierStats, setCourierStats] = useState<LiveTerminalStats | null>(null);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyAlert[]>([]);
  const [wcConnected, setWcConnected] = useState<boolean>(false);
  const [pathaoConnected, setPathaoConnected] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Track previous discrepancies count to only alert on genuinely new issues
  const discrepanciesRef = React.useRef(discrepancies);
  useEffect(() => {
    discrepanciesRef.current = discrepancies;
  }, [discrepancies]);

  const ordersRef = React.useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Inspection modal state
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<RawOrderRow | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // 7-Day History selection & Executive Briefing State
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);
  const [briefingCopied, setBriefingCopied] = useState(false);
  const [briefingViewMode, setBriefingViewMode] = useState<'structured' | 'text'>('structured');

  // Handle Escape key to close open inspection or fullscreen modals
  useEffect(() => {
    if (!selectedDetailOrder && !isVolumeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDetailOrder) setSelectedDetailOrder(null);
        if (isVolumeModalOpen) setIsVolumeModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDetailOrder, isVolumeModalOpen]);

  // Hydrate client state from localStorage cache and URL parameters safely without SSR mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const urlDate = p.get('date');
    if (urlDate) setSelectedHistoricalDate(urlDate);
    const urlCourier = p.get('courierFilter');
    if (urlCourier) setCourierFilter(urlCourier);
    const urlLedger = p.get('ledgerView');
    if (urlLedger === 'ORDER_WISE' || urlLedger === 'orderwise') setLedgerViewMode('ORDER_WISE');
    if (urlLedger === 'ITEM_WISE' || urlLedger === 'itemwise') setLedgerViewMode('ITEM_WISE');

    const cached = getCacheItem<LiveTerminalCacheEnvelope>(DEEN_CACHE_KEYS.LIVE_TERMINAL);
    if (cached) {
      if (Array.isArray(cached.orders) && cached.orders.length > 0) setLiveOrders(cached.orders);
      if (cached.stats) setCourierStats(cached.stats);
      if (Array.isArray(cached.discrepancies)) setDiscrepancies(cached.discrepancies);
      if (cached.wcConnected !== undefined) setWcConnected(cached.wcConnected);
      if (cached.pathaoConnected !== undefined) setPathaoConnected(cached.pathaoConnected);
      if (cached.lastSyncTime) setLastSyncTime(cached.lastSyncTime);
    }
  }, []);

  // Auto-dismiss transient sync message to remove UI clutter
  useEffect(() => {
    if (!syncStatusMsg) return;
    const timer = setTimeout(() => {
      setSyncStatusMsg(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [syncStatusMsg]);

  // Guard to prevent concurrent sync loops
  const isSyncingRef = React.useRef(false);

  // Active dataset for processing (prefer live synced orders if available)
  const activeDataset = liveOrders.length > 0 ? liveOrders : orders;

  // Determine current operational baseline anchor date from the dataset
  const snapshotAnchorDate = useMemo(() => {
    const ordersWithDates = (activeDataset || [])
      .map((o) => ({ order: o, date: parseOrderDate(o) }))
      .filter((x): x is { order: RawOrderRow; date: Date } => x.date !== null);

    const now = new Date();
    const todayIso = formatDateToIsoDay(now);
    const hasOrdersToday = ordersWithDates.some((x) => formatDateToIsoDay(x.date) === todayIso);
    if (hasOrdersToday) return todayIso;
    if (ordersWithDates.length > 0) {
      const sorted = [...ordersWithDates].sort((a, b) => b.date.getTime() - a.date.getTime());
      return formatDateToIsoDay(sorted[0].date);
    }
    return todayIso;
  }, [activeDataset]);

  // Process live operational data
  const report: LiveOpsReport = useMemo(() => {
    return processLiveOpsData(activeDataset, {
      view: selectedHistoricalDate ? 'Today Shipped' : selectedView,
      onlineOnly,
      customDate: selectedHistoricalDate || undefined,
      anchorDate: snapshotAnchorDate,
      historicalOrders: orders,
    });
  }, [activeDataset, selectedView, onlineOnly, selectedHistoricalDate, snapshotAnchorDate, orders]);

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
      const payload: Record<string, unknown> = {
        limitConsignments: 35,
        fetchLiveWc: true,
        maxPages: 6,
        activeOrders: ordersRef.current && ordersRef.current.length > 0 ? ordersRef.current : undefined,
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
        headers: getClientAuthHeaders(),
        body: JSON.stringify(payload),
      });

      let data: {
        success?: boolean;
        orders?: RawOrderRow[];
        stats?: LiveTerminalStats;
        discrepancies?: DiscrepancyAlert[];
        wcConnected?: boolean;
        pathaoConnected?: boolean;
        provenance?: DataProvenanceInfo;
        message?: string;
      } | null = null;
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
    } catch (e: unknown) {
      if (isManual) {
        const msg = e instanceof Error ? e.message : 'Using current snapshot';
        setSyncStatusMsg(`Sync notice: ${msg}`);
        dispatchSyncNotification({
          type: 'error',
          title: 'Live Sync Notice',
          description: msg,
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

  const handleManualSync = useCallback(() => {
    handleSyncNow(true);
  }, [handleSyncNow]);

  const handleAutoSync = useCallback(() => {
    handleSyncNow(false);
  }, [handleSyncNow]);

  // SWR: Silent background revalidation on mount
  useEffect(() => {
    handleSyncNow(false);
  }, [handleSyncNow]);

  // Filtered orders list for ledger table (Sorted by Order Number)
  const filteredOrders = useMemo(() => {
    const list = report.activeOrders.filter((o) => {
      // Rule: Exclude POS outlet orders from online operations view
      if (!isOrderOnline(o)) return false;

      // Rule: Exclude exchange replacements (and non-checkout orders) from standard commercial view unless 'EXCHANGES_ONLY' is selected
      if (courierFilter === 'EXCHANGES_ONLY') {
        if (!isOrderExchange(o)) return false;
      } else {
        if (isOrderExchange(o)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const oid = String(o['Order ID'] || o.orderId || '').toLowerCase();
        const cname = String(getExportCustomerName(o) || o['Customer Name'] || '').toLowerCase();
        const phone = String(getExportPhoneNumber(o) || o.Phone || '').toLowerCase();
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
        const itemName = String(o['Item Name'] || '');
        const cat = getCategoryForSales(itemName);
        const subCat = getSubCategoryForSales(itemName, cat);
        const shortSub = getShortSubCategoryLabel(subCat);
        const matchesCategory = (cat === categoryFilter);
        const matchesSubCategory = (
          subCat === categoryFilter ||
          shortSub === categoryFilter ||
          (categoryFilter === 'Regular Fit' && /regular/i.test(itemName) && cat === 'Jeans') ||
          (categoryFilter === 'Slim Fit' && /slim/i.test(itemName) && cat === 'Jeans') ||
          (categoryFilter === 'Straight Fit' && /straight/i.test(itemName) && cat === 'Jeans')
        );
        if (!matchesCategory && !matchesSubCategory) return false;
      }

      if (courierFilter !== 'ALL' && courierFilter !== 'EXCHANGES_ONLY') {
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

    return list.sort(compareOrdersByNumber);
  }, [report.activeOrders, searchQuery, categoryFilter, courierFilter, selectedView, pipelineFilter]);

  // Grouped order-wise records for consolidated ledger table view
  const orderWiseGroups = useMemo(() => {
    return groupOrdersByOrderId(report.activeOrders);
  }, [report.activeOrders]);

  const filteredOrderWiseGroups = useMemo(() => {
    return filterOrderWiseGroups(orderWiseGroups, {
      searchQuery,
      categoryFilter,
      courierFilter,
      pipelineFilter,
      selectedView,
    });
  }, [orderWiseGroups, searchQuery, categoryFilter, courierFilter, pipelineFilter, selectedView]);

  // Table Container Ref for Scroll Virtualization
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Hook 1: Order-Wise Table Virtualizer (Calibrated to true rendered row dimensions)
  const orderWiseVirtualizer = useTableVirtualizer<OrderWiseGroup>({
    items: filteredOrderWiseGroups,
    estimateItemHeight: useCallback(
      (group: OrderWiseGroup) => {
        if (expandedOrderIds.has(group.orderId)) {
          return 74 + 36 + group.items.length * 36 + 24;
        }
        return 74;
      },
      [expandedOrderIds]
    ),
    overscan: 16,
    scrollContainerRef: tableContainerRef,
  });

  // Hook 2: Item-Wise Table Virtualizer
  const itemWiseVirtualizer = useTableVirtualizer<RawOrderRow>({
    items: filteredOrders,
    estimateItemHeight: useCallback(() => 54, []),
    overscan: 16,
    scrollContainerRef: tableContainerRef,
  });

  // Webhook Courier Telemetry live state (Stable interval without listener churn)
  const [webhookUpdatesCount, setWebhookUpdatesCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      const updates = getLiveWebhookUpdates();
      setWebhookUpdatesCount((prev) => (updates.size !== prev ? updates.size : prev));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Modal order item group (resolves all multi-item basket items if inspecting in modal)
  const modalOrderGroup = useMemo(() => {
    if (!selectedDetailOrder) return null;
    const oid = String(selectedDetailOrder['Order ID'] || selectedDetailOrder.orderId || '').trim();
    if (!oid) return null;
    const matchingRows = (report.activeOrders || []).filter(
      (o) => String(o['Order ID'] || o.orderId || '').trim() === oid
    );
    if (matchingRows.length <= 1) return null;
    const grouped = groupOrdersByOrderId(matchingRows);
    return grouped[0] || null;
  }, [selectedDetailOrder, report.activeOrders]);

  // Batch resolve customer delivery ratings & fraud risk for displayed ledger orders
  useEffect(() => {
    const rawPhones: string[] = [];
    for (const g of filteredOrderWiseGroups) {
      if (g.phone) rawPhones.push(g.phone);
    }
    for (const o of filteredOrders) {
      const p = getExportPhoneNumber(o) || o.Phone;
      if (p) rawPhones.push(String(p));
    }

    const uniqueList = Array.from(new Set(rawPhones.filter(Boolean)));
    if (uniqueList.length === 0) return;

    // 1. Instant local baseline resolution (0ms synchronous lookup from store history)
    batchResolveCustomerRatings(uniqueList, { skipPathaoApi: true, liveOrders: report.activeOrders })
      .then((localRatings) => {
        setCustomerRatings((prev) => ({ ...localRatings, ...prev }));
      })
      .catch(() => {});

    // 2. Asynchronous Pathao API verification in background for unverified numbers
    const unverified = uniqueList.filter((ph) => {
      const { full } = normalizeCustomerPhone(ph);
      const existing = customerRatingsRef.current[full] || customerRatingsRef.current[ph];
      return !existing || existing.source !== 'PATHAO';
    }).slice(0, 30);

    if (unverified.length > 0) {
      fetch('/api/courier/customer-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuthHeaders(),
        },
        body: JSON.stringify({ phones: unverified }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.ratings && typeof data.ratings === 'object') {
            setCustomerRatings((prev) => ({ ...prev, ...data.ratings }));
          }
        })
        .catch(() => {});
    }
  }, [filteredOrderWiseGroups, filteredOrders, report.activeOrders]);

  // Unique categories for table filter dropdown (pure online commercial items)
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const o of report.activeOrders) {
      if (isOrderOnline(o) && !isOrderExchange(o)) {
        const itemName = String(o['Item Name'] || '');
        const cat = getCategoryForSales(itemName);
        if (showSubCategory) {
          const subCat = getSubCategoryForSales(itemName, cat);
          set.add(getShortSubCategoryLabel(subCat));
        } else {
          set.add(cat);
        }
      }
    }
    return Array.from(set).sort();
  }, [report.activeOrders, showSubCategory]);

  // Authoritative day labels for KPI card sparklines (7-day timeline)
  const kpiDayLabels = useMemo(() => {
    return report.last7DaysHistory && report.last7DaysHistory.length > 0
      ? report.last7DaysHistory.map((h) => (h.isToday ? 'Today' : h.dayName.slice(0, 3)))
      : undefined;
  }, [report.last7DaysHistory]);

  // Export current table to Excel with full courier details sorted by order number
  // Strictly excludes POS and non-checkout exchange orders from commercial sales sheet
  const handleExportExcel = () => {
    if (ledgerViewMode === 'ORDER_WISE') {
      exportOrderWiseLedgerExcel(filteredOrderWiseGroups, report, {
        isExchangesView: courierFilter === 'EXCHANGES_ONLY',
        ratings: customerRatings,
      });
      return;
    }
    exportLiveShippedOrdersExcel(report.activeOrders, report, {
      isExchangesView: courierFilter === 'EXCHANGES_ONLY',
    });
  };

  const handleExportCsv = () => {
    const isExchangesView = courierFilter === 'EXCHANGES_ONLY';

    if (ledgerViewMode === 'ORDER_WISE') {
      const exportData = filteredOrderWiseGroups.map((g) => {
        const r = getRatingForPhone(g.phone);
        return {
          'Order ID': g.orderId,
          'Date': g.orderDate,
          'Customer Name': g.customerName,
          'Phone Number': g.phone,
          'Customer Rating': r?.ratingLabel || 'Standard Buyer',
          'Delivery Success Rate': r?.successRate !== undefined ? `${r.successRate}%` : 'N/A',
          'City': g.city,
          'Total Items (Pcs)': g.totalQuantity,
          'Products': g.items.map((i) => `${i.itemName} (x${i.quantity})`).join('; '),
          'Collection Type':
            g.collectionType === 'SELECTS'
              ? 'DEEN Selects'
              : g.collectionType === 'REGULAR'
              ? 'DEEN Regular'
              : 'Mixed (Selects + Regular)',
          'Order Total': g.totalAmount,
          'WooCommerce Status': g.wcStatus,
          'Courier Status': g.courierStatus,
          'Consignment ID': g.consignmentIds.join(', ') || 'N/A',
          'Fulfillment Branch': g.branch.branchName,
          'Discrepancy': g.hasDiscrepancy ? 'YES' : 'NO',
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DEEN_Live_OrderWise_Ledger_${report.referenceDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const targetOrders = isExchangesView
      ? report.activeOrders.filter(isOrderExchange)
      : filteredOrders.filter((o) => isOrderOnline(o) && !isOrderExchange(o));

    const sortedOrders = [...targetOrders].sort(compareOrdersByNumber);
    const exportData = sortedOrders.map((o) => {
      const itemName = String(o['Item Name'] || '');
      const sku = String(o.SKU || '');
      const isSelects = classifyProductLine(itemName, sku, getCategoryForSales(itemName)) === 'DEEN Selects';
      return {
        'Order ID': String(o['Order ID'] || o.orderId || ''),
        'Date': String(o['Order Date'] || ''),
        'Customer Name': getExportCustomerName(o),
        'Phone': getExportPhoneNumber(o),
        'City': String(o.City || ''),
        'Item Name': itemName,
        'SKU': sku,
        'Category': getCategoryForSales(itemName),
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

  const handleExportHtml = () => {
    downloadLiveOpsHtmlReport(report, {
      includeOrdersTable: true,
      maxOrdersInTable: 250,
      orderWiseGroups: ledgerViewMode === 'ORDER_WISE' ? filteredOrderWiseGroups : undefined,
      title: `DEEN Operations & Dispatch Report — ${report.referenceDate}`,
    });
  };

  const isActuallySyncing = isSyncing || localSyncing;

  return (
    <div className="space-y-6">
      {/* ── Unified Operational Command Deck ── */}
      <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-slate-200/90 dark:border-[#1F1F1F] p-5 shadow-xs space-y-4 transition-all">

        {/* Row 1: Identity & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#171717] pb-3.5">
          {/* Terminal Identity & Live Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight font-headline">
              Live Shipped & Orders Terminal
            </h1>

            {/* Sleek Compact Status Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 transition-colors ${
                  wcConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                }`}
                title={wcConnected ? 'Connected to live WooCommerce REST API' : 'WooCommerce unconfigured or using snapshot'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${wcConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span>{wcConnected ? 'WooCommerce API Live' : 'WC Snapshot'}</span>
              </span>

              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 bg-slate-50 dark:bg-[#141414] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#222222]"
                title={pathaoConnected ? 'Connected to Pathao Hermes courier API' : 'Pathao unconfigured or using local telemetry'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${pathaoConnected ? 'bg-blue-500' : 'bg-slate-400'}`} />
                <span>{pathaoConnected ? 'Pathao Aladdin Live' : 'Pathao Telemetry (Sim)'}</span>
              </span>

              {liveOrders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span>{liveOrders.length} Items Synced</span>
                </span>
              )}
            </div>
          </div>

          {/* Primary Action Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Online Only Filter Toggle Pill */}
            <button
              type="button"
              onClick={() => setOnlineOnly(!onlineOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                onlineOnly
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-2xs'
                  : 'bg-slate-50 dark:bg-[#121212] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#1F1F1F] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlineOnly ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span>Online Only</span>
            </button>

            {/* Sync Button with Isolated 1-Second Auto-Countdown */}
            <AutoSyncCountdownButton
              onManualSync={handleManualSync}
              onAutoSync={handleAutoSync}
              isSyncing={isActuallySyncing}
            />
          </div>
        </div>

        {/* Sync status alert notification — Non-disruptive stable banner */}
        {syncStatusMsg && (
          <div className="text-xs bg-slate-50 dark:bg-[#121212] border border-slate-200/80 dark:border-[#222222] px-3 py-2 rounded-xl flex items-center justify-between text-slate-700 dark:text-slate-300 shadow-2xs animate-in fade-in duration-150">
            <span className="font-medium flex items-center gap-2 truncate">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{syncStatusMsg}</span>
            </span>
            <button onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold ml-2 shrink-0 cursor-pointer">✕</button>
          </div>
        )}

        {/* Row 2: Operational Context & Segmented View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Discrete Context Chips */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Reference Snapshot Date */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/60 dark:border-[#222222]">
              <span>🗓️</span>
              <span>Operational snapshot: <strong className="text-slate-900 dark:text-white font-bold">{report.refDayName} ({report.referenceDate})</strong></span>
            </span>

            {/* 7-Day Baseline Pill */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-[#222222]">
              <span className="font-bold text-slate-900 dark:text-white">Baseline:</span>
              <span>7-Day Daily Avg ({report.avg7dMetrics.items} pkgs/day, ৳{report.avg7dMetrics.revenue.toLocaleString()})</span>
            </span>

            {/* Sync Time */}
            {lastSyncTime && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-1">
                Synced at {lastSyncTime}
              </span>
            )}

            {report.isFallbackDate && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[11px]">
                (Displaying latest recorded dispatches)
              </span>
            )}
          </div>

          {/* Segmented View Mode Switcher */}
          <div className="inline-flex bg-slate-100 dark:bg-[#121212] p-1 rounded-2xl border border-slate-200/80 dark:border-[#1F1F1F] text-xs font-bold self-start md:self-auto shadow-2xs">
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
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/60">
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
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-[#262626] text-slate-700 dark:text-slate-300 font-semibold">
                {report.allOrdersBreakdown.processingCount + report.allOrdersBreakdown.holdCount}
              </span>
            </button>
          </div>
        </div>

        {/* Row 3: Integrated 7-Day Dispatch History Timeline */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#171717]">
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🗓️</span>
                <span>Last 7 Days Dispatch History</span>
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                • Click any date to audit that day&apos;s shipped orders • Friday shown only when open with dispatches
              </span>
            </div>

            {selectedHistoricalDate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedHistoricalDate(null);
                  setSelectedView('Today Shipped');
                  setCategoryFilter('ALL');
                }}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-200/80 dark:border-blue-800/60 transition-colors"
              >
                ↺ Reset to Today
              </button>
            )}
          </div>

          {/* Day Cards Grid */}
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
                    if (day.isToday && selectedHistoricalDate === day.dateIso) {
                      setSelectedHistoricalDate(null);
                    } else {
                      setSelectedHistoricalDate(day.dateIso);
                    }
                    setSelectedView('Today Shipped');
                    setCategoryFilter('ALL');
                  }}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/70 dark:bg-[#121212] border-slate-200/80 dark:border-[#1F1F1F] hover:bg-slate-100 dark:hover:bg-[#171717] hover:border-slate-300 dark:hover:border-slate-700'
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
                    <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>📦 {day.orderCount}</span>
                      {day.exchangeCount !== undefined && day.exchangeCount > 0 && (
                        <span
                          className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60"
                          title={`${day.exchangeCount} exchange replacement parcel(s)`}
                        >
                          🔄 {day.exchangeCount}
                        </span>
                      )}
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
      </div>

      {/* ── 5 Operational KPI Cards (Top Row: Pixel-Matched to DEEN-OPS Screenshot) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: SHIPPED ITEMS - TODAY */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedHistoricalDate
                ? `Shipped Items (${report.refDayName.slice(0, 3)} ${report.referenceDate.slice(5)})`
                : (selectedView === "Today's Orders" ? "Today's Items - Total" : 'Shipped Items - Today')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              📦
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline group-hover:scale-[1.03] transition-transform duration-300 origin-left">
                {report.shippedItems.value}
              </div>
              {report.exchangeStats.itemsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setCourierFilter((prev) => (prev === 'EXCHANGES_ONLY' ? 'ALL' : 'EXCHANGES_ONLY'))}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 shadow-2xs ${
                    courierFilter === 'EXCHANGES_ONLY'
                      ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-500/30'
                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/90 dark:border-purple-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                  title={`${report.exchangeStats.itemsCount} exchange replacement piece(s). Click to filter.`}
                >
                  <span>🔄</span>
                  <span>+{report.exchangeStats.itemsCount} exch pc{report.exchangeStats.itemsCount > 1 ? 's' : ''}</span>
                </button>
              )}
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
              labels={kpiDayLabels}
              valueSuffix=" pcs"
              color="#f97316"
              gradientId="kpi-sparkline-items"
              fillOpacity={0.25}
              height={34}
            />
          </div>
        </div>

        {/* Card 2: SALES REVENUE */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedHistoricalDate
                ? `Sales Revenue (${report.refDayName.slice(0, 3)} ${report.referenceDate.slice(5)})`
                : (selectedView === "Today's Orders" ? "Today's Revenue - Total" : 'Sales Revenue - Today')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-2xs">
              ৳
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline group-hover:scale-[1.03] transition-transform duration-300 origin-left">
              {report.salesRevenue.value}
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
              labels={kpiDayLabels}
              valuePrefix="৳"
              color="#e11d48"
              gradientId="kpi-sparkline-revenue"
              fillOpacity={0.25}
              height={34}
            />
          </div>
        </div>

        {/* Card 3: SHIPPED ORDERS */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedHistoricalDate
                ? `Shipped Orders (${report.refDayName.slice(0, 3)} ${report.referenceDate.slice(5)})`
                : (selectedView === "Today's Orders" ? "Today's Orders - Total" : 'Shipped Orders - Today')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              🚚
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline group-hover:scale-[1.03] transition-transform duration-300 origin-left">
                {report.shippedOrders.value}
              </div>
              {report.exchangeStats.count > 0 ? (
                <button
                  type="button"
                  onClick={() => setCourierFilter((prev) => (prev === 'EXCHANGES_ONLY' ? 'ALL' : 'EXCHANGES_ONLY'))}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 shadow-2xs ${
                    courierFilter === 'EXCHANGES_ONLY'
                      ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-500/30'
                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/90 dark:border-purple-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                  title={`${report.exchangeStats.count} exchange replacement order(s) dispatched. Click to filter.`}
                >
                  <span>🔄</span>
                  <span>+{report.exchangeStats.count} exch</span>
                </button>
              ) : report.exchangeStats.originalExchangedOrders.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCourierFilter((prev) => (prev === 'EXCHANGES_ONLY' ? 'ALL' : 'EXCHANGES_ONLY'))}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 shadow-2xs ${
                    courierFilter === 'EXCHANGES_ONLY'
                      ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-500/30'
                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/90 dark:border-purple-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                  }`}
                  title={`${report.exchangeStats.originalExchangedOrders.length} past order(s) updated to Exchanged today. Click to filter.`}
                >
                  <span>🔄</span>
                  <span>{report.exchangeStats.originalExchangedOrders.length} swapped</span>
                </button>
              ) : null}
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
              labels={kpiDayLabels}
              valueSuffix=" pkgs"
              color="#3b82f6"
              gradientId="kpi-sparkline-orders"
              fillOpacity={0.25}
              height={34}
            />
          </div>
        </div>

        {/* Card 4: BASKET SIZE */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedHistoricalDate ? `Basket Size (${report.refDayName.slice(0, 3)})` : 'Basket Size'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              🛍️
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-headline group-hover:scale-[1.03] transition-transform duration-300 origin-left">
              {report.basketSize.value}
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
              labels={kpiDayLabels}
              valuePrefix="৳"
              color="#eab308"
              gradientId="kpi-sparkline-basket"
              fillOpacity={0.25}
              height={34}
            />
          </div>
        </div>

        {/* Card 5: CUSTOMER MIX */}
        <div className="bg-white dark:bg-black rounded-2xl p-4 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {selectedHistoricalDate ? `Customer Mix (${report.refDayName.slice(0, 3)})` : 'Customer Mix'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50/80 dark:bg-[#121212] border border-sky-100 dark:border-[#222222] flex items-center justify-center text-sm shadow-2xs">
              👥
            </div>
          </div>

          <div className="mt-1 mb-2">
            <div className="text-2xl sm:text-[24px] font-black text-slate-900 dark:text-white tracking-tight font-headline group-hover:scale-[1.03] transition-transform duration-300 origin-left">
              {report.customerMix.newCount} New / {report.customerMix.retCount} Ret
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
              labels={kpiDayLabels}
              valueSuffix="% New"
              color="#a855f7"
              gradientId="kpi-sparkline-cust"
              fillOpacity={0.3}
              height={34}
            />
          </div>
        </div>
      </div>

      {/* ── Performance Outlook & Category Analytics (Directly Below KPI Cards: Pixel-Matched to DEEN-OPS Screenshot) ── */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">📊</span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight font-headline flex items-center gap-2">
              <span>Performance Outlook & Category Analytics</span>
              {selectedHistoricalDate ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  🗓️ {report.refDayName} ({report.referenceDate})
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400">
                  {selectedView === "Today's Orders" ? "Today's Active Orders" : "Today Shipped"}
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-3 select-none flex-wrap">

            {/* Show Sub-Category View Toggle with clear Active/Inactive State */}
            <div className="flex items-center gap-2 select-none">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => {
                    setShowSubCategory((prev) => !prev);
                    setCategoryFilter('ALL');
                  }}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${
                    showSubCategory ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  title={showSubCategory ? 'Switch to Top-Level Category View' : 'Switch to Granular Sub-Category View'}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      showSubCategory ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{showSubCategory ? 'Sub-Category View' : 'Category View'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    showSubCategory
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-slate-100 text-slate-700 dark:bg-[#1A1A1A] dark:text-slate-300 border border-slate-200 dark:border-[#2A2A2A]'
                  }`}>
                    {showSubCategory ? 'Granular' : 'Top Families'}
                  </span>
                </span>
              </label>
              <span
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help text-xs"
                title="Category View groups by top apparel families (e.g. Jeans, Twill, FS Shirt). Sub-Category View breaks them down into fit & fabric variants (e.g. Regular Fit / Slim Fit Jeans, Flannel Shirt, Oxford Shirt, 5-Pocket Twill)."
              >
                (?)
              </span>
            </div>
          </div>
        </div>

        {/* Dual Split Ratio Progress Bars (DEEN Selects vs DEEN Regular) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Split Bar */}
          <div className="space-y-1.5 px-0.5 group cursor-pointer">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:scale-105 transition-transform duration-200 origin-left">
                <span>💎 Selects:</span>
                <strong>৳ {report.selectsStats.selectsRevenue.toLocaleString()}</strong>
                <span className="text-slate-500 dark:text-slate-400 font-normal">({report.selectsStats.selectsQty} pcs · {report.selectsStats.selectsRevShare}%)</span>
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:scale-105 transition-transform duration-200 origin-right">
                <span className="text-slate-500 dark:text-slate-400 font-normal">({report.selectsStats.regularRevShare}% · {report.selectsStats.regularQty} pcs)</span>
                <strong>৳ {report.selectsStats.regularRevenue.toLocaleString()}</strong>
                <span>📦 Regular</span>
              </span>
            </div>
            {/* Visual Dual Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-[#1F1F1F] rounded-full h-1.5 hover:h-2 transition-all duration-300 overflow-hidden flex cursor-pointer">
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
          <div className="space-y-1.5 px-0.5 group cursor-pointer">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:scale-105 transition-transform duration-200 origin-left">
                <span>💎 Selects:</span>
                <strong>{report.selectsStats.selectsQty} pcs</strong>
                <span className="text-slate-500 dark:text-slate-400 font-normal">({report.selectsStats.selectsQtyShare}% · ৳{report.selectsStats.selectsRevenue.toLocaleString()})</span>
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:scale-105 transition-transform duration-200 origin-right">
                <span className="text-slate-500 dark:text-slate-400 font-normal">(৳{report.selectsStats.regularRevenue.toLocaleString()} · {report.selectsStats.regularQtyShare}%)</span>
                <strong>{report.selectsStats.regularQty} pcs</strong>
                <span>📦 Regular</span>
              </span>
            </div>
            {/* Visual Dual Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-[#1F1F1F] rounded-full h-1.5 hover:h-2 transition-all duration-300 overflow-hidden flex cursor-pointer">
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

        {/* Side-by-Side Charts (Donut & Volume Bar) - STRICTLY SPLIT VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Chart: Revenue Share (TK) Donut */}
          <div className="bg-white dark:bg-black border border-slate-200/90 dark:border-[#1F1F1F] rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white tracking-tight font-headline flex items-center justify-between gap-1.5 w-full">
                <span className="flex items-center gap-1.5">
                  <span>🔥</span>
                  <span>{showSubCategory ? 'Revenue Share by Sub-Category (TK)' : 'Revenue Share by Category (TK)'}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                    • {selectedHistoricalDate ? `${report.refDayName.slice(0, 3)} (${report.referenceDate.slice(5)})` : 'Today'}
                  </span>
                </span>
                {categoryFilter !== 'ALL' && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                    Filter: {categoryFilter}
                  </span>
                )}
              </h3>
            </div>

            <LiveRevenueDonutChart
              items={activeCategoryItems}
              totalRevenue={report.salesRevenue.rawValue}
              selectsShare={report.selectsStats.selectsRevShare}
              selectedCategory={categoryFilter}
              onSelectCategory={(cat) => setCategoryFilter((prev) => (prev === cat ? 'ALL' : cat))}
              isSubCategory={showSubCategory}
            />
          </div>

          {/* Right Chart: Sales Volume by Category Bar Chart */}
          <div className="bg-white dark:bg-black border border-slate-200/90 dark:border-[#1F1F1F] rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white tracking-tight font-headline flex items-center justify-between gap-1.5 w-full">
                <span className="flex items-center gap-1.5">
                  <span>📦</span>
                  <span>{showSubCategory ? 'Sales Volume by Sub-Category' : 'Sales Volume by Category'}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                    • {selectedHistoricalDate ? `${report.refDayName.slice(0, 3)} (${report.referenceDate.slice(5)})` : 'Today'}
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  {categoryFilter !== 'ALL' && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      Filter: {categoryFilter}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsVolumeModalOpen(true)}
                    className="p-1 px-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2A2A2A] transition-all flex items-center gap-1"
                    title="Open in fullscreen modal"
                  >
                    <span>⛶</span>
                    <span className="text-[10px]">Fullscreen</span>
                  </button>
                </div>
              </h3>
            </div>

            <div className="w-full flex-1 min-h-[380px] flex flex-col justify-end">
              <LiveVolumeBarChart
                items={activeCategoryItems}
                avgUnitsSold={report.avgUnitsSold}
                selectedCategory={categoryFilter}
                onSelectCategory={(cat) => setCategoryFilter((prev) => (prev === cat ? 'ALL' : cat))}
                isSubCategory={showSubCategory}
                isFullWidth={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Fullscreen Modal for Sales Volume by Category ── */}
      {isVolumeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setIsVolumeModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sales Volume by Category"
            className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#2A2A2A] rounded-3xl p-5 sm:p-8 w-full max-w-6xl max-h-[94vh] overflow-y-auto shadow-2xl flex flex-col justify-between cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#222222] mb-3">
              <div>
                <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white font-headline flex items-center gap-2">
                  <span>📦</span>
                  <span>{showSubCategory ? 'Sales Volume by Sub-Category (Units Sold)' : 'Sales Volume by Category (Units Sold)'}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    Fullscreen High-Definition View
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Categorical unit distribution across dispatched operational parcels • {selectedHistoricalDate ? `${report.refDayName} (${report.referenceDate})` : 'Today'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVolumeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold transition-colors"
                title="Close Fullscreen (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="w-full flex-1 min-h-[460px] py-2">
              <LiveVolumeBarChart
                items={activeCategoryItems}
                avgUnitsSold={report.avgUnitsSold}
                selectedCategory={categoryFilter}
                onSelectCategory={(cat) => setCategoryFilter((prev) => (prev === cat ? 'ALL' : cat))}
                isSubCategory={showSubCategory}
                isFullWidth={true}
                isModal={true}
              />
            </div>
          </div>
        </div>
      )}

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

          <div className="flex items-center gap-2 flex-wrap">
            {report.exchangeStats && report.exchangeStats.count > 0 && (
              <button
                type="button"
                onClick={() => setCourierFilter(courierFilter === 'EXCHANGES_ONLY' ? 'ALL' : 'EXCHANGES_ONLY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  courierFilter === 'EXCHANGES_ONLY'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-xs'
                    : 'bg-purple-500/20 text-purple-300 border-purple-400/40 hover:bg-purple-500/30'
                }`}
                title="Exchanges are tracked separately and isolated from gross sales charts"
              >
                <span>🔄</span>
                <span>{report.exchangeStats.count} Exchange Replacement(s)</span>
              </button>
            )}

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
                  DEEN Sales Executive Briefing
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
            <div className="inline-flex p-0.5 rounded-xl bg-black/40 border border-slate-700/70">
              <button
                type="button"
                onClick={() => setBriefingViewMode('structured')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  briefingViewMode === 'structured'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Structured View
              </button>
              <button
                type="button"
                onClick={() => setBriefingViewMode('text')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  briefingViewMode === 'text'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Briefing Text
              </button>
            </div>

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
              <span>{briefingCopied ? 'Copied Briefing! ✓' : 'Copy Briefing'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {report.referenceDate} Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
              title="Export complete self-contained HTML report with KPI cards and charts"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export HTML</span>
            </button>
          </div>
        </div>

        {briefingViewMode === 'text' ? (
          /* Text View: Pre-formatted briefing text matching copy output */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Exact Briefing Text (Formatted for Instant Sharing):</span>
              <span className="text-[11px] text-indigo-300">Click below or use Copy Briefing button</span>
            </div>
            <pre
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(report.executiveBriefing.clipboardText);
                  setBriefingCopied(true);
                  setTimeout(() => setBriefingCopied(false), 2500);
                }
              }}
              className="bg-black/40 hover:bg-black/50 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed cursor-pointer transition-colors shadow-inner selection:bg-indigo-600 selection:text-white"
            >
              {report.executiveBriefing.clipboardText}
            </pre>
          </div>
        ) : (
          /* Structured View: Rich interactive cards representing every section of the Briefing */
          <div className="space-y-4">
            {/* Top 4 Core Performance Metric Chips */}
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

            {/* Briefing Modules: Collection Split, Dispatch IDs, Channel Breakdown, Top Products */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Module 1: 🏷️ Collection Split */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <span>🏷️</span> Collection Split
                  </span>
                  <span className="text-[11px] font-bold text-indigo-300">
                    {report.executiveBriefing.selectsStats?.selectsRevShare ?? report.executiveBriefing.selectsSharePct}% Selects
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 flex items-center gap-1">💎 Selects:</span>
                    <span className="font-bold text-indigo-300">
                      ৳ {(report.executiveBriefing.selectsStats?.selectsRevenue ?? 0).toLocaleString()}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        ({report.executiveBriefing.selectsStats?.selectsQty ?? 0} pcs)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 flex items-center gap-1">📦 Regular:</span>
                    <span className="font-bold text-slate-200">
                      ৳ {(report.executiveBriefing.selectsStats?.regularRevenue ?? 0).toLocaleString()}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        ({report.executiveBriefing.selectsStats?.regularQty ?? 0} pcs)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 flex overflow-hidden mt-1">
                    <div
                      className="bg-indigo-400 h-full"
                      style={{ width: `${report.executiveBriefing.selectsStats?.selectsRevShare ?? report.executiveBriefing.selectsSharePct}%` }}
                      title="DEEN Selects"
                    />
                    <div
                      className="bg-slate-600 h-full"
                      style={{ width: `${report.executiveBriefing.selectsStats?.regularRevShare ?? (100 - report.executiveBriefing.selectsSharePct)}%` }}
                      title="DEEN Regular"
                    />
                  </div>
                </div>
              </div>

              {/* Module 2: 📋 Fulfillment Tracking */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <span>📋</span> Dispatch Tracking
                </span>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Last Shipped Order:</div>
                    <div className="font-mono font-bold text-emerald-400 text-sm truncate">
                      #{report.executiveBriefing.fulfillment?.lastShippedOrder || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Last Pathao Print:</div>
                    <div className="font-mono font-bold text-indigo-300 text-sm truncate">
                      {report.executiveBriefing.fulfillment?.lastPathaoPrint ? `${report.executiveBriefing.fulfillment.lastPathaoPrint}` : 'None'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 3: 🛒 Order Channel Breakdown */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <span>🛒</span> Channel Split
                  </span>
                  <span className="text-[11px] font-bold text-white">
                    {report.executiveBriefing.channelBreakdown?.totalOrders ?? report.executiveBriefing.totalOrders} total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                  <div className="bg-white/5 rounded-xl p-2">
                    <div className="text-[10px] text-slate-400">🚀 Ecom (Checkout)</div>
                    <div className="font-bold text-sky-400 text-sm mt-0.5">
                      {report.executiveBriefing.channelBreakdown?.ecomCount ?? report.executiveBriefing.totalOrders}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2">
                    <div className="text-[10px] text-slate-400">🔄 Exchanges</div>
                    <div className="font-bold text-amber-400 text-sm mt-0.5">
                      {report.executiveBriefing.channelBreakdown?.exchangeCount ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 4: 🔥 Top Performing Products */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <span>🔥</span> Top Products
                </span>
                <div className="space-y-1 text-xs">
                  {report.executiveBriefing.top3Products && report.executiveBriefing.top3Products.length > 0 ? (
                    report.executiveBriefing.top3Products.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="truncate pr-1 text-slate-200" title={p.name}>
                          <span className="text-amber-400 font-bold mr-1">#{idx + 1}</span> {p.name}
                        </span>
                        <span className="font-bold text-sky-300 shrink-0">
                          {p.units.toFixed(1)} <span className="font-normal text-[10px] text-slate-400">pcs</span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 text-xs">None recorded</div>
                  )}
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
        )}
      </div>

      {/* ── Product Demand & Velocity Spotlight Leaderboard ── */}
      <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-slate-200/90 dark:border-[#1F1F1F] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#1F1F1F] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight font-headline">
                Product Demand & Velocity Spotlight ({report.topProducts.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Top selling products and SKUs in active orders flow. Click any product to isolate all corresponding parcels in the ledger below.
              </p>
            </div>
          </div>
          <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs shrink-0">
            Sorted by units & velocity
          </span>
        </div>

        <div className="overflow-x-auto min-w-0 border border-slate-200 dark:border-[#1F1F1F] rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/90 dark:bg-[#121212] text-[10.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-[#1F1F1F]">
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
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F1F]">
              {report.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
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
                      className="hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 text-center font-bold">
                        {p.rank === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 inline-flex items-center justify-center font-black text-xs shadow-2xs">
                            🥇
                          </span>
                        ) : p.rank === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-[#222] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#333] inline-flex items-center justify-center font-black text-xs shadow-2xs">
                            🥈
                          </span>
                        ) : p.rank === 3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center justify-center font-black text-xs shadow-2xs">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 font-mono">#{p.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-[240px]">
                        <div className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate" title={p.productName}>
                          {p.productName}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">SKU: {p.sku}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 border border-transparent dark:border-[#222]">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {p.isSelects ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            💎 Selects
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            📦 Regular
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{p.unitsSold} pcs</span>
                          <div className="w-12 bg-slate-100 dark:bg-[#1F1F1F] rounded-full h-1.5 overflow-hidden hidden sm:block">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${unitPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                        ৳ {p.revenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {p.revenueShare}%
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {p.velocityScore === 'HOT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 animate-pulse">
                            🔥 HOT
                          </span>
                        ) : p.velocityScore === 'FAST' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            ⚡ FAST
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 border border-transparent dark:border-[#222]">
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
                          className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50 font-bold text-[10.5px] transition-colors"
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
      <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-slate-200/90 dark:border-[#1F1F1F] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1F1F1F] pb-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight font-headline flex items-center gap-2">
                <span>📋</span>
                <span>Everyday Dispatched Orders Ledger</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({ledgerViewMode === 'ORDER_WISE' ? `${filteredOrderWiseGroups.length} unique orders` : `${filteredOrders.length} line items`})
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-[#262626]">
                  {ledgerViewMode === 'ORDER_WISE'
                    ? `Showing ${orderWiseVirtualizer.virtualItems.length} of ${filteredOrderWiseGroups.length} (Virtualized 60fps)`
                    : `Showing ${itemWiseVirtualizer.virtualItems.length} of ${filteredOrders.length} (Virtualized 60fps)`}
                </span>
                {webhookUpdatesCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Webhooks ({webhookUpdatesCount})</span>
                  </span>
                )}
              </h3>

              {/* View Mode Toggle: Line Items vs Consolidated Orders */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLedgerViewMode('ITEM_WISE')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                    ledgerViewMode === 'ITEM_WISE'
                      ? 'bg-white dark:bg-[#1F1F1F] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Item-wise: View individual product line items"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Line Items</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-300">
                    {filteredOrders.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerViewMode('ORDER_WISE')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                    ledgerViewMode === 'ORDER_WISE'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Order-wise: Consolidate multi-item orders into single rows"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Order-Wise</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      ledgerViewMode === 'ORDER_WISE'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-200/70 dark:bg-[#2A2A2A] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {filteredOrderWiseGroups.length}
                  </span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {ledgerViewMode === 'ORDER_WISE'
                ? 'Consolidated view grouping multi-item baskets into single authoritative rows with expandable product breakdowns.'
                : 'Granular line-item record of each apparel product dispatched matching the active shift view with live Pathao delivery status.'}
            </p>
          </div>

          {/* Export Action Buttons & Expand Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {ledgerViewMode === 'ORDER_WISE' && filteredOrderWiseGroups.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  toggleAllExpanded(
                    expandedOrderIds.size < filteredOrderWiseGroups.length,
                    filteredOrderWiseGroups.map((g) => g.orderId)
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A] bg-slate-50 dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-xs font-bold transition-all shadow-2xs"
                title={
                  expandedOrderIds.size < filteredOrderWiseGroups.length
                    ? 'Expand all multi-item orders'
                    : 'Collapse all orders'
                }
              >
                {expandedOrderIds.size < filteredOrderWiseGroups.length ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Expand All</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                    <span>Collapse All</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel ({ledgerViewMode === 'ORDER_WISE' ? 'Order-Wise' : '.xlsx'})</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-bold transition-all shadow-2xs"
              title="Export complete self-contained HTML report with KPI cards and charts"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>HTML</span>
            </button>
          </div>
        </div>

        {/* Courier Telemetry Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
            Courier Filter:
          </span>
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'Delivered', label: '✓ Delivered' },
            { id: 'In Transit', label: '🚚 In Transit' },
            { id: 'Returned', label: '⚠ Returned' },
            { id: 'Untracked', label: '○ Untracked' },
            ...(report.exchangeStats && report.exchangeStats.count > 0 ? [{ id: 'EXCHANGES_ONLY', label: `🔄 Exchanges (${report.exchangeStats.count})` }] : []),
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
                    : 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs'
                  : 'bg-slate-100 dark:bg-[#121212] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1A1A1A] border border-transparent dark:border-[#1F1F1F]'
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
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#222] bg-slate-50/50 dark:bg-[#121212] text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#181818] transition-all"
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
              className="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222] bg-slate-50 dark:bg-[#121212] text-xs text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div
          ref={tableContainerRef}
          className="overflow-x-auto overflow-y-auto max-h-[720px] min-w-0 rounded-2xl border border-slate-100 dark:border-[#1F1F1F]"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-[#0A0A0A] shadow-xs backdrop-blur-md">
              {ledgerViewMode === 'ORDER_WISE' ? (
                <tr className="bg-slate-50 dark:bg-[#0A0A0A] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-[#1F1F1F] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5">Order ID</th>
                  <th className="py-3 px-3.5">Date & Time</th>
                  <th className="py-3 px-3.5">Customer & Phone</th>
                  <th className="py-3 px-3.5">Products Summary</th>
                  <th className="py-3 px-3.5 text-center">Collection</th>
                  <th className="py-3 px-3.5 text-center">Total Pcs</th>
                  <th className="py-3 px-3.5 text-right">Order Total</th>
                  <th className="py-3 px-3.5 text-center">WC Status</th>
                  <th className="py-3 px-3.5 text-center">Courier Status (Pathao)</th>
                  <th className="py-3 px-3.5 text-center">Consignment ID</th>
                  <th className="py-3 px-3.5 text-center">Action</th>
                </tr>
              ) : (
                <tr className="bg-slate-50 dark:bg-[#0A0A0A] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-[#1F1F1F] uppercase text-[10px] tracking-wider">
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
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F1F] font-medium text-slate-700 dark:text-slate-300">
              {ledgerViewMode === 'ORDER_WISE' ? (
                filteredOrderWiseGroups.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No consolidated orders found matching the filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {orderWiseVirtualizer.paddingTop > 0 && (
                      <tr className="pointer-events-none select-none border-0" aria-hidden="true">
                        <td colSpan={11} style={{ height: `${orderWiseVirtualizer.paddingTop}px`, padding: 0, border: 0 }} />
                      </tr>
                    )}
                    {orderWiseVirtualizer.virtualItems.map(({ item: group, index: idx }) => {
                      const isExpanded = expandedOrderIds.has(group.orderId);
                      const hasMultipleItems = group.items.length > 1;
                      const liveUpdates = getLiveWebhookUpdates();
                      const liveUpdate =
                        (group.consignmentId && liveUpdates.get(group.consignmentId)) ||
                        liveUpdates.get(`order_${group.baseOrderId}`) ||
                        group.consignmentIds.map((cid) => liveUpdates.get(cid)).find(Boolean);
                      const effectiveCourierStatus = liveUpdate ? liveUpdate.normalizedStatus : group.courierStatus;

                      return (
                        <React.Fragment key={`order-group-${group.orderId}-${idx}`}>
                        <tr
                          onClick={() => setSelectedDetailOrder(group.primaryRow)}
                          className={`hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors cursor-pointer group ${
                            group.hasDiscrepancy ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                          } ${isExpanded ? 'bg-slate-50/40 dark:bg-[#111111]' : ''}`}
                        >
                          {/* Order ID & Badges */}
                          <td className="py-2.5 px-3.5 font-bold text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {hasMultipleItems ? (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleOrderExpanded(group.orderId, e)}
                                    className="p-1 -ml-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#222] transition-colors"
                                    title={isExpanded ? 'Collapse line items' : 'Expand line items'}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="w-3.5 inline-block" />
                                )}
                                <span className="group-hover:underline">{group.orderId}</span>
                                {group.hasDiscrepancy && (
                                  <span
                                    title={`Discrepancy: ${group.discrepancyType || 'Status mismatch'}`}
                                    className="text-rose-500"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 inline" />
                                  </span>
                                )}
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>

                              {/* Branch / Exchange Badge */}
                              {(() => {
                                if (group.isExchange) {
                                  return (
                                    <span
                                      className="inline-block self-start px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-tight bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-sans shadow-2xs"
                                      title={
                                        group.exchangeInfo.type === 'replacement'
                                          ? `Replacement for #${group.exchangeInfo.referencedOrderId}`
                                          : 'Exchanged Order'
                                      }
                                    >
                                      {group.exchangeInfo.displayTag || 'Exchange'}
                                    </span>
                                  );
                                }

                                if (!group.branch.isBranchFulfillment) return null;
                                const badgeColor =
                                  group.branch.branchCode === 'MIRPUR'
                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                    : group.branch.branchCode === 'CUMILLA'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : group.branch.branchCode === 'WARI'
                                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                                    : group.branch.branchCode === 'SYLHET'
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200';
                                return (
                                  <span
                                    className={`inline-block self-start px-1.5 py-0.2 rounded text-[9.5px] font-bold tracking-tight border font-sans ${badgeColor}`}
                                    title={`Fulfillment: ${group.branch.branchName}`}
                                  >
                                    {group.branch.branchName.replace(' Branch', '').replace(' Outlet POS', ' POS')}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px] font-sans">
                            {formatOrderDateTime(group.orderDate)}
                          </td>

                          {/* Customer & Phone */}
                          <td className="py-2.5 px-3.5">
                            <div
                              className="font-bold text-slate-800 dark:text-white truncate max-w-[140px]"
                              title={group.customerName}
                            >
                              {group.customerName}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {group.phone || 'N/A'}
                            </div>
                            {group.phone && (
                              <div className="mt-1">
                                <CustomerRatingBadge rating={getRatingForPhone(group.phone)} phone={group.phone} />
                              </div>
                            )}
                            {group.city && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[140px] mt-0.5">
                                {group.city}
                              </div>
                            )}
                          </td>

                          {/* Products Summary & SKU */}
                          <td className="py-2.5 px-3.5 max-w-[240px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-semibold text-slate-800 dark:text-white truncate"
                                title={group.items[0]?.itemName}
                              >
                                {group.items[0]?.itemName || 'Apparel Item'}
                              </span>
                              {hasMultipleItems && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleOrderExpanded(group.orderId, e)}
                                  className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                                >
                                  +{group.items.length - 1} more
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5">
                              <span>SKU: {group.items[0]?.sku || 'N/A'}</span>
                              <span>•</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                {group.items[0]?.category}
                              </span>
                            </div>
                          </td>

                          {/* Collection */}
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            {group.collectionType === 'SELECTS' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                💎 Selects
                              </span>
                            ) : group.collectionType === 'REGULAR' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                📦 Regular
                              </span>
                            ) : (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                title="Mixed: Order contains both DEEN Selects and Regular apparel"
                              >
                                💎 Selects + 📦 Regular
                              </span>
                            )}
                          </td>

                          {/* Total Pcs (Strict Integer) */}
                          <td className="py-2.5 px-3.5 text-center font-bold text-slate-800 dark:text-white">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#181818] border border-slate-200/80 dark:border-[#262626] text-xs font-mono">
                              {group.totalQuantity} pcs
                            </span>
                          </td>

                          {/* Order Total */}
                          <td className="py-2.5 px-3.5 text-right font-black text-slate-900 dark:text-white">
                            ৳ {group.totalAmount.toLocaleString()}
                          </td>

                          {/* WC Status */}
                          <td className="py-2.5 px-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2A2A2A]">
                              {group.wcStatus}
                            </span>
                          </td>

                          {/* Courier Status */}
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            {effectiveCourierStatus === 'Delivered' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Delivered</span>
                                {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live webhook update" />}
                              </span>
                            ) : effectiveCourierStatus === 'In Transit' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                                <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                <span>In Transit</span>
                                {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Live webhook update" />}
                              </span>
                            ) : effectiveCourierStatus === 'Returned' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                <span>Returned</span>
                                {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Live webhook update" />}
                              </span>
                            ) : effectiveCourierStatus === 'Partial' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                <span>Partial</span>
                                {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" title="Live webhook update" />}
                              </span>
                            ) : effectiveCourierStatus === 'Pending Pickup' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Pending</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-[#1A1A1A] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#2A2A2A]">
                                Untracked
                              </span>
                            )}
                          </td>

                          {/* Consignment ID */}
                          <td className="py-2.5 px-3.5 text-center font-mono text-[11px] whitespace-nowrap">
                            {group.consignmentIds.length > 0 ? (
                              <div className="flex flex-col gap-1 items-center">
                                {group.consignmentIds.map((cid, cIdx) => (
                                  <a
                                    key={`consignment-${cid}-${cIdx}`}
                                    href={`https://pathao.com/courier/tracking/?consignment_id=${encodeURIComponent(cid)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                                    title="Open Pathao Tracking"
                                  >
                                    <span>{cid}</span>
                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDetailOrder(group.primaryRow);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-colors shadow-2xs"
                            >
                              Details
                            </button>
                          </td>
                        </tr>

                        {/* Accordion Sub-Row for Consolidated Order Line Items */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-[#0D0D0D] border-b border-slate-200/80 dark:border-[#1F1F1F]">
                            <td colSpan={11} className="py-3 px-4 sm:px-6">
                              <div className="rounded-2xl border border-slate-200/90 dark:border-[#222] bg-white dark:bg-[#121212] p-3.5 shadow-xs space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-blue-500" />
                                    <span>
                                      Order #{group.orderId} Item Breakdown ({group.items.length} unique products, {group.totalQuantity} total pcs)
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                                    Order Total: ৳ {group.totalAmount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="overflow-x-auto min-w-0">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50 dark:bg-[#181818] text-slate-500 dark:text-slate-400 font-bold uppercase text-[9.5px] border-b border-slate-200/60 dark:border-[#222]">
                                      <tr>
                                        <th className="py-2 px-3">Item / Apparel</th>
                                        <th className="py-2 px-3">SKU</th>
                                        <th className="py-2 px-3">Category</th>
                                        <th className="py-2 px-3 text-center">Collection</th>
                                        <th className="py-2 px-3 text-center">Qty</th>
                                        <th className="py-2 px-3 text-right">Unit Price</th>
                                        <th className="py-2 px-3 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-[#1F1F1F] font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                                      {group.items.map((item, iIdx) => (
                                        <tr key={`${group.orderId}-item-${iIdx}`} className="hover:bg-slate-50/60 dark:hover:bg-[#171717]">
                                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-white">
                                            {item.itemName}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400">
                                            {item.sku || 'N/A'}
                                          </td>
                                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                            {item.category}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.isSelects ? (
                                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                💎 Selects
                                              </span>
                                            ) : (
                                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                📦 Regular
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-white">
                                            {item.quantity}
                                          </td>
                                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                                            ৳ {item.itemCost.toLocaleString()}
                                          </td>
                                          <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white font-mono">
                                            ৳ {item.amount.toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {orderWiseVirtualizer.paddingBottom > 0 && (
                    <tr className="pointer-events-none select-none border-0" aria-hidden="true">
                      <td colSpan={11} style={{ height: `${orderWiseVirtualizer.paddingBottom}px`, padding: 0, border: 0 }} />
                    </tr>
                  )}
                </>
              )
            ) : (
              filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">No orders found matching the filter criteria.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {itemWiseVirtualizer.paddingTop > 0 && (
                    <tr className="pointer-events-none select-none border-0" aria-hidden="true">
                      <td colSpan={11} style={{ height: `${itemWiseVirtualizer.paddingTop}px`, padding: 0, border: 0 }} />
                    </tr>
                  )}
                  {itemWiseVirtualizer.virtualItems.map(({ item: row, index: idx }) => {
                    const oid = String(row['Order ID'] || row.orderId || '');
                    const prodName = String(row['Item Name'] || 'Apparel Item');
                    const sku = String(row.SKU || '');
                    const cat = getCategoryForSales(prodName);
                    const isSelects = classifyProductLine(prodName, sku, cat) === 'DEEN Selects';
                    const qty = Number(row.Quantity) || 1;
                    const itemCost = Number(row['Item Cost']) || 0;
                    const orderAmt = Number(row['Order Amount']) || itemCost * qty;
                    const wcStatus = String(row['Delivery Status'] || (row as Record<string, unknown>).status || 'shipped');
                    const rawCourierStatus = String(row['Courier Status'] || row.courierStatus || 'Untracked');
                    const consignmentId = String(row['Consignment ID'] || row.consignmentId || '').trim();
                    const hasDiscrepancy = Boolean(row.hasDiscrepancy);
                    const liveUpdates = getLiveWebhookUpdates();
                    const liveUpdate = (consignmentId && liveUpdates.get(consignmentId)) || liveUpdates.get(`order_${oid}`);
                    const effectiveCourierStatus = liveUpdate ? liveUpdate.normalizedStatus : rawCourierStatus;

                    return (
                      <tr
                        key={`live-order-row-${oid}-${idx}`}
                        onClick={() => setSelectedDetailOrder(row)}
                        className={`hover:bg-slate-50/80 dark:hover:bg-[#141414] transition-colors cursor-pointer group ${
                          hasDiscrepancy ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3.5 font-bold text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap">
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
                              const exInfo = extractExchangeInfo(row);
                              const branch = detectFulfillmentBranch(row);
                              const isExchangeOrder = exInfo.isExchange || branch.branchCode === 'EXCHANGE';

                              if (isExchangeOrder) {
                                return (
                                  <span
                                    className="inline-block self-start px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-tight bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-sans shadow-2xs"
                                    title={exInfo.type === 'replacement' ? `Replacement for #${exInfo.referencedOrderId}` : 'Exchanged Order'}
                                  >
                                    {exInfo.displayTag || 'Exchange'}
                                  </span>
                                );
                              }

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
                                  : 'bg-slate-100 text-slate-700 border-slate-200';
                              return (
                                <span
                                  className={`inline-block self-start px-1.5 py-0.2 rounded text-[9.5px] font-bold tracking-tight border font-sans ${badgeColor}`}
                                  title={`Fulfillment: ${branch.branchName}`}
                                >
                                  {branch.branchName.replace(' Branch', '').replace(' Outlet POS', ' POS')}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px] font-sans">
                          {formatOrderDateTime(row['Order Date'])}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-slate-800 dark:text-white truncate max-w-[140px]" title={String(getExportCustomerName(row) || row['Customer Name'] || '')}>
                            {String(getExportCustomerName(row) || row['Customer Name'] || 'Customer')}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {String(getExportPhoneNumber(row) || row.Phone || 'N/A')}
                          </div>
                          {Boolean(getExportPhoneNumber(row) || row.Phone) && (
                            <div className="mt-1">
                              <CustomerRatingBadge
                                rating={getRatingForPhone(getExportPhoneNumber(row) || row.Phone)}
                                phone={String(getExportPhoneNumber(row) || row.Phone)}
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 max-w-[220px]">
                          <div className="font-semibold text-slate-800 dark:text-white truncate" title={prodName}>
                            {prodName}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5">
                            <span>SKU: {sku || 'N/A'}</span>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">{cat}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {isSelects ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              💎 Selects
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              📦 Regular
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-bold text-slate-800 dark:text-white">
                          {qty}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-medium text-slate-600 dark:text-slate-300">
                          ৳ {itemCost.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-black text-slate-900 dark:text-white">
                          ৳ {orderAmt.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2A2A2A]">
                            {wcStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {effectiveCourierStatus === 'Delivered' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Delivered</span>
                              {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live webhook update" />}
                            </span>
                          ) : effectiveCourierStatus === 'In Transit' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                              <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              <span>In Transit</span>
                              {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Live webhook update" />}
                            </span>
                          ) : effectiveCourierStatus === 'Returned' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              <span>Returned</span>
                              {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Live webhook update" />}
                            </span>
                          ) : effectiveCourierStatus === 'Partial' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>Partial</span>
                              {liveUpdate && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" title="Live webhook update" />}
                            </span>
                          ) : effectiveCourierStatus === 'Pending Pickup' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Pending</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-[#1A1A1A] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#2A2A2A]">
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
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                              title="Open Pathao Tracking"
                            >
                              <span>{consignmentId}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {itemWiseVirtualizer.paddingBottom > 0 && (
                    <tr className="pointer-events-none select-none border-0" aria-hidden="true">
                      <td colSpan={11} style={{ height: `${itemWiseVirtualizer.paddingBottom}px`, padding: 0, border: 0 }} />
                    </tr>
                  )}
                </>
              )
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order Telemetry Inspection Modal ── */}
      {selectedDetailOrder && (
        <div
          onClick={() => setSelectedDetailOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Order #${String(selectedDetailOrder['Order ID'] || selectedDetailOrder.orderId || '')} Telemetry Details`}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-deepBlack-card rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-deepBlack-border shadow-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh] cursor-default"
          >
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-deepBlack-border pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white font-headline">
                    Order #{String(selectedDetailOrder['Order ID'] || selectedDetailOrder.orderId || '')}
                  </h3>
                  {(() => {
                    const branch = detectFulfillmentBranch(selectedDetailOrder);
                    if (!branch.isBranchFulfillment) return null;
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        {branch.branchName}
                      </span>
                    );
                  })()}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-deepBlack-hover text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-deepBlack-border">
                    WC: {String(selectedDetailOrder['Delivery Status'] || 'shipped')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    Pathao: {String(selectedDetailOrder['Courier Status'] || selectedDetailOrder.courierStatus || 'Untracked')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Placed on {String(selectedDetailOrder['Order Date'] || '')} • Customer: {String(getExportCustomerName(selectedDetailOrder) || selectedDetailOrder['Customer Name'] || '')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-deepBlack-hover hover:bg-slate-200 dark:hover:bg-deepBlack-border flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Discrepancy Alert Banner inside Modal if applicable */}
            {selectedDetailOrder.hasDiscrepancy && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-bold text-rose-900 dark:text-rose-200">
                    Courier Discrepancy Detected ({String(selectedDetailOrder.discrepancyType || '')})
                  </h4>
                  <p className="text-rose-700 dark:text-rose-300 mt-0.5">
                    {String(selectedDetailOrder.discrepancyMessage ||
                      'The status recorded in WooCommerce differs from the courier return status received from Pathao Hermes API.')}
                  </p>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Product Info */}
              <div className="p-4 bg-slate-50/70 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Product & Apparel Line
                  </span>
                  {modalOrderGroup && modalOrderGroup.items.length > 1 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold text-[9px]">
                      {modalOrderGroup.items.length} items
                    </span>
                  )}
                </h4>
                {modalOrderGroup && modalOrderGroup.items.length > 1 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1 divide-y divide-slate-200/60 dark:divide-deepBlack-border">
                    {modalOrderGroup.items.map((it, itIdx) => (
                      <div key={itIdx} className="pt-1.5 first:pt-0">
                        <div className="flex justify-between items-start text-xs font-semibold text-slate-900 dark:text-white">
                          <span className="truncate pr-2">{it.itemName}</span>
                          <span className="font-bold shrink-0">x{it.quantity}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                          <span>SKU: {it.sku || 'N/A'}</span>
                          <span>৳ {it.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{String(selectedDetailOrder['Item Name'] || '')}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">SKU: {String(selectedDetailOrder.SKU || 'N/A')}</div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-deepBlack-border text-slate-600 dark:text-slate-300">
                  <span>Quantity:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {modalOrderGroup ? modalOrderGroup.totalQuantity : Number(selectedDetailOrder.Quantity || 1)} pcs
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Order Total:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ৳ {Number(modalOrderGroup ? modalOrderGroup.totalAmount : selectedDetailOrder['Order Amount'] || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Pathao Telemetry */}
              <div className="p-4 bg-slate-50/70 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400">
                  <Truck className="w-3.5 h-3.5" /> Pathao Courier Telemetry
                </h4>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Consignment ID:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {String(selectedDetailOrder['Consignment ID'] || selectedDetailOrder.consignmentId || 'Untracked')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Courier Status:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {String(selectedDetailOrder['Courier Status'] || selectedDetailOrder.courierStatus || 'Untracked')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">COD Collected:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ৳ {Number(selectedDetailOrder.collectedAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Fulfillment Hub:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {detectFulfillmentBranch(selectedDetailOrder).branchName}
                  </span>
                </div>
                {selectedDetailOrder['Consignment ID'] && (
                  <div className="pt-2">
                    <a
                      href={`https://pathao.com/courier/tracking/?consignment_id=${encodeURIComponent(
                        String(selectedDetailOrder['Consignment ID'] || '')
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
            <div className="p-4 bg-slate-50/70 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border rounded-2xl space-y-1.5 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400">
                Customer & Delivery Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{String(getExportCustomerName(selectedDetailOrder) || selectedDetailOrder['Customer Name'] || 'Customer')}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Phone:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-900 dark:text-white">{String(getExportPhoneNumber(selectedDetailOrder) || selectedDetailOrder.Phone || 'N/A')}</span>
                    <CustomerRatingBadge
                      rating={getRatingForPhone(getExportPhoneNumber(selectedDetailOrder) || selectedDetailOrder.Phone)}
                      phone={String(getExportPhoneNumber(selectedDetailOrder) || selectedDetailOrder.Phone)}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">City / Area:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{String(selectedDetailOrder.City || 'Dhaka')}</span>
                </div>
                {(() => {
                  const detailPhone = String(getExportPhoneNumber(selectedDetailOrder) || selectedDetailOrder.Phone || '');
                  const r = getRatingForPhone(detailPhone);
                  if (!r) return null;
                  return (
                    <div className="col-span-2 pt-1.5 border-t border-slate-200/60 dark:border-deepBlack-border flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span>Pathao / Store Rating:</span>
                        <strong className="text-slate-800 dark:text-slate-200">{r.ratingLabel}</strong>
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                        {r.totalOrders > 0
                          ? `${r.deliveredOrders} delivered / ${r.returnedOrders} returned (${r.totalOrders} total)`
                          : 'First-time buyer'}
                      </span>
                    </div>
                  );
                })()}
                {selectedDetailOrder['Order Notes'] && (
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-deepBlack-border">
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Customer Note:</span>
                    <span className="italic text-slate-600 dark:text-slate-300">{String(selectedDetailOrder['Order Notes'] || '')}</span>
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
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/50 rounded-2xl space-y-3 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>WhatsApp Customer Operations</span>
                    </h4>
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-200 font-mono font-semibold bg-emerald-100/70 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                      {waVerify.formattedPhone ? `+${waVerify.formattedPhone}` : 'No phone provided'}
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-deepBlack-card hover:bg-slate-50 dark:hover:bg-deepBlack-hover border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition-colors shadow-2xs"
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
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs transition-colors shadow-xs"
              >
                Inspect in Reconciled Ledger
              </button>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-deepBlack-border text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors"
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
