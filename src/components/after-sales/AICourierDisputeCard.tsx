"use client";

import React, { useState, useEffect } from 'react';
import { CourierMismatchRecord } from '@/types';
import {
  ShieldAlert,
  Coins,
  FileText,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Truck,
  Key
} from 'lucide-react';
import { loadBYOKConfig, BYOKConfig } from '@/lib/byok';
import { BYOKModal } from '@/components/ai/BYOKModal';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';

interface HighPriorityClaim {
  orderId: string | number;
  consignmentId: string;
  actionNeeded: string;
  financialLoss?: number;
  discrepancyType?: string;
}

interface CourierAuditData {
  executiveAuditVerdict?: string;
  totalLeakageAmount?: number;
  unremittedCodCount?: number;
  ghostReturnCount?: number;
  claimDossierText?: string;
  highPriorityClaims?: HighPriorityClaim[];
}

interface AICourierDisputeCardProps {
  mismatches: CourierMismatchRecord[];
}

export function AICourierDisputeCard({ mismatches }: AICourierDisputeCardProps) {
  const [audit, setAudit] = useState<CourierAuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showClaimLetter, setShowClaimLetter] = useState(false);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);

  const CACHE_KEY = 'deen_cached_ai_courier_audit';
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  // Load cached courier audit on mount
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
      console.error('Failed to load cached courier audit:', e);
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
    if (mismatches.length === 0) return;
    setLoading(true);
    try {
      const currentBYOK = loadBYOKConfig();
      const res = await fetch('/api/ai/after-sales/courier-audit', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          mismatches: mismatches.slice(0, 30),
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
            mismatchCount: mismatches.length,
          }));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to run AI courier audit:', err);
    } finally {
      setLoading(false);
    }
  }, [mismatches]);

  useEffect(() => {
    if (!audit && mismatches.length > 0) {
      fetchAudit();
    }
  }, [audit, mismatches.length, fetchAudit]);

  const handleCopyClaim = () => {
    if (!audit?.claimDossierText) return;
    navigator.clipboard.writeText(audit.claimDossierText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (mismatches.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-white via-orange-50/20 to-rose-50/20 dark:from-deepBlack-card dark:via-deepBlack-sidebar dark:to-deepBlack-card rounded-2xl border border-orange-200/80 dark:border-deepBlack-border shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-orange-100 dark:border-deepBlack-border bg-white/80 dark:bg-deepBlack-card/80 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-bold text-sm sm:text-base text-navy-deep dark:text-white">
                AI Courier Financial Leakage & Dispute Claims Auditor
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                Revenue Recovery
              </span>
              {cachedTime && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-deepBlack-border hidden sm:inline">
                  Cached: {cachedTime}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Audits COD under-collections, ghost returns, and generates formal dispute dossiers for Pathao.
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
            className="px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-primary text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Auditing...' : 'Re-Run Courier Audit'}</span>
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-primary text-xs font-semibold animate-pulse">
            <Coins className="w-3.5 h-3.5 animate-spin" />
            Auditing courier remittances & unmanifested returns...
          </div>
        </div>
      )}

      {isExpanded && audit && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-deepBlack-card border border-rose-100 dark:border-rose-900/40 shadow-2xs text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
            <Coins className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Revenue Leakage Verdict:</span>
              <p>{audit.executiveAuditVerdict}</p>
            </div>
          </div>

          {/* Key Financial Leakage Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-deepBlack-card p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider block">
                Total Revenue at Risk
              </span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-headline mt-1">
                ৳ {(audit.totalLeakageAmount || 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Unsettled COD & unverified returns</span>
            </div>

            <div className="bg-white dark:bg-deepBlack-card p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider block">
                Unremitted COD Settlements
              </span>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 font-headline mt-1">
                {audit.unremittedCodCount || 0} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">parcels</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Delivered but cash not transferred</span>
            </div>

            <div className="bg-white dark:bg-deepBlack-card p-3.5 rounded-xl border border-slate-200 dark:border-deepBlack-border shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider block">
                Suspected Ghost Returns
              </span>
              <div className="text-2xl font-black text-slate-800 dark:text-white font-headline mt-1">
                {audit.ghostReturnCount || 0} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">parcels</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Marked returned without warehouse scan</span>
            </div>
          </div>

          {/* Dispute Claim Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border shadow-2xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">Formal Pathao Merchant Dispute Dossier</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Pre-formatted formal claim letter ready for email submission</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClaimLetter(prev => !prev)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-deepBlack-border text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors"
              >
                {showClaimLetter ? 'Hide Dossier' : 'View Claim Letter'}
              </button>
              <button
                type="button"
                onClick={handleCopyClaim}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Claim Copied!' : 'Copy Formal Claim'}</span>
              </button>
            </div>
          </div>

          {/* Expandable Dispute Letter Preview */}
          {showClaimLetter && audit.claimDossierText && (
            <div className="p-4 rounded-xl bg-slate-900 dark:bg-deepBlack-canvas text-slate-100 font-mono text-[11px] leading-relaxed relative whitespace-pre-wrap max-h-72 overflow-y-auto shadow-inner border border-slate-800 dark:border-deepBlack-border">
              {audit.claimDossierText}
            </div>
          )}

          {/* High Priority Claims Table */}
          {audit.highPriorityClaims && audit.highPriorityClaims.length > 0 && (
            <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200 dark:border-deepBlack-border overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-deepBlack-sidebar border-b border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Top Priority Discrepancies Requiring Immediate Settlement Adjustment
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Showing top {audit.highPriorityClaims.length}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-deepBlack-border text-xs">
                {audit.highPriorityClaims.map((claim: HighPriorityClaim, cIdx: number) => (
                  <div key={cIdx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-900 dark:text-white font-mono">Order #{claim.orderId}</strong>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({claim.consignmentId})</span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{claim.actionNeeded}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-rose-600 dark:text-rose-400 block">৳ {claim.financialLoss?.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{claim.discrepancyType}</span>
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
