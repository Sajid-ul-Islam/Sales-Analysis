"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  X,
  Check,
  RotateCcw,
  Clock,
  Scale
} from 'lucide-react';
import { DateScope, DateScopeCounts, CustomDateRange, FileWeek } from '@/lib/dateFilter';

export interface DateRangeSelectorProps {
  activeScope: DateScope;
  customRange?: CustomDateRange;
  onScopeChange: (scope: DateScope, customRange?: CustomDateRange) => void;
  counts?: DateScopeCounts;
  subLabel?: string;
  minDateIso?: string;
  maxDateIso?: string;
  fileWeeks?: FileWeek[];
  onOpenComparison?: () => void;
  align?: 'left' | 'right';
  className?: string;
}

const PRESET_OPTIONS: { id: DateScope; label: string; description: string }[] = [
  { id: 'all', label: 'All Records', description: 'Full dataset period (Default)' },
  { id: '30d', label: 'Last 30 Days', description: 'Past 30 rolling days' },
  { id: 'today', label: 'Today', description: 'Latest active day' },
  { id: '7d', label: 'Last 7 Days', description: 'Past 7 rolling days' },
  { id: 'month', label: 'This Month', description: 'Dominant calendar month' },
  { id: '90d', label: 'Last 90 Days', description: 'Past quarter' },
];

export function DateRangeSelector({
  activeScope,
  customRange,
  onScopeChange,
  counts,
  subLabel,
  minDateIso,
  maxDateIso,
  fileWeeks,
  onOpenComparison,
  align = 'right',
  className = '',
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state for custom range inputs
  const [startInput, setStartInput] = useState(customRange?.startDate || minDateIso || '');
  const [endInput, setEndInput] = useState(customRange?.endDate || maxDateIso || '');
  const [customError, setCustomError] = useState<string | null>(null);

  // Sync inputs when customRange or min/max changes
  useEffect(() => {
    if (customRange?.startDate) setStartInput(customRange.startDate);
    else if (minDateIso && !startInput) setStartInput(minDateIso);

    if (customRange?.endDate) setEndInput(customRange.endDate);
    else if (maxDateIso && !endInput) setEndInput(maxDateIso);
  }, [customRange, minDateIso, maxDateIso]);

  // Click outside to close popover
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

  const activeLabel = React.useMemo(() => {
    if (activeScope === 'custom') {
      if (customRange?.label) {
        return `${customRange.label}`;
      }
      return customRange ? `Custom: ${customRange.startDate} – ${customRange.endDate}` : 'Custom Range';
    }
    const found = PRESET_OPTIONS.find((p) => p.id === activeScope);
    return found ? found.label : 'Date Range';
  }, [activeScope, customRange]);

  const activeCount = counts && activeScope in counts ? counts[activeScope as keyof DateScopeCounts] : undefined;

  const handleSelectPreset = (presetId: DateScope) => {
    onScopeChange(presetId);
    setIsOpen(false);
    setCustomError(null);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);

    if (!startInput || !endInput) {
      setCustomError('Please select both start and end dates.');
      return;
    }

    if (startInput > endInput) {
      setCustomError('Start date must be before or equal to end date.');
      return;
    }

    onScopeChange('custom', { startDate: startInput, endDate: endInput });
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onScopeChange('all');
    setCustomError(null);
  };

  const isFiltered = activeScope !== 'all';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button: Adaptive - Clean Native Icon on mobile, Full Executive Badge on Desktop */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Filter by date range or select dynamic weeks"
        className={`relative inline-flex items-center justify-center p-2.5 sm:px-3 sm:py-2 sm:gap-2 min-w-[44px] min-h-[44px] rounded-xl text-xs font-semibold transition-all shadow-2xs border cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
          isFiltered
            ? 'bg-orange-50/90 text-slate-900 border-primary/30 ring-1 ring-primary/20 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800'
            : 'bg-white dark:bg-[#000000] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1F1F1F] hover:bg-slate-50/80 dark:hover:bg-white/10 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar
            className={`w-5 h-5 sm:w-3.5 sm:h-3.5 shrink-0 ${isFiltered ? 'text-primary' : 'text-slate-400'}`}
          />
          <span className="hidden sm:inline font-bold truncate max-w-[140px] md:max-w-[200px]">
            {activeLabel}
          </span>
          {activeCount !== undefined && (
            <span
              className={`hidden sm:inline px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                isFiltered
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-[#222222]'
              }`}
            >
              {activeCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Mobile Filter Indicator Dot */}
        {isFiltered && (
          <span className="sm:hidden absolute bottom-1.5 w-1 h-1 rounded-full bg-[#EB5A19]" />
        )}

        {/* Clear filter icon if active on desktop */}
        {isFiltered ? (
          <span
            onClick={handleClear}
            className="hidden sm:inline p-0.5 rounded-md hover:bg-orange-200/60 dark:hover:bg-orange-900/60 text-slate-400 hover:text-rose-600 transition-colors"
            title="Clear date filter (Reset to All Records)"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronDown
            className={`hidden sm:inline w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        )}
      </button>

      {/* Popover Menu: Full Screen / Centered on Mobile, Anchored on Desktop */}
      {isOpen && (
        <div
          className={`fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto ${
            align === 'right' ? 'sm:right-0' : 'sm:left-0'
          } mt-2 w-auto sm:w-[400px] max-w-[calc(100vw-16px)] bg-white dark:bg-[#000000] rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100/80 text-primary flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 font-headline">Date Scope Filter</h4>
                <p className="text-[10px] text-slate-500">
                  {subLabel ? subLabel : 'Default shows all records in uploaded file'}
                </p>
              </div>
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-bold text-primary hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to All</span>
              </button>
            )}
          </div>

          <div className="p-3 space-y-3.5 max-h-[500px] overflow-y-auto">
            {/* 1. Dynamic File Weeks (Detected from Uploaded File) */}
            {fileWeeks && fileWeeks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Dynamic File Weeks
                  </span>
                  {onOpenComparison && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenComparison();
                      }}
                      className="text-[10px] font-bold text-primary hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Open Week-over-Week Comparator"
                    >
                      <Scale className="w-3 h-3" />
                      <span>Compare Weeks</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {fileWeeks.map((w) => {
                    const isWeekSelected =
                      activeScope === 'custom' &&
                      (customRange?.label === w.label ||
                        (customRange?.startDate === w.startDate && customRange?.endDate === w.endDate));
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          onScopeChange('custom', {
                            startDate: w.startDate,
                            endDate: w.endDate,
                            label: w.label,
                          });
                          setIsOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                          isWeekSelected
                            ? 'bg-orange-50 border-primary/40 text-slate-900 shadow-2xs ring-1 ring-primary/20'
                            : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            {isWeekSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                            <span
                              className={`text-xs truncate ${
                                isWeekSelected ? 'font-bold text-primary' : 'font-semibold text-slate-800'
                              }`}
                            >
                              {w.label}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                            {w.dateRangeLabel}
                          </span>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono shrink-0 ${
                            isWeekSelected
                              ? 'bg-primary text-white font-bold'
                              : 'bg-slate-100 text-slate-600 font-medium'
                          }`}
                        >
                          {w.orderCount.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Quick Standard Presets */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                Standard Presets
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_OPTIONS.map((opt) => {
                  const isSelected = activeScope === opt.id;
                  const count = counts ? counts[opt.id as keyof DateScopeCounts] : undefined;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectPreset(opt.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-orange-50 border-primary/40 text-slate-900 shadow-2xs ring-1 ring-primary/20'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1.5">
                          {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                          <span
                            className={`text-xs truncate ${
                              isSelected ? 'font-bold text-primary' : 'font-semibold text-slate-800'
                            }`}
                          >
                            {opt.label}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                          {opt.description}
                        </span>
                      </div>

                      {count !== undefined && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono shrink-0 ${
                            isSelected
                              ? 'bg-primary text-white font-bold'
                              : 'bg-slate-100 text-slate-600 font-medium'
                          }`}
                        >
                          {count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Custom Date Range Picker */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Custom Date Range
                </span>
                {minDateIso && maxDateIso && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    File: {minDateIso} → {maxDateIso}
                  </span>
                )}
              </div>

              <form onSubmit={handleApplyCustom} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startInput}
                      min={minDateIso}
                      max={maxDateIso || endInput}
                      onChange={(e) => setStartInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endInput}
                      min={startInput || minDateIso}
                      max={maxDateIso}
                      onChange={(e) => setEndInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                    />
                  </div>
                </div>

                {customError && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-medium">
                    {customError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setCustomError(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-orange-600 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Custom Range</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 4. Compare Between Weeks Button in Popover */}
            {onOpenComparison && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenComparison();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Scale className="w-4 h-4 text-orange-400" />
                  <span>Compare Between Weeks (WoW Analysis)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
