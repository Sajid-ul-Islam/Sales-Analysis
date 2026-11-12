"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
  RefreshCw,
  Scale,
  Sparkles
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const BASE_YEARS = [2024, 2025, 2026, 2027, 2028];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  if (!iso || !iso.includes('-')) return null;
  const parts = iso.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function formatDisplayDate(iso: string): string {
  const parsed = parseIso(iso);
  if (!parsed) return iso || '';
  const monthStr = MONTH_SHORT_NAMES[parsed.month] || '';
  return `${monthStr} ${parsed.day}, ${parsed.year}`;
}

function calculateDaysCount(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const s = new Date(`${startIso}T00:00:00`).getTime();
  const e = new Date(`${endIso}T00:00:00`).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

export function DateRangeSelector({
  activeScope,
  customRange,
  onScopeChange,
  counts,
  subLabel,
  minDateIso,
  maxDateIso,
  fileWeeks: _fileWeeks,
  availableMonths,
  onOpenComparison,
  onSyncWooCommerce,
  isSyncing = false,
  align = 'right',
  className = '',
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mobile sub-tab: 'presets' | 'calendar'
  const [mobileTab, setMobileTab] = useState<'presets' | 'calendar'>('calendar');

  // Local state for custom range inputs
  const defaultBounds = useMemo(() => getDateScopeBoundaries(activeScope, customRange), [activeScope, customRange]);
  const [startInput, setStartInput] = useState(customRange?.startDate || defaultBounds.startDate || minDateIso || '');
  const [endInput, setEndInput] = useState(customRange?.endDate || defaultBounds.endDate || maxDateIso || '');
  const [customError, setCustomError] = useState<string | null>(null);

  // Interactive Calendar Navigation state
  const initialAnchorIso = customRange?.startDate || defaultBounds.startDate || maxDateIso || '2026-10-15';
  const parsedInitial = useMemo(() => parseIso(initialAnchorIso) || { year: 2026, month: 9, day: 1 }, [initialAnchorIso]);
  
  const [viewYear, setViewYear] = useState<number>(parsedInitial.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedInitial.month); // 0-indexed: 9 = October
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);

  // Year select options ensuring viewYear is always included
  const yearOptions = useMemo(() => {
    const set = new Set(BASE_YEARS);
    set.add(viewYear);
    if (parsedInitial) set.add(parsedInitial.year);
    return Array.from(set).sort((a, b) => a - b);
  }, [viewYear, parsedInitial]);

  // Sync inputs when customRange or scope changes
  useEffect(() => {
    if (customRange?.startDate && customRange?.endDate) {
      setStartInput(customRange.startDate);
      setEndInput(customRange.endDate);
      const parsed = parseIso(customRange.startDate);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    } else {
      const b = getDateScopeBoundaries(activeScope, customRange);
      if (b.startDate) setStartInput(b.startDate);
      if (b.endDate) setEndInput(b.endDate);
      if (b.startDate) {
        const parsed = parseIso(b.startDate);
        if (parsed) {
          setViewYear(parsed.year);
          setViewMonth(parsed.month);
        }
      }
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

  // Active button label
  const activeLabel = useMemo(() => {
    if (activeScope === 'custom') {
      if (customRange?.label) return customRange.label;
      return customRange?.startDate && customRange?.endDate
        ? `${formatDisplayDate(customRange.startDate)} → ${formatDisplayDate(customRange.endDate)}`
        : 'Custom Range';
    }
    const found = PRESET_OPTIONS.find((p) => p.id === activeScope);
    return found ? found.label : 'Date Range';
  }, [activeScope, customRange]);

  const activeCount = counts && activeScope in counts ? counts[activeScope as keyof DateScopeCounts] : undefined;

  const isNonDefault = activeScope !== '30d' || Boolean(customRange);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Preset Selection
  const handleSelectPreset = (presetId: DateScope) => {
    if (presetId === 'custom') {
      setMobileTab('calendar');
      return;
    }
    onScopeChange(presetId);
    setIsOpen(false);
    setCustomError(null);
  };

  // Calendar Day Click Handler
  const handleDayClick = (iso: string) => {
    setCustomError(null);

    // If we're starting a new range or both are already set
    if (!startInput || (startInput && endInput && !isSelectingEnd)) {
      setStartInput(iso);
      setEndInput('');
      setIsSelectingEnd(true);
      setHoverDate(null);
    } else if (isSelectingEnd && startInput) {
      // Completing the range selection
      if (iso < startInput) {
        // Swap so chronological order is preserved
        setEndInput(startInput);
        setStartInput(iso);
      } else {
        setEndInput(iso);
      }
      setIsSelectingEnd(false);
      setHoverDate(null);
    }
  };

  const handleDayMouseEnter = (iso: string) => {
    if (isSelectingEnd && startInput && !endInput) {
      setHoverDate(iso);
    }
  };

  const handleCalendarMouseLeave = () => {
    setHoverDate(null);
  };

  // Quick Chips
  const handleQuickChip = (daysAgo: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (daysAgo - 1) * 86400000);
    const startIso = toIso(start);
    const endIso = toIso(end);
    setStartInput(startIso);
    setEndInput(endIso);
    setIsSelectingEnd(false);
    setCustomError(null);
    const parsed = parseIso(endIso);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  };

  const handleSetCurrentMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startIso = toIso(start);
    const endIso = toIso(end);
    setStartInput(startIso);
    setEndInput(endIso);
    setIsSelectingEnd(false);
    setCustomError(null);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const handleSetPreviousMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const startIso = toIso(start);
    const endIso = toIso(end);
    setStartInput(startIso);
    setEndInput(endIso);
    setIsSelectingEnd(false);
    setCustomError(null);
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
  };

  const handleSetOctober2026 = () => {
    setStartInput('2026-10-01');
    setEndInput('2026-10-31');
    setIsSelectingEnd(false);
    setCustomError(null);
    setViewYear(2026);
    setViewMonth(9);
  };

  // Manual input changes with auto-calendar sync
  const handleManualStartChange = (val: string) => {
    setStartInput(val);
    const parsed = parseIso(val);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  };

  const handleManualEndChange = (val: string) => {
    setEndInput(val);
    const parsed = parseIso(val);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  };

  // Apply Range Action
  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCustomError(null);

    if (!startInput) {
      setCustomError('Select at least a start date.');
      return;
    }

    const effectiveEnd = endInput || startInput;

    let s = startInput;
    let eDate = effectiveEnd;
    if (s > eDate) {
      const tmp = s;
      s = eDate;
      eDate = tmp;
    }

    const label = `${formatDisplayDate(s)} → ${formatDisplayDate(eDate)}`;
    onScopeChange('custom', { startDate: s, endDate: eDate, label });
    setIsOpen(false);
  };

  const handleResetToDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    onScopeChange('30d');
    setCustomError(null);
  };

  // Calendar Grid Calculation
  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sun
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    // Previous month padding days
    const prevDays: { day: number; iso: string; isCurrentMonth: boolean }[] = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      prevDays.push({
        day: d,
        iso: toIso(prevDate),
        isCurrentMonth: false,
      });
    }

    // Current month days
    const currentDays: { day: number; iso: string; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(viewYear, viewMonth, d);
      currentDays.push({
        day: d,
        iso: toIso(curDate),
        isCurrentMonth: true,
      });
    }

    // Next month overflow days (fill to 35 or 42 cells)
    const totalCells = (prevDays.length + currentDays.length) > 35 ? 42 : 35;
    const remaining = totalCells - (prevDays.length + currentDays.length);
    const nextDays: { day: number; iso: string; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      nextDays.push({
        day: d,
        iso: toIso(nextDate),
        isCurrentMonth: false,
      });
    }

    return [...prevDays, ...currentDays, ...nextDays];
  }, [viewYear, viewMonth]);

  // Range highlights computation
  const activeEffectiveEnd = endInput || (isSelectingEnd && hoverDate ? hoverDate : '');
  const minSelected = startInput && activeEffectiveEnd ? (startInput <= activeEffectiveEnd ? startInput : activeEffectiveEnd) : startInput;
  const maxSelected = startInput && activeEffectiveEnd ? (startInput <= activeEffectiveEnd ? activeEffectiveEnd : startInput) : startInput;

  const daysCount = useMemo(() => {
    if (!startInput) return 0;
    const e = endInput || startInput;
    return calculateDaysCount(startInput <= e ? startInput : e, startInput <= e ? e : startInput);
  }, [startInput, endInput]);

  const todayIso = useMemo(() => toIso(new Date()), []);

  // Status text for preview
  const rangeStatusText = useMemo(() => {
    if (startInput && endInput) {
      return `${formatDisplayDate(startInput)} → ${formatDisplayDate(endInput)}`;
    }
    if (startInput && !endInput) {
      if (hoverDate) {
        const s = startInput <= hoverDate ? startInput : hoverDate;
        const e = startInput <= hoverDate ? hoverDate : startInput;
        return `${formatDisplayDate(s)} → ${formatDisplayDate(e)} (Click to select)`;
      }
      return `Selected: ${formatDisplayDate(startInput)} • Click end date on calendar`;
    }
    return 'Click any date to begin range selection';
  }, [startInput, endInput, hoverDate]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* ── Modern Trigger Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
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
          <span className="font-bold truncate max-w-[150px] sm:max-w-[220px]">
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
              role="button"
              tabIndex={0}
              aria-label="Reset date filter to default Last 30 Days"
              onClick={handleResetToDefault}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleResetToDefault(e as unknown as React.MouseEvent);
                }
              }}
              className="p-1 rounded-md hover:bg-orange-200/60 dark:hover:bg-orange-900/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
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

      {/* ── Modern Dropdown Popover ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Date Range Picker"
          className={`fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto ${
            align === 'right' ? 'sm:right-0' : 'sm:left-0'
          } mt-2 w-auto sm:w-[620px] md:w-[680px] max-w-[calc(100vw-16px)] bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200 dark:border-[#1F1F1F] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/90 dark:bg-[#121212] border-b border-slate-100 dark:border-[#1A1A1A] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-headline flex items-center gap-1.5">
                  <span>Date Range & Period Scope</span>
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {subLabel || 'Select standard preset or interactively click dates on the calendar'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isNonDefault && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] font-bold text-primary hover:text-orange-700 dark:hover:text-orange-400 flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  title="Reset to 30 Days"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset (30D)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Tab Switcher (< 640px) */}
          <div className="sm:hidden flex border-b border-slate-100 dark:border-[#1F1F1F] bg-slate-50/80 dark:bg-[#111111] p-1 gap-1">
            <button
              type="button"
              onClick={() => setMobileTab('presets')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mobileTab === 'presets'
                  ? 'bg-white dark:bg-[#1A1A1A] text-primary shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Presets & Months
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('calendar')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mobileTab === 'calendar'
                  ? 'bg-white dark:bg-[#1A1A1A] text-primary shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Calendar Picker
            </button>
          </div>

          {/* 2-Pane Content Area */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#1A1A1A] max-h-[580px] overflow-y-auto">
            {/* Left Pane: Standard Presets & Available Months */}
            <div
              className={`w-full sm:w-[210px] p-2.5 space-y-2 shrink-0 bg-slate-50/40 dark:bg-black/40 ${
                mobileTab === 'calendar' ? 'hidden sm:block' : 'block'
              }`}
            >
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 select-none">
                Quick Presets
              </div>
              <div className="space-y-0.5">
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
              </div>

              {/* 1-Click Selectable Calendar Months from Dataset */}
              {availableMonths && availableMonths.length > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-[#1F1F1F]">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1 select-none flex items-center justify-between">
                    <span>Dataset Months</span>
                    <span className="text-[8px] font-mono font-bold text-slate-400">{availableMonths.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {availableMonths.slice(0, 5).map((m) => {
                      const isMonthActive = activeScope === 'custom' && customRange?.startDate === m.startDate && customRange?.endDate === m.endDate;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onScopeChange('custom', { startDate: m.startDate, endDate: m.endDate, label: m.label });
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                            isMonthActive
                              ? 'bg-primary text-white font-bold shadow-xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161616] font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {isMonthActive ? (
                              <Check className="w-3.5 h-3.5 text-white shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">{m.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono px-1 rounded shrink-0 ${isMonthActive ? 'text-white/80' : 'text-slate-400'}`}>
                            {m.orderCount.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compare Periods Button */}
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

            {/* Right Pane: Interactive Calendar & Custom Range Controls */}
            <div
              className={`flex-1 p-3.5 sm:p-4 flex flex-col justify-between space-y-3.5 ${
                mobileTab === 'presets' ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <div className="space-y-3">
                {/* Calendar Navigation & Month/Year Jump Bar */}
                <div className="flex items-center justify-between gap-2 pb-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      title="Previous Month"
                      aria-label="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      title="Next Month"
                      aria-label="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dropdowns for Month and Year */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={viewMonth}
                      onChange={(e) => setViewMonth(Number(e.target.value))}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-[#181818] border border-slate-200/80 dark:border-[#262626] rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx}>
                          {name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={viewYear}
                      onChange={(e) => setViewYear(Number(e.target.value))}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-[#181818] border border-slate-200/80 dark:border-[#262626] rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-mono"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>

                    {/* Quick Jump to October 2026 */}
                    {(viewYear !== 2026 || viewMonth !== 9) && (
                      <button
                        type="button"
                        onClick={handleSetOctober2026}
                        className="px-2 py-1 text-[10px] font-bold text-primary bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 border border-orange-200/60 dark:border-orange-800/60 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Jump to October 2026"
                      >
                        Oct 2026
                      </button>
                    )}
                  </div>
                </div>

                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DAY_NAMES.map((d, i) => (
                    <div
                      key={d}
                      className={`text-[10px] font-bold uppercase tracking-wider py-1 ${
                        i === 0 || i === 6 ? 'text-orange-500/80' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid (Days of Month) */}
                <div
                  className="grid grid-cols-7 gap-y-1 select-none"
                  onMouseLeave={handleCalendarMouseLeave}
                >
                  {calendarGrid.map((item) => {
                    const isStart = item.iso === minSelected;
                    const isEnd = item.iso === maxSelected;
                    const inRange = Boolean(
                      minSelected && maxSelected && item.iso >= minSelected && item.iso <= maxSelected
                    );
                    const isSingle = minSelected && maxSelected && minSelected === maxSelected && isStart;
                    const isTodayDate = item.iso === todayIso;

                    return (
                      <div
                        key={item.iso}
                        className="relative flex items-center justify-center p-0"
                        onMouseEnter={() => handleDayMouseEnter(item.iso)}
                      >
                        {/* Connecting background ribbon for range */}
                        {inRange && !isSingle && (
                          <div
                            className={`absolute inset-y-0.5 bg-orange-100 dark:bg-orange-950/50 ${
                              isStart ? 'left-1/2 right-0' : isEnd ? 'left-0 right-1/2' : 'left-0 right-0'
                            }`}
                          />
                        )}

                        {/* Day Cell Button */}
                        <button
                          type="button"
                          onClick={() => handleDayClick(item.iso)}
                          className={`relative z-10 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            isStart || isEnd
                              ? 'bg-primary text-white font-bold shadow-xs scale-105'
                              : inRange
                              ? 'text-orange-950 dark:text-orange-200 font-bold hover:bg-orange-200/60 dark:hover:bg-orange-900/60'
                              : item.isCurrentMonth
                              ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E1E1E]'
                              : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-[#151515]'
                          }`}
                        >
                          <span>{item.day}</span>
                          {/* Dot for Today */}
                          {isTodayDate && !isStart && !isEnd && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Range Summary Preview Banner */}
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-[#222222] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px] sm:text-xs">
                      {rangeStatusText}
                    </span>
                  </div>
                  {daysCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {daysCount} {daysCount === 1 ? 'day' : 'days'}
                    </span>
                  )}
                </div>

                {/* Quick Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-0.5">
                    Quick:
                  </span>
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
                  <button
                    type="button"
                    onClick={handleSetPreviousMonth}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/60 dark:border-[#2A2A2A]"
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={handleSetOctober2026}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 text-primary transition-colors cursor-pointer border border-orange-200/60 dark:border-orange-800/60"
                  >
                    October 2026
                  </button>
                </div>

                {/* Form Inputs: Start Date & End Date */}
                <form onSubmit={handleApplyCustom} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startInput}
                        min={minDateIso}
                        max={endInput || undefined}
                        onChange={(e) => handleManualStartChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#262626] text-xs text-slate-900 dark:text-white bg-white dark:bg-[#121212] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endInput}
                        min={startInput || minDateIso}
                        onChange={(e) => handleManualEndChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#262626] text-xs text-slate-900 dark:text-white bg-white dark:bg-[#121212] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  {customError && (
                    <div className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
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
                    <span>Apply Date Range</span>
                  </button>
                </div>

                {/* Direct WooCommerce Sync Button */}
                {onSyncWooCommerce && (
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => {
                      if (!startInput) {
                        setCustomError('Select at least a start date.');
                        return;
                      }
                      const effectiveEnd = endInput || startInput;
                      let s = startInput;
                      let eDate = effectiveEnd;
                      if (s > eDate) {
                        const tmp = s;
                        s = eDate;
                        eDate = tmp;
                      }
                      const boundaries = getDateScopeBoundaries('custom', {
                        startDate: s,
                        endDate: eDate,
                      });
                      onScopeChange('custom', { startDate: s, endDate: eDate });
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
