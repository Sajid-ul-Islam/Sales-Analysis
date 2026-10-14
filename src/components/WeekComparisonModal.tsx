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
  Percent,
  DollarSign,
  PackageCheck,
  AlertOctagon
} from 'lucide-react';
import { RawOrderRow } from '@/types';
import { FileWeek, comparePeriods, PeriodComparisonResult, DateScope, CustomDateRange } from '@/lib/dateFilter';

export interface WeekComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: RawOrderRow[];
  fileWeeks: FileWeek[];
  onApplyPeriod: (scope: DateScope, customRange?: CustomDateRange) => void;
  activeScope?: DateScope;
  activeCustomRange?: CustomDateRange;
}

export function WeekComparisonModal({
  isOpen,
  onClose,
  orders,
  fileWeeks,
  onApplyPeriod,
}: WeekComparisonModalProps) {
  // Default to comparing the second week against the first week if available
  const [periodAId, setPeriodAId] = useState<string>('');
  const [periodBId, setPeriodBId] = useState<string>('');

  useEffect(() => {
    if (fileWeeks && fileWeeks.length > 0) {
      if (fileWeeks.length >= 2) {
        setPeriodAId(fileWeeks[1].id);
        setPeriodBId(fileWeeks[0].id);
      } else {
        setPeriodAId(fileWeeks[0].id);
        setPeriodBId(fileWeeks[0].id);
      }
    }
  }, [fileWeeks]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const weekA = useMemo(() => fileWeeks.find(w => w.id === periodAId) || fileWeeks[1] || fileWeeks[0], [fileWeeks, periodAId]);
  const weekB = useMemo(() => fileWeeks.find(w => w.id === periodBId) || fileWeeks[0], [fileWeeks, periodBId]);

  const comparison: PeriodComparisonResult | null = useMemo(() => {
    if (!weekA || !weekB || !orders || orders.length === 0) return null;
    return comparePeriods(
      orders,
      { startMs: weekA.startMs, endMs: weekA.endMs, label: weekA.label, subLabel: weekA.dateRangeLabel },
      { startMs: weekB.startMs, endMs: weekB.endMs, label: weekB.label, subLabel: weekB.dateRangeLabel }
    );
  }, [orders, weekA, weekB]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-primary flex items-center justify-center shrink-0 shadow-2xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-headline flex items-center gap-2">
                Week-over-Week & Period Comparator
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  Dynamic File Weeks
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Compare dispatch velocity, delivery rates, return leakages, and revenue between weeks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close comparator"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Week Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            {/* Period A */}
            <div className="md:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  Primary Period (Week A)
                </label>
                {weekA && (
                  <span className="text-xs font-mono text-slate-500">
                    {weekA.dateRangeLabel} ({weekA.orderCount} orders)
                  </span>
                )}
              </div>
              <select
                value={periodAId}
                onChange={(e) => setPeriodAId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-2xs"
              >
                {fileWeeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label} ({w.dateRangeLabel}) — {w.orderCount} orders
                  </option>
                ))}
              </select>
            </div>

            {/* VS Divider */}
            <div className="md:col-span-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center shadow-2xs font-headline">
                VS
              </div>
            </div>

            {/* Period B */}
            <div className="md:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Comparison Base (Week B)
                </label>
                {weekB && (
                  <span className="text-xs font-mono text-slate-500">
                    {weekB.dateRangeLabel} ({weekB.orderCount} orders)
                  </span>
                )}
              </div>
              <select
                value={periodBId}
                onChange={(e) => setPeriodBId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-2xs"
              >
                {fileWeeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label} ({w.dateRangeLabel}) — {w.orderCount} orders
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metric Comparison Cards */}
          {comparison && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Orders Dispatched */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                  <span>Total Orders</span>
                  <PackageCheck className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-slate-900">
                      {comparison.periodA.totalOrders.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      vs {comparison.periodB.totalOrders.toLocaleString()} in {comparison.periodB.label}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.ordersDelta >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                  <span>Delivery Success Rate</span>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-emerald-600">
                      {comparison.periodA.deliveryRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {comparison.periodA.deliveredOrders} vs {comparison.periodB.deliveredOrders} delivered
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.deliveryRateDiff >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                  <span>Return Rate</span>
                  <AlertOctagon className="w-4 h-4 text-rose-500" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-rose-600">
                      {comparison.periodA.returnRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {comparison.periodA.returnedOrders} vs {comparison.periodB.returnedOrders} returns
                    </span>
                  </div>
                  {/* Lower return rate is better, so invert colors */}
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.returnRateDiff <= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                  <span>Gross Sales (GMV)</span>
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <span className="text-2xl font-bold font-headline text-slate-900">
                      ৳{(comparison.periodA.grossRevenue / 1000).toFixed(0)}k
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      AOV: ৳{comparison.periodA.aov.toLocaleString()} (vs ৳{comparison.periodB.aov.toLocaleString()})
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold ${
                      comparison.deltas.grossRevenueDelta >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Fulfillment Composition Breakdown
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-600">
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
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{comparison.periodA.label} ({comparison.periodA.subLabel})</span>
                  <span>{comparison.periodA.totalOrders} orders</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-200">
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
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{comparison.periodB.label} ({comparison.periodB.subLabel})</span>
                  <span>{comparison.periodB.totalOrders} orders</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-200">
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
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onApplyPeriod('all');
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to All Records</span>
          </button>

          <div className="flex items-center gap-2">
            {weekA && (
              <button
                type="button"
                onClick={() => {
                  onApplyPeriod('custom', {
                    startDate: weekA.startDate,
                    endDate: weekA.endDate,
                    label: weekA.label,
                  });
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-orange-600 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Filter to {weekA.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {weekB && weekA?.id !== weekB?.id && (
              <button
                type="button"
                onClick={() => {
                  onApplyPeriod('custom', {
                    startDate: weekB.startDate,
                    endDate: weekB.endDate,
                    label: weekB.label,
                  });
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 transition-colors shadow-2xs cursor-pointer"
              >
                <span>Filter to {weekB.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
