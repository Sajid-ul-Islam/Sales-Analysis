"use client";

import React, { useState } from 'react';
import { ReconciledOrderRow, SummaryAnalytics } from '@/types';
import { DateScope, CustomDateRange } from '@/lib/dateFilter';
import { OutletDispatchTab } from './OutletDispatchTab';
import { OutletSalesTab } from './OutletSalesTab';
import { Store, ShoppingBag, Truck } from 'lucide-react';

export interface OmnichannelOutletsTabProps {
  orders: ReconciledOrderRow[];
  summary: SummaryAnalytics;
  onSelectOrder?: (orderId: string) => void;
  dateScope?: DateScope;
  customRange?: CustomDateRange;
  initialMode?: 'pos' | 'dispatch';
}

export function OmnichannelOutletsTab({
  orders,
  summary,
  onSelectOrder,
  dateScope,
  customRange,
  initialMode = 'pos',
}: OmnichannelOutletsTabProps) {
  const [activeMode, setActiveMode] = useState<'pos' | 'dispatch'>(initialMode);

  return (
    <div className="space-y-6">
      {/* Top Segmented Hub Switcher */}
      <div className="bg-white dark:bg-deepBlack-card border border-slate-200/90 dark:border-deepBlack-border rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-headline text-slate-900 dark:text-white flex items-center gap-2">
                Retail Outlets Hub
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-sans uppercase">
                  Mirpur • Cumilla • Wari • Sylhet
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unified retail hub isolating in-store POS register walk-ins from regional split courier dispatches.
              </p>
            </div>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border text-xs font-semibold self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveMode('pos')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeMode === 'pos'
                  ? 'bg-white dark:bg-deepBlack-card text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-deepBlack-border'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
              <span>In-Store POS Walk-Ins</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('dispatch')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeMode === 'dispatch'
                  ? 'bg-white dark:bg-deepBlack-card text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-deepBlack-border'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4 text-blue-500" />
              <span>Branch Split Couriers (c, w, s, m)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Active Outlets Sub-View */}
      {activeMode === 'pos' ? (
        <OutletSalesTab
          orders={orders}
          summary={summary}
          onSelectOrder={onSelectOrder}
          dateScope={dateScope}
          customRange={customRange}
        />
      ) : (
        <OutletDispatchTab
          orders={orders}
          summary={summary}
          onSelectOrder={onSelectOrder}
        />
      )}
    </div>
  );
}
