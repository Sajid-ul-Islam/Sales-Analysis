'use client';

import React from 'react';
import { CheckCircle2, Sparkles, ArrowRight, Download, Eye, FileSpreadsheet } from 'lucide-react';

export interface SuccessMetricItem {
  label: string;
  value: string | number;
}

export interface SuccessCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  metrics?: SuccessMetricItem[];
  nextActions?: Array<{
    label: string;
    onClick: () => void;
    icon?: 'download' | 'view' | 'sheet' | 'arrow';
    primary?: boolean;
  }>;
}

export function SuccessCelebrationModal({
  isOpen,
  onClose,
  title = 'Reconciliation Completed Successfully!',
  message = 'All commercial web orders, physical branch dispatches, and Pathao courier records have been reconciled with integer knapsack subset-sum precision.',
  metrics = [],
  nextActions = [],
}: SuccessCelebrationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#0A0A0A] border border-neutral-800 p-6 md:p-8 shadow-2xl relative overflow-hidden animate-scaleUp">
        {/* Confetti / Particle Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-5 shadow-xl shadow-emerald-950/40">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Audit Invariants Reconciled</span>
          </div>

          <h3 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight">
            {title}
          </h3>

          <p className="text-xs md:text-sm text-neutral-400 max-w-md mx-auto mb-6 leading-relaxed">
            {message}
          </p>

          {/* Key Metric Confirmation Pills */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6 text-left">
              {metrics.map((m, idx) => (
                <div
                  key={`metric-${idx}`}
                  className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between"
                >
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                    {m.label}
                  </span>
                  <span className="text-sm font-bold text-white mt-1 font-mono">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Next Steps: What is Next? */}
          {nextActions.length > 0 && (
            <div className="space-y-2 mb-6 text-left">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2 text-center">
                Recommended Next Steps:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nextActions.map((action, i) => (
                  <button
                    key={`action-${i}`}
                    onClick={() => {
                      action.onClick();
                      onClose();
                    }}
                    className={`py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                      action.primary
                        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/40'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {action.icon === 'download' && <Download className="w-3.5 h-3.5" />}
                      {action.icon === 'sheet' && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
                      {action.icon === 'view' && <Eye className="w-3.5 h-3.5 text-blue-400" />}
                      <span>{action.label}</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-neutral-300 py-1 transition-colors font-medium"
          >
            Dismiss and return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
