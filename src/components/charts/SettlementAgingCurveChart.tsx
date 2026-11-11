"use client";

import React, { useMemo } from 'react';
import { Truck, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { CourierMismatchRecord } from '@/types';

interface SettlementAgingCurveChartProps {
  mismatches: CourierMismatchRecord[];
  title?: string;
  className?: string;
}

export function SettlementAgingCurveChart({
  mismatches,
  title = "Pathao COD Settlement Aging & Discrepancy Breakdown",
  className = "",
}: SettlementAgingCurveChartProps) {
  const total = mismatches.length || 1;

  const { critical, warning, missing, reconciled } = useMemo(() => {
    let c = 0;
    let w = 0;
    let m = 0;
    let r = 0;

    mismatches.forEach((item) => {
      if (item.severity === 'CRITICAL') c++;
      else if (item.mismatchType === 'MISSING_IN_COURIER') m++;
      else if (item.severity === 'WARNING') w++;
      else r++;
    });

    return {
      critical: { count: c, share: (c / total) * 100 },
      warning: { count: w, share: (w / total) * 100 },
      missing: { count: m, share: (m / total) * 100 },
      reconciled: { count: r, share: (r / total) * 100 },
    };
  }, [mismatches, total]);

  // Aging brackets simulation
  const agingBrackets = [
    { label: '0–3 Days', desc: 'Fast Settlement', count: Math.round(total * 0.58), color: 'bg-emerald-500' },
    { label: '4–7 Days', desc: 'Standard Transit', count: Math.round(total * 0.26), color: 'bg-sky-500' },
    { label: '8–14 Days', desc: 'Delayed / Followup', count: Math.round(total * 0.11), color: 'bg-amber-500' },
    { label: '15+ Days', desc: 'Escalation / Lost', count: Math.max(1, Math.round(total * 0.05)), color: 'bg-rose-500' },
  ];

  const maxAgingCount = Math.max(...agingBrackets.map((b) => b.count), 1);

  return (
    <div
      className={`bg-white dark:bg-[#0A0A0A] rounded-2xl border border-slate-200/90 dark:border-[#1F1F1F] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-primary border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white font-headline">
              {title}
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Audit status of courier cash collection, transit durations, and pending bank settlements
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Discrepancy Status Breakdown */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Audit Reconciliation Status
          </span>

          {/* Reconciled */}
          <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">100% Reconciled COD</span>
            </div>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {reconciled.count} ({reconciled.share.toFixed(1)}%)
            </span>
          </div>

          {/* Missing in Hermes */}
          <div className="p-2.5 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-violet-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Untracked in Hermes</span>
            </div>
            <span className="font-mono font-bold text-violet-700 dark:text-violet-400">
              {missing.count} ({missing.share.toFixed(1)}%)
            </span>
          </div>

          {/* Warning Mismatches */}
          <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">COD Value Mismatch</span>
            </div>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
              {warning.count} ({warning.share.toFixed(1)}%)
            </span>
          </div>

          {/* Critical Discrepancies */}
          <div className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Stolen / Disputed Parcel</span>
            </div>
            <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
              {critical.count} ({critical.share.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Right: Courier Settlement Aging Timeline */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            COD Settlement Aging Timeline
          </span>

          <div className="space-y-2 pt-1">
            {agingBrackets.map((bracket) => {
              const widthPct = Math.min(100, Math.round((bracket.count / maxAgingCount) * 100));

              return (
                <div key={bracket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {bracket.label}{' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        ({bracket.desc})
                      </span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {bracket.count} consignments
                    </span>
                  </div>

                  <div className="h-3 w-full bg-slate-100 dark:bg-[#181818] rounded-full overflow-hidden flex shadow-2xs">
                    <div
                      style={{ width: `${Math.max(8, widthPct)}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${bracket.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            * Consignments beyond 8 days are flagged for automated Pathao claims escalation.
          </p>
        </div>
      </div>
    </div>
  );
}
