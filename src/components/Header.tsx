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
  isSyncing?: boolean;
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
  onToggleTheme,
  isSyncing = false
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
    <header className="sticky top-0 h-16 border-b border-slate-200 dark:border-[#1F1F1F] bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md flex items-center justify-between px-2 sm:px-6 shrink-0 z-20 shadow-xs transition-colors duration-200">
      {/* Search Input Bar with Mobile Menu Toggle & ⌘K shortcut */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 sm:mr-4">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
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
        <div className="relative w-full max-w-[120px] xs:max-w-[160px] sm:max-w-xs md:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search..."
            aria-label="Search orders, SKUs, customer phones"
            className="w-full min-w-[44px] pl-9 pr-3 sm:pr-10 py-2 sm:py-2.5 min-h-[44px] bg-slate-100/70 hover:bg-slate-100 focus:bg-white dark:bg-[#0D0D0D] dark:hover:bg-[#141414] dark:focus:bg-[#000000] text-xs border border-transparent hover:border-slate-200 dark:hover:border-[#222222] focus:border-slate-300 dark:focus:border-[#333333] rounded-xl placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all text-slate-800 dark:text-slate-100"
          />
          <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] rounded shadow-2xs pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Header Tools & Indicators (Clean Native Icons, No Boxed Buttons) */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Data Source Switcher: Clean Native Icons */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onSwitchSourceMode?.('UPLOAD')}
            className={`relative inline-flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
              activeSourceMode === 'UPLOAD'
                ? 'text-[#EB5A19]'
                : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
            title="Render from uploaded spreadsheets & offline manifests (.xlsx / .csv)"
            aria-label="Switch data source to uploaded spreadsheets"
            aria-pressed={activeSourceMode === 'UPLOAD'}
          >
            <FileSpreadsheet className="w-5 h-5 shrink-0" />
            {activeSourceMode === 'UPLOAD' && (
              <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[#EB5A19]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSwitchSourceMode?.('API')}
            className={`relative inline-flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer ${
              activeSourceMode === 'API'
                ? 'text-emerald-500'
                : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
            title="Render from live WooCommerce & Pathao Hermes API"
            aria-label="Switch data source to Cloud API"
            aria-pressed={activeSourceMode === 'API'}
          >
            <Cloud className={`w-5 h-5 shrink-0 ${activeSourceMode === 'API' && isSyncing ? 'animate-pulse' : ''}`} />
            {activeSourceMode === 'API' ? (
              <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            ) : hasCloudData ? (
              <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-emerald-400/60" title="Cloud data synced" />
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
          />
        )}

        <div className="h-5 w-px bg-slate-200 dark:bg-[#1F1F1F] mx-0.5 hidden sm:block" />

        {/* Reset Baseline Action (Clean Native Icon) */}
        {onResetBaseline && (
          <button
            type="button"
            onClick={onResetBaseline}
            className="inline-flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:text-[#EB5A19] dark:text-slate-500 dark:hover:text-[#EB5A19] hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            title="Reload verified 1,026 clean orders September baseline"
            aria-label="Reload verified baseline dataset"
          >
            <RefreshCw className="w-5 h-5 shrink-0" />
          </button>
        )}

        {/* Export Excel Action (Clean Native Icon) */}
        <button
          type="button"
          onClick={onExport}
          disabled={!hasData}
          className="inline-flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          title="Export Reconciled Dataset to Excel (.xlsx)"
          aria-label="Export Reconciled Dataset to Excel (.xlsx)"
        >
          <Download className="w-5 h-5 shrink-0" />
        </button>

        {/* Quick Light/Dark Theme Toggle Action (Clean Native Icon) */}
        <button
          type="button"
          onClick={handleThemeToggle}
          className="inline-flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group cursor-pointer"
          title={activeDarkMode ? 'Switch to light mode (Current: Dark)' : 'Switch to dark mode (Current: Light)'}
          aria-label={activeDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={activeDarkMode}
        >
          {activeDarkMode ? (
            <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform shrink-0" />
          ) : (
            <Moon className="w-5 h-5 text-slate-400 group-hover:-rotate-12 transition-transform shrink-0" />
          )}
        </button>
      </div>
    </header>
  );
}
