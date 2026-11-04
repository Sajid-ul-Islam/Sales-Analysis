"use client";

import React, { useState } from 'react';
import { ReturnedItemRow, ExchangedOrderRow, SummaryAnalytics } from '@/types';
import { ItemReturnsTab } from './ItemReturnsTab';
import { ExchangedOrdersTab } from './ExchangedOrdersTab';
import { RotateCcw, ArrowRightLeft } from 'lucide-react';

export interface AfterSalesHubProps {
  returnedItems: ReturnedItemRow[];
  exchangedOrders: ExchangedOrderRow[];
  summary: SummaryAnalytics;
  onSelectOrder?: (orderId: string) => void;
  initialMode?: 'returns' | 'exchanges';
}

export function AfterSalesHub({
  returnedItems = [],
  exchangedOrders = [],
  summary,
  onSelectOrder,
  initialMode = 'returns'
}: AfterSalesHubProps) {
  const [activeMode, setActiveMode] = useState<'returns' | 'exchanges'>(initialMode);

  const totalReturnedUnits = returnedItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalExchangesCount = exchangedOrders.length;

  return (
    <div className="space-y-6">
      {/* Top Segmented Hub Switcher */}
      <div className="bg-white dark:bg-deepBlack-card border border-slate-200/90 dark:border-deepBlack-border rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <RotateCcw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-headline text-slate-900 dark:text-white flex items-center gap-2">
                After-Sales & Reverse Logistics Hub
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-sans uppercase">
                  Consolidated After-Sales
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unified after-sales tracking: customer rejected returns, quality restock grading, and size/variant replacements.
              </p>
            </div>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border text-xs font-semibold self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveMode('returns')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeMode === 'returns'
                  ? 'bg-white dark:bg-deepBlack-card text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-deepBlack-border'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-rose-500" />
              <span>Returned Items</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold">
                {totalReturnedUnits.toLocaleString()}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('exchanges')}
              className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeMode === 'exchanges'
                  ? 'bg-white dark:bg-deepBlack-card text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-deepBlack-border'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
              <span>Size Exchanges</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold">
                {totalExchangesCount.toLocaleString()}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Active View */}
      {activeMode === 'returns' ? (
        <ItemReturnsTab
          returnedItems={returnedItems}
          onSelectOrder={onSelectOrder}
        />
      ) : (
        <ExchangedOrdersTab
          exchangedOrders={exchangedOrders}
          summary={summary}
        />
      )}
    </div>
  );
}
