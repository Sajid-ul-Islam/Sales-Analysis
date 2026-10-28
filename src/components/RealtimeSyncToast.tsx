"use client";

import React, { useState } from 'react';
import { RefreshCw, X, Radio, ArrowUpRight } from 'lucide-react';
import type { SyncEvent } from '@/lib/sync/eventLog';

interface RealtimeSyncToastProps {
  isConnected: boolean;
  isReconnecting: boolean;
  pendingCount: number;
  lastEvent: SyncEvent | null;
  onRefresh: () => void;
  onClear: () => void;
}

export function RealtimeSyncToast({
  isConnected,
  isReconnecting,
  pendingCount,
  lastEvent,
  onRefresh,
  onClear,
}: RealtimeSyncToastProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // If there are no pending events and connected, or user dismissed and no new events
  if (pendingCount === 0 && !isReconnecting) {
    return null;
  }

  if (isDismissed && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900/95 dark:bg-[#121212]/95 backdrop-blur-md text-white border border-slate-800 dark:border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/40 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : isReconnecting ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
              )}
            </span>
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">
              {isReconnecting
                ? 'Reconnecting Live Stream...'
                : isConnected
                ? 'Real-Time Sync Feed'
                : 'Stream Disconnected'}
            </span>
          </div>

          <button
            onClick={() => {
              setIsDismissed(true);
              onClear();
            }}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        {pendingCount > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <span className="bg-primary/20 text-primary-light border border-primary/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                +{pendingCount} {pendingCount === 1 ? 'Event' : 'Events'}
              </span>
              <span>New Dispatches & Updates</span>
            </div>
            {lastEvent && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {lastEvent.summary}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <button
              onClick={() => {
                onRefresh();
                onClear();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-all shadow-md active:scale-98"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Orders</span>
            </button>
            <button
              onClick={onClear}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
