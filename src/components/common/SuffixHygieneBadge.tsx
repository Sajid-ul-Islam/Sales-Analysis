'use client';

import React from 'react';
import { validateOrderSuffix, SuffixValidationResult } from '@/lib/suffixHygiene';
import { AlertTriangle, Wand2 } from 'lucide-react';

export interface SuffixHygieneBadgeProps {
  orderId?: string;
  rawOrderId?: string;
  onApplyFix?: (fixedOrderId: string) => void;
  showBranchLabel?: boolean;
}

export function SuffixHygieneBadge({
  orderId,
  rawOrderId,
  onApplyFix,
  showBranchLabel = false,
}: SuffixHygieneBadgeProps) {
  const targetId = orderId || rawOrderId || '';
  const validation: SuffixValidationResult = validateOrderSuffix(targetId);

  if (validation.isValid) {
    if (!showBranchLabel) return <span className="font-mono">{targetId}</span>;

    const branchColors: Record<string, string> = {
      ONLINE: 'text-sky-400 bg-sky-950/40 border-sky-800/60',
      MIRPUR: 'text-purple-400 bg-purple-950/40 border-purple-800/60',
      CUMILLA: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
      WARI: 'text-teal-400 bg-teal-950/40 border-teal-800/60',
      SYLHET: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/60',
      EXCHANGE: 'text-violet-400 bg-violet-950/40 border-violet-800/60',
    };

    const colorClass = branchColors[validation.branchCode] || 'text-neutral-400 bg-neutral-900 border-neutral-800';

    return (
      <span className="inline-flex items-center gap-1.5 font-mono">
        <span>{targetId}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${colorClass}`}>
          {validation.branchCode}
        </span>
      </span>
    );
  }

  const sanitizedFix = validation.suggestedFix || targetId;

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border bg-rose-950/40 text-rose-300 border-rose-800/60 shadow-xs"
      title={`Suffix Hygiene Warning: Format: ${sanitizedFix}. ${validation.issueDescription || 'Malformed order ID'}`}
    >
      <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
      <span className="line-through opacity-70">{targetId}</span>
      <span className="text-rose-400">→</span>
      <span className="font-bold text-white">{sanitizedFix}</span>

      {onApplyFix && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onApplyFix(sanitizedFix);
          }}
          className="ml-1 p-0.5 hover:bg-rose-900/60 rounded text-rose-300 hover:text-white transition-colors cursor-pointer"
          title={`Auto-sanitize to ${sanitizedFix}`}
        >
          <Wand2 className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
