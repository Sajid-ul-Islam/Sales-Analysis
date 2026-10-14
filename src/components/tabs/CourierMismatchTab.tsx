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
  RotateCcw,
  Split,
  RefreshCw,
  ExternalLink,
  Filter,
  Download,
  ShieldAlert
} from 'lucide-react';

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
    return mismatches.filter((item) => {
      if (selectedFilter === 'CRITICAL' && item.severity !== 'CRITICAL') return false;
      if (selectedFilter === 'WARNING' && item.severity !== 'WARNING') return false;
      if (selectedFilter === 'MATCH' && item.severity !== 'MATCH') return false;
      if (selectedFilter === 'MISSING' && item.mismatchType !== 'MISSING_IN_COURIER') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesOid = item.orderId.toLowerCase().includes(q);
        const matchesCons = (item.consignmentId || '').toLowerCase().includes(q);
        const matchesCust = item.customerName.toLowerCase().includes(q);
        const matchesPhone = item.phone.includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesOid && !matchesCons && !matchesCust && !matchesPhone && !matchesDesc) return false;
      }
      return true;
    });
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

      {/* KPI Cards: Reconciled vs Divergences */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Audited */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Audited</span>
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
              <Filter className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="font-headline font-black text-2xl text-navy-deep">{totalAudited}</div>
            <span className="text-[10px] text-slate-500">Returns & Partials Ingested</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-100">
            From Uploaded Excel
          </div>
        </div>

        {/* Card 2: Reconciled Matches */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Reconciled OK</span>
            <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="font-headline font-black text-2xl text-emerald-600">{reconciledCount}</div>
            <span className="text-[10px] text-slate-500">Confirmed by Pathao</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold pt-1.5 border-t border-slate-100">
            {totalAudited > 0 ? ((reconciledCount / totalAudited) * 100).toFixed(1) : 0}% Sync Rate
          </div>
        </div>

        {/* Card 3: Critical Status Mismatches */}
        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-xs flex flex-col justify-between bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">Critical Mismatches</span>
            <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center text-rose-600">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="font-headline font-black text-2xl text-rose-600">{criticalCount}</div>
            <span className="text-[10px] text-slate-500">Excel Return vs Pathao Delivered</span>
          </div>
          <div className="text-[10px] text-rose-600 font-bold pt-1.5 border-t border-rose-100">
            Potential COD Revenue Loss
          </div>
        </div>

        {/* Card 4: Missing in Pathao */}
        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Missing in Courier</span>
            <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="font-headline font-black text-2xl text-amber-600">{missingCount}</div>
            <span className="text-[10px] text-slate-500">No Consignment in Manifest</span>
          </div>
          <div className="text-[10px] text-amber-700 font-bold pt-1.5 border-t border-amber-100">
            Check Steadfast/Paperfly
          </div>
        </div>

        {/* Card 5: Partial / Amount Warnings */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Other Warnings</span>
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2">
            <div className="font-headline font-black text-2xl text-navy-deep">{Math.max(0, warningCount - missingCount)}</div>
            <span className="text-[10px] text-slate-500">Partial vs RTS Discrepancies</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-100">
            Requires Hub Verification
          </div>
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
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Audited ({totalAudited})
          </button>
          <button
            onClick={() => setSelectedFilter('CRITICAL')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white font-bold shadow-2xs'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            Critical Mismatches ({criticalCount})
          </button>
          <button
            onClick={() => setSelectedFilter('MISSING')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'MISSING'
                ? 'bg-amber-600 text-white font-bold shadow-2xs'
                : 'text-amber-600 hover:bg-amber-50'
            }`}
          >
            Missing in Pathao ({missingCount})
          </button>
          <button
            onClick={() => setSelectedFilter('MATCH')}
            className={`px-3 py-1 rounded-lg text-xs font-headline transition-all ${
              selectedFilter === 'MATCH'
                ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                : 'text-emerald-600 hover:bg-emerald-50'
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
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary text-slate-800 placeholder-slate-400 transition-all"
          />
        </div>
      </div>

      {/* Mismatches Audit Ledger Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                <th className="py-3 px-4 uppercase tracking-wider">Order & Tracking</th>
                <th className="py-3 px-4 uppercase tracking-wider">Customer Info</th>
                <th className="py-3 px-3 uppercase tracking-wider">Excel Status</th>
                <th className="py-3 px-3 uppercase tracking-wider">Pathao Courier Status</th>
                <th className="py-3 px-3 uppercase tracking-wider text-right">COD Remittance</th>
                <th className="py-3 px-3 uppercase tracking-wider">Reconciliation Verdict</th>
                <th className="py-3 px-4 uppercase tracking-wider">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                    <span className="font-headline font-bold text-slate-700 block text-sm">
                      No Mismatches Found
                    </span>
                    <span className="text-xs text-slate-500">
                      All records match the selected filter criteria.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      item.severity === 'CRITICAL'
                        ? 'bg-rose-50/15'
                        : item.severity === 'WARNING'
                        ? 'bg-amber-50/10'
                        : ''
                    }`}
                  >
                    {/* Order ID & Consignment */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-headline font-bold text-slate-900">
                          #{item.orderId}
                        </span>
                        {item.consignmentId ? (
                          <span className="text-[10px] font-mono text-slate-400">
                            Cons: {item.consignmentId}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-amber-600">
                            No Courier ID
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 truncate max-w-[140px]">
                          {item.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.phone || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Excel Status */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.excelStatus === 'Returned'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200/50'
                          : item.excelStatus === 'Partial'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                          : item.excelStatus === 'Exchange'
                          ? 'bg-orange-50 text-primary border border-orange-200/50'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.excelStatus}
                      </span>
                    </td>

                    {/* Pathao Courier Status */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.pathaoStatus.toLowerCase().includes('delivered')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : item.pathaoStatus.toLowerCase().includes('return') || item.pathaoStatus.toLowerCase().includes('rts')
                          ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                          : item.pathaoStatus.toLowerCase().includes('partial')
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {item.pathaoStatus}
                      </span>
                    </td>

                    {/* COD Remittance */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-headline font-bold text-slate-900">
                          ৳ {item.pathaoCollectedCod.toLocaleString()}
                        </span>
                        {item.expectedCod !== item.pathaoCollectedCod && (
                          <span className="text-[9px] text-slate-400">
                            Exp: ৳{item.expectedCod.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Severity Verdict */}
                    <td className="py-3 px-3">
                      {item.severity === 'CRITICAL' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                          <XCircle className="w-3 h-3" />
                          <span>Status Mismatch</span>
                        </span>
                      )}
                      {item.severity === 'WARNING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{item.mismatchType === 'MISSING_IN_COURIER' ? 'Missing in Pathao' : 'Warning'}</span>
                        </span>
                      )}
                      {item.severity === 'MATCH' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reconciled</span>
                        </span>
                      )}
                      {item.severity === 'INFO' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span>Reconciled</span>
                        </span>
                      )}
                    </td>

                    {/* Recommended Action */}
                    <td className="py-3 px-4">
                      <p className="text-[11px] text-slate-700 font-medium">
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
