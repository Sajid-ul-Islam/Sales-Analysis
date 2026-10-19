"use client";

import React from 'react';
import { CustomerRatingData } from '@/lib/customerRating';
import { ShieldCheck, ShieldAlert, AlertTriangle, Sparkles, UserCheck } from 'lucide-react';

interface CustomerRatingBadgeProps {
  rating?: CustomerRatingData | null;
  phone?: string;
  className?: string;
  compact?: boolean;
}

export function CustomerRatingBadge({
  rating,
  phone,
  className = '',
  compact = false,
}: CustomerRatingBadgeProps) {
  if (!rating) {
    if (!phone) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 ${className}`}
        title="Checking Pathao delivery ratings..."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
        Checking...
      </span>
    );
  }

  const { ratingTier, successRate, totalOrders, deliveredOrders, returnedOrders, source, courierNotes } = rating;

  // Build descriptive tooltip
  const tooltip = totalOrders > 0
    ? `Pathao/Store Rating: ${ratingTier} (${successRate}% success rate across ${totalOrders} orders: ${deliveredOrders} delivered, ${returnedOrders} returned). ${courierNotes || ''}`
    : `New Customer: First-time buyer profile with no prior return history. Standard order verification recommended.`;

  switch (ratingTier) {
    case 'EXCELLENT':
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs ${className}`}
          title={tooltip}
        >
          <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{compact ? `${successRate}%` : `${successRate}% Excellent`}</span>
        </span>
      );

    case 'GOOD':
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800 shadow-2xs ${className}`}
          title={tooltip}
        >
          <ShieldCheck className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>{compact ? `${successRate}%` : `${successRate}% Good`}</span>
        </span>
      );

    case 'MODERATE':
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs ${className}`}
          title={tooltip}
        >
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{compact ? `${successRate}%` : `${successRate}% Moderate`}</span>
        </span>
      );

    case 'RISKY':
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 shadow-2xs animate-pulse ${className}`}
          title={tooltip}
        >
          <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{compact ? `⚠️ ${successRate}% Risk` : `⚠️ ${successRate}% High Risk`}</span>
        </span>
      );

    case 'NEW':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-tight bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 ${className}`}
          title={tooltip}
        >
          <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
          <span>New Buyer</span>
        </span>
      );
  }
}
