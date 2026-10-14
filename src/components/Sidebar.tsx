"use client";

import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  GitCompare,
  MapPin,
  ListOrdered,
  Shirt,
  RotateCcw,
  ShieldAlert,
  Coins,
  ChevronDown,
  Layers,
  HelpCircle,
  Settings,
  Truck,
  ArrowRightLeft,
  Store,
  ShoppingBag,
  BarChart3,
  X,
  User
} from 'lucide-react';

import { DeenLogo } from './DeenLogo';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  returnCount: number;
  mismatchCount?: number;
  exchangeCount?: number;
  activeSourceMode?: 'UPLOAD' | 'API';
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  returnCount,
  mismatchCount,
  exchangeCount,
  activeSourceMode = 'UPLOAD',
  mobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const navItems = [
    { id: 'tabExecutive', label: 'Executive', icon: LayoutDashboard },
    { id: 'tabMarketingAnalytics', label: 'Ad Analytics', icon: BarChart3, highlight: true },
    { id: 'tabOutletDispatch', label: 'Outlet Dispatch', icon: Store, highlight: true },
    { id: 'tabOutletSales', label: 'Outlet Sales', icon: ShoppingBag, highlight: true },
    { id: 'tabCourierMismatch', label: 'Courier Audit', icon: Truck, countBadge: mismatchCount, highlight: true },
    { id: 'tabTerritory', label: 'Territory', icon: MapPin },
    { id: 'tabStatus', label: 'Status Matrix', icon: GitCompare },
    { id: 'tabOrders', label: 'Orders Ledger', icon: ListOrdered },
    { id: 'tabSku', label: 'SKU Flow', icon: Shirt },
    { id: 'tabItemReturns', label: 'Returned Items', icon: RotateCcw, countBadge: returnCount },
    { id: 'tabExchanges', label: 'Exchanges', icon: ArrowRightLeft, countBadge: exchangeCount, highlight: true },
    { id: 'tabCustomerRisk', label: 'Customer Risk', icon: ShieldAlert, highlight: true },
    { id: 'tabUnitEconomics', label: 'Unit Economics', icon: Calculator, highlight: true },
    { id: 'tabSettings', label: 'Settings & Themes', icon: Settings, highlight: true },
  ];

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderSidebarBody = (isMobile = false) => (
    <>
      <div className="flex flex-col min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <DeenLogo size="md" />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          
            </span>
            {isMobile && onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Workspace Subheader Pill */}
        <div className="px-3.5 py-2 mx-3 my-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-orange-100/80 text-primary flex items-center justify-center shrink-0">
                <Layers className="w-3 h-3" />
              </div>
              <span className="text-xs font-semibold text-slate-900 truncate">Operations Hub</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 font-mono">
              Live
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
            <span className="text-slate-400 font-medium">Source:</span>
            <span className={`font-bold flex items-center gap-1 ${
              activeSourceMode === 'API' ? 'text-emerald-700' : 'text-primary'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                activeSourceMode === 'API' ? 'bg-emerald-500 animate-pulse' : 'bg-primary'
              }`}></span>
              {activeSourceMode === 'API' ? 'Cloud API' : 'Excel Files'}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase font-headline">
            Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                  isActive
                    ? 'bg-orange-50 text-primary font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-primary'
                        : item.highlight
                        ? 'text-amber-500'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.countBadge !== undefined && item.countBadge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-primary text-white' : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}>
                    {item.countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Account Pill & Settings Shortcut */}
      <div className="p-3 border-t border-slate-200 shrink-0">
        <div
          onClick={() => handleItemClick('tabSettings')}
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
          title="Open System Settings & Custom Themes"
        >
          <div className="relative w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 group-hover:border-primary/50 group-hover:bg-orange-50 group-hover:text-primary transition-all">
            <User className="w-4 h-4" />
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
              Operations Admin
            </span>
            <span className="text-[10px] text-slate-400 truncate">Settings & Themes</span>
          </div>
          <Settings className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-slate-200 bg-white flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none shadow-2xs">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200 select-none">
            {renderSidebarBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
