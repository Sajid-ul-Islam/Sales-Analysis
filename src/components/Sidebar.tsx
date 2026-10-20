"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  GitCompare,
  MapPin,
  ListOrdered,
  Shirt,
  RotateCcw,
  ShieldAlert,
  Settings,
  Truck,
  ArrowRightLeft,
  Store,
  ShoppingBag,
  BarChart3,
  X,
  User,
  Activity,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

import { DeenLogo, DeenLogoMark } from './DeenLogo';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  returnCount: number;
  mismatchCount?: number;
  exchangeCount?: number;
  activeSourceMode?: 'UPLOAD' | 'API';
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countBadge?: number;
  highlight?: boolean;
}

interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

export function Sidebar({
  activeTab,
  setActiveTab,
  returnCount,
  mismatchCount = 0,
  exchangeCount = 0,
  activeSourceMode: _activeSourceMode = 'UPLOAD',
  mobileOpen = false,
  onCloseMobile,
  isCollapsed: propIsCollapsed,
  onToggleCollapse: propOnToggleCollapse
}: SidebarProps) {
  // Internal collapse state with localStorage persistence
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('deen_sidebar_collapsed');
        if (saved !== null) {
          setInternalCollapsed(saved === 'true');
        }
      } catch {}
    }
  }, []);

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const handleToggleCollapse = React.useCallback(() => {
    if (propOnToggleCollapse) {
      propOnToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('deen_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  }, [propOnToggleCollapse]);

  // Global keyboard shortcut: ⌘B or Ctrl+B toggles sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleCollapse]);

  // Floating tooltip state for tablet icon rail
  const [activeTooltip, setActiveTooltip] = useState<{
    label: string;
    count?: number;
    top: number;
  } | null>(null);

  // Grouped Navigation Structure
  const navGroups: NavGroupConfig[] = [
    {
      title: 'Core Operations',
      items: [
        { id: 'tabExecutive', label: 'Executive Overview', icon: LayoutDashboard },
        { id: 'tabLiveOps', label: 'Live Orders Terminal', icon: Activity, highlight: true },
        { id: 'tabOrders', label: 'Orders Ledger', icon: ListOrdered },
        { id: 'tabItemReturns', label: 'Returned Items', icon: RotateCcw, countBadge: returnCount },
        { id: 'tabCourierMismatch', label: 'Courier Audit', icon: Truck, countBadge: mismatchCount, highlight: true },
      ]
    },
    {
      title: 'Omni-Channel Outlets',
      items: [
        { id: 'tabOutletDispatch', label: 'Outlet Dispatch', icon: Store, highlight: true },
        { id: 'tabOutletSales', label: 'Outlet Sales', icon: ShoppingBag, highlight: true },
        { id: 'tabTerritory', label: 'Territory Distribution', icon: MapPin },
        { id: 'tabExchanges', label: 'Exchanges', icon: ArrowRightLeft, countBadge: exchangeCount, highlight: true },
      ]
    },
    {
      title: 'Intelligence & Risk',
      items: [
        { id: 'tabMarketingAnalytics', label: 'Ad Analytics', icon: BarChart3, highlight: true },
        { id: 'tabSku', label: 'SKU Flow', icon: Shirt },
        { id: 'tabCustomerRisk', label: 'Customer Risk', icon: ShieldAlert, highlight: true },
        { id: 'tabStatus', label: 'Status & Economics', icon: GitCompare },
      ]
    },
    {
      title: 'Configuration',
      items: [
        { id: 'tabSettings', label: 'Settings & Themes', icon: Settings, highlight: true },
      ]
    }
  ];

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Close mobile drawer on Escape key press
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileOpen]);

  // Tooltip trigger helper for tablet rail
  const showTooltip = (label: string, count: number | undefined, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setActiveTooltip({
      label,
      count,
      top: rect.top + rect.height / 2
    });
  };

  const hideTooltip = () => {
    setActiveTooltip(null);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TABLET ICON RAIL: md:flex lg:hidden (Width: 64px / w-16)               */}
      {/* Maximizes screen real estate for wide data tables on 768px-1024px screens  */}
      {/* ========================================================================= */}
      <aside
        className={`${isCollapsed ? 'hidden md:flex w-16' : 'hidden md:flex lg:hidden w-16'} border-r border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#050505] flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none shadow-2xs transition-all duration-200`}
        aria-label="Tablet navigation rail"
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Mark Header with Expand Button */}
          <div className="h-16 flex flex-col items-center justify-center border-b border-slate-100 dark:border-[#1F1F1F] shrink-0 gap-0.5 py-1">
            <div
              className="relative group cursor-pointer"
              onClick={() => handleItemClick('tabExecutive')}
              title="DEEN Commerce - Executive Overview"
            >
              <DeenLogoMark className="w-6 h-6 rounded-xl shadow-xs" />
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black animate-pulse" />
            </div>
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Expand sidebar (⌘B)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Icon List with Floating Tooltips */}
          <nav className="flex-1 px-2 py-2.5 space-y-1 overflow-y-auto overflow-x-hidden">
            {navGroups.map((group, groupIdx) => (
              <React.Fragment key={group.title}>
                {groupIdx > 0 && (
                  <div className="my-1.5 mx-1 border-t border-slate-100 dark:border-slate-800" />
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id || (item.id === 'tabStatus' && activeTab === 'tabUnitEconomics');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      onMouseEnter={(e) => showTooltip(item.label, item.countBadge, e.currentTarget)}
                      onMouseLeave={hideTooltip}
                      onFocus={(e) => showTooltip(item.label, item.countBadge, e.currentTarget)}
                      onBlur={hideTooltip}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full min-h-[44px] h-11 rounded-xl flex items-center justify-center relative transition-all group focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        isActive
                          ? 'bg-orange-50 text-primary font-bold shadow-2xs dark:bg-orange-950/40 dark:text-orange-400'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                      )}

                      <Icon
                        className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive
                            ? 'text-primary dark:text-orange-400'
                            : item.highlight
                            ? 'text-amber-500/90 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                        }`}
                      />

                      {/* Count badge pill */}
                      {item.countBadge !== undefined && item.countBadge > 0 && (
                        <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs bg-rose-500 text-white leading-tight flex items-center justify-center">
                          {item.countBadge > 99 ? '99+' : item.countBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Tablet Rail Bottom Profile / Settings */}
        <div className="p-2 border-t border-slate-200 dark:border-[#1F1F1F] shrink-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => handleItemClick('tabSettings')}
            onMouseEnter={(e) => showTooltip('Settings & Themes (Admin)', undefined, e.currentTarget)}
            onMouseLeave={hideTooltip}
            onFocus={(e) => showTooltip('Settings & Themes (Admin)', undefined, e.currentTarget)}
            onBlur={hideTooltip}
            aria-label="Settings and Themes"
            className="w-11 h-11 min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#161616] relative group transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <div className="relative w-8 h-8 rounded-full bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs shrink-0 group-hover:border-primary/50 group-hover:text-primary transition-all">
              <User className="w-4 h-4" />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1.5 ring-white dark:ring-black" />
            </div>
          </button>
        </div>

        {/* Floating Tooltip Portal Tethered to Screen Coordinates */}
        {activeTooltip && (
          <div
            role="tooltip"
            className="fixed z-50 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl pointer-events-none flex items-center gap-1.5 border border-slate-700/60 transition-all duration-150 animate-in fade-in-0 zoom-in-95"
            style={{
              left: '4.5rem', // 72px (rail is 64px, + 8px gap)
              top: `${activeTooltip.top}px`,
              transform: 'translateY(-50%)'
            }}
          >
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800" />
            <span>{activeTooltip.label}</span>
            {activeTooltip.count !== undefined && activeTooltip.count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white">
                {activeTooltip.count}
              </span>
            )}
          </div>
        )}
      </aside>

      {/* ========================================================================= */}
      {/* 2. DESKTOP PERSISTENT SIDEBAR: lg:flex (Width: 256px / w-64)              */}
      {/* Full-featured desktop navigation with brand header and workspace status   */}
      {/* ========================================================================= */}
      <aside
        className={`${isCollapsed ? 'hidden' : 'hidden lg:flex w-64'} border-r border-slate-200 dark:border-[#1F1F1F] bg-white dark:bg-[#050505] flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none shadow-2xs transition-all duration-200`}
        aria-label="Desktop sidebar navigation"
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header */}
          <div className="h-16 px-4 border-b border-slate-100 dark:border-[#1F1F1F] flex items-center justify-between shrink-0">
            <DeenLogo size="md" />
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Collapse sidebar (⌘B)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grouped Navigation Links (WCAG AA >=44px) */}
          <nav className="flex-1 px-3 py-1 space-y-3 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-2.5 pt-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase font-headline">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id || (item.id === 'tabStatus' && activeTab === 'tabUnitEconomics');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left group relative focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                        isActive
                          ? 'bg-orange-50 text-primary font-bold shadow-2xs dark:bg-orange-950/40 dark:text-orange-400'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-full" />
                      )}

                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-primary dark:text-orange-400'
                              : item.highlight
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.countBadge !== undefined && item.countBadge > 0 && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-primary text-white'
                            : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                        }`}>
                          {item.countBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Desktop Account & Settings Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-[#1F1F1F] shrink-0">
          <button
            type="button"
            onClick={() => handleItemClick('tabSettings')}
            className="w-full min-h-[44px] flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-[#161616] cursor-pointer transition-colors group text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
            title="Open System Settings & Custom Themes"
          >
            <div className="relative w-8 h-8 rounded-full bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs shrink-0 group-hover:border-primary/50 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-primary transition-all">
              <User className="w-4 h-4" />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                Operations Admin
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 truncate">Settings & Themes</span>
            </div>
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 3. MOBILE SLIDE-OVER DRAWER: md:hidden (Triggered via mobileOpen)         */}
      {/* Slide-over off-canvas drawer with minimum 48px touch targets & backdrop  */}
      {/* ========================================================================= */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative w-72 sm:w-80 max-w-[85vw] bg-white dark:bg-[#050505] h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200 select-none">
            <div className="flex flex-col min-h-0 flex-1">
              {/* Drawer Brand Header with 48px Close Button */}
              <div className="h-16 px-4 border-b border-slate-100 dark:border-[#1F1F1F] flex items-center justify-between shrink-0">
                <DeenLogo size="md" />
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="min-h-[48px] min-w-[48px] p-3 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161616] transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Navigation Links (Mobile 48px minimum touch targets) */}
              <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <div className="px-2 pt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase font-headline">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id || (item.id === 'tabStatus' && activeTab === 'tabUnitEconomics');
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemClick(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full min-h-[48px] flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-left group focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                            isActive
                              ? 'bg-orange-50 text-primary font-bold shadow-2xs dark:bg-orange-950/50 dark:text-orange-400 border-l-4 border-primary'
                              : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={`w-5 h-5 shrink-0 transition-colors ${
                                isActive
                                  ? 'text-primary dark:text-orange-400'
                                  : item.highlight
                                  ? 'text-amber-500 dark:text-amber-400'
                                  : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.countBadge !== undefined && item.countBadge > 0 && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-primary text-white'
                                : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            }`}>
                              {item.countBadge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </div>

            {/* Drawer Account / Settings Footer (Safe Area padded) */}
            <div className="p-3 border-t border-slate-200 dark:border-[#1F1F1F] shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={() => handleItemClick('tabSettings')}
                className="w-full min-h-[48px] flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="relative w-9 h-9 rounded-full bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-sm shrink-0">
                  <User className="w-5 h-5" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Operations Admin
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-400 truncate">Settings & Themes</span>
                </div>
                <Settings className="w-5 h-5 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
