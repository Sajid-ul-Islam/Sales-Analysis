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
  Moon,
  MoreVertical,
  Bell,
  Command
} from 'lucide-react';
import { DateScope, DateScopeCounts, CustomDateRange, FileWeek } from '@/lib/dateFilter';
import { loadSavedThemeSettings, saveThemeSettings, BackgroundStyleId } from '@/lib/themeManager';

export interface HeaderProps {
  onExport: () => void;
  hasData: boolean;
  onResetBaseline?: () => void;
  dataSourceName?: string;
  onSearch?: (term: string) => void;
  onOpenCommandPalette?: () => void;
  onOpenNotificationCenter?: () => void;
  notificationCount?: number;
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
  dataSourceName: _dataSourceName,
  onSearch,
  onOpenCommandPalette,
  onOpenNotificationCenter,
  notificationCount = 0,
  activeSourceMode = 'UPLOAD',
  onSwitchSourceMode,
  hasCloudData = false,
  onOpenSettings: _onOpenSettings,
  onToggleCopilot: _onToggleCopilot,
  activeDateScope: _activeDateScope,
  customDateRange: _customDateRange,
  onDateScopeChange: _onDateScopeChange,
  dateScopeCounts: _dateScopeCounts,
  dateScopeSubLabel: _dateScopeSubLabel,
  minDateIso: _minDateIso,
  maxDateIso: _maxDateIso,
  fileWeeks: _fileWeeks,
  onOpenComparison: _onOpenComparison,
  onToggleMobileMenu,
  mobileOpen,
  isDarkMode: propIsDarkMode,
  onToggleTheme,
  isSyncing = false
}: HeaderProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Self-contained dark mode fallback state if prop is not supplied
  const [internalDarkMode, setInternalDarkMode] = useState(false);
  const activeDarkMode = propIsDarkMode !== undefined ? propIsDarkMode : internalDarkMode;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = loadSavedThemeSettings();
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark-canvas') ||
        saved.darkModeCanvas ||
        saved.backgroundId === 'dark-canvas';
      setInternalDarkMode(isDark);
    }
  }, []);

  // Close more menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [moreMenuOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    if (onSearch) {
      onSearch('');
    }
    searchRef.current?.focus();
  };

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        } else {
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenCommandPalette]);

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
    <header className="sticky top-0 h-16 border-b border-slate-200 dark:border-deepBlack-border bg-white/95 dark:bg-deepBlack-canvas/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 shadow-xs transition-colors duration-200">
      {/* Search Input Bar with Mobile Menu Toggle & ⌘K shortcut */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2 sm:mr-4">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all shrink-0 inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
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
        <div className="relative flex-1 min-w-0 max-w-xs md:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={() => {
              if (onOpenCommandPalette && !searchTerm) {
                onOpenCommandPalette();
              }
            }}
            placeholder="Search or press ⌘K..."
            aria-label="Search orders, SKUs, customer phones"
            className="w-full min-w-0 pl-9 pr-8 sm:pr-14 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] bg-slate-100/70 hover:bg-slate-100 focus:bg-white dark:bg-deepBlack-sidebar dark:hover:bg-deepBlack-card dark:focus:bg-deepBlack-canvas text-xs border border-transparent hover:border-slate-200 dark:hover:border-deepBlack-border focus:border-slate-300 dark:focus:border-slate-700 rounded-xl placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all text-slate-800 dark:text-slate-100"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/90 dark:bg-deepBlack-hover border border-slate-200 dark:border-deepBlack-border hover:border-orange-300 dark:hover:border-orange-500/50 rounded shadow-2xs cursor-pointer transition-colors"
              title="Open Command Palette (⌘K)"
            >
              <Command className="w-2.5 h-2.5 text-primary-dark dark:text-orange-400" />
              <span>K</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Tools & Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Segmented Data Source Mode Switcher */}
        <div className="inline-flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-100/90 dark:bg-deepBlack-card border border-slate-200/80 dark:border-deepBlack-border shrink-0">
          <button
            type="button"
            onClick={() => onSwitchSourceMode?.('UPLOAD')}
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSourceMode === 'UPLOAD'
                ? 'bg-white dark:bg-deepBlack-hover text-primary-dark dark:text-orange-400 shadow-2xs font-bold'
                : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
            title="Render from uploaded spreadsheets & offline manifests (.xlsx / .csv)"
            aria-label="Switch data source to uploaded spreadsheets"
            aria-pressed={activeSourceMode === 'UPLOAD'}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline text-[11px]">Files</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchSourceMode?.('API')}
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSourceMode === 'API'
                ? 'bg-white dark:bg-deepBlack-hover text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
            title="Render from live WooCommerce & Pathao Hermes API"
            aria-label="Switch data source to Cloud API"
            aria-pressed={activeSourceMode === 'API'}
          >
            <Cloud className={`w-4 h-4 shrink-0 ${activeSourceMode === 'API' && isSyncing ? 'animate-pulse' : ''}`} />
            <span className="hidden xl:inline text-[11px]">API</span>
            {hasCloudData && activeSourceMode !== 'API' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Cloud data synced" />
            )}
          </button>
        </div>

        {/* Desktop & Tablet Actions Cluster (hidden on small mobile) */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <div className="h-5 w-px bg-slate-200 dark:bg-deepBlack-border mx-1" />

          {/* Reset Baseline Action */}
          {onResetBaseline && (
            <button
              type="button"
              onClick={onResetBaseline}
              className="inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-primary dark:text-slate-500 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              title="Reload verified master baseline ledger"
              aria-label="Reload verified baseline dataset"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
            </button>
          )}

          {/* Export Excel Action */}
          <button
            type="button"
            onClick={onExport}
            disabled={!hasData}
            className="inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            title="Export Reconciled Dataset to Excel (.xlsx)"
            aria-label="Export Reconciled Dataset to Excel (.xlsx)"
          >
            <Download className="w-4 h-4 shrink-0" />
          </button>

          {/* Real-Time Sync Notifications Trigger */}
          {onOpenNotificationCenter && (
            <button
              type="button"
              onClick={onOpenNotificationCenter}
              className="relative inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-primary dark:text-slate-400 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              title="View Real-Time Sync & Operations Notifications"
              aria-label="View Real-Time Sync Notifications"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {notificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-white dark:ring-deepBlack-canvas animate-pulse" />
              )}
            </button>
          )}

          {/* Quick Light/Dark Theme Toggle Action */}
          <button
            type="button"
            onClick={handleThemeToggle}
            className="inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group cursor-pointer"
            title={activeDarkMode ? 'Switch to light mode (Current: Dark)' : 'Switch to dark mode (Current: Light)'}
            aria-label={activeDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={activeDarkMode}
          >
            {activeDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-slate-400 group-hover:-rotate-12 transition-transform shrink-0" />
            )}
          </button>
        </div>

        {/* Mobile More Actions Menu (sm:hidden) */}
        <div className="relative sm:hidden" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setMoreMenuOpen(prev => !prev)}
            className="inline-flex items-center justify-center p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            aria-label="More header actions"
            aria-expanded={moreMenuOpen}
          >
            <MoreVertical className="w-5 h-5 shrink-0" />
          </button>

          {moreMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Actions
              </div>

              {/* Export Option */}
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  onExport();
                }}
                disabled={!hasData}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="flex-1 text-left">Export Reconciled (.xlsx)</span>
              </button>

              {/* Reload Baseline Option */}
              {onResetBaseline && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onResetBaseline();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-primary-dark dark:text-orange-400 shrink-0" />
                  <span className="flex-1 text-left">Reload Baseline (1,026)</span>
                </button>
              )}

              {/* Notifications Option */}
              {onOpenNotificationCenter && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onOpenNotificationCenter();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-primary-dark dark:text-orange-400 shrink-0" />
                    <span>Sync Notifications</span>
                  </div>
                  {notificationCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-primary text-white">
                      {notificationCount}
                    </span>
                  )}
                </button>
              )}

              <div className="h-px bg-slate-100 dark:border-deepBlack-border my-1" />

              {/* Theme Toggle Option */}
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  handleThemeToggle();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                {activeDarkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="flex-1 text-left">Switch to Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="flex-1 text-left">Switch to Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
