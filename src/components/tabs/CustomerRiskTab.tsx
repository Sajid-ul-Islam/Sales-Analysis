"use client";

import React, { useState, useMemo } from 'react';
import { CustomerRiskProfile } from '@/types';
import { ShieldAlert, ShieldCheck, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';
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
      {/* Risk Profiling Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Audited Buyer Profiles</span>
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">{profiles.length.toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">Aggregated by Buyer Phone</span>
          </div>
          <span className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            E-Commerce CRM Intelligence
          </span>
        </div>

        {/* High Risk Tier */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">High Risk (&gt;50% RTO)</span>
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-rose-600">{highRiskCount.toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">Chronic Return Suspects</span>
          </div>
          <span className="text-[11px] text-rose-700 pt-2 border-t border-slate-100 font-semibold">
            Mandate Advance ৳150 bKash Fee
          </span>
        </div>

        {/* Medium Risk */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Medium Risk (25-50% RTO)</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-amber-600">{mediumRiskCount.toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">Frequent Partial/Return Buyers</span>
          </div>
          <span className="text-[11px] text-amber-700 pt-2 border-t border-slate-100 font-semibold">
            Call Verification Before Packing
          </span>
        </div>

        {/* Low Risk / Safelist */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Low Risk / Verified</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-emerald-600">{lowRiskCount.toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-0.5">High Acceptance Loyalty</span>
          </div>
          <span className="text-[11px] text-emerald-700 pt-2 border-t border-slate-100 font-semibold">
            Instant Express Dispatch
          </span>
        </div>
      </div>

      {/* AI Reverse Logistics Loss & Chronic Returner Audit */}
      <AICustomerLossCard profiles={profiles} />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="HIGH_RISK">High Risk Tiers Only</option>
              <option value="MEDIUM">Medium Risk Only</option>
              <option value="LOW">Low Risk (Verified) Only</option>
            </select>

            <select
              value={minOrdersFilter}
              onChange={(e) => setMinOrdersFilter(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            >
              <option value="1">All Orders (≥ 1)</option>
              <option value="2">Repeat Buyers Only (≥ 2 orders)</option>
              <option value="3">High Frequency (≥ 3 orders)</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{filteredProfiles.length.toLocaleString()}</strong> customer profiles
        </span>
      </div>

      {/* Customer Risk Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50/60 border-b border-slate-100">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to view risk analysis & spend</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">Customer pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 bg-slate-50 sticky left-0 z-20 min-w-[160px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Customer Phone & Name</th>
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
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No customer profiles found for active filter.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p, idx) => {
                  const isHigh = p.riskTier === 'HIGH_RISK';
                  const isMed = p.riskTier === 'MEDIUM';

                  return (
                    <tr key={`${p.phone}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3.5 px-4 font-mono sticky left-0 bg-white group-hover:bg-slate-50 z-10 min-w-[160px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                        <div className="font-bold text-slate-900 text-xs">{p.phone}</div>
                        <div className="text-[11px] text-slate-500 font-sans truncate max-w-[150px]">{p.customerName || 'Customer'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
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
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isMed
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {p.returnRate.toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                        ৳ {Math.round(p.totalSpent).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isHigh ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3" />
                            HIGH RISK
                          </span>
                        ) : isMed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            MEDIUM
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" />
                            LOW RISK
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span className={isHigh ? 'text-rose-600' : isMed ? 'text-amber-600' : 'text-slate-500'}>
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
