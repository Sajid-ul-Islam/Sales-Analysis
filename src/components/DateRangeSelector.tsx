"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  X,
  Check,
  RotateCcw,
  RefreshCw,
  Scale
} from 'lucide-react';
import {
  DateScope,
  DateScopeCounts,
  CustomDateRange,
  FileWeek,
  AvailableMonth,
  DateScopeBoundaries,
  getDateScopeBoundaries
} from '@/lib/dateFilter';

export interface DateRangeSelectorProps {
  activeScope: DateScope;
  customRange?: CustomDateRange;
  onScopeChange: (scope: DateScope, customRange?: CustomDateRange) => void;
  counts?: DateScopeCounts;
  subLabel?: string;
  minDateIso?: string;
  maxDateIso?: string;
  fileWeeks?: FileWeek[];
  availableMonths?: AvailableMonth[];
  onOpenComparison?: (mode?: 'week' | 'month') => void;
  onSyncWooCommerce?: (boundaries: DateScopeBoundaries) => void;
  isSyncing?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

export const PRESET_OPTIONS: { id: DateScope; label: string; shortLabel: string; isDefault?: boolean }[] = [
  { id: 'today', label: 'Today', shortLabel: 'Today' },
  { id: '7d', label: 'Last 7 Days', shortLabel: '7D' },
  { id: 'month', label: 'This Month', shortLabel: 'MTD' },
  { id: '30d', label: 'Last 30 Days', shortLabel: '30D', isDefault: true },
  { id: '90d', label: 'Last 90 Days', shortLabel: '90D' },
  { id: 'all', label: 'All Records', shortLabel: 'All' },
  { id: 'custom', label: 'Custom Range', shortLabel: 'Custom' },
];

export function DateRangeSelector({
  activeScope,
  customRange,
  onScopeChange,
  counts,
  subLabel,
  minDateIso,
  maxDateIso,
  fileWeeks: _fileWeeks,
  availableMonths: _availableMonths,
  onOpenComparison,
  onSyncWooCommerce,
  isSyncing = false,
  align = 'right',
  className = '',
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state for custom range inputs
  const defaultBounds = useMemo(() => getDateScopeBoundaries(activeScope, customRange), [activeScope, customRange]);
  const [startInput, setStartInput] = useState(customRange?.startDate || defaultBounds.startDate || minDateIso || '');
  const [endInput, setEndInput] = useState(customRange?.endDate || defaultBounds.endDate || maxDateIso || '');
  const [customError, setCustomError] = useState<string | null>(null);

  // Sync inputs when customRange or scope changes
  useEffect(() => {
    if (customRange?.startDate && customRange?.endDate) {
      setStartInput(customRange.startDate);
      setEndInput(customRange.endDate);
    } else {
      const b = getDateScopeBoundaries(activeScope, customRange);
      if (b.startDate) setStartInput(b.startDate);
      if (b.endDate) setEndInput(b.endDate);
    }
  }, [customRange, activeScope]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const activeLabel = useMemo(() => {
    if (activeScope === 'custom') {
      if (customRange?.label) return customRange.label;
      return customRange?.startDate && customRange?.endDate
        ? `${customRange.startDate} → ${customRange.endDate}`
        : 'Custom Range';
    }
    const found = PRESET_OPTIONS.find((p) => p.id === activeScope);
    return found ? found.label : 'Date Range';
  }, [activeScope, customRange]);

  const activeCount = counts && activeScope in counts ? counts[activeScope as keyof DateScopeCounts] : undefined;

  const handleSelectPreset = (presetId: DateScope) => {
    if (presetId === 'custom') {
      // Just focus on custom form inputs without closing
      return;
    }
    onScopeChange(presetId);
    setIsOpen(false);
    setCustomError(null);
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCustomError(null);

    if (!startInput || !endInput) {
      setCustomError('Select both start and end dates.');
      return;
    }

    if (startInput > endInput) {
      setCustomError('Start date must be before or equal to end date.');
      return;
    }

    onScopeChange('custom', { startDate: startInput, endDate: endInput });
    setIsOpen(false);
  };

  const handleResetToDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    onScopeChange('30d');
    setCustomError(null);
  };

  const handleQuickChip = (daysAgo: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (daysAgo - 1) * 86400000);
    const toIso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    setStartInput(toIso(start));
    setEndInput(toIso(end));
    setCustomError(null);
  };

  const handleSetCurrentMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toIso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    setStartInput(toIso(start));
    setEndInput(toIso(end));
    setCustomError(null);
  };

  const isNonDefault = activeScope !== '30d' || Boolean(customRange);

  // Computed days in current input range
  const daysInCustomRange = useMemo(() => {
    if (!startInput || !endInput) return 0;
    const s = new Date(startInput).getTime();
    const e = new Date(endInput).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    return Math.round((e - s) / 86400000) + 1;
  }, [startInput, endInput]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* ── Industry Standard Trigger Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Filter date range and sync live data"
        className={`relative inline-flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-all shadow-2xs border cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black ${
          isNonDefault
            ? 'bg-orange-50/90 text-slate-900 border-primary/40 ring-1 ring-primary/20 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800'
            : 'bg-white dark:bg-[#0A0A0A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1F1F1F] hover:bg-slate-50 dark:hover:bg-[#141414] hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${isNonDefault ? 'text-primary' : 'text-slate-400'}`} />
          <span className="font-bold truncate max-w-[150px] sm:max-w-[210px]">
            {activeLabel}
          </span>
          {activeCount !== undefined && (
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                isNonDefault
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-[#222222]'
              }`}
            >
              {activeCount.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {isNonDefault ? (
            <span
              onClick={handleResetToDefault}
              className="p-0.5 rounded-md hover:bg-orange-200/60 dark:hover:bg-orange-900/60 text-slate-400 hover:text-rose-600 transition-colors"
              title="Reset date filter to default (Last 30 Days)"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          ) : (
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-primary' : ''
              }`}
            />
          )}
        </div>
      </button>

      {/* ── Industry Standard 2-Pane Popover ── */}
      {isOpen && (
        <div
          className={`fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto ${
            align === 'right' ? 'sm:right-0' : 'sm:left-0'
          } mt-2 w-auto sm:w-[500px] max-w-[calc(100vw-16px)] bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-[#121212] border-b border-slate-100 dark:border-[#1A1A1A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-headline">Date Range Scope</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {subLabel || 'Standard synchronized time window'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isNonDefault && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] font-bold text-primary hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Reset to 30 Days"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset (30D)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2-Pane Content Area */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#1A1A1A] max-h-[500px] overflow-y-auto">
            {/* Left Pane: Standard Presets List */}
            <div className="w-full sm:w-[190px] p-2 space-y-1 shrink-0 bg-slate-50/40 dark:bg-black/40">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1 select-none">
                Presets
              </div>
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = activeScope === opt.id && (!customRange || opt.id === 'custom');
                const count = counts ? counts[opt.id as keyof DateScopeCounts] : undefined;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white font-bold shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161616] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-white shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{opt.label}</span>
                      {opt.isDefault && (
                        <span
                          className={`text-[8px] font-bold px-1 rounded uppercase ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-orange-100 dark:bg-orange-950 text-primary'
                          }`}
                        >
                          Def
                        </span>
                      )}
                    </div>

                    {count !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-1 rounded shrink-0 ${
                          isSelected ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Direct WooCommerce Sync for Active Preset */}
              {onSyncWooCommerce && activeScope !== 'custom' && (
                <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-[#1F1F1F]">
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => {
                      const boundaries = getDateScopeBoundaries(activeScope, customRange);
                      onSyncWooCommerce(boundaries);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition-all cursor-pointer disabled:opacity-50"
                    title={`Directly pull WooCommerce orders for ${activeLabel}`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="truncate">Sync WooCommerce</span>
                  </button>
                </div>
              )}

              {/* Compare Periods Button (if enabled) */}
              {onOpenComparison && (
                <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-[#1F1F1F]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenComparison('week');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#161616] border border-slate-200/80 dark:border-[#262626] transition-colors cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5 text-primary" />
                    <span>Compare Periods</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Pane: Custom Date Form & Quick Chips */}
            <div className="flex-1 p-3.5 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Custom Date Bounds
                  </span>
                  {daysInCustomRange > 0 && (
                    <span className="text-[10px] font-mono text-primary font-bold">
                      {daysInCustomRange} day{daysInCustomRange === 1 ? '' : 's'} selected
                    </span>
                  )}
                </div>

                {/* Quick Fill Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleQuickChip(7)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/60 dark:border-[#2A2A2A]"
                  >
                    Last 7D
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickChip(14)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/60 dark:border-[#2A2A2A]"
                  >
                    Last 14D
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickChip(30)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/60 dark:border-[#2A2A2A]"
                  >
                    Last 30D
                  </button>
                  <button
                    type="button"
                    onClick={handleSetCurrentMonth}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/60 dark:border-[#2A2A2A]"
                  >
                    This Month
                  </button>
                </div>

                {/* Form Inputs: Start Date & End Date */}
                <form onSubmit={handleApplyCustom} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startInput}
                        min={minDateIso}
                        max={endInput || undefined}
                        onChange={(e) => setStartInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#262626] text-xs text-slate-900 dark:text-white bg-white dark:bg-[#121212] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endInput}
                        min={startInput || minDateIso}
                        onChange={(e) => setEndInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#262626] text-xs text-slate-900 dark:text-white bg-white dark:bg-[#121212] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  {customError && (
                    <div className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
                      {customError}
                    </div>
                  )}
                </form>
              </div>

              {/* Action Buttons: Cancel, Apply, and Optional WooCommerce Sync */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#1A1A1A] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setCustomError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161616] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCustom()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Range</span>
                  </button>
                </div>

                {/* Direct WooCommerce Sync Button */}
                {onSyncWooCommerce && (
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => {
                      if (!startInput || !endInput) {
                        setCustomError('Select both start and end dates.');
                        return;
                      }
                      if (startInput > endInput) {
                        setCustomError('Start date must be before or equal to end date.');
                        return;
                      }
                      const boundaries = getDateScopeBoundaries('custom', {
                        startDate: startInput,
                        endDate: endInput,
                      });
                      onScopeChange('custom', { startDate: startInput, endDate: endInput });
                      onSyncWooCommerce(boundaries);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition-all cursor-pointer disabled:opacity-50"
                    title="Directly query and sync WooCommerce orders for this exact date window"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync WooCommerce ({startInput || 'Start'} → {endInput || 'End'})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
