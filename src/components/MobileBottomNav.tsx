"use client";

import React from 'react';
import {
  LayoutDashboard,
  ListOrdered,
  RotateCcw,
  Cloud,
  RefreshCw,
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
   * Optional badge count for returned items (displayed on the Returns tab).
   */
  returnCount?: number;
  /**
   * Optional badge count for orders (displayed on the Orders tab).
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
}

/**
 * MobileBottomNav
 * 
 * Sticky mobile navigation bar for viewports < 768px (md:hidden).
 * Provides one-tap switching between the 4 highest-frequency reconciliation tabs:
 * 1. Overview (tabExecutive)
 * 2. Orders (tabOrders)
 * 3. Returns (tabItemReturns)
 * 4. Sync (tabSettings / Cloud Sync)
 * Plus a 5th action to trigger the slide-over drawer for extended modules (More).
 * 
 * Complies with:
 * - WCAG AA & Mobile Touch Target standard (>= 48px width and height).
 * - Safe area bottom inset (env(safe-area-inset-bottom)).
 * - DEEN Commerce Design System (Brand Orange #EB5A19, high-contrast dark tokens).
 * - Dual-engine fail-safe Tailwind styling.
 */
export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  returnCount = 0,
  orderCount,
  activeSourceMode = 'UPLOAD',
  onTriggerSync,
  isSyncing = false
}: MobileBottomNavProps) {
  // Check if current active tab is an extended module from the slide-over drawer
  const primaryTabIds = ['tabExecutive', 'tabOrders', 'tabItemReturns', 'tabSettings'];
  const isExtendedModuleActive = !primaryTabIds.includes(activeTab);

  // Tab 4 (Sync) selection handler
  const handleSyncClick = () => {
    if (onTriggerSync && activeTab === 'tabSettings') {
      onTriggerSync();
    } else {
      onSelectTab('tabSettings');
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#050505]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#1F1F1F] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)] select-none transition-colors duration-200"
      aria-label="Mobile Navigation"
      role="navigation"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1 items-stretch">
        {/* 1. Overview Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabExecutive')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB5A19] focus-visible:ring-inset ${
            activeTab === 'tabExecutive'
              ? 'text-[#EB5A19] dark:text-[#EB5A19] font-bold'
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
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[62px]">
            Overview
          </span>
        </button>

        {/* 2. Orders Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabOrders')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB5A19] focus-visible:ring-inset ${
            activeTab === 'tabOrders'
              ? 'text-[#EB5A19] dark:text-[#EB5A19] font-bold'
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
            <ListOrdered className={`w-5 h-5 shrink-0 transition-transform duration-150 ${activeTab === 'tabOrders' ? 'scale-105' : 'group-hover:scale-105'}`} />
            {orderCount !== undefined && orderCount > 0 && (
              <span
                className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-slate-700 text-white min-w-[16px] text-center leading-none border border-white dark:border-slate-900 shadow-2xs"
                aria-label={`${orderCount} orders`}
              >
                {orderCount > 99 ? '99+' : orderCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[62px]">
            Orders
          </span>
        </button>

        {/* 3. Returns Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('tabItemReturns')}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB5A19] focus-visible:ring-inset ${
            activeTab === 'tabItemReturns'
              ? 'text-[#EB5A19] dark:text-[#EB5A19] font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label={`Returned Items tab${returnCount > 0 ? `, ${returnCount} returns` : ''}`}
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
              <span
                className="absolute -top-1.5 -right-2.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white min-w-[18px] text-center leading-none border border-white dark:border-slate-900 shadow-2xs animate-in zoom-in-75 duration-200"
                aria-label={`${returnCount} returned items`}
              >
                {returnCount > 99 ? '99+' : returnCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[62px]">
            Returns
          </span>
        </button>

        {/* 4. Sync Tab */}
        <button
          type="button"
          onClick={handleSyncClick}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB5A19] focus-visible:ring-inset ${
            activeTab === 'tabSettings'
              ? 'text-[#EB5A19] dark:text-[#EB5A19] font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
          }`}
          aria-label="Sync and Settings tab"
          aria-current={activeTab === 'tabSettings' ? 'page' : undefined}
          title={activeSourceMode === 'API' ? 'Cloud API Sync & Settings' : 'Excel Files Sync & Settings'}
        >
          {activeTab === 'tabSettings' && (
            <span
              className="absolute top-0 inset-x-0 mx-auto w-10 h-1 bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)] transition-all duration-200"
              aria-hidden="true"
            />
          )}
          <div className="relative">
            {activeSourceMode === 'API' ? (
              <Cloud className={`w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 transition-transform duration-150 ${isSyncing ? 'animate-pulse' : ''} ${activeTab === 'tabSettings' ? 'scale-105' : 'group-hover:scale-105'}`} />
            ) : (
              <RefreshCw className={`w-5 h-5 shrink-0 transition-transform duration-150 ${isSyncing ? 'animate-spin' : ''} ${activeTab === 'tabSettings' ? 'scale-105' : 'group-hover:scale-105'}`} />
            )}
            {/* Live source status indicator dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
                activeSourceMode === 'API' ? 'bg-emerald-500 animate-pulse' : 'bg-primary'
              }`}
              aria-hidden="true"
            />
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[62px]">
            {activeSourceMode === 'API' ? 'Cloud' : 'Sync'}
          </span>
        </button>

        {/* 5. More / Extended Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className={`group relative flex flex-col items-center justify-center min-h-[48px] min-w-[48px] h-full w-full py-1.5 px-0.5 select-none transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB5A19] focus-visible:ring-inset ${
            isExtendedModuleActive
              ? 'text-[#EB5A19] dark:text-[#EB5A19] font-bold'
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
                className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#EB5A19] ring-2 ring-white dark:ring-slate-900"
                aria-hidden="true"
              />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[62px]">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
