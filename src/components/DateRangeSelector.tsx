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
import { DateScope, DateScopeCounts, CustomDateRange, FileWeek, AvailableMonth } from '@/lib/dateFilter';

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
  align?: 'left' | 'right';
  className?: string;
}

export const PRESET_OPTIONS: { id: DateScope; label: string; description: string; isDefault?: boolean }[] = [
  { id: '30d', label: 'Last 30 Days', description: 'Past 30 rolling days (Recommended)', isDefault: true },
  { id: 'month', label: 'This Month', description: 'Dominant calendar month' },
  { id: '7d', label: 'Last 7 Days', description: 'Past 7 rolling days' },
  { id: 'today', label: 'Today', description: 'Latest active live day' },
  { id: '90d', label: 'Last 90 Days', description: 'Past quarterly view' },
  { id: 'all', label: 'All Records', description: 'Full historical dataset archive' },
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
  availableMonths,
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
    if (customRange?.startDate) {
      setStartInput(customRange.startDate);
    } else if (minDateIso) {
      setStartInput(prev => prev || minDateIso);
    }

    if (customRange?.endDate) {
      setEndInput(customRange.endDate);
    } else if (maxDateIso) {
      setEndInput(prev => prev || maxDateIso);
    }
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

  const handleResetToDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    onScopeChange('30d');
    setCustomError(null);
  };

  const isNonDefault = activeScope !== '30d';

  // Quick preset shortcuts for custom picker
  const handleQuickCustomPreset = (daysBack: number) => {
    const end = maxDateIso ? new Date(`${maxDateIso}T23:59:59`) : new Date();
    const start = new Date(end.getTime() - (daysBack - 1) * 86400000);
    const toIso = (d: Date) => d.toISOString().split('T')[0];
    setStartInput(toIso(start));
    setEndInput(toIso(end));
    setCustomError(null);
  };

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
          isNonDefault
            ? 'bg-orange-50/90 text-slate-900 border-primary/40 ring-1 ring-primary/20 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800'
            : 'bg-white dark:bg-[#000000] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1F1F1F] hover:bg-slate-50/80 dark:hover:bg-white/10 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar
            className={`w-5 h-5 sm:w-3.5 sm:h-3.5 shrink-0 ${isNonDefault ? 'text-primary' : 'text-slate-400'}`}
          />
          <span className="hidden sm:inline font-bold truncate max-w-[140px] md:max-w-[200px]">
            {activeLabel}
          </span>
          {activeCount !== undefined && (
            <span
              className={`hidden sm:inline px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                isNonDefault
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-[#222222]'
              }`}
            >
              {activeCount.toLocaleString()}
            </span>
          )}
        </div>

        {/* Mobile Filter Indicator Dot */}
        {isNonDefault && (
          <span className="sm:hidden absolute bottom-1.5 w-1 h-1 rounded-full bg-[#EB5A19]" />
        )}

        {/* Clear filter icon if non-default on desktop */}
        {isNonDefault ? (
          <span
            onClick={handleResetToDefault}
            className="hidden sm:inline p-0.5 rounded-md hover:bg-orange-200/60 dark:hover:bg-orange-900/60 text-slate-400 hover:text-rose-600 transition-colors"
            title="Reset date filter to default (Last 30 Days)"
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
          } mt-2 w-auto sm:w-[420px] max-w-[calc(100vw-16px)] bg-white dark:bg-[#000000] rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/90 dark:bg-[#0C0C0C] border-b border-slate-100 dark:border-[#1A1A1A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100/80 dark:bg-orange-950/60 text-primary flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white font-headline">Date Scope Filter</h4>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Smart
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {subLabel ? subLabel : 'Default shows last 30 rolling days for optimal performance'}
                </p>
              </div>
            </div>

            {isNonDefault ? (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[11px] font-bold text-primary hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset to recommended default (Last 30 Days)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset (30D)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
                title="View full historical dataset"
              >
                All Time
              </button>
            )}
          </div>

          <div className="p-3 space-y-3.5 max-h-[520px] overflow-y-auto">
            {/* 1. Quick Segmented Pill Row for Instant 1-Click Switching */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
                <span>Quick Range Switch</span>
                <span className="text-[9px] text-slate-400 font-normal">Instant 60fps filter</span>
              </div>
              <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-[#111111] rounded-xl border border-slate-200/80 dark:border-[#222222]">
                {[
                  { id: '30d' as DateScope, label: '30D', hint: 'Default' },
                  { id: 'month' as DateScope, label: availableMonths && availableMonths[0] ? availableMonths[0].shortLabel.split(' ')[0] : 'Month', hint: 'MTD' },
                  { id: '7d' as DateScope, label: '7D', hint: 'Week' },
                  { id: 'today' as DateScope, label: 'Today', hint: 'Live' },
                  { id: 'all' as DateScope, label: 'All', hint: 'Archive' },
                ].map((pill) => {
                  const isSelected = activeScope === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => handleSelectPreset(pill.id)}
                      className={`py-1.5 px-1 text-center rounded-lg transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-[#222222] text-primary shadow-xs font-bold ring-1 ring-primary/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium hover:bg-white/50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs leading-none">{pill.label}</div>
                      <div className={`text-[8px] mt-0.5 leading-none ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                        {pill.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Detailed Standard Presets */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
                <span>Standard Periods</span>
                <span className="text-[9px] text-slate-400 font-normal">Bounded query scopes</span>
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
                          ? 'bg-orange-50 dark:bg-orange-950/40 border-primary/40 text-slate-900 dark:text-white shadow-2xs ring-1 ring-primary/20'
                          : 'bg-white dark:bg-[#0D0D0D] border-slate-200/80 dark:border-[#1F1F1F] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1.5">
                          {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                          <span
                            className={`text-xs truncate ${
                              isSelected ? 'font-bold text-primary' : 'font-semibold text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {opt.label}
                          </span>
                          {opt.isDefault && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-orange-100 dark:bg-orange-950 text-primary uppercase">
                              Def
                            </span>
                          )}
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
                              : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 font-medium'
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

            {/* 3. Calendar Months (Dedicated 1-Click Month Selector for October, September, etc.) */}
            {availableMonths && availableMonths.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Calendar Months
                  </span>
                  {onOpenComparison && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenComparison('month');
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Open Month-over-Month Comparator (MoM Analysis)"
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Compare Months</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {availableMonths.map((m) => {
                    const isMonthSelected =
                      (activeScope === 'month' && m.isCurrentMonth) ||
                      (activeScope === 'custom' &&
                        (customRange?.label === m.label ||
                          (customRange?.startDate === m.startDate && customRange?.endDate === m.endDate)));
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onScopeChange('custom', {
                            startDate: m.startDate,
                            endDate: m.endDate,
                            label: m.label,
                          });
                          setIsOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                          isMonthSelected
                            ? 'bg-orange-50 dark:bg-orange-950/40 border-primary/40 text-slate-900 dark:text-white shadow-2xs ring-1 ring-primary/20'
                            : 'bg-white dark:bg-[#0D0D0D] border-slate-200/80 dark:border-[#1F1F1F] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            {isMonthSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                            <span
                              className={`text-xs truncate ${
                                isMonthSelected ? 'font-bold text-primary' : 'font-semibold text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {m.label}
                            </span>
                            {m.isCurrentMonth && (
                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 uppercase shrink-0">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                            {m.startDate} → {m.endDate}
                          </span>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono shrink-0 ${
                            isMonthSelected
                              ? 'bg-primary text-white font-bold'
                              : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 font-medium'
                          }`}
                        >
                          {m.orderCount.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Dynamic File Weeks (Detected from Uploaded File) */}
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
                        onOpenComparison('week');
                      }}
                      className="text-[10px] font-bold text-primary hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Open Week-over-Week Comparator (WoW Analysis)"
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
                            ? 'bg-orange-50 dark:bg-orange-950/40 border-primary/40 text-slate-900 dark:text-white shadow-2xs ring-1 ring-primary/20'
                            : 'bg-white dark:bg-[#0D0D0D] border-slate-200/80 dark:border-[#1F1F1F] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            {isWeekSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                            <span
                              className={`text-xs truncate ${
                                isWeekSelected ? 'font-bold text-primary' : 'font-semibold text-slate-800 dark:text-slate-200'
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
                              : 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 font-medium'
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

            {/* 4. Custom Date Range Picker */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#1A1A1A]">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Custom Calendar Range
                </span>
                {minDateIso && maxDateIso && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Data: {minDateIso} → {maxDateIso}
                  </span>
                )}
              </div>

              {/* Quick shortcut helper pills */}
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <button
                  type="button"
                  onClick={() => handleQuickCustomPreset(14)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Last 14 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCustomPreset(60)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Last 60 Days
                </button>
              </div>

              <form onSubmit={handleApplyCustom} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startInput}
                      min={minDateIso}
                      max={endInput || undefined}
                      onChange={(e) => setStartInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#222222] text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-[#111111] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endInput}
                      min={startInput || minDateIso}
                      onChange={(e) => setEndInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#222222] text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-[#111111] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                    />
                  </div>
                </div>

                {customError && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[11px] font-medium">
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
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
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

            {/* 5. Comparative Performance Analytics (WoW & MoM) */}
            {onOpenComparison && (
              <div className="pt-2 border-t border-slate-100 dark:border-[#1A1A1A] space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Comparative Analytics</span>
                  <span className="text-[9px] text-primary lowercase font-medium">multi-period</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenComparison('week');
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                    title="Compare any two weeks (WoW Analysis)"
                  >
                    <Scale className="w-3.5 h-3.5 text-orange-400" />
                    <span>Week vs Week</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenComparison('month');
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                    title="Compare any two months (MoM Analysis, e.g. Oct vs Sep)"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Month vs Month</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
