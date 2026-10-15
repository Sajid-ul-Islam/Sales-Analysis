"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Sidebar,
  Header,
  CloudSyncBar,
  FileDropzone,
  KpiOverview,
  ExecutiveOverviewTab,
  CourierMismatchTab,
  TerritoryTab,
  StatusMatrixTab,
  OrdersLedgerTab,
  SkuPerformanceTab,
  ItemReturnsTab,
  CustomerRiskTab,
  ExchangedOrdersTab,
  OutletDispatchTab,
  OutletSalesTab,
  MarketingAnalyticsTab,
  SettingsTab,
  WeekComparisonModal
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
import { exportReconciledExcel } from '@/lib/excelExport';
import { loadSavedThemeSettings, applyThemeToDocument } from '@/lib/themeManager';
import { loadAppSettings } from '@/lib/settingsStore';
import { DateScope, filterOrdersByDateScope, CustomDateRange } from '@/lib/dateFilter';
import { RawOrderRow, AgenticActionProposal, DatasetSnapshot } from '@/types';
import { applyAgenticAction, clearAgenticTags } from '@/lib/ai/agenticActions';
import { RefreshCw, AlertCircle, CheckCircle2, UploadCloud, Database, MessageSquare, Bot, Sparkles } from 'lucide-react';
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

export type DataSourceMode = 'UPLOAD' | 'API';

export default function DashboardPage() {
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
    loadPreloadedSeptemberData(true);
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

  const [dataSourceName, setDataSourceName] = useState<string>('📁 September Baseline (1,026 Clean)');
  const [dataProvenance, setDataProvenance] = useState<DataProvenanceInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

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
    } catch (err: any) {
      console.error('Reconciliation execution error:', err);
      setStatusMessage(`Engine error: ${err.message}`);
    }
  }, [rawOrders.length, insideDeliveryFee, outsideDeliveryFee, packagingCost, cogsPercent, exactTolerance, metaAdCost]);

  // Fetch pre-loaded September workspace dataset from local API or local cache
  const loadPreloadedSeptemberData = useCallback(async (forceBypassCache = false) => {
    setIsProcessing(true);
    setStatusMessage('Loading September workspace Excel datasets...');

    // 1. Instant recovery from local cache unless hard refresh is requested
    if (!forceBypassCache) {
      const cached = getCacheItem<DatasetSnapshot>(DEEN_CACHE_KEYS.ACTIVE_DATASET);
      if (cached && cached.orders && cached.orders.length > 0) {
        setUploadedDataset(cached);
        setDataSourceMode('UPLOAD');
        setRawOrders(cached.orders || []);
        setRawPathaoDelivery(cached.pathaoDelivery || []);
        setRawReturns(cached.returns || []);
        setRawPartials(cached.partials || []);
        setRawExchanges(cached.exchanges || []);
        setDataSourceName(cached.sourceName || '📁 September Baseline (Cached)');
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
      const res = await fetch('/api/sample-data');
      const data = await res.json();
      if (data.success && data.ordersCount > 0) {
        if (data.provenance) {
          setDataProvenance(data.provenance);
        }
        const snapshot: DatasetSnapshot = {
          orders: data.orders || [],
          pathaoDelivery: data.pathaoDelivery || [],
          returns: data.returns || [],
          partials: data.partials || [],
          exchanges: data.exchanges || [],
          sourceName: '📁 September Baseline (1,026 Clean)'
        };
        setUploadedDataset(snapshot);
        setDataSourceMode('UPLOAD');

        // Persist to local cache with 7-day TTL
        setCacheItem(DEEN_CACHE_KEYS.ACTIVE_DATASET, snapshot, { ttlMs: 7 * 24 * 3600 * 1000, tag: 'dataset' });
        setCacheItem(DEEN_CACHE_KEYS.SAMPLE_BASELINE, snapshot, { tag: 'dataset' });

        setRawOrders(data.orders || []);
        setRawPathaoDelivery(data.pathaoDelivery || []);
        setRawReturns(data.returns || []);
        setRawPartials(data.partials || []);
        setRawExchanges(data.exchanges || []);
        setDataSourceName('📁 September Baseline (1,026 Clean)');
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
    } catch (err: any) {
      console.error('Failed to load sample dataset:', err);
      setStatusMessage(`Error loading workspace dataset: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setInitialLoading(false);
    }
  }, [excludeAugust, excludePOS, computeReconciliation, dateScope, customDateRange]);

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
    const savedTab = getCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB);
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

    loadPreloadedSeptemberData();

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

      let parsedPathaoDelivery: RawOrderRow[] = rawPathaoDelivery;
      if (targetPathaoDeliveryFile) {
        const wb = await readFileWorkbook(targetPathaoDeliveryFile);
        parsedPathaoDelivery = extractManifestRows(wb);
      }

      let parsedReturns: RawOrderRow[] = rawReturns;
      if (targetReturnFile) {
        const wb = await readFileWorkbook(targetReturnFile);
        parsedReturns = extractManifestRows(wb);
      } else if (targetPathaoDeliveryFile && parsedPathaoDelivery.length > 0) {
        // Primary Courier Truth: Automatically extract returns directly from Pathao Delivery Data CSV/Excel!
        parsedReturns = extractReturnsFromPathaoDelivery(parsedPathaoDelivery);
      }

      let parsedPartials: RawOrderRow[] = rawPartials;
      if (targetPartialFile) {
        const wb = await readFileWorkbook(targetPartialFile);
        parsedPartials = extractManifestRows(wb);
      } else if (targetPathaoDeliveryFile && parsedPathaoDelivery.length > 0) {
        // Automatically extract partial deliveries from Pathao Delivery Data CSV/Excel!
        parsedPartials = extractPartialsFromPathaoDelivery(parsedPathaoDelivery);
      }

      let parsedExchanges: RawOrderRow[] = rawExchanges;
      if (targetExchangeFile) {
        const wb = await readFileWorkbook(targetExchangeFile);
        parsedExchanges = extractManifestRows(wb);
      } else if (targetPathaoDeliveryFile && parsedPathaoDelivery.length > 0) {
        // Automatically extract size exchanges from Pathao Delivery Data CSV/Excel!
        parsedExchanges = extractExchangesFromPathaoDelivery(parsedPathaoDelivery);
      }

      const ordersToUse = combinedOrders.length > 0 ? combinedOrders : rawOrders;
      const sourceLabel = combinedOrders.length > 0 ? `📂 Uploaded Orders (${ordersToUse.length.toLocaleString()} rows)` : dataSourceName;

      const uploadedSnapshot: DatasetSnapshot = {
        orders: ordersToUse,
        pathaoDelivery: parsedPathaoDelivery,
        returns: parsedReturns,
        partials: parsedPartials,
        exchanges: parsedExchanges,
        sourceName: sourceLabel
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
      setDataProvenance({
        source: 'disk_spreadsheet',
        environment: 'client_upload',
        isDemoMode: false,
        isPIISanitized: true,
        timestamp: new Date().toISOString(),
        recordCount: ordersToUse.length
      });
      setDateScope('30d');
      setCustomDateRange(undefined);
      setCookie(DEEN_COOKIE_KEYS.DATE_SCOPE, '30d', { days: 30 });

      const filtered = filterOrdersByDateScope(ordersToUse, '30d', undefined);
      computeReconciliation(filtered.filteredOrders, parsedReturns, parsedPartials, excludeAugust, excludePOS, parsedExchanges, parsedPathaoDelivery);
      const pathaoInfo = parsedPathaoDelivery.length > 0 ? `, ${parsedPathaoDelivery.length.toLocaleString()} Pathao records` : '';
      setStatusMessage(`Reconciliation active: ${filtered.matchedOrders.toLocaleString()} orders reconciled for Last 30 Days (${filtered.subLabel || 'rolling period'})${pathaoInfo}, ${parsedReturns.length.toLocaleString()} fallback returns, ${parsedPartials.length} partials, ${parsedExchanges.length} exchanges.`);
    } catch (err: any) {
      console.error('File reading failed:', err);
      setStatusMessage(`Upload parsing error: ${err.message}`);
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
    computeReconciliation(updatedOrders, updatedReturns, updatedPartials, excludeAugust, excludePOS, updatedExchanges, updatedDelivery);
    setStatusMessage(`Live Cloud API Active: reconciled with ${rows.length} ${type === 'orders' ? 'WooCommerce order items' : 'Pathao courier records'}.`);
  };

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
    computeReconciliation(
      dataset.orders || [],
      dataset.returns || [],
      dataset.partials || [],
      excludeAugust,
      excludePOS,
      dataset.exchanges || [],
      dataset.pathaoDelivery || []
    );
    setStatusMessage(`Loaded from ${sourceLabel}: ${(dataset.orders || []).length.toLocaleString()} orders, ${(dataset.returns || []).length.toLocaleString()} returns.`);
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
        loadPreloadedSeptemberData();
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
    } catch (err: any) {
      console.error('Reconciliation export error:', err);
      setStatusMessage(`Excel export failed: ${err?.message || 'Please check console'}`);
    }
  };

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
        activeSourceMode={dataSourceMode}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-colors duration-200"
        style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)' }}
      >
        <Header
          onExport={handleExport}
          hasData={result !== null}
          onResetBaseline={handleResetBaseline}
          dataSourceName={dataSourceName}
          activeSourceMode={dataSourceMode}
          onSwitchSourceMode={handleSwitchDataSource}
          hasCloudData={cloudApiDataset !== null && cloudApiDataset.orders.length > 0}
          activeDateScope={dateScope}
          customDateRange={customDateRange}
          onDateScopeChange={handleDateScopeChange}
          dateScopeCounts={dateFilterResult.counts}
          dateScopeSubLabel={dateFilterResult.subLabel}
          minDateIso={dateFilterResult.minDateIso}
          maxDateIso={dateFilterResult.maxDateIso}
          fileWeeks={dateFilterResult.fileWeeks}
          onOpenComparison={() => setIsWeekComparisonOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          mobileOpen={mobileMenuOpen}
        />

        <main
          className="px-2 py-3.5 sm:px-6 sm:py-6 pb-20 md:pb-6 space-y-5 max-w-[1920px] mx-auto w-full transition-colors duration-200"
          style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)' }}
        >
          {/* Status Alert Banner */}
          {statusMessage && (
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{statusMessage}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Cloud API Integration (WooCommerce + Pathao) - SHOWN ONLY ON EXECUTIVE OVERVIEW OR INITIAL STATE */}
          {dataSourceMode === 'API' && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && (!result || activeTab === 'tabExecutive') && (
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
          {dataSourceMode === 'UPLOAD' && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && (!result || activeTab === 'tabExecutive') && (
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

          {/* Initial Loading State */}
          {initialLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm font-semibold text-slate-400">
                Initializing Next.js Knapsack DP Engine & Parsing Data...
              </span>
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
              onScopeChange={handleDateScopeChange}
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
                  rawOrders,
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

          {/* Dashboard Body when data is loaded and not in settings or marketing */}
          {result && !initialLoading && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && (
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
                  onDateRangeSelect={handleDateScopeChange}
                  dateScopeCounts={dateFilterResult.counts}
                  dateScopeLabel={dateFilterResult.label}
                  dateScopeSubLabel={dateFilterResult.subLabel}
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
                  onOpenComparison={() => setIsWeekComparisonOpen(true)}
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
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ limit: 50 })
                        });
                        const data = await res.json();
                        if (data.success && data.orders) {
                          setRawReturns(data.orders);
                          computeReconciliation(rawOrders, data.orders, rawPartials, excludeAugust, excludePOS, rawExchanges);
                          setStatusMessage(`Pathao cross-check complete: reconciled with ${data.orders.length} courier records.`);
                        } else {
                          setStatusMessage(data.message || 'Pathao cross-check completed with cached consignments.');
                        }
                      } catch (e: any) {
                        setStatusMessage(`Pathao sync notice: ${e.message}`);
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
                {activeTab === 'tabSku' && (
                  <SkuPerformanceTab
                    skuList={result.skuAnalytics}
                    allOrderItems={result.reconciledOrders}
                    onSelectOrder={() => setActiveTab('tabOrders')}
                  />
                )}
                {activeTab === 'tabItemReturns' && (
                  <ItemReturnsTab returnedItems={result.returnedItems} />
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
          {!result && !initialLoading && activeTab !== 'tabSettings' && activeTab !== 'tabMarketingAnalytics' && (
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

        {/* Dynamic Week-over-Week & Period Performance Comparison Modal */}
        <WeekComparisonModal
          isOpen={isWeekComparisonOpen}
          onClose={() => setIsWeekComparisonOpen(false)}
          orders={rawOrders}
          fileWeeks={dateFilterResult.fileWeeks}
          onApplyPeriod={handleDateScopeChange}
          activeScope={dateScope}
          activeCustomRange={customDateRange}
        />

        {/* DEEN Assistant Floating Action Trigger */}
        <div className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 group">
          {/* Executive Tooltip on Desktop Hover */}
          <div className="hidden md:flex items-center gap-1.5 absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-[#141414] text-white text-xs font-bold tracking-tight whitespace-nowrap shadow-xl border border-slate-700/60 dark:border-[#262626] pointer-events-none transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span>DEEN Assistant</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCopilotOpen(prev => !prev)}
            aria-label="Open DEEN Assistant"
            title="DEEN Assistant"
            className="relative flex items-center justify-center w-12 h-12 md:w-13 md:h-13 min-w-[48px] min-h-[48px] rounded-2xl bg-gradient-to-b from-[#f26322] to-[#EB5A19] hover:from-[#EB5A19] hover:to-[#d44e13] text-white shadow-lg shadow-orange-950/20 dark:shadow-black/60 hover:shadow-xl hover:shadow-orange-950/30 transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EB5A19] dark:focus-visible:ring-offset-black border border-white/20 dark:border-white/10"
          >
            {/* Crisp On-Brand Assistant Icon */}
            <Bot className="w-5 h-5 md:w-6 md:h-6 text-white drop-shadow-xs transition-transform duration-200 group-hover:scale-110" />

            {/* Subtle Operational Status Pill */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 pointer-events-none">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white dark:ring-[#0A0A0A]" />
            </span>
          </button>
        </div>

        {/* DEEN Assistant Drawer */}
        {result?.summary && (
          <CopilotDrawer
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            summary={result.summary}
            reconciliationResult={result}
            activeTab={activeTab}
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
        />
      </div>
    </div>
  );
}
