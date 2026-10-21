"use client";

import React, { useState, useMemo } from 'react';
import { CustomerRiskProfile } from '@/types';
import { ShieldAlert, ShieldCheck, AlertTriangle, Search, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { AICustomerLossCard } from '@/components/after-sales/AICustomerLossCard';

interface CustomerRiskTabProps {
  profiles: CustomerRiskProfile[];
}

export function CustomerRiskTab({ profiles }: CustomerRiskTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH_RISK' | 'MEDIUM' | 'LOW'>('ALL');
  const [minOrdersFilter, setMinOrdersFilter] = useState<number>(1);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const mPhone = p.phone.toLowerCase().includes(q);
        const mName = p.customerName.toLowerCase().includes(q);
        if (!mPhone && !mName) return false;
      }

      if (riskFilter !== 'ALL' && p.riskTier !== riskFilter) return false;
      if (p.totalOrders < minOrdersFilter) return false;

      return true;
    });
  }, [profiles, searchTerm, riskFilter, minOrdersFilter]);

  const highRiskCount = useMemo(() => profiles.filter(p => p.riskTier === 'HIGH_RISK').length, [profiles]);
  const mediumRiskCount = useMemo(() => profiles.filter(p => p.riskTier === 'MEDIUM').length, [profiles]);
  const lowRiskCount = useMemo(() => profiles.filter(p => p.riskTier === 'LOW').length, [profiles]);

  return (
    <div className="space-y-6">
      {/* Risk Profiling Summary Cards (Interactive Drilldowns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-4.5 xl:gap-5">
        {/* Total Customers */}
        <div
          onClick={() => setRiskFilter('ALL')}
          className={`bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            riskFilter === 'ALL'
              ? 'border-primary ring-2 ring-primary/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          title="Click to view all audited buyer profiles"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Audited Buyer Profiles</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-deepBlack-sidebar flex items-center justify-center text-primary shadow-2xs group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4.5 h-4.5 text-primary" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${riskFilter === 'ALL' ? 'text-primary' : 'text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 dark:text-white font-headline tracking-tight">{profiles.length.toLocaleString()}</div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1">Aggregated by Buyer Phone</span>
          </div>
          <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>E-Commerce CRM</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskFilter === 'ALL' ? 'bg-primary/10 text-primary' : 'text-slate-400'}`}>
              {riskFilter === 'ALL' ? 'All Profiles' : 'Click to view'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
        </div>

        {/* High Risk Tier */}
        <div
          onClick={() => setRiskFilter('HIGH_RISK')}
          className={`bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            riskFilter === 'HIGH_RISK'
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm bg-rose-50/20 dark:bg-rose-950/20'
              : 'border-rose-200/90 dark:border-rose-900/40 shadow-xs hover:border-rose-400 bg-rose-50/10 dark:bg-rose-950/10'
          }`}
          title="Click to filter by High Risk buyers (>50% RTO)"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">High Risk (&gt;50% RTO)</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${riskFilter === 'HIGH_RISK' ? 'text-rose-600' : 'text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-rose-600 font-headline tracking-tight">{highRiskCount.toLocaleString()}</div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1">Chronic Return Suspects</span>
          </div>
          <div className="text-[11px] text-rose-700 dark:text-rose-400 pt-3 border-t border-rose-100 dark:border-rose-900/40 flex items-center justify-between font-semibold">
            <span>Mandate ৳150 Advance</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskFilter === 'HIGH_RISK' ? 'bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200' : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'}`}>
              High Risk
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* Medium Risk */}
        <div
          onClick={() => setRiskFilter('MEDIUM')}
          className={`bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            riskFilter === 'MEDIUM'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm bg-amber-50/20 dark:bg-amber-950/20'
              : 'border-amber-200/90 dark:border-amber-900/40 shadow-xs hover:border-amber-400 bg-amber-50/10 dark:bg-amber-950/10'
          }`}
          title="Click to filter by Medium Risk buyers (25-50% RTO)"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Medium Risk (25-50% RTO)</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${riskFilter === 'MEDIUM' ? 'text-amber-600' : 'text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-amber-600 font-headline tracking-tight">{mediumRiskCount.toLocaleString()}</div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1">Frequent Partial/Return Buyers</span>
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400 pt-3 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between font-semibold">
            <span>Call Verification Recommended</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskFilter === 'MEDIUM' ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'}`}>
              Review
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* Low Risk / Safelist */}
        <div
          onClick={() => setRiskFilter('LOW')}
          className={`bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            riskFilter === 'LOW'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm bg-emerald-50/20 dark:bg-emerald-950/20'
              : 'border-emerald-200/90 dark:border-emerald-900/40 shadow-xs hover:border-emerald-300 bg-emerald-50/10 dark:bg-emerald-950/10'
          }`}
          title="Click to filter by Low Risk / Safelist buyers"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Low Risk / Verified</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${riskFilter === 'LOW' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-emerald-600 font-headline tracking-tight">{lowRiskCount.toLocaleString()}</div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mt-1">High Acceptance Loyalty</span>
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between font-semibold">
            <span>Instant Express Dispatch</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskFilter === 'LOW' ? 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'}`}>
              Safe
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>
      </div>

      {/* AI Reverse Logistics Loss & Chronic Returner Audit */}
      <AICustomerLossCard profiles={profiles} />

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-4 border border-slate-200 dark:border-deepBlack-border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as 'ALL' | 'HIGH_RISK' | 'MEDIUM' | 'LOW')}
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-all"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="HIGH_RISK">High Risk Tiers Only</option>
              <option value="MEDIUM">Medium Risk Only</option>
              <option value="LOW">Low Risk (Verified) Only</option>
            </select>

            <select
              value={minOrdersFilter}
              onChange={(e) => setMinOrdersFilter(Number(e.target.value))}
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-all"
            >
              <option value="1">All Orders (≥ 1)</option>
              <option value="2">Repeat Buyers Only (≥ 2 orders)</option>
              <option value="3">High Frequency (≥ 3 orders)</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-900 dark:text-white">{filteredProfiles.length.toLocaleString()}</strong> customer profiles
        </span>
      </div>

      {/* Customer Risk Ledger Table */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to view risk analysis & spend</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">Customer pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border">
              <tr>
                <th className="py-3 px-4 bg-slate-50 dark:bg-deepBlack-sidebar sticky left-0 z-20 min-w-[160px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Customer Phone & Name</th>
                <th className="py-3 px-4 text-center">Total Orders</th>
                <th className="py-3 px-4 text-center">Delivered</th>
                <th className="py-3 px-4 text-center">Partial</th>
                <th className="py-3 px-4 text-center">Returned</th>
                <th className="py-3 px-4 text-center">Return Incidence %</th>
                <th className="py-3 px-4 text-right">Lifetime Spend (৳)</th>
                <th className="py-3 px-4 text-center">Risk Tier</th>
                <th className="py-3 px-4">Dispatch Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-700 dark:text-slate-200">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No customer profiles found for active filter.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p, idx) => {
                  const isHigh = p.riskTier === 'HIGH_RISK';
                  const isMed = p.riskTier === 'MEDIUM';

                  return (
                    <tr key={`${p.phone}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors group">
                      <td className="py-3.5 px-4 font-mono sticky left-0 bg-white dark:bg-deepBlack-card group-hover:bg-[#FFF7ED] dark:group-hover:bg-deepBlack-hover z-10 min-w-[160px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{p.phone}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[150px]">{p.customerName || 'Customer'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                        {p.totalOrders}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                        {p.deliveredOrders}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-amber-600">
                        {p.partialOrders}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-rose-600">
                        {p.returnedOrders}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isHigh
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50'
                            : isMed
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
                        }`}>
                          {p.returnRate.toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                        ৳ {Math.round(p.totalSpent).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isHigh ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                            <ShieldAlert className="w-3 h-3" />
                            HIGH RISK
                          </span>
                        ) : isMed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                            <AlertTriangle className="w-3 h-3" />
                            MEDIUM
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                            <ShieldCheck className="w-3 h-3" />
                            LOW RISK
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span className={isHigh ? 'text-rose-600 dark:text-rose-400' : isMed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}>
                          {p.recommendation}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
