"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Check,
  RotateCcw,
  Scale,
  PackageCheck,
  AlertOctagon,
  DollarSign
} from 'lucide-react';
import { RawOrderRow } from '@/types';
import { FileWeek, comparePeriods, PeriodComparisonResult, DateScope, CustomDateRange, AvailableMonth } from '@/lib/dateFilter';

export interface WeekComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: RawOrderRow[];
  fileWeeks: FileWeek[];
  availableMonths?: AvailableMonth[];
  onApplyPeriod: (scope: DateScope, customRange?: CustomDateRange) => void;
  activeScope?: DateScope;
  activeCustomRange?: CustomDateRange;
  initialMode?: 'week' | 'month';
}

export function WeekComparisonModal({
  isOpen,
  onClose,
  orders,
  fileWeeks = [],
  availableMonths = [],
  onApplyPeriod,
  initialMode = 'week',
}: WeekComparisonModalProps) {
  const [mode, setMode] = useState<'week' | 'month'>(initialMode);
  const [weekAId, setWeekAId] = useState<string>('');
  const [weekBId, setWeekBId] = useState<string>('');
  const [monthAId, setMonthAId] = useState<string>('');
  const [monthBId, setMonthBId] = useState<string>('');

  // Sync mode with initialMode when opened
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode, isOpen]);

  // Set default week IDs (Week 2 vs Week 1 if available)
  useEffect(() => {
    if (fileWeeks && fileWeeks.length > 0) {
      if (fileWeeks.length >= 2) {
        setWeekAId(fileWeeks[1].id);
        setWeekBId(fileWeeks[0].id);
      } else {
        setWeekAId(fileWeeks[0].id);
        setWeekBId(fileWeeks[0].id);
      }
    }
  }, [fileWeeks]);

  // Set default month IDs (Latest month vs Previous month, e.g. Oct 2026 vs Sep 2026)
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0) {
      if (availableMonths.length >= 2) {
        setMonthAId(availableMonths[0].id);
        setMonthBId(availableMonths[1].id);
      } else {
        setMonthAId(availableMonths[0].id);
        setMonthBId(availableMonths[0].id);
      }
    }
  }, [availableMonths]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const weekA = useMemo(() => fileWeeks.find(w => w.id === weekAId) || fileWeeks[1] || fileWeeks[0], [fileWeeks, weekAId]);
  const weekB = useMemo(() => fileWeeks.find(w => w.id === weekBId) || fileWeeks[0], [fileWeeks, weekBId]);

  const monthA = useMemo(() => availableMonths.find(m => m.id === monthAId) || availableMonths[0], [availableMonths, monthAId]);
  const monthB = useMemo(() => availableMonths.find(m => m.id === monthBId) || availableMonths[1] || availableMonths[0], [availableMonths, monthBId]);

  const activePeriodA = useMemo(() => {
    if (mode === 'month') {
      if (!monthA) return null;
      return {
        id: monthA.id,
        label: monthA.label,
        subLabel: `${monthA.startDate} – ${monthA.endDate}`,
        startMs: monthA.startMs,
        endMs: monthA.endMs,
        orderCount: monthA.orderCount,
        startDate: monthA.startDate,
        endDate: monthA.endDate,
      };
    }
    if (!weekA) return null;
    return {
      id: weekA.id,
      label: weekA.label,
      subLabel: weekA.dateRangeLabel,
      startMs: weekA.startMs,
      endMs: weekA.endMs,
      orderCount: weekA.orderCount,
      startDate: weekA.startDate,
      endDate: weekA.endDate,
    };
  }, [mode, monthA, weekA]);

  const activePeriodB = useMemo(() => {
    if (mode === 'month') {
      if (!monthB) return null;
      return {
        id: monthB.id,
        label: monthB.label,
        subLabel: `${monthB.startDate} – ${monthB.endDate}`,
        startMs: monthB.startMs,
        endMs: monthB.endMs,
        orderCount: monthB.orderCount,
        startDate: monthB.startDate,
        endDate: monthB.endDate,
      };
    }
    if (!weekB) return null;
    return {
      id: weekB.id,
      label: weekB.label,
      subLabel: weekB.dateRangeLabel,
      startMs: weekB.startMs,
      endMs: weekB.endMs,
      orderCount: weekB.orderCount,
      startDate: weekB.startDate,
      endDate: weekB.endDate,
    };
  }, [mode, monthB, weekB]);

  const comparison: PeriodComparisonResult | null = useMemo(() => {
    if (!activePeriodA || !activePeriodB || !orders || orders.length === 0) return null;
    return comparePeriods(
      orders,
      { startMs: activePeriodA.startMs, endMs: activePeriodA.endMs, label: activePeriodA.label, subLabel: activePeriodA.subLabel },
      { startMs: activePeriodB.startMs, endMs: activePeriodB.endMs, label: activePeriodB.label, subLabel: activePeriodB.subLabel }
    );
  }, [orders, activePeriodA, activePeriodB]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparative Performance Analyzer"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        className="bg-white dark:bg-[#0C0C0C] w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1F1F1F] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Segmented Mode Switcher */}
        <div className="px-5 py-4 bg-slate-50/90 dark:bg-[#111111] border-b border-slate-200 dark:border-[#1F1F1F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-primary flex items-center justify-center shrink-0 shadow-2xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-headline flex items-center gap-2">
                Comparative Performance Analyzer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {mode === 'month' ? 'Month vs Month (MoM)' : 'Week vs Week (WoW)'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare delivery realization, return leakages, sales GMV, and AOV across operational horizons.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Buttons */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#2A2A2A] shrink-0">
              <button
                type="button"
                onClick={() => setMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'week'
                    ? 'bg-white dark:bg-[#2A2A2A] text-primary shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Week vs Week</span>
                {fileWeeks.length > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">({fileWeeks.length}W)</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'month'
                    ? 'bg-white dark:bg-[#2A2A2A] text-primary shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Month vs Month</span>
                {availableMonths.length > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">({availableMonths.length}M)</span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Close comparator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Period Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center bg-slate-50/80 dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F]">
            {/* Period A */}
            <div className="md:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  Primary Period ({mode === 'month' ? 'Month A' : 'Week A'})
                </label>
                {activePeriodA && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {activePeriodA.subLabel} ({activePeriodA.orderCount} orders)
                  </span>
                )}
              </div>

              {mode === 'month' ? (
                <select
                  value={monthAId}
                  onChange={(e) => setMonthAId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-[#2A2A2A] text-sm font-semibold bg-white dark:bg-[#181818] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs"
                >
                  {availableMonths.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.startDate} → {m.endDate}) — {m.orderCount} orders {m.isCurrentMonth ? '[Current]' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={weekAId}
                  onChange={(e) => setWeekAId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-[#2A2A2A] text-sm font-semibold bg-white dark:bg-[#181818] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs"
                >
                  {fileWeeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label} ({w.dateRangeLabel}) — {w.orderCount} orders
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* VS Divider */}
            <div className="md:col-span-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#222222] text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shadow-2xs font-headline">
                VS
              </div>
            </div>

            {/* Period B */}
            <div className="md:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Comparison Base ({mode === 'month' ? 'Month B' : 'Week B'})
                </label>
                {activePeriodB && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {activePeriodB.subLabel} ({activePeriodB.orderCount} orders)
                  </span>
                )}
              </div>

              {mode === 'month' ? (
                <select
                  value={monthBId}
                  onChange={(e) => setMonthBId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-[#2A2A2A] text-sm font-semibold bg-white dark:bg-[#181818] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-2xs"
                >
                  {availableMonths.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.startDate} → {m.endDate}) — {m.orderCount} orders {m.isCurrentMonth ? '[Current]' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={weekBId}
                  onChange={(e) => setWeekBId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-[#2A2A2A] text-sm font-semibold bg-white dark:bg-[#181818] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-2xs"
                >
                  {fileWeeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label} ({w.dateRangeLabel}) — {w.orderCount} orders
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Metric Comparison Cards */}
          {comparison && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Orders Dispatched */}
              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                  <span>Total Orders</span>
                  <PackageCheck className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-slate-900 dark:text-white">
                      {comparison.periodA.totalOrders.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      vs {comparison.periodB.totalOrders.toLocaleString()} in {comparison.periodB.label}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.ordersDelta >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {comparison.deltas.ordersDelta >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>
                      {comparison.deltas.ordersDelta >= 0 ? '+' : ''}
                      {comparison.deltas.ordersPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Delivered Orders & Realization Rate */}
              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                  <span>Delivery Success Rate</span>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-emerald-600 dark:text-emerald-400">
                      {comparison.periodA.deliveryRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {comparison.periodA.deliveredOrders} vs {comparison.periodB.deliveredOrders} delivered
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.deliveryRateDiff >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <span>
                      {comparison.deltas.deliveryRateDiff >= 0 ? '+' : ''}
                      {comparison.deltas.deliveryRateDiff.toFixed(1)} pp
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Return Leakage Rate */}
              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                  <span>Return Rate</span>
                  <AlertOctagon className="w-4 h-4 text-rose-500" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-rose-600 dark:text-rose-400">
                      {comparison.periodA.returnRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {comparison.periodA.returnedOrders} vs {comparison.periodB.returnedOrders} returns
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.returnRateDiff <= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <span>
                      {comparison.deltas.returnRateDiff >= 0 ? '+' : ''}
                      {comparison.deltas.returnRateDiff.toFixed(1)} pp
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Gross Revenue */}
              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                  <span>Gross Sales (GMV)</span>
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-slate-900 dark:text-white">
                      ৳{(comparison.periodA.grossRevenue / 1000).toFixed(0)}k
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      AOV: ৳{comparison.periodA.aov.toLocaleString()} (vs ৳{comparison.periodB.aov.toLocaleString()})
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.grossRevenueDelta >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <span>
                      {comparison.deltas.grossRevenueDelta >= 0 ? '+' : ''}
                      {comparison.deltas.grossRevenuePct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visual Stacked Distribution Comparison */}
          {comparison && (
            <div className="bg-slate-50 dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#1F1F1F] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Fulfillment Composition Breakdown ({mode === 'month' ? 'Month vs Month' : 'Week vs Week'})
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                    Delivered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                    Returned
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                    Partial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
                    Exchange
                  </span>
                </div>
              </div>

              {/* Period A Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>{comparison.periodA.label} ({comparison.periodA.subLabel})</span>
                  <span>{comparison.periodA.totalOrders} orders</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-200 dark:bg-[#222222]">
                  <div
                    style={{ width: `${comparison.periodA.deliveryRate}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Delivered: ${comparison.periodA.deliveredOrders}`}
                  />
                  <div
                    style={{ width: `${comparison.periodA.returnRate}%` }}
                    className="bg-rose-500 h-full transition-all"
                    title={`Returned: ${comparison.periodA.returnedOrders}`}
                  />
                  <div
                    style={{
                      width: `${
                        comparison.periodA.totalOrders > 0
                          ? (comparison.periodA.partialOrders / comparison.periodA.totalOrders) * 100
                          : 0
                      }%`,
                    }}
                    className="bg-amber-500 h-full transition-all"
                    title={`Partial: ${comparison.periodA.partialOrders}`}
                  />
                  <div
                    style={{
                      width: `${
                        comparison.periodA.totalOrders > 0
                          ? (comparison.periodA.exchangeOrders / comparison.periodA.totalOrders) * 100
                          : 0
                      }%`,
                    }}
                    className="bg-indigo-500 h-full transition-all"
                    title={`Exchange: ${comparison.periodA.exchangeOrders}`}
                  />
                </div>
              </div>

              {/* Period B Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>{comparison.periodB.label} ({comparison.periodB.subLabel})</span>
                  <span>{comparison.periodB.totalOrders} orders</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-200 dark:bg-[#222222]">
                  <div
                    style={{ width: `${comparison.periodB.deliveryRate}%` }}
                    className="bg-emerald-500/80 h-full transition-all"
                    title={`Delivered: ${comparison.periodB.deliveredOrders}`}
                  />
                  <div
                    style={{ width: `${comparison.periodB.returnRate}%` }}
                    className="bg-rose-500/80 h-full transition-all"
                    title={`Returned: ${comparison.periodB.returnedOrders}`}
                  />
                  <div
                    style={{
                      width: `${
                        comparison.periodB.totalOrders > 0
                          ? (comparison.periodB.partialOrders / comparison.periodB.totalOrders) * 100
                          : 0
                      }%`,
                    }}
                    className="bg-amber-500/80 h-full transition-all"
                    title={`Partial: ${comparison.periodB.partialOrders}`}
                  />
                  <div
                    style={{
                      width: `${
                        comparison.periodB.totalOrders > 0
                          ? (comparison.periodB.exchangeOrders / comparison.periodB.totalOrders) * 100
                          : 0
                      }%`,
                    }}
                    className="bg-indigo-500/80 h-full transition-all"
                    title={`Exchange: ${comparison.periodB.exchangeOrders}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#111111] border-t border-slate-200 dark:border-[#1F1F1F] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onApplyPeriod('all');
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to All Records</span>
          </button>

          <div className="flex items-center gap-2">
            {activePeriodA && (
              <button
                type="button"
                onClick={() => {
                  onApplyPeriod('custom', {
                    startDate: activePeriodA.startDate,
                    endDate: activePeriodA.endDate,
                    label: activePeriodA.label,
                  });
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-orange-600 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Filter to {activePeriodA.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {activePeriodB && activePeriodA?.id !== activePeriodB?.id && (
              <button
                type="button"
                onClick={() => {
                  onApplyPeriod('custom', {
                    startDate: activePeriodB.startDate,
                    endDate: activePeriodB.endDate,
                    label: activePeriodB.label,
                  });
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 dark:bg-white/20 text-white hover:bg-slate-900 dark:hover:bg-white/30 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Filter to {activePeriodB.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
