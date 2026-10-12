"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  UnitEconomicsTab,
  ExchangedOrdersTab,
  OutletDispatchTab,
  OutletSalesTab
} from '@/components';
import { runReconciliationEngine, ReconciliationResult } from '@/lib/reconciliationEngine';
import { exportReconciledExcel } from '@/lib/excelExport';
import { RawOrderRow } from '@/types';
import { RefreshCw, AlertCircle, CheckCircle2, UploadCloud } from 'lucide-react';

export type DataSourceMode = 'UPLOAD' | 'API';

interface DatasetSnapshot {
  orders: RawOrderRow[];
  pathaoDelivery: RawOrderRow[];
  returns: RawOrderRow[];
  partials: RawOrderRow[];
  exchanges: RawOrderRow[];
  sourceName: string;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('tabExecutive');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('ALL');
  const [ledgerTerritoryFilter, setLedgerTerritoryFilter] = useState('ALL');
  const [orderFiles, setOrderFiles] = useState<File[]>([]);
  const [pathaoDeliveryFile, setPathaoDeliveryFile] = useState<File | null>(null);
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [partialFile, setPartialFile] = useState<File | null>(null);
  const [exchangeFile, setExchangeFile] = useState<File | null>(null);

  const handleKpiCardClick = (target: string, statusFilter?: string, territoryFilter?: string) => {
    setLedgerStatusFilter(statusFilter || 'ALL');
    setLedgerTerritoryFilter(territoryFilter || 'ALL');
    setActiveTab(target);
    const tabEl = document.getElementById('mainTabSection');
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [rawOrders, setRawOrders] = useState<RawOrderRow[]>([]);
  const [rawPathaoDelivery, setRawPathaoDelivery] = useState<RawOrderRow[]>([]);
  const [rawReturns, setRawReturns] = useState<RawOrderRow[]>([]);
  const [rawPartials, setRawPartials] = useState<RawOrderRow[]>([]);
  const [rawExchanges, setRawExchanges] = useState<RawOrderRow[]>([]);

  const [excludeAugust, setExcludeAugust] = useState(true);
  const [excludePOS, setExcludePOS] = useState(true);

  // Distinct Data Source Modes: Uploaded Spreadsheets vs Live Cloud API
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('UPLOAD');
  const [uploadedDataset, setUploadedDataset] = useState<DatasetSnapshot | null>(null);
  const [cloudApiDataset, setCloudApiDataset] = useState<DatasetSnapshot | null>(null);

  const [dataSourceName, setDataSourceName] = useState<string>('📁 September Baseline (1,026 Clean)');
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [result, setResult] = useState<ReconciliationResult | null>(null);

  // Helper to re-run reconciliation engine whenever raw data or filter toggles change
  const computeReconciliation = useCallback((
    orders: RawOrderRow[],
    returns: RawOrderRow[],
    partials: RawOrderRow[],
    augustFilter: boolean,
    posFilter: boolean,
    exchanges: RawOrderRow[] = [],
    pathaoDelivery: RawOrderRow[] = []
  ) => {
    if (!orders.length) return;
    try {
      const res = runReconciliationEngine(orders, returns, partials, {
        excludeAugust: augustFilter,
        excludePOS: posFilter
      }, exchanges, pathaoDelivery);
      setResult(res);
    } catch (err: any) {
      console.error('Reconciliation execution error:', err);
      setStatusMessage(`Engine error: ${err.message}`);
    }
  }, []);

  // Fetch pre-loaded September workspace dataset from local API
  const loadPreloadedSeptemberData = useCallback(async () => {
    setIsProcessing(true);
    setStatusMessage('Loading September workspace Excel datasets...');
    try {
      const res = await fetch('/api/sample-data');
      const data = await res.json();
      if (data.success && data.ordersCount > 0) {
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

        setRawOrders(data.orders || []);
        setRawPathaoDelivery(data.pathaoDelivery || []);
        setRawReturns(data.returns || []);
        setRawPartials(data.partials || []);
        setRawExchanges(data.exchanges || []);
        setDataSourceName('📁 September Baseline (1,026 Clean)');
        computeReconciliation(
          data.orders || [],
          data.returns || [],
          data.partials || [],
          excludeAugust,
          excludePOS,
          data.exchanges || [],
          data.pathaoDelivery || []
        );
        const pathaoInfo = data.pathaoDeliveryCount ? `, ${data.pathaoDeliveryCount} Pathao delivery records` : '';
        setStatusMessage(`Loaded baseline: ${data.ordersCount} orders${pathaoInfo}, ${data.returnsCount} returns, ${data.partialsCount} partials, ${data.exchangesCount || (data.exchanges || []).length} exchanges.`);
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
  }, [excludeAugust, excludePOS, computeReconciliation]);

  // Initial mount: load preloaded workspace data
  useEffect(() => {
    loadPreloadedSeptemberData();
  }, [loadPreloadedSeptemberData]);

  // Re-run computation when filters change
  useEffect(() => {
    if (rawOrders.length > 0) {
      computeReconciliation(rawOrders, rawReturns, rawPartials, excludeAugust, excludePOS, rawExchanges, rawPathaoDelivery);
    }
  }, [excludeAugust, excludePOS, rawOrders, rawReturns, rawPartials, rawExchanges, rawPathaoDelivery, computeReconciliation]);

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
      }

      let parsedPartials: RawOrderRow[] = rawPartials;
      if (targetPartialFile) {
        const wb = await readFileWorkbook(targetPartialFile);
        parsedPartials = extractManifestRows(wb);
      }

      let parsedExchanges: RawOrderRow[] = rawExchanges;
      if (targetExchangeFile) {
        const wb = await readFileWorkbook(targetExchangeFile);
        parsedExchanges = extractManifestRows(wb);
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

      setRawOrders(ordersToUse);
      setRawPathaoDelivery(parsedPathaoDelivery);
      setRawReturns(parsedReturns);
      setRawPartials(parsedPartials);
      setRawExchanges(parsedExchanges);
      setDataSourceName(sourceLabel);

      computeReconciliation(ordersToUse, parsedReturns, parsedPartials, excludeAugust, excludePOS, parsedExchanges, parsedPathaoDelivery);
      const pathaoInfo = parsedPathaoDelivery.length > 0 ? `, ${parsedPathaoDelivery.length.toLocaleString()} Pathao records` : '';
      setStatusMessage(`Reconciliation active: ${ordersToUse.length.toLocaleString()} orders reconciled with primary Pathao delivery${pathaoInfo}, ${parsedReturns.length.toLocaleString()} fallback returns, ${parsedPartials.length} partials, ${parsedExchanges.length} exchanges.`);
    } catch (err: any) {
      console.error('File reading failed:', err);
      setStatusMessage(`Upload parsing error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLiveSyncData = (type: 'orders' | 'returns', rows: RawOrderRow[]) => {
    setDataSourceMode('API');
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
    setRawOrders(updatedOrders);
    setRawReturns(updatedReturns);
    setDataSourceName(sourceLabel);
    computeReconciliation(updatedOrders, updatedReturns, updatedPartials, excludeAugust, excludePOS, updatedExchanges, updatedDelivery);
    setStatusMessage(`Live Cloud API Active: reconciled with ${rows.length} ${type === 'orders' ? 'WooCommerce order items' : 'Pathao courier records'}.`);
  };

  // Distinct Switcher between Uploaded Spreadsheets and Live WooCommerce & Pathao API
  const handleSwitchDataSource = (mode: DataSourceMode) => {
    setDataSourceMode(mode);
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
    <div className="flex min-h-screen bg-white font-sans text-slate-900">
      {/* Branded Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        returnCount={result ? result.returnedItems.length : 0}
        mismatchCount={result ? result.courierMismatches.filter(m => m.severity === 'CRITICAL' || m.severity === 'WARNING').length : 0}
        exchangeCount={result ? result.exchangedOrders.length : rawExchanges.length}
        activeSourceMode={dataSourceMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <Header
          onExport={handleExport}
          hasData={result !== null}
          onResetBaseline={loadPreloadedSeptemberData}
          dataSourceName={dataSourceName}
          activeSourceMode={dataSourceMode}
          onSwitchSourceMode={handleSwitchDataSource}
          hasCloudData={cloudApiDataset !== null && cloudApiDataset.orders.length > 0}
        />

        <main className="p-6 space-y-6 max-w-7xl mx-auto w-full bg-white">
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

          {/* Cloud API Integration (WooCommerce + Pathao) - SHOWN ONLY IN CLOUD API MODE */}
          {dataSourceMode === 'API' && (
            <CloudSyncBar onDataSynced={handleLiveSyncData} />
          )}

          {/* Spreadsheet Upload Dropzones - SHOWN ONLY IN SPREADSHEET UPLOAD MODE */}
          {dataSourceMode === 'UPLOAD' && (
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
              setExcludeAugust={setExcludeAugust}
              excludePOS={excludePOS}
              setExcludePOS={setExcludePOS}
              onProcess={handleProcessUploadedFiles}
              onLoadPreloadedData={loadPreloadedSeptemberData}
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

          {/* Dashboard Body when data is loaded */}
          {result && !initialLoading && (
            <div className="space-y-6">
              {/* Executive KPI Overview (8 Cards + Hero) */}
              <KpiOverview
                summary={result.summary}
                activeSourceMode={dataSourceMode}
                dataSourceName={dataSourceName}
                onSwitchSourceMode={handleSwitchDataSource}
                hasCloudData={cloudApiDataset !== null && cloudApiDataset.orders.length > 0}
                onKpiClick={handleKpiCardClick}
                onQuickRecalc={() => {
                  computeReconciliation(rawOrders, rawReturns, rawPartials, excludeAugust, excludePOS, rawExchanges);
                  setStatusMessage('Quick recalculation completed: ledger re-indexed.');
                }}
                onExport={handleExport}
                onSync={() => {
                  handleSwitchDataSource('API');
                  const el = document.getElementById('cloudSyncSection');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              />

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
                  <TerritoryTab summary={result.summary} />
                )}
                {activeTab === 'tabStatus' && (
                  <StatusMatrixTab summary={result.summary} />
                )}
                {activeTab === 'tabOrders' && (
                  <OrdersLedgerTab
                    orders={result.reconciledOrders}
                    initialStatusFilter={ledgerStatusFilter}
                    initialTerritoryFilter={ledgerTerritoryFilter}
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
                {activeTab === 'tabUnitEconomics' && (
                  <UnitEconomicsTab summary={result.summary} />
                )}
              </div>
            </div>
          )}

          {/* Empty State Guide Card when no files or data loaded yet */}
          {!result && !initialLoading && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-sm my-6">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-primary mb-4 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="font-headline text-base font-bold text-slate-900 mb-1">
                Ready to Reconcile Your Store Orders
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                Drag & drop your store order files, courier return manifests, and partial settlement sheets into the 3 dropzones above, or sync directly from WooCommerce & Pathao in the Cloud toolbar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-primary uppercase block">1. Orders</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">Dispatched Orders</span>
                  <span className="text-[10px] text-slate-500">WooCommerce / Shopify (.xlsx)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">2. Returns</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">Return Manifest</span>
                  <span className="text-[10px] text-slate-500">Pathao / Steadfast (.xlsx)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">3. Partials</span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5">Partial Orders</span>
                  <span className="text-[10px] text-slate-500">Split & partial records (.xlsx)</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
