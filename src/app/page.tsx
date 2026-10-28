"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Sidebar,
  Header,
  CloudSyncBar,
  FileDropzone,
  KpiOverview,
  DateRangeSelector,
  ExecutiveOverviewTab,
  CourierMismatchTab,
  TerritoryTab,
  StatusMatrixTab,
  OrdersLedgerTab,
  SkuPerformanceTab,
  ProductAnalysisTab,
  ItemReturnsTab,
  CustomerRiskTab,
  ExchangedOrdersTab,
  OutletDispatchTab,
  OutletSalesTab,
  LiveOpsTab,
  MarketingAnalyticsTab,
  SettingsTab,
  WeekComparisonModal,
  DraggableAssistantButton,
  CommandPaletteModal,
  SyncNotificationCenter,
  dispatchSyncNotification,
  DataProvenanceBanner
} from '@/components';
import { CopilotDrawer } from '@/components/ai/CopilotDrawer';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import {
  runReconciliationEngine,
  ReconciliationResult,
  extractReturnsFromPathaoDelivery,
  extractPartialsFromPathaoDelivery,
  extractExchangesFromPathaoDelivery
} from '@/lib/reconciliationEngine';
import { exportReconciledExcel, exportMonthlyNetSalesExcel } from '@/lib/excelExport';
import { loadSavedThemeSettings, saveThemeSettings, applyThemeToDocument, BackgroundStyleId } from '@/lib/themeManager';
import { loadAppSettings } from '@/lib/settingsStore';
import { DateScope, filterOrdersByDateScope, CustomDateRange, getDynamicDatasetTitle } from '@/lib/dateFilter';
import { RawOrderRow, AgenticActionProposal, DatasetSnapshot } from '@/types';
import { applyAgenticAction, clearAgenticTags } from '@/lib/ai/agenticActions';
import { RefreshCw, CheckCircle2, UploadCloud, Calendar, RotateCcw, Scale } from 'lucide-react';
import {
  getCookie,
  setCookie,
  DEEN_COOKIE_KEYS,
  getOrCreateSessionId
} from '@/lib/cookieManager';
import {
  setCacheItem,
  getCacheItem,
  removeCacheItem,
  DEEN_CACHE_KEYS
} from '@/lib/cacheManager';
import { DataProvenanceInfo } from '@/lib/dataAudit';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';
import { useAuth } from '@/context/AuthContext';
import { sampleDatasetSnapshot } from '@/lib/orderSampling';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { RealtimeSyncToast } from '@/components/RealtimeSyncToast';
import type { SyncEvent } from '@/lib/sync/eventLog';

export type DataSourceMode = 'UPLOAD' | 'API';

export default function DashboardPage() {
  const { user } = useAuth();
  const sampleRatio = user?.sampleRate;

  // Helper that applies executive sampling (15% across all components)
  const applySampling = useCallback(<T extends DatasetSnapshot>(ds: T): T => {
    if (sampleRatio && sampleRatio < 1 && ds && ds.orders) {
      return sampleDatasetSnapshot(ds, sampleRatio) as T;
    }
    return ds;
  }, [sampleRatio]);

  const [activeTab, setActiveTab] = useState('tabExecutive');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('ALL');
  const [ledgerTerritoryFilter, setLedgerTerritoryFilter] = useState('ALL');
  const [orderFiles, setOrderFiles] = useState<File[]>([]);
  const [pathaoDeliveryFile, setPathaoDeliveryFile] = useState<File | null>(null);
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [partialFile, setPartialFile] = useState<File | null>(null);
  const [exchangeFile, setExchangeFile] = useState<File | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleKpiCardClick = (target: string, statusFilter?: string, territoryFilter?: string) => {
    setLedgerStatusFilter(statusFilter || 'ALL');
    setLedgerTerritoryFilter(territoryFilter || 'ALL');
    setActiveTab(target);
    setCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB, target, { days: 30 });
    const tabEl = document.getElementById('mainTabSection');
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectTab = (target: string) => {
    setActiveTab(target);
    setCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB, target, { days: 30 });
  };

  const [dateScope, setDateScope] = useState<DateScope>('30d');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | undefined>(undefined);
  const [isWeekComparisonOpen, setIsWeekComparisonOpen] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'week' | 'month'>('week');
  const [, startScopeTransition] = React.useTransition();

  const handleDateScopeChange = (range: DateScope, customRange?: CustomDateRange) => {
    startScopeTransition(() => {
      setDateScope(range);
      if (customRange) {
        setCustomDateRange(customRange);
      } else if (range !== 'custom') {
        setCustomDateRange(undefined);
      }
      setCookie(DEEN_COOKIE_KEYS.DATE_SCOPE, range, { days: 30 });

      // Automatically re-run reconciliation engine on filtered order set
      const filtered = filterOrdersByDateScope(rawOrders, range, customRange);
      computeReconciliation(
        filtered.filteredOrders,
        rawReturns,
        rawPartials,
        excludeAugust,
        excludePOS,
        rawExchanges,
        rawPathaoDelivery
      );
      setStatusMessage(`Date filter active: ${filtered.label}${filtered.subLabel ? ` (${filtered.subLabel})` : ''} — ${filtered.matchedOrders.toLocaleString()} orders reconciled.`);
    });
  };

  const handleToggleExcludeAugust = (val: boolean) => {
    setExcludeAugust(val);
    setCookie(DEEN_COOKIE_KEYS.EXCLUDE_AUGUST, String(val), { days: 30 });
  };

  const handleToggleExcludePOS = (val: boolean) => {
    setExcludePOS(val);
    setCookie(DEEN_COOKIE_KEYS.EXCLUDE_POS, String(val), { days: 30 });
  };

  const handleResetBaseline = () => {
    removeCacheItem(DEEN_CACHE_KEYS.ACTIVE_DATASET);
    setDateScope('30d');
    setCustomDateRange(undefined);
    setCookie(DEEN_COOKIE_KEYS.DATE_SCOPE, '30d', { days: 30 });
    loadPreloadedBaselineData(true);
  };

  const [rawOrders, setRawOrders] = useState<RawOrderRow[]>([]);
  const [rawPathaoDelivery, setRawPathaoDelivery] = useState<RawOrderRow[]>([]);
  const [rawReturns, setRawReturns] = useState<RawOrderRow[]>([]);
  const [rawPartials, setRawPartials] = useState<RawOrderRow[]>([]);
  const [rawExchanges, setRawExchanges] = useState<RawOrderRow[]>([]);

  const [excludeAugust, setExcludeAugust] = useState(true);
  const [excludePOS, setExcludePOS] = useState(true);

  // Dynamically filter raw orders according to selected date scope
  const dateFilterResult = React.useMemo(() => {
    return filterOrdersByDateScope(rawOrders, dateScope, customDateRange);
  }, [rawOrders, dateScope, customDateRange]);

  // Distinct Data Source Modes: Uploaded Spreadsheets vs Live Cloud API
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('UPLOAD');
  const [uploadedDataset, setUploadedDataset] = useState<DatasetSnapshot | null>(null);
  const [cloudApiDataset, setCloudApiDataset] = useState<DatasetSnapshot | null>(null);

  const [dataSourceName, setDataSourceName] = useState<string>('📁 Verified Master Ledger');
  const [dataProvenance, setDataProvenance] = useState<DataProvenanceInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Auto-dismiss transient top status banner after 6s to remove permanent visual noise
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotInitialQuery, setCopilotInitialQuery] = useState<string>('');

  const handleOpenCopilot = (initialQuery?: string) => {
    if (initialQuery) {
      setCopilotInitialQuery(initialQuery);
    }
    setIsCopilotOpen(true);
  };

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Real-time multi-source SSE sync pipeline
  const handleRealtimeEvent = useCallback((event: SyncEvent) => {
    dispatchSyncNotification({
      type: event.source === 'woocommerce' ? 'orders_synced' : 'courier_updated',
      title: event.summary,
      description: `Live event from ${event.source === 'woocommerce' ? 'WooCommerce' : 'Pathao'}`,
      targetTab: 'tabLiveOps',
      targetOrderId: event.orderId,
    });
  }, []);

  const realtimeSync = useRealtimeSync({
    enabled: true,
    onEvent: handleRealtimeEvent,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    const savedTab = urlTab || getCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB);
        if (savedTab) {
          setActiveTab(savedTab);
        }
      }

      try {
        const savedCollapsed = localStorage.getItem('deen_sidebar_collapsed');
        if (savedCollapsed !== null) {
          setIsSidebarCollapsed(savedCollapsed === 'true');
        }
      } catch {}

      const savedTheme = loadSavedThemeSettings();
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark-canvas') ||
        savedTheme.backgroundId === 'dark-canvas' ||
        Boolean(savedTheme.darkModeCanvas);
      setIsDarkMode(isDark);

      const handler = (e: Event) => {
        const ce = e as CustomEvent<{ isDark?: boolean }>;
        if (ce.detail?.isDark !== undefined) {
          setIsDarkMode(ce.detail.isDark);
        }
      };
      window.addEventListener('deen-theme-changed', handler);
      return () => window.removeEventListener('deen-theme-changed', handler);
    }
  }, []);

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('deen_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (typeof window !== 'undefined') {
      const saved = loadSavedThemeSettings();
      const updated = {
        ...saved,
        backgroundId: (nextMode ? 'dark-canvas' : 'super-white') as BackgroundStyleId,
        darkModeCanvas: nextMode
      };
      saveThemeSettings(updated);
      if (nextMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark-canvas');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark-canvas');
      }
      window.dispatchEvent(new CustomEvent('deen-theme-changed', { detail: { isDark: nextMode } }));
    }
  };

  // Financial & Mathematical Model Parameters (Loaded from AppSettings)
  const [insideDeliveryFee, setInsideDeliveryFee] = useState<number>(50);
  const [outsideDeliveryFee, setOutsideDeliveryFee] = useState<number>(90);
  const [packagingCost, setPackagingCost] = useState<number>(25);
  const [cogsPercent, setCogsPercent] = useState<number>(42);
  const [exactTolerance, setExactTolerance] = useState<number>(2);
  const [metaAdCost, setMetaAdCost] = useState<number>(150000);

  // Helper to re-run reconciliation engine whenever raw data or filter toggles change
  const computeReconciliation = useCallback((
    orders: RawOrderRow[],
    returns: RawOrderRow[],
    partials: RawOrderRow[],
    augustFilter: boolean,
    posFilter: boolean,
    exchanges: RawOrderRow[] = [],
    pathaoDelivery: RawOrderRow[] = [],
    customInsideFee?: number,
    customOutsideFee?: number,
    customPackagingCost?: number,
    customCogsPercent?: number,
    customExactTolerance?: number,
    customMetaAdCost?: number
  ) => {
    if (!orders.length) {
      if (rawOrders.length > 0) {
        try {
          const res = runReconciliationEngine([], returns, partials, {
            excludeAugust: augustFilter,
            excludePOS: posFilter,
            insideDeliveryFee: customInsideFee !== undefined ? customInsideFee : insideDeliveryFee,
            outsideDeliveryFee: customOutsideFee !== undefined ? customOutsideFee : outsideDeliveryFee,
            packagingCost: customPackagingCost !== undefined ? customPackagingCost : packagingCost,
            cogsPercent: customCogsPercent !== undefined ? customCogsPercent : cogsPercent,
            exactTolerance: customExactTolerance !== undefined ? customExactTolerance : exactTolerance,
            metaAdCost: customMetaAdCost !== undefined ? customMetaAdCost : metaAdCost
          }, exchanges, pathaoDelivery);
          setResult(res);
        } catch {}
      }
      return;
    }
    try {
      const res = runReconciliationEngine(orders, returns, partials, {
        excludeAugust: augustFilter,
        excludePOS: posFilter,
        insideDeliveryFee: customInsideFee !== undefined ? customInsideFee : insideDeliveryFee,
        outsideDeliveryFee: customOutsideFee !== undefined ? customOutsideFee : outsideDeliveryFee,
        packagingCost: customPackagingCost !== undefined ? customPackagingCost : packagingCost,
        cogsPercent: customCogsPercent !== undefined ? customCogsPercent : cogsPercent,
        exactTolerance: customExactTolerance !== undefined ? customExactTolerance : exactTolerance,
        metaAdCost: customMetaAdCost !== undefined ? customMetaAdCost : metaAdCost
      }, exchanges, pathaoDelivery);
      setResult(res);
    } catch (err: unknown) {
      console.error('Reconciliation execution error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Engine error: ${errMsg}`);
    }
  }, [rawOrders.length, insideDeliveryFee, outsideDeliveryFee, packagingCost, cogsPercent, exactTolerance, metaAdCost]);

  // Reactive Executive Sampling: Samples dataset to 15% across all components
  useEffect(() => {
    if (sampleRatio && sampleRatio < 1 && rawOrders.length > 0) {
      const snapshot: DatasetSnapshot = {
        orders: rawOrders,
        pathaoDelivery: rawPathaoDelivery,
        returns: rawReturns,
        partials: rawPartials,
        exchanges: rawExchanges,
        sourceName: dataSourceName,
      };
      const sampled = sampleDatasetSnapshot(snapshot, sampleRatio);
      if (sampled.orders.length !== rawOrders.length) {
        setRawOrders(sampled.orders);
        setRawPathaoDelivery(sampled.pathaoDelivery);
        setRawReturns(sampled.returns);
        setRawPartials(sampled.partials);
        setRawExchanges(sampled.exchanges);
        const filtered = filterOrdersByDateScope(sampled.orders, dateScope, customDateRange);
        computeReconciliation(
          filtered.filteredOrders,
          sampled.returns,
          sampled.partials,
          excludeAugust,
          excludePOS,
          sampled.exchanges,
          sampled.pathaoDelivery
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRatio, rawOrders.length, dateScope, customDateRange, excludeAugust, excludePOS, computeReconciliation, dataSourceName, rawPathaoDelivery, rawReturns, rawPartials, rawExchanges]);

  // Fetch pre-loaded workspace dataset from local API or local cache
  const loadPreloadedBaselineData = useCallback(async (forceBypassCache = false) => {
    setIsProcessing(true);
    setStatusMessage('Loading verified workspace ledger datasets...');

    // 1. Instant recovery from local cache unless hard refresh is requested
    if (!forceBypassCache) {
      const rawCached = getCacheItem<DatasetSnapshot>(DEEN_CACHE_KEYS.ACTIVE_DATASET);
      if (rawCached && rawCached.orders && rawCached.orders.length > 0) {
        const cached = applySampling(rawCached);
        setUploadedDataset(cached);
        setDataSourceMode('UPLOAD');
        setRawOrders(cached.orders || []);
        setRawPathaoDelivery(cached.pathaoDelivery || []);
        setRawReturns(cached.returns || []);
        setRawPartials(cached.partials || []);
        setRawExchanges(cached.exchanges || []);
        const dynamicTitle = cached.sourceName || getDynamicDatasetTitle(cached.orders, 'UPLOAD');
        setDataSourceName(dynamicTitle);
        const filtered = filterOrdersByDateScope(cached.orders || [], dateScope, customDateRange);
        computeReconciliation(
          filtered.filteredOrders,
          cached.returns || [],
          cached.partials || [],
          excludeAugust,
          excludePOS,
          cached.exchanges || [],
          cached.pathaoDelivery || []
        );
        const pathaoInfo = (cached.pathaoDelivery || []).length ? `, ${cached.pathaoDelivery.length} Pathao delivery records` : '';
        setStatusMessage(`⚡ Restored from Local Cache: ${filtered.filteredOrders.length.toLocaleString()} orders (${filtered.label})${pathaoInfo}, ${cached.returns.length} returns, ${cached.partials.length} partials.`);
        setIsProcessing(false);
        setInitialLoading(false);
        return;
      }
    }

    // 2. Fetch baseline from local API and cache in browser memory
    try {
      const res = await fetch('/api/sample-data', {
        headers: getClientAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.ordersCount > 0) {
        if (data.provenance) {
          setDataProvenance(data.provenance);
        }
        const dynamicTitle = getDynamicDatasetTitle(data.orders || [], 'UPLOAD', '📁 Verified Master Ledger');
        const rawSnapshot: DatasetSnapshot = {
          orders: data.orders || [],
          pathaoDelivery: data.pathaoDelivery || [],
          returns: data.returns || [],
          partials: data.partials || [],
          exchanges: data.exchanges || [],
          sourceName: dynamicTitle
        };
        const snapshot = applySampling(rawSnapshot);
        setUploadedDataset(snapshot);
        setDataSourceMode('UPLOAD');

        // Persist to local cache with 7-day TTL
        setCacheItem(DEEN_CACHE_KEYS.ACTIVE_DATASET, snapshot, { ttlMs: 7 * 24 * 3600 * 1000, tag: 'dataset' });

        setRawOrders(snapshot.orders || []);
        setRawPathaoDelivery(snapshot.pathaoDelivery || []);
        setRawReturns(snapshot.returns || []);
        setRawPartials(snapshot.partials || []);
        setRawExchanges(snapshot.exchanges || []);
        setDataSourceName(dynamicTitle);
        const filtered = filterOrdersByDateScope(data.orders || [], dateScope, customDateRange);
        computeReconciliation(
          filtered.filteredOrders,
          data.returns || [],
          data.partials || [],
          excludeAugust,
          excludePOS,
          data.exchanges || [],
          data.pathaoDelivery || []
        );
        const pathaoInfo = data.pathaoDeliveryCount ? `, ${data.pathaoDeliveryCount} Pathao delivery records` : '';
        setStatusMessage(`Loaded baseline: ${filtered.filteredOrders.length.toLocaleString()} orders (${filtered.label})${pathaoInfo}, ${data.returnsCount} returns, ${data.partialsCount} partials, ${data.exchangesCount || (data.exchanges || []).length} exchanges.`);
      } else {
        setDataSourceName('Ready for File Upload');
        setStatusMessage('Ready for file upload: drop store orders and Pathao delivery log into the dropzones below.');
      }
    } catch (err: unknown) {
      console.error('Failed to load sample dataset:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Error loading workspace dataset: ${errMsg}`);
    } finally {
      setIsProcessing(false);
      setInitialLoading(false);
    }
  }, [excludeAugust, excludePOS, computeReconciliation, dateScope, customDateRange, applySampling]);

  // Initial mount: load saved theme, settings, session cookies, and workspace data
  const hasInitialMountedRef = useRef(false);

  useEffect(() => {
    if (hasInitialMountedRef.current) return;
    hasInitialMountedRef.current = true;

    // Safety timeout: Guarantee that initialLoading is dismissed even under slow network or hydration
    const safetyTimer = setTimeout(() => {
      setInitialLoading(false);
    }, 2500);

    // 1. Initialize anonymous session ID and record session visit
    getOrCreateSessionId();
    setCookie(DEEN_COOKIE_KEYS.LAST_VISIT, new Date().toISOString(), { days: 90 });

    // 2. Restore active tab, date scope, and toggles from cookies
    const urlTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    const savedTab = urlTab || getCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB);
    if (savedTab) setActiveTab(savedTab);

    const savedScope = getCookie(DEEN_COOKIE_KEYS.DATE_SCOPE) as DateScope | null;
    if (savedScope) {
      setDateScope(savedScope);
    } else {
      setDateScope('30d');
      setCookie(DEEN_COOKIE_KEYS.DATE_SCOPE, '30d', { days: 30 });
    }

    const savedExcludeAug = getCookie(DEEN_COOKIE_KEYS.EXCLUDE_AUGUST);
    if (savedExcludeAug !== null) setExcludeAugust(savedExcludeAug === 'true');

    const savedExcludePos = getCookie(DEEN_COOKIE_KEYS.EXCLUDE_POS);
    if (savedExcludePos !== null) setExcludePOS(savedExcludePos === 'true');

    const savedSourceMode = getCookie(DEEN_COOKIE_KEYS.SOURCE_MODE) as DataSourceMode | null;
    if (savedSourceMode) setDataSourceMode(savedSourceMode);

    // 3. Load theme & settings
    const savedTheme = loadSavedThemeSettings();
    applyThemeToDocument(savedTheme);

    const savedSettings = loadAppSettings();
    if (savedSettings) {
      if (savedSettings.insideDeliveryFee !== undefined) setInsideDeliveryFee(savedSettings.insideDeliveryFee);
      if (savedSettings.outsideDeliveryFee !== undefined) setOutsideDeliveryFee(savedSettings.outsideDeliveryFee);
      if (savedSettings.packagingCost !== undefined) setPackagingCost(savedSettings.packagingCost);
      if (savedSettings.cogsPercent !== undefined) setCogsPercent(savedSettings.cogsPercent);
      if (savedSettings.exactTolerance !== undefined) setExactTolerance(savedSettings.exactTolerance);
      if (savedSettings.metaAdCost !== undefined) setMetaAdCost(savedSettings.metaAdCost);
    }

    loadPreloadedBaselineData();

    return () => clearTimeout(safetyTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run computation when raw data, date filter scope, or business rule toggles change
  useEffect(() => {
    if (rawOrders.length > 0) {
      computeReconciliation(
        dateFilterResult.filteredOrders,
        rawReturns,
        rawPartials,
        excludeAugust,
        excludePOS,
        rawExchanges,
        rawPathaoDelivery
      );
    }
  }, [
    dateFilterResult.filteredOrders,
    excludeAugust,
    excludePOS,
    rawReturns,
    rawPartials,
    rawExchanges,
    rawPathaoDelivery,
    computeReconciliation,
    rawOrders.length
  ]);

  // Read a File object to XLSX Workbook (works seamlessly for .xlsx, .xls, .csv)
  const readFileWorkbook = (file: File): Promise<XLSX.WorkBook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const data = new Uint8Array(buffer);
          let workbook: XLSX.WorkBook;
          try {
            workbook = XLSX.read(data, { type: 'array', cellDates: true });
          } catch {
            // Fallback for CSV / plain text
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(data);
            workbook = XLSX.read(text, { type: 'string', raw: true });
          }
          resolve(workbook);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper: Computes earliest and latest timestamps to provide 100% transparent temporal provenance
  const extractFileDateBoundaries = (orders: RawOrderRow[]) => {
    let minMs = Infinity;
    let maxMs = -Infinity;
    let minIso = '';
    let maxIso = '';

    for (const r of orders) {
      const rawDate = r['Order Date'] || r.Date || r.date || r.date_created || r['Created at'] || r.dateModified;
      if (!rawDate) continue;
      const ms = new Date(String(rawDate)).getTime();
      if (!isNaN(ms) && ms > 0) {
        if (ms < minMs) {
          minMs = ms;
          minIso = new Date(ms).toISOString();
        }
        if (ms > maxMs) {
          maxMs = ms;
          maxIso = new Date(ms).toISOString();
        }
      }
    }

    const hasDates = minMs !== Infinity && maxMs !== -Infinity;
    const durationDays = hasDates ? Math.max(1, Math.round((maxMs - minMs) / 86400000)) : 0;

    const formatDate = (iso: string) => {
      try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
          ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      } catch {
        return iso;
      }
    };

    const formattedRange = hasDates
      ? `${formatDate(minIso)} → ${formatDate(maxIso)} (${durationDays} Day${durationDays === 1 ? '' : 's'})`
      : 'No timestamps detected';

    return {
      hasDates,
      minMs,
      maxMs,
      dateFrom: minIso,
      dateTo: maxIso,
      durationDays,
      formattedRange,
    };
  };

  // Process user uploaded files (Single file, Multi-file, or Multi-sheet CSV/XLSX)
  const handleProcessUploadedFiles = async (customFiles?: {
    orders?: File[];
    returns?: File | null;
    partials?: File | null;
    exchanges?: File | null;
    pathaoDelivery?: File | null;
  }) => {
    const targetOrderFiles = customFiles?.orders ?? orderFiles;
    const targetPathaoDeliveryFile = customFiles?.pathaoDelivery !== undefined ? customFiles.pathaoDelivery : pathaoDeliveryFile;
    const targetReturnFile = customFiles?.returns !== undefined ? customFiles.returns : returnFile;
    const targetPartialFile = customFiles?.partials !== undefined ? customFiles.partials : partialFile;
    const targetExchangeFile = customFiles?.exchanges !== undefined ? customFiles.exchanges : exchangeFile;

    if (targetOrderFiles.length === 0 && !targetPathaoDeliveryFile && !targetReturnFile && !targetPartialFile && !targetExchangeFile && rawOrders.length === 0) {
      setStatusMessage('Please select or drop files to process.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Parsing uploaded Excel / CSV files...');
    try {
      // Helper: Smartly extract real order rows from any Excel workbook, skipping executive summary sheets
      const extractOrdersFromWorkbook = (wb: XLSX.WorkBook): RawOrderRow[] => {
        let matchedRows: RawOrderRow[] = [];

        const isOrderKey = (k: string) => {
          const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return clean === 'orderid' || clean === 'order' || clean === 'id' || clean === 'orderno' || clean === 'ordernumber' || clean === 'consignmentid' || clean === 'invoice' || clean === 'trackingcode' || clean === 'trackingid' || clean === 'oid' || clean === 'number' || clean === 'uniqueorder' || clean === 'merchantorderid';
        };

        // 1. Check non-summary sheets
        for (const sheetName of wb.SheetNames) {
          const sLower = sheetName.toLowerCase();
          if (sLower.includes('executive') || sLower.includes('summary') || sLower.includes('dashboard') || sLower.includes('cover')) {
            continue;
          }
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const rows = XLSX.utils.sheet_to_json<RawOrderRow>(sheet, { defval: '' });
          if (rows.length === 0) continue;

          // Check if sheet contains order IDs
          const validOrderRows = rows.filter(r => {
            const keys = Object.keys(r);
            return keys.some(k => isOrderKey(k) && String(r[k]).trim() !== '');
          });

          if (validOrderRows.length > 0) {
            matchedRows = [...matchedRows, ...validOrderRows];
          }
        }

        // 2. If non-summary sheets had nothing, check all sheets
        if (matchedRows.length === 0) {
          for (const sheetName of wb.SheetNames) {
            const sheet = wb.Sheets[sheetName];
            if (!sheet) continue;
            const rows = XLSX.utils.sheet_to_json<RawOrderRow>(sheet, { defval: '' });
            const validOrderRows = rows.filter(r => {
              const keys = Object.keys(r);
              return keys.some(k => isOrderKey(k) && String(r[k]).trim() !== '');
            });
            if (validOrderRows.length > 0) {
              matchedRows = [...matchedRows, ...validOrderRows];
              break;
            }
          }
        }

        // 3. Fallback to first sheet
        if (matchedRows.length === 0 && wb.SheetNames.length > 0) {
          const defaultSheet = wb.Sheets[wb.SheetNames[0]];
          matchedRows = defaultSheet ? XLSX.utils.sheet_to_json<RawOrderRow>(defaultSheet, { defval: '' }) : [];
        }

        return matchedRows;
      };

      // Helper: Extract courier manifest rows from return/partial/exchange/pathao sheets
      const extractManifestRows = (wb: XLSX.WorkBook): RawOrderRow[] => {
        for (const sheetName of wb.SheetNames) {
          const sLower = sheetName.toLowerCase();
          if (sLower.includes('summary') || sLower.includes('executive') || sLower.includes('dashboard')) {
            continue;
          }
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const rows = XLSX.utils.sheet_to_json<RawOrderRow>(sheet, { defval: '' });
          if (rows.length > 0) return rows;
        }
        return wb.SheetNames.length > 0 ? XLSX.utils.sheet_to_json<RawOrderRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' }) : [];
      };

      let combinedOrders: RawOrderRow[] = [];
      for (const file of targetOrderFiles) {
        const wb = await readFileWorkbook(file);
        const extracted = extractOrdersFromWorkbook(wb);
        combinedOrders = [...combinedOrders, ...extracted];
      }

      const isFreshOrderUpload = combinedOrders.length > 0;

      // Strict Data Isolation: If new order files are uploaded, DO NOT blend with old baseline returns/manifests
      let parsedPathaoDelivery: RawOrderRow[] = [];
      if (targetPathaoDeliveryFile) {
        const wb = await readFileWorkbook(targetPathaoDeliveryFile);
        parsedPathaoDelivery = extractManifestRows(wb);
      } else if (!isFreshOrderUpload) {
        parsedPathaoDelivery = rawPathaoDelivery;
      }

      let parsedReturns: RawOrderRow[] = [];
      if (targetReturnFile) {
        const wb = await readFileWorkbook(targetReturnFile);
        parsedReturns = extractManifestRows(wb);
      } else if (parsedPathaoDelivery.length > 0) {
        // Primary Courier Truth: Automatically extract returns directly from Pathao Delivery Data CSV/Excel!
        parsedReturns = extractReturnsFromPathaoDelivery(parsedPathaoDelivery);
      } else if (!isFreshOrderUpload) {
        parsedReturns = rawReturns;
      }

      let parsedPartials: RawOrderRow[] = [];
      if (targetPartialFile) {
        const wb = await readFileWorkbook(targetPartialFile);
        parsedPartials = extractManifestRows(wb);
      } else if (parsedPathaoDelivery.length > 0) {
        // Automatically extract partial deliveries from Pathao Delivery Data CSV/Excel!
        parsedPartials = extractPartialsFromPathaoDelivery(parsedPathaoDelivery);
      } else if (!isFreshOrderUpload) {
        parsedPartials = rawPartials;
      }

      let parsedExchanges: RawOrderRow[] = [];
      if (targetExchangeFile) {
        const wb = await readFileWorkbook(targetExchangeFile);
        parsedExchanges = extractManifestRows(wb);
      } else if (parsedPathaoDelivery.length > 0) {
        // Automatically extract size exchanges from Pathao Delivery Data CSV/Excel!
        parsedExchanges = extractExchangesFromPathaoDelivery(parsedPathaoDelivery);
      } else if (!isFreshOrderUpload) {
        parsedExchanges = rawExchanges;
      }

      const ordersToUse = combinedOrders.length > 0 ? combinedOrders : rawOrders;
      const uploadedFileNames = [
        ...targetOrderFiles.map(f => f.name),
        targetPathaoDeliveryFile?.name,
        targetReturnFile?.name,
        targetPartialFile?.name,
        targetExchangeFile?.name
      ].filter(Boolean) as string[];

      const fileBoundaries = extractFileDateBoundaries(ordersToUse);
      const sourceLabel = uploadedFileNames.length > 0
        ? `📂 ${uploadedFileNames[0]} (${ordersToUse.length.toLocaleString()} rows)`
        : dataSourceName;

      // Smart Scope Detection: If the latest date in the uploaded file is older than 30 days from today,
      // default to 'all' so the user sees 100% of their records instead of an empty screen!
      const daysSinceLatest = fileBoundaries.hasDates
        ? (Date.now() - fileBoundaries.maxMs) / 86400000
        : 0;

      const chosenScope: DateScope = (!fileBoundaries.hasDates || daysSinceLatest > 30) ? 'all' : '30d';

      const provenanceInfo: DataProvenanceInfo = {
        source: 'disk_spreadsheet',
        environment: 'client_upload',
        isDemoMode: false,
        isPIISanitized: true,
        timestamp: new Date().toISOString(),
        recordCount: ordersToUse.length,
        fileNames: uploadedFileNames,
        dateFrom: fileBoundaries.dateFrom,
        dateTo: fileBoundaries.dateTo,
        dateRangeFormatted: fileBoundaries.formattedRange,
        activeDatasetLabel: uploadedFileNames.length > 0 ? `📂 ${uploadedFileNames[0]}` : 'Offline Spreadsheet',
        durationDays: fileBoundaries.durationDays,
      };

      const uploadedSnapshot: DatasetSnapshot = {
        orders: ordersToUse,
        pathaoDelivery: parsedPathaoDelivery,
        returns: parsedReturns,
        partials: parsedPartials,
        exchanges: parsedExchanges,
        sourceName: sourceLabel,
        fileNames: uploadedFileNames,
        dateFrom: fileBoundaries.dateFrom,
        dateTo: fileBoundaries.dateTo,
        dateRangeFormatted: fileBoundaries.formattedRange,
      };
      setUploadedDataset(uploadedSnapshot);
      setDataSourceMode('UPLOAD');
      setCookie(DEEN_COOKIE_KEYS.SOURCE_MODE, 'UPLOAD', { days: 30 });

      // Cache uploaded dataset in browser memory for instant recovery
      setCacheItem(DEEN_CACHE_KEYS.ACTIVE_DATASET, uploadedSnapshot, { ttlMs: 7 * 24 * 3600 * 1000, tag: 'dataset' });

      setRawOrders(ordersToUse);
      setRawPathaoDelivery(parsedPathaoDelivery);
      setRawReturns(parsedReturns);
      setRawPartials(parsedPartials);
      setRawExchanges(parsedExchanges);
      setDataSourceName(sourceLabel);
      setDataProvenance(provenanceInfo);

      setDateScope(chosenScope);
      setCustomDateRange(undefined);
      setCookie(DEEN_COOKIE_KEYS.DATE_SCOPE, chosenScope, { days: 30 });

      const filtered = filterOrdersByDateScope(ordersToUse, chosenScope, undefined);
      computeReconciliation(filtered.filteredOrders, parsedReturns, parsedPartials, excludeAugust, excludePOS, parsedExchanges, parsedPathaoDelivery);
      const pathaoInfo = parsedPathaoDelivery.length > 0 ? `, ${parsedPathaoDelivery.length.toLocaleString()} Pathao records` : '';
      setStatusMessage(`📂 Offline Dataset Active: Rendering ${filtered.matchedOrders.toLocaleString()} / ${ordersToUse.length.toLocaleString()} orders [${fileBoundaries.formattedRange}]${pathaoInfo}.`);

      // Automated Cloud Sync: Non-blocking background persistence to Vercel Blob
      fetch('/api/blob/dataset', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(uploadedSnapshot),
      })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setStatusMessage(prev => `${prev} ☁️ Auto-synced to Cloud Blob.`);
        }
      })
      .catch(() => {});
    } catch (err: unknown) {
      console.error('File reading failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Upload parsing error: ${errMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLiveSyncData = (type: 'orders' | 'returns', rows: RawOrderRow[], provenance?: DataProvenanceInfo) => {
    setDataSourceMode('API');
    setCookie(DEEN_COOKIE_KEYS.SOURCE_MODE, 'API', { days: 30 });
    if (provenance) {
      setDataProvenance(provenance);
    }
    const updatedOrders = type === 'orders' ? rows : (cloudApiDataset?.orders || rawOrders);
    const updatedReturns = type === 'returns' ? rows : (cloudApiDataset?.returns || rawReturns);
    const updatedDelivery = cloudApiDataset?.pathaoDelivery || rawPathaoDelivery;
    const updatedPartials = cloudApiDataset?.partials || rawPartials;
    const updatedExchanges = cloudApiDataset?.exchanges || rawExchanges;
    const sourceLabel = `☁️ Live Cloud (${type === 'orders' ? `${rows.length} WooCommerce orders` : `${rows.length} Pathao returns`})`;

    const snapshot: DatasetSnapshot = {
      orders: updatedOrders,
      pathaoDelivery: updatedDelivery,
      returns: updatedReturns,
      partials: updatedPartials,
      exchanges: updatedExchanges,
      sourceName: sourceLabel
    };

    setCloudApiDataset(snapshot);
    // Cache live cloud dataset and individual API responses
    setCacheItem(DEEN_CACHE_KEYS.ACTIVE_DATASET, snapshot, { ttlMs: 24 * 3600 * 1000, tag: 'dataset' });
    if (type === 'orders') {
      setCacheItem(DEEN_CACHE_KEYS.WC_SYNC, rows, { ttlMs: 3600 * 1000, tag: 'api' });
    } else {
      setCacheItem(DEEN_CACHE_KEYS.PATHAO_SYNC, rows, { ttlMs: 3600 * 1000, tag: 'api' });
    }

    setRawOrders(updatedOrders);
    setRawReturns(updatedReturns);
    setDataSourceName(sourceLabel);
    const filtered = filterOrdersByDateScope(updatedOrders, dateScope, customDateRange);
    computeReconciliation(filtered.filteredOrders, updatedReturns, updatedPartials, excludeAugust, excludePOS, updatedExchanges, updatedDelivery);
    setStatusMessage(`Live Cloud API Active: reconciled ${filtered.matchedOrders.toLocaleString()} orders (${filtered.label}) with ${rows.length} ${type === 'orders' ? 'WooCommerce items' : 'Pathao records'}.`);

    dispatchSyncNotification({
      type: type === 'orders' ? 'orders_synced' : 'courier_updated',
      title: type === 'orders' ? 'WooCommerce Orders Synced' : 'Pathao Courier Synced',
      description: `Reconciled ${filtered.matchedOrders.toLocaleString()} orders with ${rows.length} ${type === 'orders' ? 'WooCommerce items' : 'Pathao records'} (${filtered.label}).`,
      targetTab: type === 'orders' ? 'tabOrders' : 'tabCourierMismatch'
    });

    // Automated Cloud Sync: Non-blocking background persistence to Vercel Blob
    fetch('/api/blob/dataset', {
      method: 'POST',
      headers: getClientAuthHeaders(),
      body: JSON.stringify(snapshot),
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        setStatusMessage(prev => `${prev} ☁️ Auto-synced to Cloud Blob.`);
      }
    })
    .catch(() => {});
  };

  const handleRefreshLiveData = useCallback(async () => {
    setIsProcessing(true);
    setStatusMessage('Syncing live data from WooCommerce & courier pipeline...');
    try {
      const res = await fetch('/api/sync/live-terminal', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ limitConsignments: 35, fetchLiveWc: true }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data && data.success && data.orders && data.orders.length > 0) {
          setRawOrders(data.orders);
          handleLiveSyncData('orders', data.orders, data.provenance);
          setStatusMessage(`Live sync updated: ${data.orders.length.toLocaleString()} active orders.`);
        }
      }
    } catch {
      setStatusMessage('Live sync connection error. Please retry.');
    } finally {
      setIsProcessing(false);
    }
  }, [cloudApiDataset, rawOrders, rawReturns, rawPathaoDelivery, rawPartials, rawExchanges, dateScope, customDateRange, excludeAugust, excludePOS, computeReconciliation]);

  const handleLoadFullDataset = (dataset: DatasetSnapshot, provenance?: DataProvenanceInfo) => {
    setDataSourceMode('API');
    setCookie(DEEN_COOKIE_KEYS.SOURCE_MODE, 'API', { days: 30 });
    if (provenance) {
      setDataProvenance(provenance);
    }
    setCloudApiDataset(dataset);
    setCacheItem(DEEN_CACHE_KEYS.ACTIVE_DATASET, dataset, { ttlMs: 24 * 3600 * 1000, tag: 'dataset' });
    setRawOrders(dataset.orders || []);
    setRawReturns(dataset.returns || []);
    setRawPartials(dataset.partials || []);
    setRawExchanges(dataset.exchanges || []);
    setRawPathaoDelivery(dataset.pathaoDelivery || []);
    const sourceLabel = dataset.sourceName || '☁️ Vercel Blob Dataset';
    setDataSourceName(sourceLabel);
    const filtered = filterOrdersByDateScope(dataset.orders || [], dateScope, customDateRange);
    computeReconciliation(
      filtered.filteredOrders,
      dataset.returns || [],
      dataset.partials || [],
      excludeAugust,
      excludePOS,
      dataset.exchanges || [],
      dataset.pathaoDelivery || []
    );
    setStatusMessage(`Loaded from ${sourceLabel}: ${filtered.matchedOrders.toLocaleString()} orders (${filtered.label}), ${(dataset.returns || []).length.toLocaleString()} returns.`);
  };

  // Distinct Switcher between Uploaded Spreadsheets and Live WooCommerce & Pathao API
  const handleSwitchDataSource = (mode: DataSourceMode) => {
    setDataSourceMode(mode);
    setCookie(DEEN_COOKIE_KEYS.SOURCE_MODE, mode, { days: 30 });
    if (mode === 'UPLOAD') {
      if (uploadedDataset && uploadedDataset.orders.length > 0) {
        setRawOrders(uploadedDataset.orders);
        setRawPathaoDelivery(uploadedDataset.pathaoDelivery);
        setRawReturns(uploadedDataset.returns);
        setRawPartials(uploadedDataset.partials);
        setRawExchanges(uploadedDataset.exchanges);
        setDataSourceName(uploadedDataset.sourceName);
        computeReconciliation(
          uploadedDataset.orders,
          uploadedDataset.returns,
          uploadedDataset.partials,
          excludeAugust,
          excludePOS,
          uploadedDataset.exchanges,
          uploadedDataset.pathaoDelivery
        );
        setStatusMessage(`Switched active view to Uploaded Spreadsheets (${uploadedDataset.orders.length.toLocaleString()} orders).`);
      } else {
        loadPreloadedBaselineData();
      }
    } else {
      // mode === 'API'
      if (cloudApiDataset && cloudApiDataset.orders.length > 0) {
        setRawOrders(cloudApiDataset.orders);
        setRawPathaoDelivery(cloudApiDataset.pathaoDelivery);
        setRawReturns(cloudApiDataset.returns);
        setRawPartials(cloudApiDataset.partials);
        setRawExchanges(cloudApiDataset.exchanges);
        setDataSourceName(cloudApiDataset.sourceName);
        computeReconciliation(
          cloudApiDataset.orders,
          cloudApiDataset.returns,
          cloudApiDataset.partials,
          excludeAugust,
          excludePOS,
          cloudApiDataset.exchanges,
          cloudApiDataset.pathaoDelivery
        );
        setStatusMessage(`Switched active view to Live Cloud API (${cloudApiDataset.orders.length.toLocaleString()} orders).`);
      } else {
        setStatusMessage('Live Cloud API data has not been synced yet. Initiating cloud sync...');
        const el = document.getElementById('cloudSyncSection');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleApplyAgenticAction = useCallback((proposal: AgenticActionProposal) => {
    if (!result || !result.reconciledOrders) return;
    const updatedOrders = applyAgenticAction(result.reconciledOrders, proposal);
    setResult({
      ...result,
      reconciledOrders: updatedOrders,
    });
    if (proposal.type === 'CLEAR_TAGS') {
      setStatusMessage('AI audit tags cleared from all orders in active dataset.');
    } else {
      setStatusMessage(`✅ ${proposal.affectedCount} orders tagged as "${proposal.tag}". Updated in Orders Ledger and Excel export.`);
    }
  }, [result]);

  const handleClearAiTags = useCallback(() => {
    if (!result || !result.reconciledOrders) return;
    const updatedOrders = clearAgenticTags(result.reconciledOrders);
    setResult({
      ...result,
      reconciledOrders: updatedOrders,
    });
    setStatusMessage('AI audit tags cleared from all orders in active dataset.');
  }, [result]);

  const handleExport = () => {
    if (!result) {
      setStatusMessage('No reconciled data available to export.');
      return;
    }
    try {
      setStatusMessage('Preparing and downloading DEEN Reconciliation Excel audit workbook (.xlsx)...');
      exportReconciledExcel(result);
      setTimeout(() => {
        setStatusMessage('Excel reconciliation audit workbook (.xlsx) downloaded successfully.');
      }, 1200);
    } catch (err: unknown) {
      console.error('Reconciliation export error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Excel export failed: ${errMsg || 'Please check console'}`);
    }
  };

  const handleExportMonthlyNetSales = useCallback(() => {
    if (!result) {
      setStatusMessage('No reconciled data available to export.');
      return;
    }
    try {
      setStatusMessage('Generating 7-Sheet Month-End Net Sales Report (.xlsx)...');
      exportMonthlyNetSalesExcel(result, {
        provenance: dataProvenance || undefined,
      });
      setTimeout(() => {
        setStatusMessage('✅ Month-End Net Sales Report (.xlsx) downloaded successfully.');
      }, 1200);
    } catch (err: unknown) {
      console.error('Monthly Net Sales export error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Monthly export failed: ${errMsg || 'Please check console'}`);
    }
  }, [result, dataProvenance]);

  return (
    <div
      className="flex min-h-screen font-sans text-slate-900 transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)' }}
    >
      {/* Branded Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        returnCount={result ? result.returnedItems.length : 0}
        mismatchCount={result ? result.courierMismatches.filter(m => m.severity === 'CRITICAL' || m.severity === 'WARNING').length : 0}
        exchangeCount={result ? result.exchangedOrders.length : rawExchanges.length}
        pendingEventsCount={realtimeSync.pendingCount}
        activeSourceMode={dataSourceMode}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-colors duration-200"
        style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)' }}
      >
        <Header
          onExport={handleExport}
          onExportMonthlyNetSales={handleExportMonthlyNetSales}
          hasData={result !== null}
          onResetBaseline={handleResetBaseline}
          dataSourceName={dataSourceName}
          activeSourceMode={dataSourceMode}
          onSwitchSourceMode={handleSwitchDataSource}
          hasCloudData={cloudApiDataset !== null && cloudApiDataset.orders.length > 0}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          mobileOpen={mobileMenuOpen}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
          onToggleCopilot={handleOpenCopilot}
          notificationCount={notificationCount}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapseSidebar={handleToggleSidebarCollapse}
        />

        <main
          className="px-2 py-3.5 sm:px-6 sm:py-6 pb-20 md:pb-6 space-y-5 max-w-[1920px] mx-auto w-full transition-colors duration-200"
          style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)' }}
        >
          {/* Status Alert Toast — Floating non-layout-shifting overlay */}
          {statusMessage && (
            <div className="fixed bottom-6 right-6 z-50 max-w-md bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border border-slate-200 dark:border-[#222] shadow-2xl px-4 py-3 rounded-2xl text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold truncate">{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs font-bold ml-2 shrink-0 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          {/* Data Provenance & Temporal Scope Transparency Banner */}
          {result && !initialLoading && (
            <DataProvenanceBanner
              provenance={dataProvenance}
              dataSourceMode={dataSourceMode}
              totalOrders={rawOrders.length}
              matchedOrders={dateFilterResult.matchedOrders}
              activeScope={dateScope}
              dateScopeLabel={dateFilterResult.label}
              onSetScopeAll={() => handleDateScopeChange('all')}
              onResetBaseline={handleResetBaseline}
              onSwitchToApi={() => handleSwitchDataSource('API')}
            />
          )}

          {/* Cloud API Integration (WooCommerce + Pathao) - SHOWN ONLY ON INITIAL EMPTY STATE (WHEN NO DATA LOADED YET) */}
          {dataSourceMode === 'API' && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && activeTab !== 'tabLiveOps' && activeTab !== 'tabExecutive' && !result && (
            <CloudSyncBar
              onDataSynced={handleLiveSyncData}
              activeOrders={rawOrders}
              provenance={dataProvenance}
              activeDataset={{
                orders: rawOrders,
                returns: rawReturns,
                partials: rawPartials,
                exchanges: rawExchanges,
                pathaoDelivery: rawPathaoDelivery,
                sourceName: dataSourceName,
              }}
              onLoadFullDataset={handleLoadFullDataset}
            />
          )}

          {/* Spreadsheet Upload Dropzones - SHOWN ONLY ON EXECUTIVE OVERVIEW OR INITIAL STATE */}
          {dataSourceMode === 'UPLOAD' && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && activeTab !== 'tabLiveOps' && (!result || activeTab === 'tabExecutive') && (
            <FileDropzone
              orderFiles={orderFiles}
              setOrderFiles={setOrderFiles}
              pathaoDeliveryFile={pathaoDeliveryFile}
              setPathaoDeliveryFile={setPathaoDeliveryFile}
              returnFile={returnFile}
              setReturnFile={setReturnFile}
              partialFile={partialFile}
              setPartialFile={setPartialFile}
              exchangeFile={exchangeFile}
              setExchangeFile={setExchangeFile}
              excludeAugust={excludeAugust}
              setExcludeAugust={handleToggleExcludeAugust}
              excludePOS={excludePOS}
              setExcludePOS={handleToggleExcludePOS}
              onProcess={handleProcessUploadedFiles}
              onLoadPreloadedData={handleResetBaseline}
              isProcessing={isProcessing}
              rawOrdersCount={rawOrders.length}
              dataSourceName={dataSourceName}
            />
          )}

          {/* Initial Loading State - Only shown when loading reconciliation ledger */}
          {initialLoading && activeTab !== 'tabLiveOps' && activeTab !== 'tabSettings' && (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm font-semibold text-slate-400">
                Initializing Next.js Knapsack DP Engine & Parsing Data...
              </span>
            </div>
          )}

          {/* Unified Date Range Sub-Header Context Bar — Option B */}
          {result && !initialLoading && activeTab !== 'tabSettings' && activeTab !== 'tabLiveOps' && (
            <div className="sticky top-16 z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md rounded-2xl p-2 sm:p-2.5 md:px-4 md:py-3 border border-slate-200/90 dark:border-[#1F1F1F] shadow-xs flex flex-wrap items-center justify-between gap-2 sm:gap-3 transition-colors">
              {/* Left: Icon, Label, Dropdown & Reset */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0 text-primary">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    Period:
                  </span>
                </div>

                <DateRangeSelector
                  activeScope={dateScope}
                  customRange={customDateRange}
                  onScopeChange={handleDateScopeChange}
                  counts={dateFilterResult.counts}
                  subLabel={dateFilterResult.subLabel}
                  minDateIso={dateFilterResult.minDateIso}
                  maxDateIso={dateFilterResult.maxDateIso}
                  fileWeeks={dateFilterResult.fileWeeks}
                  availableMonths={dateFilterResult.availableMonths}
                  onOpenComparison={(mode) => {
                    setComparisonMode(mode || 'week');
                    setIsWeekComparisonOpen(true);
                  }}
                  align="left"
                />

                {(dateScope !== '30d' || customDateRange) && (
                  <button
                    type="button"
                    onClick={() => handleDateScopeChange('30d')}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary bg-slate-100 hover:bg-orange-50 dark:bg-[#171717] dark:hover:bg-orange-950/30 rounded-xl transition-colors border border-transparent hover:border-orange-200 dark:hover:border-orange-900/40 cursor-pointer shrink-0"
                    title="Reset date range to default (Last 30 Days)"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Right: Quick telemetry chips & Comparison buttons */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">
                  <span>Orders:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {(dateFilterResult.matchedOrders ?? result.reconciledOrders.length).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#121212] border border-slate-200/80 dark:border-[#1F1F1F] text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">
                  <span>Delivered:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ৳{Math.round(result.summary.netDeliveredRevenue || result.summary.grossRevenue || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setComparisonMode('week');
                      setIsWeekComparisonOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[#0E0E0E] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-[#1F1F1F] hover:border-slate-300 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                    title="Compare Performance Between Weeks (WoW Analysis)"
                  >
                    <Scale className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Week vs Week</span>
                    <span className="sm:hidden">WoW</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComparisonMode('month');
                      setIsWeekComparisonOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-[#0E0E0E] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-[#1F1F1F] hover:border-slate-300 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                    title="Compare Performance Between Months (MoM Analysis)"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Month vs Month</span>
                    <span className="sm:hidden">MoM</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GA4 & Meta Marketing Intelligence Tab */}
          {activeTab === 'tabMarketingAnalytics' && (
            <MarketingAnalyticsTab
              summary={result?.summary}
              onSelectOrder={() => setActiveTab('tabOrders')}
              configuredMetaCost={metaAdCost}
              activeScope={dateScope}
              customRange={customDateRange}
              counts={dateFilterResult.counts}
              subLabel={dateFilterResult.subLabel}
              minDateIso={dateFilterResult.minDateIso}
              maxDateIso={dateFilterResult.maxDateIso}
            />
          )}

          {/* System Settings & Custom Themes Tab */}
          {activeTab === 'tabSettings' && (
            <SettingsTab
              excludeAugust={excludeAugust}
              setExcludeAugust={handleToggleExcludeAugust}
              excludePOS={excludePOS}
              setExcludePOS={handleToggleExcludePOS}
              onResetBaseline={handleResetBaseline}
              onDataSynced={handleLiveSyncData}
              activeOrders={rawOrders}
              provenance={dataProvenance || undefined}
              activeDataset={{
                orders: rawOrders,
                returns: rawReturns,
                partials: rawPartials,
                exchanges: rawExchanges,
                pathaoDelivery: rawPathaoDelivery,
                sourceName: dataSourceName,
              }}
              onLoadFullDataset={handleLoadFullDataset}
              insideDeliveryFee={insideDeliveryFee}
              setInsideDeliveryFee={setInsideDeliveryFee}
              outsideDeliveryFee={outsideDeliveryFee}
              setOutsideDeliveryFee={setOutsideDeliveryFee}
              packagingCost={packagingCost}
              setPackagingCost={setPackagingCost}
              cogsPercent={cogsPercent}
              setCogsPercent={setCogsPercent}
              exactTolerance={exactTolerance}
              setExactTolerance={setExactTolerance}
              metaAdCost={metaAdCost}
              setMetaAdCost={setMetaAdCost}
              onRefreshReconciliation={() => {
                computeReconciliation(
                  dateFilterResult.filteredOrders,
                  rawReturns,
                  rawPartials,
                  excludeAugust,
                  excludePOS,
                  rawExchanges,
                  rawPathaoDelivery,
                  insideDeliveryFee,
                  outsideDeliveryFee,
                  packagingCost,
                  cogsPercent,
                  exactTolerance,
                  metaAdCost
                );
              }}
            />
          )}

          {/* Live Shipped & Orders Terminal Tab (DEEN-OPS) */}
          {activeTab === 'tabLiveOps' && (
            <LiveOpsTab
              orders={rawOrders.length > 0 ? rawOrders : ((result?.reconciledOrders as unknown as RawOrderRow[]) || [])}
              onSelectOrder={(_orderId) => {
                setLedgerStatusFilter('ALL');
                setActiveTab('tabOrders');
              }}
              onRefreshLive={async (fetchedOrders?: RawOrderRow[], provenance?: DataProvenanceInfo) => {
                if (fetchedOrders && fetchedOrders.length > 0) {
                  setRawOrders(fetchedOrders);
                  handleLiveSyncData('orders', fetchedOrders, provenance);
                  return;
                }
                try {
                  const res = await fetch('/api/sync/live-terminal', {
                    method: 'POST',
                    headers: getClientAuthHeaders(),
                    body: JSON.stringify({ limitConsignments: 35, fetchLiveWc: true }),
                  });
                  const contentType = res.headers.get('content-type') || '';
                  if (contentType.includes('application/json')) {
                    const data = await res.json().catch(() => null);
                    if (data && data.success && data.orders && data.orders.length > 0) {
                      setRawOrders(data.orders);
                      handleLiveSyncData('orders', data.orders, data.provenance);
                    }
                  }
                } catch {
                  // Suppress transient network sync failures
                }
              }}
              isSyncing={isProcessing}
            />
          )}

          {/* Dashboard Body when data is loaded and not in settings or marketing */}
          {result && !initialLoading && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && activeTab !== 'tabLiveOps' && (
            <div className="space-y-6">
              {/* Executive KPI Overview (8 Cards + Hero) - Only shown on Executive Overview */}
              {activeTab === 'tabExecutive' && (
                <KpiOverview
                  summary={result.summary}
                  orders={result.reconciledOrders}
                  activeSourceMode={dataSourceMode}
                  dataSourceName={dataSourceName}
                  onSwitchSourceMode={handleSwitchDataSource}
                  hasCloudData={cloudApiDataset !== null && cloudApiDataset.orders.length > 0}
                  onKpiClick={handleKpiCardClick}
                  activeDateScope={dateScope}
                  customDateRange={customDateRange}
                  dateScopeCounts={dateFilterResult.counts}
                  dateScopeLabel={dateFilterResult.label}
                  dateScopeSubLabel={dateFilterResult.subLabel}
                  minDateIso={dateFilterResult.minDateIso}
                  maxDateIso={dateFilterResult.maxDateIso}
                  fileWeeks={dateFilterResult.fileWeeks}
                  availableMonths={dateFilterResult.availableMonths}
                  onQuickRecalc={() => {
                    computeReconciliation(
                      dateFilterResult.filteredOrders,
                      rawReturns,
                      rawPartials,
                      excludeAugust,
                      excludePOS,
                      rawExchanges,
                      rawPathaoDelivery
                    );
                    setStatusMessage('Quick recalculation completed: ledger re-indexed.');
                  }}
                  onExport={handleExport}
                  onSync={() => {
                    handleSwitchDataSource('API');
                    const el = document.getElementById('cloudSyncSection');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  skuAnalytics={result.skuAnalytics}
                  customerRiskProfiles={result.customerRiskProfiles}
                  courierMismatches={result.courierMismatches}
                  onAskAi={() => setIsCopilotOpen(true)}
                  onExecuteAgenticAction={handleApplyAgenticAction}
                />
              )}

              {/* Tab Navigation Content */}
              <div id="mainTabSection" className="pt-2">
                {activeTab === 'tabExecutive' && (
                  <ExecutiveOverviewTab
                    summary={result.summary}
                    orders={result.reconciledOrders}
                    skuList={result.skuAnalytics}
                    reconciliationResult={result}
                    provenance={dataProvenance || undefined}
                    onExportMonthlyReport={handleExportMonthlyNetSales}
                  />
                )}
                {activeTab === 'tabOutletDispatch' && (
                  <OutletDispatchTab
                    orders={result.reconciledOrders}
                    summary={result.summary}
                    onSelectOrder={() => setActiveTab('tabOrders')}
                  />
                )}
                {activeTab === 'tabOutletSales' && (
                  <OutletSalesTab
                    orders={result.reconciledOrders}
                    summary={result.summary}
                    onSelectOrder={() => setActiveTab('tabOrders')}
                    dateScope={dateScope}
                    customRange={customDateRange}
                  />
                )}
                {activeTab === 'tabCourierMismatch' && (
                  <CourierMismatchTab
                    mismatches={result.courierMismatches}
                    onRefreshPathao={async () => {
                      setIsProcessing(true);
                      setStatusMessage('Cross-checking live Pathao API for returns & COD reconciliations...');
                      try {
                        const res = await fetch('/api/sync/pathao', {
                          method: 'POST',
                          headers: getClientAuthHeaders(),
                          body: JSON.stringify({ limit: 50 })
                        });
                        const contentType = res.headers.get('content-type') || '';
                        let data: { success?: boolean; orders?: RawOrderRow[]; message?: string } | null = null;
                        if (contentType.includes('application/json')) {
                          data = await res.json().catch(() => null);
                        }
                        if (data && data.success && data.orders) {
                          setRawReturns(data.orders);
                          computeReconciliation(dateFilterResult.filteredOrders, data.orders, rawPartials, excludeAugust, excludePOS, rawExchanges);
                          setStatusMessage(`Pathao cross-check complete: reconciled with ${data.orders.length} courier records.`);
                        } else {
                          setStatusMessage(data?.message || 'Pathao cross-check completed with cached consignments.');
                        }
                      } catch (e: unknown) {
                        const errMsg = e instanceof Error ? e.message : String(e);
                        setStatusMessage(`Pathao sync notice: ${errMsg || 'Sync completed'}`);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    isRefreshing={isProcessing}
                  />
                )}
                {activeTab === 'tabTerritory' && (
                  <TerritoryTab
                    summary={result.summary}
                    orders={result.reconciledOrders}
                    onSelectOrder={() => setActiveTab('tabOrders')}
                  />
                )}
                {(activeTab === 'tabStatus' || activeTab === 'tabUnitEconomics') && (
                  <StatusMatrixTab summary={result.summary} orders={result.reconciledOrders} />
                )}
                {activeTab === 'tabOrders' && (
                  <OrdersLedgerTab
                    orders={result.reconciledOrders}
                    initialStatusFilter={ledgerStatusFilter}
                    initialTerritoryFilter={ledgerTerritoryFilter}
                    onClearAiTags={handleClearAiTags}
                  />
                )}
                {activeTab === 'tabProductAnalysis' && (
                  <ProductAnalysisTab
                    orders={result.reconciledOrders}
                    cogsPercent={cogsPercent}
                    dateScopeDays={dateScope === '7d' ? 7 : dateScope === '90d' ? 90 : 30}
                    onSelectOrder={() => setActiveTab('tabOrders')}
                  />
                )}
                {activeTab === 'tabSku' && (
                  <SkuPerformanceTab
                    skuList={result.skuAnalytics}
                    allOrderItems={result.reconciledOrders}
                    onSelectOrder={() => setActiveTab('tabOrders')}
                  />
                )}
                {activeTab === 'tabItemReturns' && (
                  <ItemReturnsTab returnedItems={result.returnedItems} onSelectOrder={(_orderId) => { setLedgerStatusFilter('FULL_RETURN'); setActiveTab('tabOrders'); }} />
                )}
                {activeTab === 'tabExchanges' && (
                  <ExchangedOrdersTab
                    exchangedOrders={result.exchangedOrders || []}
                    summary={result.summary}
                  />
                )}
                {activeTab === 'tabCustomerRisk' && (
                  <CustomerRiskTab profiles={result.customerRiskProfiles} />
                )}
              </div>
            </div>
          )}

          {/* Empty State Guide Card when no files or data loaded yet */}
          {!result && !initialLoading && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && activeTab !== 'tabLiveOps' && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-sm my-6">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-primary mb-4 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="font-headline text-base font-bold text-slate-900 mb-1">
                Ready to Reconcile Your Store Orders
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                Drag & drop your store order files and Pathao delivery manifests into the dropzones above, or sync live data directly from WooCommerce & Pathao in the Cloud toolbar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-primary uppercase block">1. Store Orders</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">Dispatched Orders</span>
                  <span className="text-[10px] text-slate-500">WooCommerce / Excel (.xlsx)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase block">2. Primary Truth</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">Pathao Delivery Data</span>
                  <span className="text-[10px] text-slate-500">Auto-detects returns & partials (.csv)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Separate Manifests</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">Optional Overrides</span>
                  <span className="text-[10px] text-slate-500">Manual returns & exchange files</span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Dynamic Week-over-Week & Month-over-Month Performance Comparison Modal */}
        <WeekComparisonModal
          isOpen={isWeekComparisonOpen}
          onClose={() => setIsWeekComparisonOpen(false)}
          orders={rawOrders}
          fileWeeks={dateFilterResult.fileWeeks}
          availableMonths={dateFilterResult.availableMonths}
          initialMode={comparisonMode}
          onApplyPeriod={handleDateScopeChange}
          activeScope={dateScope}
          activeCustomRange={customDateRange}
        />

        {/* Omnipresent Command Palette (⌘K / Ctrl+K) */}
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectTab={(tabId, filter) => {
            handleSelectTab(tabId);
            if (filter && tabId === 'tabOrders') {
              setLedgerStatusFilter('ALL');
            }
          }}
          reconciliationResult={result}
          liveOrders={rawOrders}
          onTriggerSync={() => handleSelectTab('tabLiveOps')}
          onToggleTheme={handleToggleTheme}
          onToggleCopilot={handleOpenCopilot}
          onExportExcel={handleExport}
          onExportMonthlyNetSales={handleExportMonthlyNetSales}
          onToggleSidebar={handleToggleSidebarCollapse}
        />

        {/* Real-Time Sync & Logistics Notification Center & Event Drawer */}
        <SyncNotificationCenter
          isOpen={isNotificationCenterOpen}
          onClose={() => setIsNotificationCenterOpen(false)}
          onNavigateToTab={(tabId) => handleSelectTab(tabId)}
          onCountChange={(count) => setNotificationCount(count)}
        />

        {/* DEEN Assistant Floating Action Trigger (Draggable & Repositionable) */}
        <DraggableAssistantButton
          isOpen={isCopilotOpen}
          onToggle={() => setIsCopilotOpen(prev => !prev)}
        />

        {/* DEEN Assistant Drawer */}
        {result?.summary && (
          <CopilotDrawer
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            summary={result.summary}
            reconciliationResult={result}
            liveOrders={rawOrders.length > 0 ? rawOrders : ((result?.reconciledOrders as unknown as RawOrderRow[]) || [])}
            activeTab={activeTab}
            initialQuery={copilotInitialQuery}
            onClearInitialQuery={() => setCopilotInitialQuery('')}
            onApplyAgenticAction={handleApplyAgenticAction}
            onNavigateToTab={(targetTab) => handleSelectTab(targetTab)}
          />
        )}

        {/* Sticky Mobile Bottom Navigation Bar (md:hidden) */}
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenDrawer={() => setMobileMenuOpen(true)}
          returnCount={result ? result.returnedItems.length : 0}
          orderCount={result ? result.reconciledOrders.length : rawOrders.length}
          activeSourceMode={dataSourceMode}
          onTriggerSync={() => handleSelectTab('tabSettings')}
          pendingEventsCount={realtimeSync.pendingCount}
        />

        {/* Real-Time Live Sync Notification Toast */}
        <RealtimeSyncToast
          isConnected={realtimeSync.isConnected}
          isReconnecting={realtimeSync.isReconnecting}
          pendingCount={realtimeSync.pendingCount}
          lastEvent={realtimeSync.lastEvent}
          onRefresh={handleRefreshLiveData}
          onClear={realtimeSync.clearPending}
        />
      </div>
    </div>
  );
}
