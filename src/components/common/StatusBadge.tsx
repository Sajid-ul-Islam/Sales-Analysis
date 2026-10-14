"use client";

import React from 'react';
import { CheckCircle2, RotateCcw, Split, ArrowRightLeft, AlertTriangle } from 'lucide-react';

export type StandardDeliveryStatus =
  | 'Delivered'
  | 'Paid Return'
  | 'Not Paid Return'
  | 'Partial'
  | 'Exchange'
  | 'Returned'
  | string;

interface StatusBadgeProps {
  status: StandardDeliveryStatus;
  isPaidReturn?: boolean;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

/**
 * Standardized Delivery Status Badge adhering to docs/DESIGN.md & AGENTS.md:
 * - Delivered:        bg-emerald-50 text-emerald-700 border-emerald-200
 * - Paid Return:      bg-blue-50 text-blue-700 border-blue-200
 * - Not Paid Return:  bg-rose-50 text-rose-700 border-rose-200
 * - Partial:          bg-amber-50 text-amber-700 border-amber-200
 * - Exchange:         bg-purple-50 text-purple-700 border-purple-200
 */
export function StatusBadge({
  status,
  isPaidReturn,
  size = 'sm',
  showIcon = true,
  className = ''
}: StatusBadgeProps) {
  const norm = (status || '').toLowerCase();

  let label = status || 'Delivered';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let Icon = CheckCircle2;

  if (norm.includes('exchange') || norm.includes('swap')) {
    label = 'Exchange';
    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
    Icon = ArrowRightLeft;
  } else if (norm.includes('partial')) {
    label = 'Partial';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = Split;
  } else if (norm.includes('paid return') || (norm.includes('return') && isPaidReturn === true)) {
    label = 'Paid Return';
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    Icon = RotateCcw;
  } else if (norm.includes('not paid') || norm.includes('non-paid') || norm.includes('non paid') || (norm.includes('return') && isPaidReturn === false)) {
    label = 'Not Paid Return';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = RotateCcw;
  } else if (norm.includes('return')) {
    label = 'Returned';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = RotateCcw;
  } else if (norm.includes('deliver') || norm.includes('kept')) {
    label = 'Delivered';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = CheckCircle2;
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold border shadow-2xs whitespace-nowrap ${paddingClass} ${badgeColor} ${className}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />}
      <span>{label}</span>
    </span>
  );
}
