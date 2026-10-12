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
  ArrowRightLeft
} from 'lucide-react';

import { DeenLogo, DeenLogoMark } from './DeenLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  returnCount: number;
  mismatchCount?: number;
  exchangeCount?: number;
  activeSourceMode?: 'UPLOAD' | 'API';
}

export function Sidebar({ activeTab, setActiveTab, returnCount, mismatchCount, exchangeCount, activeSourceMode = 'UPLOAD' }: SidebarProps) {
  const navItems = [
    { id: 'tabExecutive', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'tabCourierMismatch', label: 'Pathao Courier Audit', icon: Truck, countBadge: mismatchCount, highlight: true },
    { id: 'tabTerritory', label: 'Territory Performance', icon: MapPin },
    { id: 'tabStatus', label: 'Reconciliation Matrix', icon: GitCompare },
    { id: 'tabOrders', label: 'Orders Ledger', icon: ListOrdered },
    { id: 'tabSku', label: 'SKU & Category Flow', icon: Shirt },
    { id: 'tabItemReturns', label: 'Returned Items', icon: RotateCcw, countBadge: returnCount },
    { id: 'tabExchanges', label: 'Exchanged Orders', icon: ArrowRightLeft, countBadge: exchangeCount, highlight: true },
    { id: 'tabCustomerRisk', label: 'Customer Risk Intelligence', icon: ShieldAlert, highlight: true },
    { id: 'tabUnitEconomics', label: 'Sales & Calculation', icon: Calculator, highlight: true },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30 select-none shadow-2xs">
      <div className="flex flex-col min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <DeenLogo size="md" />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            v2.6
          </span>
        </div>

        {/* Workspace Subheader Pill */}
        <div className="px-3.5 py-2.5 mx-3 my-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <DeenLogoMark className="w-5 h-5 !rounded-md" />
              <span className="text-xs font-semibold text-slate-900 truncate">Dhaka HQ Cluster</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 font-mono">
              Live
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
            <span className="text-slate-400 font-medium">Active Source:</span>
            <span className={`font-bold flex items-center gap-1 ${
              activeSourceMode === 'API' ? 'text-emerald-700' : 'text-primary'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                activeSourceMode === 'API' ? 'bg-emerald-500 animate-pulse' : 'bg-primary'
              }`}></span>
              {activeSourceMode === 'API' ? 'Cloud REST API' : 'Spreadsheets'}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase font-headline">
            Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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

      {/* Bottom Account Pill */}
      <div className="p-3 border-t border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
          <DeenLogoMark className="w-8 h-8 !rounded-lg" />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-900 truncate">Deen Operations</span>
            <span className="text-[10px] text-slate-400 truncate">ops@deencommerce.com</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
      </div>
    </aside>
  );
}
