"use client";

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Truck,
  ChevronDown,
  ChevronUp,
  Calendar,
  Layers,
  Zap,
  HardDrive,
  Trash2,
  ShieldCheck,
  Download,
  Database,
  UploadCloud,
  FileSpreadsheet
} from 'lucide-react';
import { RawOrderRow, DatasetSnapshot } from '@/types';
import { loadAppSettings } from '@/lib/settingsStore';
import { DataProvenanceInfo } from '@/lib/dataAudit';
import { downloadDatasetAsJson, saveDatasetToLocalDisk } from '@/lib/datasetExport';
import {
  getSyncCache,
  setSyncCache,
  clearAllSyncCaches,
  getSyncCacheStats,
  isHistoricalDateRange,
  formatCacheAge
} from '@/lib/apiCache';

export interface CloudSyncBarProps {
  onDataSynced: (type: 'orders' | 'returns', rows: RawOrderRow[], provenance?: DataProvenanceInfo) => void;
  activeOrders?: RawOrderRow[];
  provenance?: DataProvenanceInfo | null;
  activeDataset?: Partial<DatasetSnapshot>;
  onLoadFullDataset?: (dataset: DatasetSnapshot, provenance?: DataProvenanceInfo) => void;
}

export function CloudSyncBar({ onDataSynced, activeOrders, provenance, activeDataset, onLoadFullDataset }: CloudSyncBarProps) {
  const [currentProvenance, setCurrentProvenance] = useState<DataProvenanceInfo | null>(provenance || null);

  useEffect(() => {
    if (provenance) {
      setCurrentProvenance(provenance);
    }
  }, [provenance]);
  const [isOpen, setIsOpen] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncingPathao, setSyncingPathao] = useState(false);
  const [syncingWc, setSyncingWc] = useState(false);
  const [syncingBoth, setSyncingBoth] = useState(false);

  // Date Range State
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-10-11');
  const [orderStatus, setOrderStatus] = useState<string>('any');
  const [activePreset, setActivePreset] = useState<string>('september');

  // Cache & Bypass State
  const [forceLiveSync, setForceLiveSync] = useState(false);
  const [cacheStats, setCacheStats] = useState(() => getSyncCacheStats());
  const [lastSyncFromCache, setLastSyncFromCache] = useState<{ wc?: boolean; pathao?: boolean; age?: string } | null>(null);

  // Vercel Blob & Storage State (Method 1, 2, 3)
  const [blobStatus, setBlobStatus] = useState<{ configured: boolean; latestBlob?: any } | null>(null);
  const [savingToBlob, setSavingToBlob] = useState(false);
  const [loadingFromBlob, setLoadingFromBlob] = useState(false);
  const [savingToLocal, setSavingToLocal] = useState(false);

  const [pathaoStatus, setPathaoStatus] = useState<any>(null);
  const [wcStatus, setWcStatus] = useState<any>(null);
  const [ga4Status, setGa4Status] = useState<any>(null);
  const [metaStatus, setMetaStatus] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Real-time cache probes for current date window
  const wcCached = getSyncCache('woocommerce', startDate, endDate, orderStatus, forceLiveSync);
  const pathaoCached = getSyncCache('pathao', startDate, endDate, 'any', forceLiveSync);
  const isHistorical = isHistoricalDateRange(endDate);

  const getClientCredentials = () => {
    if (typeof window === 'undefined') return { wc: undefined, pathao: undefined };
    const s = loadAppSettings();
    return {
      wc: s.wcConsumerKey ? {
        store_url: s.wcStoreUrl,
        consumer_key: s.wcConsumerKey,
        consumer_secret: s.wcConsumerSecret
      } : undefined,
      pathao: s.pathaoClientId ? {
        base_url: s.pathaoBaseUrl,
        client_id: s.pathaoClientId,
        client_secret: s.pathaoClientSecret,
        username: s.pathaoUsername
      } : undefined
    };
  };

  const checkBlobStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/blob/status');
      const data = await res.json();
      setBlobStatus(data.status ? { configured: data.configured, latestBlob: data.status.latestBlob } : { configured: Boolean(data.configured) });
    } catch {
      setBlobStatus({ configured: false });
    }
  }, []);

  const checkStatus = React.useCallback(async () => {
    setLoadingStatus(true);
    try {
      const creds = getClientCredentials();
      const payload: any = {};
      if (creds.wc) payload.woocommerce = creds.wc;
      if (creds.pathao) payload.pathao = creds.pathao;

      const res = Object.keys(payload).length > 0
        ? await fetch('/api/sync/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/sync/status');

      const data = await res.json();
      setPathaoStatus(data.pathao);
      setWcStatus(data.woocommerce);
      setGa4Status(data.ga4);
      setMetaStatus(data.meta);
    } catch (err: any) {
      console.error('Failed to check API status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    checkBlobStatus();
    setCacheStats(getSyncCacheStats());
  }, [checkStatus, checkBlobStatus]);

  // Quick Preset Handlers
  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'september') {
      setStartDate('2026-09-01');
      setEndDate('2026-09-30');
    } else if (preset === 'october') {
      setStartDate('2026-10-01');
      setEndDate(todayStr);
    }
  };

  const handleClearApiCaches = () => {
    const cleared = clearAllSyncCaches();
    setCacheStats(getSyncCacheStats());
    setMessage(`Cleared ${cleared} API sync cache snapshots. Subsequent requests will query live endpoints.`);
  };

  // Method 1: Client Download JSON Snapshot
  const handleDownloadDatasetJson = () => {
    const ds = activeDataset || { orders: activeOrders || [] };
    downloadDatasetAsJson(ds, `deen_dataset_${startDate}_${endDate}.json`);
    setMessage(`📥 Downloaded working dataset snapshot as JSON file.`);
  };

  // Method 1: Save directly to local baseline file (Node environment)
  const handleSaveToLocalDisk = async () => {
    setSavingToLocal(true);
    try {
      const ds = activeDataset || { orders: activeOrders || [] };
      const res = await saveDatasetToLocalDisk(ds);
      setMessage(res.message);
    } catch (err: any) {
      setMessage(`Failed to save baseline: ${err.message}`);
    } finally {
      setSavingToLocal(false);
    }
  };

  // Method 3: Upload current working dataset to Vercel Blob
  const handleSaveToVercelBlob = async () => {
    setSavingToBlob(true);
    setMessage('Uploading dataset snapshot to Vercel Blob...');
    try {
      const ds = activeDataset || { orders: activeOrders || [] };
      const res = await fetch('/api/blob/dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ds),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`☁️ ${data.message}`);
        checkBlobStatus();
      } else {
        setMessage(data.message || data.error || 'Failed to upload to Vercel Blob');
      }
    } catch (err: any) {
      setMessage(`Vercel Blob upload error: ${err.message}`);
    } finally {
      setSavingToBlob(false);
    }
  };

  // Method 3: Load latest cloud snapshot from Vercel Blob
  const handleLoadFromVercelBlob = async () => {
    setLoadingFromBlob(true);
    setMessage('Fetching latest dataset from Vercel Blob...');
    try {
      const res = await fetch('/api/blob/dataset');
      const data = await res.json();
      if (data.success && data.dataset) {
        if (onLoadFullDataset) {
          onLoadFullDataset(data.dataset, data.provenance);
        } else if (data.dataset.orders) {
          onDataSynced('orders', data.dataset.orders, data.provenance);
          if (data.dataset.returns) {
            onDataSynced('returns', data.dataset.returns, data.provenance);
          }
        }
        setMessage(`⚡ Loaded ${(data.dataset.orders || []).length.toLocaleString()} orders & ${(data.dataset.returns || []).length.toLocaleString()} returns from Vercel Blob.`);
      } else {
        setMessage(data.message || 'No dataset found in Vercel Blob.');
      }
    } catch (err: any) {
      setMessage(`Vercel Blob load error: ${err.message}`);
    } finally {
      setLoadingFromBlob(false);
    }
  };

  // Sync Pathao Live with Date Range and Local Cache
  const handleSyncPathao = async () => {
    // 1. Check local storage cache if not bypassing
    if (!forceLiveSync) {
      const cached = getSyncCache('pathao', startDate, endDate, 'any');
      if (cached.hit && cached.data && cached.data.length > 0) {
        onDataSynced('returns', cached.data);
        setMessage(`⚡ Instant 0ms Load: Retrieved ${cached.ordersCount} Pathao consignments from local cache (${cached.ageFormatted}). Zero external API calls made.`);
        setLastSyncFromCache(prev => ({ ...prev, pathao: true, age: cached.ageFormatted }));
        setCacheStats(getSyncCacheStats());
        return;
      }
    }

    setSyncingPathao(true);
    setMessage(`Connecting to Pathao Hermes API (${startDate} to ${endDate})...`);
    try {
      const creds = getClientCredentials();
      const res = await fetch('/api/sync/pathao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          limit: 35,
          activeOrders: activeOrders?.slice(0, 100),
          credentials: creds.pathao,
        }),
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        setSyncCache('pathao', startDate, endDate, 'any', data.orders, {
          ordersCount: data.count || data.orders.length,
        });
        if (data.provenance) {
          setCurrentProvenance(data.provenance);
        }
        onDataSynced('returns', data.orders, data.provenance);
        setMessage(`Success: Fetched ${data.count} consignments from live Pathao API & cached in local storage.`);
        setLastSyncFromCache(prev => ({ ...prev, pathao: false }));
        setCacheStats(getSyncCacheStats());
      } else {
        setMessage(data.message || data.error || 'Failed to sync Pathao');
      }
    } catch (err: any) {
      setMessage(`Pathao sync error: ${err.message}`);
    } finally {
      setSyncingPathao(false);
    }
  };

  // Sync WooCommerce Live with Date Range and Local Cache
  const handleSyncWooCommerce = async () => {
    // 1. Check local storage cache if not bypassing
    if (!forceLiveSync) {
      const cached = getSyncCache('woocommerce', startDate, endDate, orderStatus);
      if (cached.hit && cached.data && cached.data.length > 0) {
        onDataSynced('orders', cached.data);
        setMessage(`⚡ Instant 0ms Load: Retrieved ${cached.ordersCount} orders (${cached.lineItemsCount || cached.data.length} items) from local cache (${cached.ageFormatted}). Zero external API calls made.`);
        setLastSyncFromCache(prev => ({ ...prev, wc: true, age: cached.ageFormatted }));
        setCacheStats(getSyncCacheStats());
        return;
      }
    }

    setSyncingWc(true);
    setMessage(`Connecting to WooCommerce (${startDate} to ${endDate}, status: ${orderStatus})...`);
    try {
      const creds = getClientCredentials();
      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          after: `${startDate}T00:00:00`,
          before: `${endDate}T23:59:59`,
          status: orderStatus,
          perPage: 100,
          fetchAllPages: true,
          maxPages: 3,
          credentials: creds.wc,
        }),
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        setSyncCache('woocommerce', startDate, endDate, orderStatus, data.orders, {
          ordersCount: data.ordersCount || data.orders.length,
          lineItemsCount: data.lineItemsCount,
        });
        if (data.provenance) {
          setCurrentProvenance(data.provenance);
        }
        onDataSynced('orders', data.orders, data.provenance);
        setMessage(`Success: Synced ${data.ordersCount} orders (${data.lineItemsCount} items) from live WooCommerce API & stored in local cache.`);
        setLastSyncFromCache(prev => ({ ...prev, wc: false }));
        setCacheStats(getSyncCacheStats());
      } else {
        setMessage(data.message || data.error || 'WooCommerce sync returned 0 orders for the specified date range.');
      }
    } catch (err: any) {
      setMessage(`WooCommerce sync error: ${err.message}`);
    } finally {
      setSyncingWc(false);
    }
  };

  // One-Click Sync Both (WooCommerce + Pathao) with Smart Dual Caching
  const handleSyncBoth = async () => {
    setSyncingBoth(true);
    setMessage(`Running consolidated cloud sync for WooCommerce & Pathao (${startDate} to ${endDate})...`);
    try {
      const creds = getClientCredentials();
      let wcData: RawOrderRow[] | null = null;
      let wcMsg = '';
      let pathaoData: RawOrderRow[] | null = null;
      let pathaoMsg = '';

      // Check WooCommerce Cache
      const wcCache = !forceLiveSync ? getSyncCache('woocommerce', startDate, endDate, orderStatus) : null;
      if (wcCache?.hit && wcCache.data && wcCache.data.length > 0) {
        wcData = wcCache.data;
        wcMsg = `WooCommerce: ⚡ ${wcCache.ordersCount} orders (cached ${wcCache.ageFormatted})`;
      }

      // Check Pathao Cache
      const pathaoCache = !forceLiveSync ? getSyncCache('pathao', startDate, endDate, 'any') : null;
      if (pathaoCache?.hit && pathaoCache.data && pathaoCache.data.length > 0) {
        pathaoData = pathaoCache.data;
        pathaoMsg = `Pathao: ⚡ ${pathaoCache.ordersCount} consignments (cached ${pathaoCache.ageFormatted})`;
      }

      // If both were in cache, instant return with 0 network calls!
      if (wcData && pathaoData) {
        onDataSynced('orders', wcData);
        onDataSynced('returns', pathaoData);
        setMessage(`⚡ Instant 0ms Sync (0 API Calls): ${wcMsg} • ${pathaoMsg}`);
        setLastSyncFromCache({ wc: true, pathao: true, age: wcCache?.ageFormatted });
        setCacheStats(getSyncCacheStats());
        return;
      }

      // Run network fetch for cache misses only
      const promises: Promise<any>[] = [];

      if (!wcData) {
        promises.push(
          fetch('/api/sync/woocommerce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              after: `${startDate}T00:00:00`,
              before: `${endDate}T23:59:59`,
              status: orderStatus,
              perPage: 100,
              fetchAllPages: true,
              maxPages: 3,
              credentials: creds.wc,
            }),
          }).then(r => r.json()).then(res => ({ type: 'wc', res }))
        );
      }

      if (!pathaoData) {
        promises.push(
          fetch('/api/sync/pathao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate,
              endDate,
              limit: 35,
              activeOrders: activeOrders?.slice(0, 100),
              credentials: creds.pathao,
            }),
          }).then(r => r.json()).then(res => ({ type: 'pathao', res }))
        );
      }

      const results = await Promise.all(promises);

      let latestProvenance: DataProvenanceInfo | undefined = undefined;
      for (const item of results) {
        if (item.type === 'wc') {
          if (item.res.success && item.res.orders && item.res.orders.length > 0) {
            wcData = item.res.orders;
            if (item.res.provenance) latestProvenance = item.res.provenance;
            setSyncCache('woocommerce', startDate, endDate, orderStatus, item.res.orders, {
              ordersCount: item.res.ordersCount || item.res.orders.length,
              lineItemsCount: item.res.lineItemsCount,
            });
            wcMsg = `WooCommerce: 🌐 ${item.res.ordersCount} orders (Live API)`;
          } else {
            wcMsg = `WooCommerce: ${item.res.message || 'No orders'}`;
          }
        } else if (item.type === 'pathao') {
          if (item.res.success && item.res.orders && item.res.orders.length > 0) {
            pathaoData = item.res.orders;
            if (item.res.provenance) latestProvenance = item.res.provenance;
            setSyncCache('pathao', startDate, endDate, 'any', item.res.orders, {
              ordersCount: item.res.count || item.res.orders.length,
            });
            pathaoMsg = `Pathao: 🌐 ${item.res.count} consignments (Live API)`;
          } else {
            pathaoMsg = `Pathao: ${item.res.message || 'No consignments'}`;
          }
        }
      }

      if (latestProvenance) {
        setCurrentProvenance(latestProvenance);
      }
      if (wcData) onDataSynced('orders', wcData, latestProvenance);
      if (pathaoData) onDataSynced('returns', pathaoData, latestProvenance);

      const summaries = [wcMsg, pathaoMsg].filter(Boolean);
      setMessage(`Cloud Sync Complete (${startDate} to ${endDate}): ${summaries.join(' • ')}`);
      setLastSyncFromCache({ wc: !promises.some(p => p.toString().includes('woocommerce')), pathao: !promises.some(p => p.toString().includes('pathao')) });
      setCacheStats(getSyncCacheStats());
    } catch (err: any) {
      setMessage(`Consolidated sync error: ${err.message}`);
    } finally {
      setSyncingBoth(false);
    }
  };

  return (
    <div id="cloudSyncSection" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 px-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none border-b border-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-primary">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline text-sm font-bold text-slate-900">Cloud Sync & Omnichannel Hub</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">
                Live REST APIs
              </span>
              {currentProvenance && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                    currentProvenance.source === 'live_api'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : currentProvenance.source === 'demo_anonymized'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : currentProvenance.source === 'baseline_bundled'
                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                  title={`Source: ${currentProvenance.source} | Environment: ${currentProvenance.environment} | PII Sanitized: ${currentProvenance.isPIISanitized ? 'Yes' : 'No'}`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {currentProvenance.source === 'live_api'
                    ? 'Live API'
                    : currentProvenance.source === 'demo_anonymized'
                    ? 'Demo Anonymized'
                    : currentProvenance.source === 'baseline_bundled'
                    ? 'Bundled Baseline'
                    : 'Disk Files'}
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                GA4 Live Stream
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                metaStatus?.connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${metaStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {metaStatus?.connected ? 'Meta Connected' : 'Meta Benchmark'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Sync orders, returns, and marketing metrics directly from <code className="text-primary font-semibold">deencommerce.com</code>, <code className="text-emerald-600 font-semibold">Pathao</code>, and <code className="text-indigo-600 font-semibold">Google Analytics 4</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              checkStatus();
            }}
            disabled={loadingStatus}
            className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            title="Refresh API Connection Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin text-primary' : ''}`} />
          </button>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-6 space-y-5 bg-white">
          {/* Preset Buttons & Date Filter Controls */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-slate-800">Date Range Filter</span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
                {[
                  { id: 'september', label: 'September 2026 (Audit)' },
                  { id: 'october', label: 'October 2026 (MTD)' },
                  { id: 'last30', label: 'Last 30 Days' },
                  { id: 'last7', label: 'Last 7 Days' },
                  { id: 'today', label: 'Today' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                      activePreset === p.id
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">WooCommerce Order Status</label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-primary"
                >
                  <option value="any">Any Status (All Orders)</option>
                  <option value="processing">Processing (Active Handover)</option>
                  <option value="completed">Completed (Delivered & Paid)</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded / Returned</option>
                </select>
              </div>
            </div>

            {/* Cache Strategy & Bypass Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-slate-700 font-bold border border-slate-200 shadow-2xs">
                  <HardDrive className="w-3 h-3 text-primary" />
                  <span>API Cache:</span>
                  <span className="text-primary font-mono font-bold">
                    {cacheStats.totalCachedEntries} saved (~{(cacheStats.totalCachedBytes / 1024).toFixed(0)} KB)
                  </span>
                  <span className="text-emerald-600 font-semibold">
                    • ~{cacheStats.savedApiCallsEstimate} calls saved
                  </span>
                </span>

                {currentProvenance && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold border shadow-2xs ${
                      currentProvenance.source === 'live_api'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : currentProvenance.source === 'demo_anonymized'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : currentProvenance.source === 'baseline_bundled'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                    title={`Source: ${currentProvenance.source} (${currentProvenance.recordCount} rows) | PII Masked: ${currentProvenance.isPIISanitized ? 'Yes' : 'No'}`}
                  >
                    <ShieldCheck className="w-3 h-3 text-current" />
                    <span>Provenance:</span>
                    <span className="font-semibold">
                      {currentProvenance.source === 'live_api'
                        ? 'Live API'
                        : currentProvenance.source === 'demo_anonymized'
                        ? 'Demo Anonymized'
                        : currentProvenance.source === 'baseline_bundled'
                        ? 'Bundled Baseline'
                        : 'Disk / Spreadsheet Fallback'}
                    </span>
                  </span>
                )}

                <span className="text-slate-400 font-mono text-[10px]">
                  TTL: {isHistorical ? '🔒 Historical (7d cache)' : '⚡ Active MTD (2h cache)'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={forceLiveSync}
                    onChange={(e) => setForceLiveSync(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                  />
                  <span>Force Live Refresh</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Bypass Cache)</span>
                </label>

                {cacheStats.totalCachedEntries > 0 && (
                  <button
                    type="button"
                    onClick={handleClearApiCaches}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    title="Clear all stored API sync responses from browser"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Cache</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WooCommerce Status Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-primary shadow-xs">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-headline text-xs font-bold text-slate-900">WooCommerce Store</h4>
                    <span className="text-[10px] text-slate-500">deencommerce.com</span>
                  </div>
                </div>

                {wcStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                    Checking...
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-600 mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Store Orders:</span>
                  <span className="font-bold text-slate-800">{wcStatus?.totalOrdersCount || '1,500+'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Filter Window:</span>
                  <span className="font-mono text-primary font-semibold">{startDate} → {endDate}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-400">Cache Status:</span>
                  {wcCached.hit && !forceLiveSync ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 text-[10px]">
                      <Zap className="w-3 h-3 text-emerald-600" />
                      Cached ({wcCached.ordersCount} orders • {wcCached.ageFormatted})
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[10px]">
                      {forceLiveSync ? 'Bypassed (Live Fetch)' : 'Not Cached (Live API)'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncWooCommerce}
                disabled={syncingWc || syncingBoth}
                className={`w-full px-3 py-2 rounded-lg disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                  wcCached.hit && !forceLiveSync
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                {syncingWc ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing WooCommerce Orders...</span>
                  </>
                ) : wcCached.hit && !forceLiveSync ? (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Load from Cache (0ms • 0 API Calls)</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Sync WooCommerce Orders (Live API)</span>
                  </>
                )}
              </button>
            </div>

            {/* Pathao Hermes Status Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-xs">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-headline text-xs font-bold text-slate-900">Pathao Hermes Courier</h4>
                    <span className="text-[10px] text-slate-500">api-hermes.pathao.com</span>
                  </div>
                </div>

                {pathaoStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Token Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                    Checking...
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-600 mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Verified Hubs:</span>
                  <span className="font-bold text-slate-800">{pathaoStatus?.storesCount || 5} Logistics Stores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Primary Hub:</span>
                  <span className="font-semibold text-slate-800">DEEN Logistics</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-400">Cache Status:</span>
                  {pathaoCached.hit && !forceLiveSync ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 text-[10px]">
                      <Zap className="w-3 h-3 text-emerald-600" />
                      Cached ({pathaoCached.ordersCount} consignments • {pathaoCached.ageFormatted})
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono text-[10px]">
                      {forceLiveSync ? 'Bypassed (Live Fetch)' : 'Not Cached (Live API)'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncPathao}
                disabled={syncingPathao || syncingBoth}
                className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                {syncingPathao ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching Pathao Consignments...</span>
                  </>
                ) : pathaoCached.hit && !forceLiveSync ? (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Load from Cache (0ms • 0 API Calls)</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>Fetch Pathao Consignments (Live API)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Combined Sync All Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSyncBoth}
              disabled={syncingBoth || syncingWc || syncingPathao}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
            >
              {syncingBoth ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  <span>Synchronizing WooCommerce & Pathao in Parallel...</span>
                </>
              ) : wcCached.hit && pathaoCached.hit && !forceLiveSync ? (
                <>
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>Instant Load All from Cache (0ms • 0 API Calls)</span>
                </>
              ) : (wcCached.hit || pathaoCached.hit) && !forceLiveSync ? (
                <>
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Smart Sync (1 from Cache, 1 Live Fetch)</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Sync All (Store Orders + Courier Manifests for Selected Period)</span>
                </>
              )}
            </button>
          </div>

          {/* 3-Tier Storage & Persistence Hub (Methods 1, 2, 3) */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-slate-900 font-headline">
                  Dataset Storage & Persistence Hub (Methods 1, 2, 3)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                Store fetched datasets so you never have to refetch repeatedly
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Method 1: Bundled Baseline JSON & Export */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-primary" />
                      Method 1: Static JSON
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-primary">
                      Zero Cost
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                    Download active dataset as JSON or save to <code className="text-slate-700 font-mono">baselineSample.json</code>. Bundled into Vercel build for 0ms startup.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDatasetJson}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95"
                    title="Download active dataset as standardized JSON file"
                  >
                    <Download className="w-3 h-3 text-primary" />
                    <span>Download JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveToLocalDisk}
                    disabled={savingToLocal}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                    title="Write directly to src/data/baselineSample.json in local development"
                  >
                    {savingToLocal ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                    ) : (
                      <FileSpreadsheet className="w-3 h-3 text-slate-600" />
                    )}
                    <span>Save Baseline</span>
                  </button>
                </div>
              </div>

              {/* Method 2: Browser Local Storage */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                      Method 2: Browser Cache
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Auto Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                    Browser localStorage caches live API queries for 7 days (historical) or 2 hours. Provides instant 0ms reload on refresh.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForceLiveSync(false);
                      const kb = Math.round(cacheStats.totalCachedBytes / 1024);
                      setMessage(`⚡ Browser local cache active: ${cacheStats.totalCachedEntries} snapshots (${kb} KB) stored.`);
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-emerald-800 border border-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95"
                    title="Restore active dataset from browser local storage"
                  >
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>{cacheStats.totalCachedEntries} Cached ({Math.round(cacheStats.totalCachedBytes / 1024)} KB)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearApiCaches}
                    className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 text-[11px] transition-all shadow-2xs active:scale-95"
                    title="Clear Browser Cache"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Method 3: Vercel Blob Cloud Storage */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-indigo-600" />
                      Method 3: Vercel Blob
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      blobStatus?.configured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {blobStatus?.configured ? 'Connected' : 'Token Needed'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                    Serverless cloud object storage. Persists synced JSON in Vercel Blob so all team members & visitors share the latest cloud data without redeploying.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveToVercelBlob}
                    disabled={savingToBlob || !blobStatus?.configured}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95"
                    title={blobStatus?.configured ? "Upload current dataset to Vercel Blob" : "Configure BLOB_READ_WRITE_TOKEN in Vercel Environment Variables"}
                  >
                    {savingToBlob ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3 h-3" />
                    )}
                    <span>Save to Blob</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadFromVercelBlob}
                    disabled={loadingFromBlob || !blobStatus?.configured}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-indigo-800 border border-indigo-200 disabled:opacity-50 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95"
                    title={blobStatus?.configured ? "Fetch latest dataset snapshot from Vercel Blob" : "Configure BLOB_READ_WRITE_TOKEN in Vercel Environment Variables"}
                  >
                    {loadingFromBlob ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                    ) : (
                      <Cloud className="w-3 h-3 text-indigo-600" />
                    )}
                    <span>Load</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {message && (
            <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
