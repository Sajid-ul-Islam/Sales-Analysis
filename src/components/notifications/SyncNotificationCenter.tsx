"use client";

import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ArrowRight,
  Clock,
  Trash2
} from 'lucide-react';
import {
  SyncNotificationItem,
  dispatchSyncNotification,
  DEEN_SYNC_NOTIFICATION_EVENT,
  DEEN_SYNC_HISTORY_STORAGE_KEY
} from '@/lib/syncNotificationBus';

export type { SyncNotificationItem };
export { dispatchSyncNotification, DEEN_SYNC_NOTIFICATION_EVENT, DEEN_SYNC_HISTORY_STORAGE_KEY };

export interface SyncNotificationCenterProps {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigateToTab?: (tabId: string, filter?: string) => void;
  onCountChange?: (count: number) => void;
}

export function SyncNotificationCenter({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onNavigateToTab,
  onCountChange
}: SyncNotificationCenterProps) {
  const [toasts, setToasts] = useState<SyncNotificationItem[]>([]);
  const [history, setHistory] = useState<SyncNotificationItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('deen_sync_history_v1');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);
  const isDrawerOpen = propIsOpen !== undefined ? propIsOpen : internalDrawerOpen;

  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      setInternalDrawerOpen(false);
    }
  };

  useEffect(() => {
    onCountChange?.(toasts.length);
  }, [toasts.length, onCountChange]);

  // Listen for custom notifications across the app
  useEffect(() => {
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent<SyncNotificationItem>;
      if (customEvent.detail) {
        const item: SyncNotificationItem = customEvent.detail;

        // Add to active floating toasts (auto-dismiss after 4.5s)
        setToasts((prev) => [item, ...prev.slice(0, 3)]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, 4500);

        // Add to persistent history
        setHistory((prev) => {
          const updated = [item, ...prev].slice(0, 25);
          try {
            localStorage.setItem('deen_sync_history_v1', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    };

    window.addEventListener('deen_sync_notification', handleNotification);
    return () => window.removeEventListener('deen_sync_notification', handleNotification);
  }, []);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('deen_sync_history_v1');
    } catch {}
  };

  const handleItemClick = (item: SyncNotificationItem) => {
    if (item.targetTab && onNavigateToTab) {
      onNavigateToTab(item.targetTab, item.targetOrderId);
      handleClose();
    }
  };

  return (
    <>
      {/* Floating Active Toasts (Top Right) */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isDiscrepancy = toast.type === 'discrepancy_detected';
          const isCourier = toast.type === 'courier_updated';

          let borderTheme = 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/95 dark:bg-[#061A12]/95';
          let icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />;

          if (isError) {
            borderTheme = 'border-rose-200 dark:border-rose-900/60 bg-rose-50/95 dark:bg-[#200A0A]/95';
            icon = <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />;
          } else if (isDiscrepancy) {
            borderTheme = 'border-amber-200 dark:border-amber-900/60 bg-amber-50/95 dark:bg-[#1F1505]/95';
            icon = <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />;
          } else if (isCourier) {
            borderTheme = 'border-blue-200 dark:border-blue-900/60 bg-blue-50/95 dark:bg-[#071324]/95';
            icon = <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg backdrop-blur-md flex items-start gap-3 transition-all animate-slideInRight ${borderTheme}`}
            >
              {icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                    {toast.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {toast.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                  {toast.description}
                </p>
                {toast.targetTab && (
                  <button
                    type="button"
                    onClick={() => handleItemClick(toast)}
                    className="mt-1.5 text-[10px] font-bold text-[#EB5A19] dark:text-orange-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect details</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDismissToast(toast.id)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* History Slide-Over Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={handleClose}
          />

          <div className="relative w-full max-w-sm bg-white dark:bg-[#0E0E0E] shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-[#222] z-10 animate-slideInRight">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-[#1F1F1F] flex items-center justify-between bg-slate-50 dark:bg-[#070707]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#EB5A19]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Sync & Logistics Events
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-[#EB5A19]">
                  {history.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Clear history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Event List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold">No sync events recorded yet</p>
                  <p className="text-[11px] mt-1">Events from WooCommerce and Pathao will appear here automatically.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-[#222] bg-slate-50/50 dark:bg-[#121212] hover:bg-slate-100/70 dark:hover:bg-[#181818] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
