'use client';

import React, { useState, useMemo } from 'react';
import {
  Lock,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AvailableMonth } from '@/lib/dateFilter';
import { computeMonthlyStatementSummaries } from '@/lib/monthlyStatements';
import { ReconciledOrderRow, SummaryAnalytics } from '@/types';
import { ReconciliationResult } from '@/lib/reconciliationEngine';
import { exportMonthlyNetSalesExcel } from '@/lib/excelExport';

export interface MonthlyStatementsHubProps {
  orders?: ReconciledOrderRow[];
  summary?: SummaryAnalytics;
  reconciliationResult?: ReconciliationResult | null;
  availableMonths?: AvailableMonth[];
  selectedMonthId?: string;
  onSelectMonth?: (month: AvailableMonth | null) => void;
  onSyncLiveMonth?: () => void;
  isSyncingLive?: boolean;
  onExportReport?: () => void;
}

export function MonthlyStatementsHub({
  orders = [],
  summary: _summary,
  reconciliationResult,
  availableMonths = [],
  selectedMonthId,
  onSelectMonth,
  onSyncLiveMonth,
  isSyncingLive = false,
  onExportReport,
}: MonthlyStatementsHubProps) {
  const [showComparison, setShowComparison] = useState(false);

  // Compute monthly statements across available orders
  const statementSummaries = useMemo(() => {
    const list = reconciliationResult?.reconciledOrders || orders;
    return computeMonthlyStatementSummaries(list);
  }, [reconciliationResult, orders]);

  // Combine with availableMonths from dateFilter if present
  const displayMonths = useMemo(() => {
    if (availableMonths && availableMonths.length > 0) {
      return availableMonths;
    }
    // Fallback: derive AvailableMonth objects from statementSummaries
    return statementSummaries.map((s) => ({
      id: s.id,
      year: s.year,
      month: s.monthIndex,
      label: s.label,
      shortLabel: s.shortLabel,
      startDate: s.startDate,
      endDate: s.endDate,
      startMs: new Date(s.startDate).getTime(),
      endMs: new Date(s.endDate).getTime() + 86400000 - 1,
      orderCount: s.orderCount,
      isCurrentMonth: s.isCurrentMonth,
    }));
  }, [availableMonths, statementSummaries]);

  // Active Month
  const activeMonth = useMemo(() => {
    if (!selectedMonthId) return null;
    return displayMonths.find((m) => m.id === selectedMonthId) || null;
  }, [displayMonths, selectedMonthId]);

  // Active Month Summary
  const activeStatement = useMemo(() => {
    if (!activeMonth) return null;
    return statementSummaries.find((s) => s.id === activeMonth.id || s.label === activeMonth.label) || null;
  }, [activeMonth, statementSummaries]);

  const handleTabClick = (month: AvailableMonth | null) => {
    if (onSelectMonth) {
      onSelectMonth(month);
    }
  };

  const handleExport = () => {
    if (onExportReport) {
      onExportReport();
      return;
    }
    if (reconciliationResult) {
      exportMonthlyNetSalesExcel(reconciliationResult, {
        monthLabel: activeMonth?.label || 'Monthly Statement',
      });
    }
  };

  // Day in current ongoing month (e.g. Day 3 of November)
  const today = new Date();
  const currentDayOfMonth = today.getDate();

  return (
    <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200/90 dark:border-deepBlack-border shadow-xs overflow-hidden transition-all">
      {/* 1. Header Toolbar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-deepBlack-border bg-slate-50/50 dark:bg-deepBlack-sidebar/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            📑
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline text-base sm:text-lg font-bold text-navy-deep dark:text-white tracking-tight">
                Executive Monthly Statements
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/90 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Automated Statement Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Closed month-end net reconciliations & live daily operational statements.
            </p>
          </div>
        </div>

        {/* Global Hub Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {activeMonth?.isCurrentMonth && onSyncLiveMonth && (
            <button
              type="button"
              onClick={onSyncLiveMonth}
              disabled={isSyncingLive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
              title="Fetch today's new orders from WooCommerce and update Pathao courier statuses"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? 'animate-spin' : ''}`} />
              <span>{isSyncingLive ? 'Syncing Live...' : '⚡ Sync Today’s Dispatches'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 text-primary-dark dark:text-orange-400 border-orange-200/90 dark:border-orange-800/60 cursor-pointer"
            title="Download Comprehensive Month-End Net Sales & P&L Close Report (.xlsx - 7 Sheets)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary-dark dark:text-orange-400" />
            <span>Download {activeMonth ? activeMonth.shortLabel : 'Month'} .xlsx</span>
          </button>

          <button
            type="button"
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border cursor-pointer"
          >
            <span>Month Comparison</span>
            {showComparison ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Interactive Monthly Tabs Navigation */}
      <div className="p-3 sm:px-5 sm:py-3.5 bg-white dark:bg-deepBlack-card border-b border-slate-100 dark:border-deepBlack-border">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0 scrollbar-thin pb-1 sm:pb-0">
          {displayMonths.map((m) => {
            const isSelected = selectedMonthId === m.id || (!selectedMonthId && m.isCurrentMonth);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleTabClick(m)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs border border-primary'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 dark:bg-deepBlack-elevated dark:hover:bg-deepBlack-hover dark:text-slate-300 border border-slate-200/70 dark:border-deepBlack-border'
                }`}
              >
                {m.isCurrentMonth ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                ) : (
                  <Lock className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                )}
                <span>{m.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : m.isCurrentMonth
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-slate-200/90 text-slate-700 dark:bg-deepBlack-border dark:text-slate-400'
                  }`}
                >
                  {m.isCurrentMonth ? 'Live Daily' : 'Closed'}
                </span>
              </button>
            );
          })}

          {/* All-Time Consolidated Tab */}
          <button
            type="button"
            onClick={() => handleTabClick(null)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              !selectedMonthId
                ? 'bg-primary text-white shadow-xs border border-primary'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 dark:bg-deepBlack-elevated dark:hover:bg-deepBlack-hover dark:text-slate-300 border border-slate-200/70 dark:border-deepBlack-border'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>All-Time (Consolidated)</span>
          </button>
        </div>
      </div>

      {/* 3. Active Month Statement Headline Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-orange-500/5 via-slate-50 to-transparent dark:from-orange-950/20 dark:via-deepBlack-sidebar/50 dark:to-deepBlack-card border-b border-slate-100 dark:border-deepBlack-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-base font-bold text-navy-deep dark:text-white">
                  {activeMonth ? activeMonth.label : 'All-Time Consolidated'} Statement
                </h3>
                {activeMonth?.isCurrentMonth ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Day {currentDayOfMonth} of {activeMonth.label.split(' ')[0]} · Ongoing
                  </span>
                ) : activeMonth ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 dark:bg-deepBlack-elevated dark:text-slate-300 border border-slate-200 dark:border-deepBlack-border flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Audited & Closed
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeMonth
                  ? `Period: ${activeMonth.startDate} to ${activeMonth.endDate} · Authoritative P&L Close`
                  : 'Consolidated performance across all synced historical months'}
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          {activeStatement && (
            <div className="flex items-center gap-3 self-start sm:self-auto text-xs">
              <div className="text-right">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Net Realized
                </div>
                <div className="font-headline font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ৳{activeStatement.deliveredRevenue.toLocaleString()}
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-deepBlack-border" />
              <div className="text-right">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Retention Rate
                </div>
                <div className="font-headline font-bold text-primary text-sm">
                  {activeStatement.deliveryRate}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Collapsible Multi-Month Comparison Scorecard */}
      {showComparison && statementSummaries.length > 0 && (
        <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              Month-over-Month Executive Comparison
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Click any month to switch active view
            </span>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-deepBlack-border text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <th className="py-2 pr-3">Month Statement</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Orders</th>
                  <th className="py-2 px-3 text-right">Gross Dispatched</th>
                  <th className="py-2 px-3 text-right">Net Delivered</th>
                  <th className="py-2 px-3 text-right">Delivery Rate</th>
                  <th className="py-2 px-3 text-right">Return Rate</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border">
                {statementSummaries.map((st) => {
                  const isCur = selectedMonthId === st.id;
                  return (
                    <tr
                      key={st.id}
                      className={`hover:bg-slate-100/60 dark:hover:bg-deepBlack-hover transition-colors ${
                        isCur ? 'bg-orange-50/50 dark:bg-orange-950/20 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-headline font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        {st.isCurrentMonth ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ) : (
                          <Lock className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{st.label}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.isCurrentMonth
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-200/80 text-slate-700 dark:bg-deepBlack-elevated dark:text-slate-400'
                          }`}
                        >
                          {st.isCurrentMonth ? 'Live Daily' : 'Closed & Audited'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        {st.orderCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                        ৳{st.grossRevenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{st.deliveredRevenue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-primary">
                        {st.deliveryRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                        {st.returnRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const found = displayMonths.find((m) => m.id === st.id);
                            if (found) handleTabClick(found);
                          }}
                          className="px-2.5 py-1 rounded text-[11px] font-bold bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border hover:border-primary text-slate-700 dark:text-slate-200 hover:text-primary transition-colors cursor-pointer"
                        >
                          View Statement
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
