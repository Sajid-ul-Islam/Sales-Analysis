"use client";

import React, { useState } from 'react';
import { DataProvenanceInfo } from '@/lib/dataAudit';
import { DateScope } from '@/lib/dateFilter';
import {
  FileSpreadsheet,
  Cloud,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';

interface DataProvenanceBannerProps {
  provenance: DataProvenanceInfo | null;
  dataSourceMode: 'UPLOAD' | 'API';
  totalOrders: number;
  matchedOrders: number;
  activeScope: DateScope;
  dateScopeLabel?: string;
  onSetScopeAll?: () => void;
  onResetBaseline?: () => void;
  onSwitchToApi?: () => void;
}

export function DataProvenanceBanner({
  provenance,
  dataSourceMode,
  totalOrders,
  matchedOrders,
  activeScope,
  dateScopeLabel = 'Last 30 Days',
  onSetScopeAll,
  onResetBaseline: _onResetBaseline,
  onSwitchToApi,
}: DataProvenanceBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!provenance && totalOrders === 0) return null;

  const isOffline = dataSourceMode === 'UPLOAD';
  const fileNames = provenance?.fileNames || [];
  const primaryFileName = fileNames.length > 0 ? fileNames[0] : (isOffline ? 'Offline Spreadsheet' : 'Cloud Sync');
  const dateRangeStr = provenance?.dateRangeFormatted || 'Historical Records';
  const isPartiallyFiltered = matchedOrders < totalOrders && activeScope !== 'all';

  return (
    <div className="w-full bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
      {/* Primary Bar */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Source & Temporal Scope */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold shadow-2xs ${
              isOffline
                ? 'bg-orange-500/10 text-primary border border-orange-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            }`}
          >
            {isOffline ? <FileSpreadsheet className="w-4.5 h-4.5" /> : <Cloud className="w-4.5 h-4.5" />}
          </div>

          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {isOffline ? `Offline File: ${primaryFileName}` : 'Live Cloud Feed (WooCommerce & Pathao)'}
              </span>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  isOffline
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {isOffline ? 'Strict File Isolation' : 'Real-Time Sync'}
              </span>

              {isPartiallyFiltered && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <Filter className="w-2.5 h-2.5" />
                  <span>Filtered ({dateScopeLabel})</span>
                </span>
              )}
            </div>

            {/* From - To Range */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Rendered Range:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">{dateRangeStr}</strong>
              </span>

              <span>•</span>

              <span>
                Rendering <strong className="text-slate-900 dark:text-white">{matchedOrders.toLocaleString()}</strong> of{' '}
                <strong>{totalOrders.toLocaleString()}</strong> total rows
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Scope Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {isPartiallyFiltered && onSetScopeAll && (
            <button
              type="button"
              onClick={onSetScopeAll}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-dark text-white transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
              title="Show all records from the uploaded file without date filter"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Show All File Dates</span>
            </button>
          )}

          {isOffline && onSwitchToApi && (
            <button
              type="button"
              onClick={onSwitchToApi}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
              title="Switch to live cloud API sync"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Switch to Live API</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title={isExpanded ? 'Hide dataset details' : 'Show dataset details'}
            aria-label="Toggle details"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Provenance Details Drawer */}
      {isExpanded && (
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#070707] text-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Origin Source</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                {isOffline ? 'Disk Spreadsheet Upload' : 'WooCommerce REST API v3'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Earliest Timestamp</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                {provenance?.dateFrom ? new Date(provenance.dateFrom).toLocaleString('en-GB') : 'N/A'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Latest Timestamp</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                {provenance?.dateTo ? new Date(provenance.dateTo).toLocaleString('en-GB') : 'N/A'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Privacy & Audit</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 truncate">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Isolated & Reconciled</span>
              </span>
            </div>
          </div>

          {fileNames.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span className="font-bold">Loaded Files:</span>
              {fileNames.map((fn, idx) => (
                <span
                  key={idx}
                  className="font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200"
                >
                  {fn}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
