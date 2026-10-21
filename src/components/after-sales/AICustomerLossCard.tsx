"use client";

import React, { useState, useEffect } from 'react';
import { CustomerRiskProfile } from '@/types';
import {
  Coins,
  RotateCcw,
  AlertTriangle,
  UserX,
  ChevronDown,
  ChevronUp,
  Lock,
  Key
} from 'lucide-react';
import { loadBYOKConfig, BYOKConfig } from '@/lib/byok';
import { BYOKModal } from '@/components/ai/BYOKModal';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';

interface LossMakingBuyer {
  phone: string;
  customerName: string;
  returnRate: number;
  policyRecommendation: string;
  courierLossAmount?: number;
  netFinancialLoss?: number;
}

interface CustomerLossData {
  executiveAuditSummary?: string;
  totalReverseLogisticsWasted?: number;
  chronicReturnerCount?: number;
  topLossMakingBuyers?: LossMakingBuyer[];
}

interface AICustomerLossCardProps {
  profiles: CustomerRiskProfile[];
}

export function AICustomerLossCard({ profiles }: AICustomerLossCardProps) {
  const [audit, setAudit] = useState<CustomerLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);

  const CACHE_KEY = 'deen_cached_ai_customer_loss';
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  // Load cached customer loss audit on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.audit) {
          setAudit(parsed.audit);
          if (parsed.timestamp) {
            setCachedTime(new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load cached customer loss audit:', e);
    }
  }, []);

  // Listen for BYOK updates across components
  useEffect(() => {
    const handleBYOKUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BYOKConfig>;
      if (customEvent.detail) {
        setByokConfig(customEvent.detail);
      }
    };
    window.addEventListener('deen_byok_updated', handleBYOKUpdate);
    return () => window.removeEventListener('deen_byok_updated', handleBYOKUpdate);
  }, []);

  const fetchAudit = React.useCallback(async () => {
    if (profiles.length === 0) return;
    setLoading(true);
    try {
      const currentBYOK = loadBYOKConfig();
      const res = await fetch('/api/ai/after-sales/customer-loss', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          profiles: profiles.slice(0, 30),
          byok: currentBYOK.isActive ? currentBYOK : undefined,
        }),
      });
      const data = await res.json();
      if (data?.audit) {
        setAudit(data.audit);
        const now = new Date();
        setCachedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            audit: data.audit,
            timestamp: now.toISOString(),
            profileCount: profiles.length,
          }));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to run AI customer loss audit:', err);
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  useEffect(() => {
    if (!audit && profiles.length > 0) {
      fetchAudit();
    }
  }, [audit, profiles.length, fetchAudit]);

  if (profiles.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-white via-rose-50/20 to-amber-50/20 dark:from-deepBlack-card dark:via-deepBlack-sidebar dark:to-deepBlack-card rounded-2xl border border-rose-200/80 dark:border-deepBlack-border shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-rose-100 dark:border-deepBlack-border bg-white/80 dark:bg-deepBlack-card/80 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white flex items-center justify-center shadow-xs">
            <UserX className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-bold text-sm sm:text-base text-navy-deep dark:text-white">
                AI Reverse Logistics Loss & Chronic Returner Audit
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                Post-Sale CRM Protection
              </span>
              {cachedTime && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-deepBlack-border hidden sm:inline">
                  Cached: {cachedTime}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quantifies after-sales courier expense wasted on repeat COD returners and enforces prepaid policy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* BYOK Status / Connect Trigger */}
          <button
            type="button"
            onClick={() => setIsBYOKModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 ${
              byokConfig.isActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                : 'bg-white dark:bg-deepBlack-elevated hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-200 border-slate-200 dark:border-deepBlack-border'
            }`}
            title="Configure Bring Your Own Key (BYOK)"
          >
            {byokConfig.isActive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>BYOK: {byokConfig.provider.toUpperCase()}</span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>BYOK Key</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fetchAudit}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Auditing...' : 'Re-Run Loss Audit'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-deepBlack-hover transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && loading && !audit && (
        <div className="p-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-pulse">
            <UserX className="w-3.5 h-3.5 animate-spin" />
            Calculating customer return patterns & courier loss...
          </div>
        </div>
      )}

      {isExpanded && audit && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-deepBlack-card border border-rose-100 dark:border-rose-900/40 shadow-2xs text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Chronic Returner Risk Assessment:</span>
              <p>{audit.executiveAuditSummary}</p>
            </div>
          </div>

          {/* Key Financial Impact Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-deepBlack-card p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider block">
                  Total Reverse Logistics Fees Wasted
                </span>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-headline mt-0.5">
                  ৳ {(audit.totalReverseLogisticsWasted || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Non-refundable RTO linehaul charges</span>
              </div>
              <Coins className="w-8 h-8 text-rose-200 dark:text-rose-950/60 shrink-0" />
            </div>

            <div className="bg-white dark:bg-deepBlack-card p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider block">
                  Identified Chronic Returners
                </span>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-400 font-headline mt-0.5">
                  {audit.chronicReturnerCount || 0} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">buyers</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">&gt;50% RTO rejection rate</span>
              </div>
              <UserX className="w-8 h-8 text-amber-200 dark:text-amber-950/60 shrink-0" />
            </div>
          </div>

          {/* Top Loss-Making Buyers Table */}
          {audit.topLossMakingBuyers && audit.topLossMakingBuyers.length > 0 && (
            <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200 dark:border-deepBlack-border overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-deepBlack-sidebar border-b border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                  Highest Net Loss Buyers (Reverse Logistics Destruction)
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Enforce Advance Payment</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-deepBlack-border text-xs">
                {audit.topLossMakingBuyers.map((buyer: LossMakingBuyer, bIdx: number) => (
                  <div key={bIdx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-white font-mono">{buyer.phone}</strong>
                          <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px]">({buyer.customerName})</span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                            {buyer.returnRate}% RTO
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">{buyer.policyRecommendation}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">Net Courier Loss</span>
                      <span className="font-black text-rose-600 dark:text-rose-400 text-sm">৳ {buyer.netFinancialLoss?.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BYOK Configuration Modal */}
      <BYOKModal
        isOpen={isBYOKModalOpen}
        onClose={() => setIsBYOKModalOpen(false)}
        onSaved={(cfg) => {
          setByokConfig(cfg);
          fetchAudit();
        }}
      />
    </div>
  );
}
