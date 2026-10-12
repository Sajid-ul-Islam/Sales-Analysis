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
  Layers
} from 'lucide-react';
import { RawOrderRow } from '@/types';

export interface CloudSyncBarProps {
  onDataSynced: (type: 'orders' | 'returns', rows: RawOrderRow[]) => void;
}

export function CloudSyncBar({ onDataSynced }: CloudSyncBarProps) {
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

  const [pathaoStatus, setPathaoStatus] = useState<any>(null);
  const [wcStatus, setWcStatus] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      setPathaoStatus(data.pathao);
      setWcStatus(data.woocommerce);
    } catch (err: any) {
      console.error('Failed to check API status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

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

  // Sync Pathao Live with Date Range
  const handleSyncPathao = async () => {
    setSyncingPathao(true);
    setMessage(`Connecting to Pathao Hermes API (${startDate} to ${endDate})...`);
    try {
      const res = await fetch('/api/sync/pathao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          limit: 50
        }),
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        onDataSynced('returns', data.orders);
        setMessage(`Success: Fetched ${data.count} consignments from Pathao (${startDate} to ${endDate}).`);
      } else {
        setMessage(data.message || data.error || 'Failed to sync Pathao');
      }
    } catch (err: any) {
      setMessage(`Pathao sync error: ${err.message}`);
    } finally {
      setSyncingPathao(false);
    }
  };

  // Sync WooCommerce Live with Date Range
  const handleSyncWooCommerce = async () => {
    setSyncingWc(true);
    setMessage(`Connecting to WooCommerce (${startDate} to ${endDate}, status: ${orderStatus})...`);
    try {
      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          after: `${startDate}T00:00:00`,
          before: `${endDate}T23:59:59`,
          status: orderStatus,
          perPage: 100,
          fetchAllPages: true,
          maxPages: 5
        }),
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        onDataSynced('orders', data.orders);
        setMessage(`Success: Synced ${data.ordersCount} orders (${data.lineItemsCount} items) from WooCommerce (${startDate} to ${endDate}).`);
      } else {
        setMessage(data.message || data.error || 'WooCommerce sync returned 0 orders for the specified date range.');
      }
    } catch (err: any) {
      setMessage(`WooCommerce sync error: ${err.message}`);
    } finally {
      setSyncingWc(false);
    }
  };

  // One-Click Sync Both (WooCommerce + Pathao)
  const handleSyncBoth = async () => {
    setSyncingBoth(true);
    setMessage(`Running consolidated cloud sync for WooCommerce & Pathao (${startDate} to ${endDate})...`);
    try {
      const wcPromise = fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          after: `${startDate}T00:00:00`,
          before: `${endDate}T23:59:59`,
          status: orderStatus,
          perPage: 100,
          fetchAllPages: true,
          maxPages: 5
        }),
      }).then(r => r.json());

      const pathaoPromise = fetch('/api/sync/pathao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          limit: 50
        }),
      }).then(r => r.json());

      const [wcRes, pathaoRes] = await Promise.all([wcPromise, pathaoPromise]);

      let summaryMsgs: string[] = [];
      if (wcRes.success && wcRes.orders && wcRes.orders.length > 0) {
        onDataSynced('orders', wcRes.orders);
        summaryMsgs.push(`WooCommerce: ${wcRes.ordersCount} orders (${wcRes.lineItemsCount} items)`);
      }
      if (pathaoRes.success && pathaoRes.orders && pathaoRes.orders.length > 0) {
        onDataSynced('returns', pathaoRes.orders);
        summaryMsgs.push(`Pathao: ${pathaoRes.count} consignments`);
      }

      if (summaryMsgs.length > 0) {
        setMessage(`Cloud Sync Complete (${startDate} to ${endDate}): ${summaryMsgs.join(' • ')}`);
      } else {
        setMessage('Sync completed but no matching records were found for this date range.');
      }
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
            <div className="flex items-center gap-2">
              <h3 className="font-headline text-sm font-bold text-slate-900">Cloud Sync (WooCommerce & Pathao)</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">
                Live REST APIs
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Sync orders and courier delivery manifests directly from <code className="text-primary font-semibold">deencommerce.com</code> & <code className="text-emerald-600 font-semibold">api-hermes.pathao.com</code>
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

              <div className="space-y-1 text-[11px] text-slate-600 mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Store Orders:</span>
                  <span className="font-bold text-slate-800">{wcStatus?.totalOrdersCount || '1,500+'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Filter Window:</span>
                  <span className="font-mono text-primary font-semibold">{startDate} → {endDate}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncWooCommerce}
                disabled={syncingWc || syncingBoth}
                className="w-full px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                {syncingWc ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing WooCommerce Orders...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Sync WooCommerce Orders</span>
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

              <div className="space-y-1 text-[11px] text-slate-600 mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Verified Hubs:</span>
                  <span className="font-bold text-slate-800">{pathaoStatus?.storesCount || 5} Logistics Stores</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Primary Hub:</span>
                  <span className="font-semibold text-slate-800">DEEN Logistics</span>
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
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>Fetch Pathao Consignments</span>
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
              ) : (
                <>
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Sync All (Store Orders + Courier Manifests for Selected Period)</span>
                </>
              )}
            </button>
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
