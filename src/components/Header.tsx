"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Cloud,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { DateScope, DateScopeCounts, CustomDateRange, FileWeek } from '@/lib/dateFilter';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { loadSavedThemeSettings, saveThemeSettings, BackgroundStyleId } from '@/lib/themeManager';

export interface HeaderProps {
  onExport: () => void;
  hasData: boolean;
  onResetBaseline?: () => void;
  dataSourceName?: string;
  onSearch?: (term: string) => void;
  activeSourceMode?: 'UPLOAD' | 'API';
  onSwitchSourceMode?: (mode: 'UPLOAD' | 'API') => void;
  hasCloudData?: boolean;
  onOpenSettings?: () => void;
  onToggleCopilot?: () => void;
  activeDateScope?: DateScope;
  customDateRange?: CustomDateRange;
  onDateScopeChange?: (scope: DateScope, customRange?: CustomDateRange) => void;
  dateScopeCounts?: DateScopeCounts;
  dateScopeSubLabel?: string;
  minDateIso?: string;
  maxDateIso?: string;
  fileWeeks?: FileWeek[];
  onOpenComparison?: () => void;
  onToggleMobileMenu?: () => void;
  mobileOpen?: boolean;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export function Header({
  onExport,
  hasData,
  onResetBaseline,
  dataSourceName,
  onSearch,
  activeSourceMode = 'UPLOAD',
  onSwitchSourceMode,
  hasCloudData = false,
  onOpenSettings,
  onToggleCopilot,
  activeDateScope,
  customDateRange,
  onDateScopeChange,
  dateScopeCounts,
  dateScopeSubLabel,
  minDateIso,
  maxDateIso,
  fileWeeks,
  onOpenComparison,
  onToggleMobileMenu,
  mobileOpen,
  isDarkMode: propIsDarkMode,
  onToggleTheme
}: HeaderProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Self-contained dark mode fallback state if prop is not supplied
  const [internalDarkMode, setInternalDarkMode] = useState(false);
  const activeDarkMode = propIsDarkMode !== undefined ? propIsDarkMode : internalDarkMode;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark-canvas') ||
        Boolean(localStorage.getItem('deen_reconcile_theme_settings_v1')?.includes('"dark-canvas"'));
      setInternalDarkMode(isDark);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleThemeToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
      return;
    }

    // Autonomous fallback: toggle class and persist settings
    const nextMode = !activeDarkMode;
    setInternalDarkMode(nextMode);

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

  return (
    <header className="sticky top-0 h-16 border-b border-slate-200 dark:border-[#1F1F1F] bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 shadow-xs transition-colors duration-200">
      {/* Search Input Bar with Mobile Menu Toggle & ⌘K shortcut */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 sm:mr-4">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={`md:hidden p-2.5 min-w-[44px] min-h-[44px] rounded-xl transition-all shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black ${
              mobileOpen
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-slate-600 hover:text-navy-deep hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#161616]'
            }`}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-primary" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        )}
        <div className="relative w-full max-w-[160px] xs:max-w-xs sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search order, SKU, phone..."
            aria-label="Search orders, SKUs, customer phones"
            className="w-full min-w-[44px] pl-9 pr-8 sm:pr-12 py-2.5 min-h-[44px] bg-slate-50 hover:bg-slate-100/70 focus:bg-white dark:bg-[#0D0D0D] dark:hover:bg-[#141414] dark:focus:bg-[#000000] text-xs border border-slate-200 dark:border-[#262626] rounded-xl placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all text-slate-800 dark:text-slate-100"
          />
          <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#262626] rounded shadow-2xs pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Header Tools & Indicators */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Distinct Data Source Switcher: Uploaded Spreadsheets vs WooCommerce & Pathao API */}
        <div className="flex items-center p-1 bg-slate-100/90 dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xs">
          <button
            type="button"
            onClick={() => onSwitchSourceMode?.('UPLOAD')}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 min-w-[44px] min-h-[44px] rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeSourceMode === 'UPLOAD'
                ? 'bg-white dark:bg-[#141414] text-navy-deep dark:text-slate-100 shadow-2xs border border-slate-200/90 dark:border-[#262626]'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            title="Render from uploaded spreadsheets & offline manifests (.xlsx / .csv)"
            aria-label="Switch data source to uploaded spreadsheets"
            aria-pressed={activeSourceMode === 'UPLOAD'}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${activeSourceMode === 'UPLOAD' ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="hidden md:inline">Spreadsheets</span>
            {activeSourceMode === 'UPLOAD' && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSwitchSourceMode?.('API')}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 min-w-[44px] min-h-[44px] rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeSourceMode === 'API'
                ? 'bg-white dark:bg-[#141414] text-emerald-800 dark:text-emerald-400 shadow-2xs border border-emerald-200/80 dark:border-emerald-800/60'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            title="Render from live WooCommerce & Pathao Hermes API"
            aria-label="Switch data source to Cloud API"
            aria-pressed={activeSourceMode === 'API'}
          >
            <Cloud className={`w-3.5 h-3.5 ${activeSourceMode === 'API' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="hidden md:inline">Cloud API</span>
            {activeSourceMode === 'API' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            ) : hasCloudData ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Cloud data synced"></span>
            ) : null}
          </button>
        </div>

        {/* Unified Date Range Selector in Header (cross-tab unified filtering) */}
        {activeDateScope && onDateScopeChange && (
          <DateRangeSelector
            activeScope={activeDateScope}
            customRange={customDateRange}
            onScopeChange={onDateScopeChange}
            counts={dateScopeCounts}
            subLabel={dateScopeSubLabel}
            minDateIso={minDateIso}
            maxDateIso={maxDateIso}
            fileWeeks={fileWeeks}
            onOpenComparison={onOpenComparison}
            align="right"
            className="hidden md:block"
          />
        )}

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block"></div>

        {/* Reset Baseline Action */}
        {onResetBaseline && (
          <button
            type="button"
            onClick={onResetBaseline}
            className="p-2.5 sm:px-3 sm:py-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 text-primary dark:text-orange-400 border border-orange-200/80 dark:border-orange-800/60 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            title="Reload verified 1,026 clean orders September baseline"
            aria-label="Reload verified baseline dataset"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">Reset Baseline</span>
          </button>
        )}

        {/* Export Excel Button */}
        <button
          type="button"
          onClick={onExport}
          disabled={!hasData}
          className="p-2.5 sm:px-3.5 sm:py-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-headline text-xs font-bold shadow-sm shadow-primary/20 transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          title="Export Reconciled Dataset to Excel (.xlsx)"
          aria-label="Export Reconciled Dataset to Excel (.xlsx)"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Export .XLSX</span>
          <span className="sm:hidden">Export</span>
        </button>

        {/* Quick Light/Dark Theme Toggle Button */}
        <button
          type="button"
          onClick={handleThemeToggle}
          className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0D0D0D] dark:hover:bg-[#161616] text-slate-600 dark:text-amber-400 hover:text-navy-deep dark:hover:text-amber-300 border border-slate-200 dark:border-[#1F1F1F] transition-all shadow-2xs active:scale-95 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black group"
          title={activeDarkMode ? 'Switch to light mode (Current: Dark)' : 'Switch to dark mode (Current: Light)'}
          aria-label={activeDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={activeDarkMode}
        >
          {activeDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform shrink-0" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:-rotate-12 transition-transform shrink-0" />
          )}
        </button>
      </div>
    </header>
  );
}
