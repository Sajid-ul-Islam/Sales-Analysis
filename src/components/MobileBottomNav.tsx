"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Radio,
  ClipboardList,
  RotateCcw,
  Menu
} from 'lucide-react';

/**
 * Interface contract for MobileBottomNav component props.
 */
export interface MobileBottomNavProps {
  /**
   * Currently active tab identifier in the dashboard (e.g. 'tabExecutive', 'tabOrders', etc.).
   */
  activeTab: string;
  /**
   * Callback fired when a primary tab is tapped by the user.
   */
  onSelectTab: (tabId: string) => void;
  /**
   * Callback fired to toggle or reveal the mobile slide-over drawer for extended modules.
   */
  onOpenDrawer: () => void;
  /**
   * Optional badge count for returned items.
   */
  returnCount?: number;
  /**
   * Optional badge count for orders.
   */
  orderCount?: number;
  /**
   * Current data source mode ('UPLOAD' for Excel spreadsheets or 'API' for Cloud sync).
   */
  activeSourceMode?: 'UPLOAD' | 'API';
  /**
   * Optional callback to trigger immediate synchronization or toggle between API and files.
   */
  onTriggerSync?: () => void;
  /**
   * Optional flag indicating if a cloud data synchronization is currently in progress.
   */
  isSyncing?: boolean;
  /**
   * Optional badge count for incoming real-time sync events.
   */
  pendingEventsCount?: number;
}

/**
 * MobileBottomNav
 * 
 * Sticky mobile navigation bar for viewports < 768px (md:hidden).
 * Provides one-tap switching between the 4 primary daily-driver operational tabs:
 * 1. Overview (tabExecutive)
 * 2. Live Ops (tabLiveOpsTerminal)
 * 3. Orders (tabOrders)
 * 4. Returns (tabItemReturns)
 * Plus a 5th action to trigger the slide-over drawer for extended modules (More).
 * 
 * Complies with:
 * - WCAG AA & Mobile Touch Target standard (>= 48px width and height).
 * - Safe area bottom inset (env(safe-area-inset-bottom)).
 * - Auto-hide on scroll-down to maximize vertical space for data tables.
 * - DEEN Commerce Design System (Brand Orange #EB5A19, high-contrast dark tokens).
 * - True Deep Black background (#000000) matching dashboard surface.
 */
export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  returnCount = 0,
  orderCount,
  activeSourceMode: _activeSourceMode = 'UPLOAD',
  onTriggerSync: _onTriggerSync,
  isSyncing: _isSyncing = false,
  pendingEventsCount = 0
}: MobileBottomNavProps) {
  // Check if current active tab is an extended module from the slide-over drawer
  const primaryTabIds = ['tabExecutive', 'tabLiveOps', 'tabOrders', 'tabItemReturns'];
  const isExtendedModuleActive = !primaryTabIds.includes(activeTab);

  // Auto-hide navigation bar on scroll-down to reclaim 64px vertical space for tables
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          // Hide when scrolling downwards past 80px with clear intent (25px delta)
          if (currentScrollY > 80 && currentScrollY > lastScrollYRef.current + 25) {
            setIsVisible(false);
          } else if (currentScrollY < lastScrollYRef.current - 25 || currentScrollY <= 20) {
            // Restore when scrolling upwards with clear intent or near top of page
            setIsVisible(true);
          }
          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-deepBlack-canvas/95 backdrop-blur-md border-t border-slate-200/90 dark:border-deepBlack-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)] select-none transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-label="Mobile Navigation"
      role="navigation"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1 items-stretch">
        {/* 1. Overview Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabExecutive')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark dark:focus-visible:ring-orange-400 focus-visible:ring-inset cursor-pointer ${
            activeTab === 'tabExecutive'
              ? 'text-primary-dark dark:text-orange-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="Overview tab"
          aria-current={activeTab === 'tabExecutive' ? 'page' : undefined}
        >
          {activeTab === 'tabExecutive' && (
            <span
              className="absolute top-0 inset-x-0 mx-auto w-10 h-1 bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)] transition-all duration-200"
              aria-hidden="true"
            />
          )}
          <div className="relative">
            <LayoutDashboard className={`w-5 h-5 shrink-0 transition-transform duration-150 ${activeTab === 'tabExecutive' ? 'scale-105' : 'group-hover:scale-105'}`} />
          </div>
          <span className="text-[11px] mt-1 tracking-tight truncate max-w-[62px]">
            Overview
          </span>
        </button>

        {/* 2. Live Ops Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabLiveOps')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark dark:focus-visible:ring-orange-400 focus-visible:ring-inset cursor-pointer ${
            activeTab === 'tabLiveOps'
              ? 'text-primary-dark dark:text-orange-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="Live Operations Terminal tab"
          aria-current={activeTab === 'tabLiveOps' ? 'page' : undefined}
        >
          {activeTab === 'tabLiveOps' && (
            <span
              className="absolute top-0 inset-x-0 mx-auto w-10 h-1 bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)] transition-all duration-200"
              aria-hidden="true"
            />
          )}
          <div className="relative">
            <Radio className={`w-5 h-5 shrink-0 transition-transform duration-150 ${activeTab === 'tabLiveOps' ? 'scale-105' : 'group-hover:scale-105'}`} />
            {pendingEventsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF5500]"></span>
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight truncate max-w-[62px]">
            Live Ops
          </span>
        </button>

        {/* 3. Orders Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabOrders')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark dark:focus-visible:ring-orange-400 focus-visible:ring-inset cursor-pointer ${
            activeTab === 'tabOrders'
              ? 'text-primary-dark dark:text-orange-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="Orders Ledger tab"
          aria-current={activeTab === 'tabOrders' ? 'page' : undefined}
        >
          {activeTab === 'tabOrders' && (
            <span
              className="absolute top-0 inset-x-0 mx-auto w-10 h-1 bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)] transition-all duration-200"
              aria-hidden="true"
            />
          )}
          <div className="relative">
            <ClipboardList className={`w-5 h-5 shrink-0 transition-transform duration-150 ${activeTab === 'tabOrders' ? 'scale-105' : 'group-hover:scale-105'}`} />
            {orderCount !== undefined && orderCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 rounded-full text-[9px] font-bold bg-slate-900 text-white min-w-[15px] text-center leading-tight">
                {orderCount > 99 ? '99+' : orderCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight truncate max-w-[62px]">
            Orders
          </span>
        </button>

        {/* 4. Returns Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabItemReturns')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark dark:focus-visible:ring-orange-400 focus-visible:ring-inset cursor-pointer ${
            activeTab === 'tabItemReturns'
              ? 'text-primary-dark dark:text-orange-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="Item Returns and Audit tab"
          aria-current={activeTab === 'tabItemReturns' ? 'page' : undefined}
        >
          {activeTab === 'tabItemReturns' && (
            <span
              className="absolute top-0 inset-x-0 mx-auto w-10 h-1 bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)] transition-all duration-200"
              aria-hidden="true"
            />
          )}
          <div className="relative">
            <RotateCcw className={`w-5 h-5 shrink-0 transition-transform duration-150 ${activeTab === 'tabItemReturns' ? 'scale-105' : 'group-hover:scale-105'}`} />
            {returnCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 rounded-full text-[9px] font-bold bg-rose-600 text-white min-w-[15px] text-center leading-tight">
                {returnCount > 99 ? '99+' : returnCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight truncate max-w-[62px]">
            Returns
          </span>
        </button>

        {/* 5. More / Extended Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark dark:focus-visible:ring-orange-400 focus-visible:ring-inset cursor-pointer ${
            isExtendedModuleActive
              ? 'text-primary-dark dark:text-orange-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="Open extended navigation drawer"
          aria-haspopup="dialog"
        >
          {isExtendedModuleActive && (
            <span
              className="absolute top-0 inset-x-0 mx-auto w-10 h-1 bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)] transition-all duration-200"
              aria-hidden="true"
            />
          )}
          <div className="relative">
            <Menu className="w-5 h-5 shrink-0 transition-transform duration-150 group-hover:scale-105" />
            {isExtendedModuleActive && (
              <span
                className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#EB5A19] ring-2 ring-white dark:ring-deepBlack-canvas"
                aria-hidden="true"
              />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight truncate max-w-[62px]">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
