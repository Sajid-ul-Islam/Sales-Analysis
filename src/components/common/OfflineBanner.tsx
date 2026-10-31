'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOnline, lastOnlineAt } = useNetworkStatus();
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    if (isOnline && lastOnlineAt) {
      setShowReconnectedToast(true);
      const timer = setTimeout(() => setShowReconnectedToast(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, lastOnlineAt]);

  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2.5 flex items-center justify-between text-xs transition-all duration-300 z-50 animate-fadeIn"
      >
        <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
            <WifiOff className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-amber-200 mr-2">⚡ Offline Mode:</span>
            <span>Internet connection unavailable. Operating seamlessly from browser IndexedDB cache. Automated live sync is paused.</span>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 border border-amber-800/60 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Local Cache Protected
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (showReconnectedToast) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-slideUp"
      >
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <Wifi className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="font-bold text-emerald-100">Back Online</p>
          <p className="text-emerald-300/80 text-[11px]">Internet connection restored. Live operations sync re-enabled.</p>
        </div>
      </div>
    );
  }

  return null;
}
