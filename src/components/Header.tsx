"use client";

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Download,
  RefreshCw,
  Bell,
  HelpCircle,
  ChevronDown,
  CheckCircle2,
  FileSpreadsheet,
  Cloud
} from 'lucide-react';

export interface HeaderProps {
  onExport: () => void;
  hasData: boolean;
  onResetBaseline?: () => void;
  dataSourceName?: string;
  onSearch?: (term: string) => void;
  activeSourceMode?: 'UPLOAD' | 'API';
  onSwitchSourceMode?: (mode: 'UPLOAD' | 'API') => void;
  hasCloudData?: boolean;
}

export function Header({
  onExport,
  hasData,
  onResetBaseline,
  dataSourceName,
  onSearch,
  activeSourceMode = 'UPLOAD',
  onSwitchSourceMode,
  hasCloudData = false
}: HeaderProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  return (
    <header className="sticky top-0 h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-20 shadow-xs">
      {/* Search Input Bar with ⌘K shortcut */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search orders, SKU code, manifest ID, or customer..."
            className="w-full pl-9 pr-12 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-800"
          />
          <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Header Tools & Indicators */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Distinct Data Source Switcher: Uploaded Spreadsheets vs WooCommerce & Pathao API */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => onSwitchSourceMode?.('UPLOAD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSourceMode === 'UPLOAD'
                ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Render from uploaded spreadsheets & offline manifests (.xlsx / .csv)"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${activeSourceMode === 'UPLOAD' ? 'text-primary' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Spreadsheets</span>
            {activeSourceMode === 'UPLOAD' && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
            )}
          </button>
          <button
            onClick={() => onSwitchSourceMode?.('API')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSourceMode === 'API'
                ? 'bg-white text-emerald-800 shadow-2xs border border-emerald-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Render from live WooCommerce & Pathao Hermes API"
          >
            <Cloud className={`w-3.5 h-3.5 ${activeSourceMode === 'API' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Cloud API</span>
            {activeSourceMode === 'API' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            ) : hasCloudData ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Cloud data synced"></span>
            ) : null}
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>

        {/* Reset Baseline Action */}
        {onResetBaseline && (
          <button
            onClick={onResetBaseline}
            className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-primary border border-orange-200/80 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
            title="Reload verified 1,026 clean orders September baseline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Baseline</span>
          </button>
        )}

        {/* Export Excel Button */}
        <button
          onClick={onExport}
          disabled={!hasData}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-headline text-xs font-bold shadow-sm shadow-primary/20 transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export .XLSX</span>
        </button>

        {/* User Account Pill with Actual Deen Logo */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-2xs ring-1 ring-slate-200 aspect-square">
            <img
              src="/deencommerce_logo.jpg"
              alt="DEEN Operations"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">Deen Operations</span>
            <span className="text-[10px] text-slate-400">Dhaka HQ Cluster</span>
          </div>
        </div>
      </div>
    </header>
  );
}
