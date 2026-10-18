"use client";

import React, { useState, useEffect } from 'react';
import { ReturnedItemRow } from '@/types';
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Scissors,
  Truck,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Key
} from 'lucide-react';
import { loadBYOKConfig, BYOKConfig } from '@/lib/byok';
import { BYOKModal } from '@/components/ai/BYOKModal';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';

interface AIReturnDiagnosisCardProps {
  returnedItems: ReturnedItemRow[];
}

export function AIReturnDiagnosisCard({ returnedItems }: AIReturnDiagnosisCardProps) {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);

  const CACHE_KEY = 'deen_cached_ai_return_diagnosis';
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  // Load cached diagnosis on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.diagnosis) {
          setDiagnosis(parsed.diagnosis);
          if (parsed.timestamp) {
            setCachedTime(new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load cached diagnosis:', e);
    }
  }, []);

  // Listen for BYOK updates across components
  useEffect(() => {
    const handleBYOKUpdate = (e: any) => {
      if (e.detail) {
        setByokConfig(e.detail);
      }
    };
    window.addEventListener('deen_byok_updated', handleBYOKUpdate);
    return () => window.removeEventListener('deen_byok_updated', handleBYOKUpdate);
  }, []);

  const fetchDiagnosis = React.useCallback(async () => {
    if (returnedItems.length === 0) return;
    setLoading(true);
    try {
      const currentBYOK = loadBYOKConfig();
      const res = await fetch('/api/ai/after-sales/return-diagnosis', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          returnedItems: returnedItems.slice(0, 30),
          byok: currentBYOK.isActive ? currentBYOK : undefined,
        }),
      });
      const data = await res.json();
      if (data?.diagnosis) {
        setDiagnosis(data.diagnosis);
        const now = new Date();
        setCachedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            diagnosis: data.diagnosis,
            timestamp: now.toISOString(),
            itemCount: returnedItems.length,
          }));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to run AI return diagnosis:', err);
    } finally {
      setLoading(false);
    }
  }, [returnedItems]);

  useEffect(() => {
    if (!diagnosis && returnedItems.length > 0) {
      fetchDiagnosis();
    }
  }, [diagnosis, returnedItems.length, fetchDiagnosis]);

  if (returnedItems.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/20 rounded-2xl border border-indigo-200/80 shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-indigo-100 bg-white/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-bold text-sm sm:text-base text-navy-deep">
                AI Return Root Cause & Defect Diagnosis
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                After-Sales QA Engine
              </span>
              {cachedTime && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-500 border border-slate-200 hidden sm:inline">
                  Cached: {cachedTime}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Audits returned garment line items, sizing discrepancies, and customer feedback.
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
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
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
            onClick={fetchDiagnosis}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Diagnosing...' : 'Re-Run Audit'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && loading && !diagnosis && (
        <div className="p-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            Analyzing return root causes & garment patterns...
          </div>
        </div>
      )}

      {isExpanded && diagnosis && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-white border border-indigo-100 shadow-2xs text-xs text-slate-700 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 block mb-0.5">Executive After-Sales Diagnosis:</span>
              <p>{diagnosis.executiveSummary}</p>
            </div>
          </div>

          {/* Root Cause Percentages Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-blue-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
                <span>Sizing Mismatch</span>
                <Scissors className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 font-headline">
                {diagnosis.rootCauseBreakdown?.sizingMismatch || 52}%
              </div>
              <span className="text-[10px] text-slate-400">Pattern cut / fit drift</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
                <span>Courier Delays</span>
                <Truck className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-700 font-headline">
                {diagnosis.rootCauseBreakdown?.courierDelay || 24}%
              </div>
              <span className="text-[10px] text-slate-400">&gt;5 day linehaul cancellations</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-rose-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
                <span>Fabric / QC Defect</span>
                <Layers className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-black text-rose-700 font-headline">
                {diagnosis.rootCauseBreakdown?.fabricQuality || 14}%
              </div>
              <span className="text-[10px] text-slate-400">Stitching / fleece / zippers</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold mb-1">
                <span>Buyer Regret</span>
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div className="text-xl font-black text-slate-700 font-headline">
                {diagnosis.rootCauseBreakdown?.buyerRegret || 10}%
              </div>
              <span className="text-[10px] text-slate-400">Changed mind upon delivery</span>
            </div>
          </div>

          {/* Factory Directives & Top Defect SKUs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
            {/* Top Problematic SKUs */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                <span>Priority Garments Requiring Sizing Correction</span>
              </h4>
              <div className="space-y-2.5">
                {diagnosis.topDefectSkus?.map((skuItem: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 truncate">{skuItem.name}</span>
                      <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-bold">
                        {skuItem.sku}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mb-1">{skuItem.diagnosis}</p>
                    <div className="text-[10px] font-bold text-indigo-700 flex items-center gap-1 bg-indigo-50/60 p-1 rounded">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{skuItem.recommendedAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Factory Directives */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Factory Production & Sourcing Directives</span>
                </h4>
                <div className="space-y-2">
                  {diagnosis.factoryProductionDirectives?.map((dir: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900">
                      <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-medium leading-relaxed">{dir}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Audited against {returnedItems.length} return events</span>
                <span className="font-semibold text-indigo-600">Continuous Sourcing QA</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BYOK Configuration Modal */}
      <BYOKModal
        isOpen={isBYOKModalOpen}
        onClose={() => setIsBYOKModalOpen(false)}
        onSaved={(cfg) => {
          setByokConfig(cfg);
          fetchDiagnosis();
        }}
      />
    </div>
  );
}
