'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Clock } from 'lucide-react';

export interface LoadingProgressProps {
  isLoading: boolean;
  message?: string;
  subMessage?: string;
  onCancel?: () => void;
  slowThresholdMs?: number;
}

const PHASES = [
  'Verifying session & edge cache...',
  'Ingesting tabular records & cleaning customer phones...',
  'Executing Knapsack discrete dynamic programming...',
  'Reconciling net sales & Pathao COD courier remittance...',
  'Finalizing financial audit ledger...',
];

export function LoadingProgress({
  isLoading,
  message = 'Processing Reconciliation Data...',
  subMessage,
  onCancel,
  slowThresholdMs = 2500,
}: LoadingProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsedMs(0);
      setPhaseIndex(0);
      return;
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);

      // Advance through phases smoothly
      if (elapsed > 4000) setPhaseIndex(4);
      else if (elapsed > 2500) setPhaseIndex(3);
      else if (elapsed > 1200) setPhaseIndex(2);
      else if (elapsed > 500) setPhaseIndex(1);
      else setPhaseIndex(0);
    }, 100);

    return () => clearInterval(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  const isSlow = elapsedMs > slowThresholdMs;
  const progressPercent = Math.min(15 + Math.round((elapsedMs / 4500) * 80), 96);

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full my-4 p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-md transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              {message}
              <span className="text-[11px] font-mono text-neutral-400 font-normal">
                ({(elapsedMs / 1000).toFixed(1)}s)
              </span>
            </h4>
            <p className="text-xs text-neutral-400">
              {subMessage || PHASES[phaseIndex]}
            </p>
          </div>
        </div>

        {isSlow && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1.5"
          >
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Progressive Multi-Tier Progress Bar */}
      <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden p-0.5 border border-neutral-800">
        <div
          className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-emerald-500 rounded-full transition-all duration-300 relative"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
        </div>
      </div>

      {/* State 5: Slow Network / High Volume Notice */}
      {isSlow && (
        <div className="mt-3.5 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-amber-400/90 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>High-volume ledger detected. Calculating integer subset-sum matches & courier statuses...</span>
          </div>
          <span className="text-neutral-400 font-mono text-[10px]">Edge compute active</span>
        </div>
      )}
    </div>
  );
}
