"use client";

import React, { useState, useMemo } from 'react';
import { CourierMismatchRecord } from '@/types';
import { AICourierDisputeCard } from '@/components/after-sales/AICourierDisputeCard';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Truck,
  RefreshCw,
  Filter,
  ArrowUpRight
} from 'lucide-react';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber,
} from '@/lib/excelExport';

interface CourierMismatchTabProps {
  mismatches: CourierMismatchRecord[];
  onRefreshPathao?: () => void;
  isRefreshing?: boolean;
}

export function CourierMismatchTab({
  mismatches,
  onRefreshPathao,
  isRefreshing = false
}: CourierMismatchTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'MATCH' | 'MISSING'>('ALL');

  // Filtered rows
  const filteredList = useMemo(() => {
    const list = mismatches.filter((item) => {
      if (selectedFilter === 'CRITICAL' && item.severity !== 'CRITICAL') return false;
      if (selectedFilter === 'WARNING' && item.severity !== 'WARNING') return false;
      if (selectedFilter === 'MATCH' && item.severity !== 'MATCH') return false;
      if (selectedFilter === 'MISSING' && item.mismatchType !== 'MISSING_IN_COURIER') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesOid = item.orderId.toLowerCase().includes(q);
        const matchesCons = (item.consignmentId || '').toLowerCase().includes(q);
        const matchesCust = (getExportCustomerName(item) || item.customerName).toLowerCase().includes(q);
        const matchesPhone = (getExportPhoneNumber(item) || item.phone).includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesOid && !matchesCons && !matchesCust && !matchesPhone && !matchesDesc) return false;
      }
      return true;
    });

    return list.sort(compareOrdersByNumber);
  }, [mismatches, selectedFilter, searchTerm]);

  // Aggregate stats
  const totalAudited = mismatches.length;
  const criticalCount = mismatches.filter(m => m.severity === 'CRITICAL').length;
  const warningCount = mismatches.filter(m => m.severity === 'WARNING').length;
  const missingCount = mismatches.filter(m => m.mismatchType === 'MISSING_IN_COURIER').length;
  const reconciledCount = mismatches.filter(m => m.severity === 'MATCH').length;

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-primary font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                Two-Way Courier Audit
              </span>
              <h2 className="font-headline text-base sm:text-lg font-bold text-navy-deep">
                Pathao Courier & Excel Mismatch Intelligence
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Cross-checks every return, partial delivery, and size exchange from your uploaded store Excel against Pathao courier manifests to detect status divergences, unmanifested returns, and COD collection leakages.
          </p>
        </div>

        {onRefreshPathao && (
          <button
            onClick={onRefreshPathao}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-headline text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/20 transition-all active:scale-95 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Cross-Checking Pathao...' : 'Sync & Audit Pathao'}</span>
          </button>
        )}
      </div>

      {/* KPI Cards: Reconciled vs Divergences (Interactive Drilldowns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* Card 1: Total Audited */}
        <div
          onClick={() => setSelectedFilter('ALL')}
          className={`bg-white rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            selectedFilter === 'ALL'
              ? 'border-primary ring-2 ring-primary/20 shadow-sm'
              : 'border-slate-200/90 shadow-xs hover:border-slate-300'
          }`}
          title="Click to view all audited returns & manifests"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Audited</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs group-hover:scale-105 transition-transform">
                <Filter className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${selectedFilter === 'ALL' ? 'text-primary' : 'text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-navy-deep tracking-tight">{totalAudited}</div>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Returns & Partials Ingested</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>From Uploaded Excel</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedFilter === 'ALL' ? 'bg-primary/10 text-primary' : 'text-slate-400'}`}>
              {selectedFilter === 'ALL' ? 'Active Filter' : 'Click to view'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-400"></div>
        </div>

        {/* Card 2: Reconciled Matches */}
        <div
          onClick={() => setSelectedFilter('MATCH')}
          className={`bg-white rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            selectedFilter === 'MATCH'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-slate-200/90 shadow-xs hover:border-emerald-300'
          }`}
          title="Click to filter by Reconciled OK orders"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Reconciled OK</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-2xs group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${selectedFilter === 'MATCH' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-emerald-600 tracking-tight">{reconciledCount}</div>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Confirmed by Pathao</span>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>{totalAudited > 0 ? ((reconciledCount / totalAudited) * 100).toFixed(1) : 0}% Sync Rate</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedFilter === 'MATCH' ? 'bg-emerald-100 text-emerald-800' : 'text-emerald-600'}`}>
              {selectedFilter === 'MATCH' ? 'Active Filter' : 'Verified'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* Card 3: Critical Status Mismatches */}
        <div
          onClick={() => setSelectedFilter('CRITICAL')}
          className={`bg-white rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            selectedFilter === 'CRITICAL'
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm bg-rose-50/30'
              : 'border-rose-200/90 shadow-xs hover:border-rose-400 bg-rose-50/15'
          }`}
          title="Click to filter by Critical Status Mismatches"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">Critical Mismatches</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-2xs group-hover:scale-105 transition-transform">
                <XCircle className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${selectedFilter === 'CRITICAL' ? 'text-rose-600' : 'text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-rose-600 tracking-tight">{criticalCount}</div>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Return vs Courier Delivered</span>
          </div>
          <div className="text-[11px] text-rose-600 font-bold pt-3 border-t border-rose-100 flex items-center justify-between">
            <span>Potential COD Leakage</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedFilter === 'CRITICAL' ? 'bg-rose-200 text-rose-800' : 'bg-rose-100 text-rose-700'}`}>
              High Risk
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* Card 4: Missing in Pathao */}
        <div
          onClick={() => setSelectedFilter('MISSING')}
          className={`bg-white rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            selectedFilter === 'MISSING'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm bg-amber-50/30'
              : 'border-amber-200/90 shadow-xs hover:border-amber-400 bg-amber-50/15'
          }`}
          title="Click to filter by Missing Consignments"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Missing in Courier</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-2xs group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${selectedFilter === 'MISSING' ? 'text-amber-600' : 'text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-amber-600 tracking-tight">{missingCount}</div>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">No Consignment in Manifest</span>
          </div>
          <div className="text-[11px] text-amber-700 font-bold pt-3 border-t border-amber-100 flex items-center justify-between">
            <span>Check Alternate Couriers</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedFilter === 'MISSING' ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-700'}`}>
              Investigate
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* Card 5: Partial / Amount Warnings */}
        <div
          onClick={() => setSelectedFilter('WARNING')}
          className={`bg-white rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            selectedFilter === 'WARNING'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
              : 'border-slate-200/90 shadow-xs hover:border-indigo-300'
          }`}
          title="Click to filter by RTS / Partial Warnings"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Other Warnings</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-2xs group-hover:scale-105 transition-transform">
                <HelpCircle className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${selectedFilter === 'WARNING' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="font-headline font-black text-2xl sm:text-3xl xl:text-4xl text-navy-deep tracking-tight">{Math.max(0, warningCount - missingCount)}</div>
            <span className="text-xs font-semibold text-slate-500 mt-1 block">Partial vs RTS Discrepancies</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>Requires Hub Verification</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedFilter === 'WARNING' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}>
              Discrepancy
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"></div>
        </div>
      </div>

      {/* AI Courier Dispute Dossier & Financial Audit */}
      <AICourierDisputeCard mismatches={mismatches} />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'ALL'
                ? 'bg-primary text-white font-bold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-deepBlack-hover'
            }`}
          >
            All Audited ({totalAudited})
          </button>
          <button
            onClick={() => setSelectedFilter('CRITICAL')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white font-bold shadow-2xs'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            Critical Mismatches ({criticalCount})
          </button>
          <button
            onClick={() => setSelectedFilter('MISSING')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'MISSING'
                ? 'bg-amber-600 text-white font-bold shadow-2xs'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            Missing in Pathao ({missingCount})
          </button>
          <button
            onClick={() => setSelectedFilter('MATCH')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'MATCH'
                ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            Reconciled ({reconciledCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Order ID, Consignment, Phone..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-deepBlack-canvas focus:border-primary text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
          />
        </div>
      </div>

      {/* Mismatches Audit Ledger Table */}
      <div className="bg-white dark:bg-deepBlack-card rounded-xl shadow-xs border border-slate-200/80 dark:border-deepBlack-border overflow-hidden flex flex-col">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to view discrepancy details</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">Order & Track pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-deepBlack-border">
                <th className="py-3 px-4 uppercase tracking-wider bg-slate-50 dark:bg-deepBlack-sidebar sticky left-0 z-20 min-w-[140px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Order & Tracking</th>
                <th className="py-3 px-4 uppercase tracking-wider">Customer Info</th>
                <th className="py-3 px-3 uppercase tracking-wider">Excel Status</th>
                <th className="py-3 px-3 uppercase tracking-wider">Pathao Courier Status</th>
                <th className="py-3 px-3 uppercase tracking-wider text-right">COD Remittance</th>
                <th className="py-3 px-3 uppercase tracking-wider">Reconciliation Verdict</th>
                <th className="py-3 px-4 uppercase tracking-wider">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border text-slate-800 dark:text-slate-200 font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                    <span className="font-headline font-bold text-slate-700 dark:text-slate-300 block text-sm">
                      No Mismatches Found
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      All records match the selected filter criteria.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors group ${
                      item.severity === 'CRITICAL'
                        ? 'bg-rose-50/15 dark:bg-rose-950/20'
                        : item.severity === 'WARNING'
                        ? 'bg-amber-50/10 dark:bg-amber-950/20'
                        : ''
                    }`}
                  >
                    {/* Order ID & Consignment */}
                    <td className={`py-3 px-4 sticky left-0 z-10 min-w-[140px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] ${
                      item.severity === 'CRITICAL'
                        ? 'bg-[#FFF1F2] dark:bg-[#1f0a0d] group-hover:bg-[#FFE4E6] dark:group-hover:bg-[#2c1015]'
                        : item.severity === 'WARNING'
                        ? 'bg-[#FFFBEB] dark:bg-[#1c1404] group-hover:bg-[#FEF3C7] dark:group-hover:bg-[#2a1e06]'
                        : 'bg-white dark:bg-deepBlack-card group-hover:bg-slate-50 dark:group-hover:bg-deepBlack-hover'
                    }`}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-headline font-bold text-slate-900 dark:text-white">
                            #{item.orderId}
                          </span>
                          {(item.severity === 'CRITICAL' || item.severity === 'WARNING' || item.requiresManualReview) && (
                            <span
                              className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-bold border border-amber-300 dark:border-amber-700 shrink-0"
                              title={item.recommendedAction || item.reviewReason || 'Manual review required'}
                            >
                              ⚠️ Review
                            </span>
                          )}
                        </div>
                        {item.consignmentId ? (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            Cons: {item.consignmentId}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                            No Courier ID
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                          {getExportCustomerName(item) || item.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {getExportPhoneNumber(item) || item.phone || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Excel Status */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.excelStatus === 'Returned'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50'
                          : item.excelStatus === 'Partial'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50'
                          : item.excelStatus === 'Exchange'
                          ? 'bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/50 dark:border-orange-900/50'
                          : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-700 dark:text-slate-300'
                      }`}>
                        {item.excelStatus}
                      </span>
                    </td>

                    {/* Pathao Courier Status */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.pathaoStatus.toLowerCase().includes('delivered')
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                          : item.pathaoStatus.toLowerCase().includes('return') || item.pathaoStatus.toLowerCase().includes('rts')
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50'
                          : item.pathaoStatus.toLowerCase().includes('partial')
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50'
                          : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-deepBlack-border'
                      }`}>
                        {item.pathaoStatus}
                      </span>
                    </td>

                    {/* COD Remittance */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-headline font-bold text-slate-900 dark:text-white">
                          ৳ {item.pathaoCollectedCod.toLocaleString()}
                        </span>
                        {item.expectedCod !== item.pathaoCollectedCod && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">
                            Exp: ৳{item.expectedCod.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Severity Verdict */}
                    <td className="py-3 px-3">
                      {item.severity === 'CRITICAL' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <XCircle className="w-3 h-3" />
                          <span>Status Mismatch</span>
                        </span>
                      )}
                      {item.severity === 'WARNING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{item.mismatchType === 'MISSING_IN_COURIER' ? 'Missing in Pathao' : 'Warning'}</span>
                        </span>
                      )}
                      {item.severity === 'MATCH' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reconciled</span>
                        </span>
                      )}
                      {item.severity === 'INFO' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-deepBlack-sidebar text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-deepBlack-border">
                          <span>Reconciled</span>
                        </span>
                      )}
                    </td>

                    {/* Recommended Action */}
                    <td className="py-3 px-4">
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                        {item.description}
                      </p>
                      <span className="text-[10px] text-primary font-bold block mt-0.5">
                        ➜ {item.recommendedAction}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
