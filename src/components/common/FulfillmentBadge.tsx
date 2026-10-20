"use client";

import React from 'react';
import { Store, Building2 } from 'lucide-react';

export type BranchLocation =
  | 'Online Store (Central Warehouse)'
  | 'Mirpur Outlet POS'
  | 'Mirpur Outlet'
  | 'Cumilla Branch'
  | 'Wari Branch'
  | 'Sylhet Branch'
  | 'Warehouse (Mirpur)'
  | string;

interface FulfillmentBadgeProps {
  location?: BranchLocation;
  suffix?: string;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Standardized Fulfillment Location Badge adhering strictly to docs/DESIGN.md & AGENTS.md:
 * - Online Store (Central Warehouse): bg-indigo-50 text-indigo-700 border-indigo-200
 * - Mirpur Outlet POS (m):            bg-purple-50 text-purple-700 border-purple-200
 * - Cumilla Branch (c):               bg-emerald-50 text-emerald-700 border-emerald-200
 * - Wari Branch (w):                  bg-sky-50 text-sky-700 border-sky-200
 * - Sylhet Branch (s):                bg-amber-50 text-amber-700 border-amber-200
 */
export function FulfillmentBadge({
  location = 'Online Store (Central Warehouse)',
  suffix,
  showIcon = false,
  className = '',
  size = 'sm'
}: FulfillmentBadgeProps) {
  const normLoc = (location || '').toLowerCase();
  const s = (suffix || '').toLowerCase();

  const isMirpur =
    normLoc.includes('mirpur') ||
    s === 'm' ||
    normLoc.includes('outlet 1') ||
    normLoc.includes('outlet pos');
  const isCumilla =
    normLoc.includes('cumilla') ||
    normLoc.includes('comilla') ||
    s === 'c';
  const isWari =
    normLoc.includes('wari') ||
    s === 'w';
  const isSylhet =
    normLoc.includes('sylhet') ||
    s === 's';

  let label = 'Online Store';
  let badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  let Icon = Building2;

  if (isMirpur) {
    label = 'Mirpur POS (m)';
    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
    Icon = Store;
  } else if (isCumilla) {
    label = 'Cumilla (c)';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = Store;
  } else if (isWari) {
    label = 'Wari (w)';
    badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
    Icon = Store;
  } else if (isSylhet) {
    label = 'Sylhet (s)';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = Store;
  }

  const paddingClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-semibold border shadow-2xs whitespace-nowrap ${paddingClass} ${badgeColor} ${className}`}
      title={`Fulfillment: ${location || label}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />}
      <span>{label}</span>
    </span>
  );
}
