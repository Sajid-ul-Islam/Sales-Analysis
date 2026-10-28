"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Download,
  Sun,
  Settings,
  ShoppingBag,
  Truck,
  RotateCcw,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  MapPin,
  FileSpreadsheet,
  CornerDownLeft,
  Tag,
  Store,
  Layers,
  Clock,
  PanelLeftClose
} from 'lucide-react';
import { ReconciliationResult } from '@/lib/reconciliationEngine';
import { RawOrderRow } from '@/types';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber,
} from '@/lib/excelExport';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tabId: string, filter?: string) => void;
  reconciliationResult?: ReconciliationResult | null;
  liveOrders?: RawOrderRow[];
  onTriggerSync?: () => void;
  onToggleTheme?: () => void;
  onToggleCopilot?: (initialQuery?: string) => void;
  onExportExcel?: () => void;
  onExportMonthlyNetSales?: () => void;
  onInspectOrder?: (order: RawOrderRow) => void;
  onToggleSidebar?: () => void;
}

interface PaletteItem {
  id: string;
  category: 'AI Assistant' | 'Actions' | 'Tabs' | 'Orders' | 'Customers' | 'SKUs';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  action: () => void;
}

const ALL_TABS_CONFIG = [
  { id: 'tabExecutive', title: 'Executive Overview', subtitle: 'Net Sales, Return Loss & Top Level KPIs', icon: <TrendingUp className="w-4 h-4 text-orange-500" /> },
  { id: 'tabLiveOps', title: 'Live Operations Terminal', subtitle: 'Real-Time Dispatching, Fulfillment Queue & 7D Baseline', icon: <Clock className="w-4 h-4 text-emerald-500" /> },
  { id: 'tabOrders', title: 'Orders Ledger', subtitle: 'Searchable Master Order Database with Suffix Decoders', icon: <FileSpreadsheet className="w-4 h-4 text-blue-500" /> },
  { id: 'tabItemReturns', title: 'Item Returns Deep-Dive', subtitle: 'Granular Inspection of Full & Partial Return Causes', icon: <RotateCcw className="w-4 h-4 text-amber-500" /> },
  { id: 'tabCourierMismatch', title: 'Courier Mismatch Audit', subtitle: 'Pathao Delivery Tracking & COD Reconciliation Discrepancies', icon: <Truck className="w-4 h-4 text-rose-500" /> },
  { id: 'tabOutletDispatch', title: 'Outlet Dispatch Hub', subtitle: 'Regional Branch Logistics & Parcel Dispatch Allocations', icon: <Layers className="w-4 h-4 text-indigo-500" /> },
  { id: 'tabOutletSales', title: 'Outlet Sales (WooCommerce Live)', subtitle: 'Physical In-Store POS Registers vs Online Store Web Revenue', icon: <Store className="w-4 h-4 text-purple-500" /> },
  { id: 'tabTerritory', title: 'Territory Breakdown', subtitle: 'Inside Dhaka vs Outside Dhaka Logistics & Margin Ratios', icon: <MapPin className="w-4 h-4 text-teal-500" /> },
  { id: 'tabExchanges', title: 'Exchanged Orders Hub', subtitle: 'D- Prefix Consignments & Sizing Replacement Auditing', icon: <RefreshCw className="w-4 h-4 text-violet-500" /> },
  { id: 'tabMarketingAnalytics', title: 'Marketing & Ad Analytics', subtitle: 'Meta Ad Spends, ROAS, Blended CAC & Campaign Efficiency', icon: <TrendingUp className="w-4 h-4 text-pink-500" /> },
  { id: 'tabProductAnalysis', title: 'Product Analysis', subtitle: 'Price Elasticity, Sweet Spot Pricing, Market Basket & Pareto ABC Distribution', icon: <ShoppingBag className="w-4 h-4 text-primary" /> },
  { id: 'tabSku', title: 'SKU Performance', subtitle: 'Garment Product Delivery Conversions & Return Losses', icon: <ShoppingBag className="w-4 h-4 text-cyan-500" /> },
  { id: 'tabCustomerRisk', title: 'Customer Risk Profiles', subtitle: 'Chronic Returner Identification & Advance Fee Protection', icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
  { id: 'tabStatus', title: 'Status & Economics', subtitle: 'COGS, Delivery Recovery, Sunk Losses & Contribution Margins', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
  { id: 'tabSettings', title: 'Settings & Theme Customizer', subtitle: 'Financial Formulas, API Keys, Credentials & Design Tokens', icon: <Settings className="w-4 h-4 text-slate-500" /> }
];

export function CommandPaletteModal({
  isOpen,
  onClose,
  onSelectTab,
  reconciliationResult,
  liveOrders = [],
  onTriggerSync,
  onToggleTheme,
  onToggleCopilot,
  onExportExcel,
  onExportMonthlyNetSales,
  onInspectOrder,
  onToggleSidebar
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'AI Assistant' | 'Actions' | 'Tabs' | 'Orders' | 'Customers' | 'SKUs'>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable index
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // 1. AI Assistant Actions & Prompt Suggestions
    items.push({
      id: 'action-copilot-general',
      category: 'AI Assistant',
      title: 'Ask DEEN Assistant (AI Copilot)',
      subtitle: 'Analyze today sales, delivery telemetry, or returns with AI',
      badge: 'DEEN AI',
      badgeColor: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60',
      icon: <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />,
      action: () => {
        onClose();
        onToggleCopilot?.();
      }
    });

    const AI_PRESET_PROMPTS = [
      {
        id: 'ai-prompt-queue',
        title: "Analyze today fulfillment queue and dispatch pace",
        subtitle: 'Break down processing orders, on-hold items and 7-day rolling baseline comparison',
        prompt: "Analyze today's fulfillment queue, warehouse pack backlog, and compare with our 7-day rolling baseline."
      },
      {
        id: 'ai-prompt-returns',
        title: 'Why is return rate fluctuating by outlet and territory?',
        subtitle: 'Deep-dive into branch returns (Mirpur, Cumilla, Wari, Sylhet) vs central warehouse',
        prompt: "Compare return rates between Central Warehouse and regional branches (Mirpur, Cumilla, Wari, Sylhet). What are the main drivers of return loss?"
      },
      {
        id: 'ai-prompt-customers',
        title: 'Identify top chronic returners and risky buyers',
        subtitle: 'Review customer delivery success rates and flag advance delivery charge requirements',
        prompt: "Identify the top chronic returners and high-risk customer phone numbers with return rates over 40%."
      },
      {
        id: 'ai-prompt-net-sales',
        title: 'Calculate net realized revenue after returns and courier costs',
        subtitle: 'Attribution of gross orders, return deductions, COGS, and customer delivery fees',
        prompt: "Provide an executive summary of net delivered sales, return deductions, COGS, and net brand burden."
      },
      {
        id: 'ai-prompt-courier',
        title: 'Audit Pathao courier delivery tracking and COD discrepancies',
        subtitle: 'Detect orders delivered in courier but processing in store, or uncollected fees',
        prompt: "Audit courier delivery discrepancies and mismatches between Pathao courier status and store orders."
      }
    ];

    AI_PRESET_PROMPTS.forEach(p => {
      items.push({
        id: p.id,
        category: 'AI Assistant',
        title: p.title,
        subtitle: p.subtitle,
        badge: 'AI Prompt',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        action: () => {
          onClose();
          onToggleCopilot?.(p.prompt);
        }
      });
    });

    // 2. Actions

    items.push({
      id: 'action-sync',
      category: 'Actions',
      title: 'Sync Live Store Data',
      subtitle: 'Fetch real-time orders from WooCommerce REST & Pathao Courier',
      badge: 'Live Sync',
      badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
      icon: <RefreshCw className="w-4 h-4 text-emerald-500" />,
      action: () => {
        onClose();
        onTriggerSync?.();
      }
    });

    items.push({
      id: 'action-export',
      category: 'Actions',
      title: 'Export Reconciled Excel Workbook',
      subtitle: 'Download formatted 5-sheet audit ledger with business status columns',
      badge: 'Excel (.xlsx)',
      badgeColor: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
      icon: <Download className="w-4 h-4 text-blue-500" />,
      action: () => {
        onClose();
        onExportExcel?.();
      }
    });

    items.push({
      id: 'action-export-monthly',
      category: 'Actions',
      title: 'Export Monthly Net Sales Report (.xlsx)',
      subtitle: 'Download complete 7-sheet month-end close workbook with P&L, SKU leaderboard & SIP origins',
      badge: 'Month-End',
      badgeColor: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60',
      icon: <FileSpreadsheet className="w-4 h-4 text-orange-500" />,
      action: () => {
        onClose();
        onExportMonthlyNetSales?.();
      }
    });

    items.push({
      id: 'action-theme',
      category: 'Actions',
      title: 'Toggle Dark / Light Theme',
      subtitle: 'Switch application color canvas and high-contrast tokens',
      badge: 'Theme',
      badgeColor: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60',
      icon: <Sun className="w-4 h-4 text-purple-500" />,
      action: () => {
        onClose();
        onToggleTheme?.();
      }
    });

    if (onToggleSidebar) {
      items.push({
        id: 'action-toggle-sidebar',
        category: 'Actions',
        title: 'Toggle Sidebar Collapse (⌘B)',
        subtitle: 'Switch desktop sidebar between full menu and compact icon rail',
        badge: '⌘B',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: <PanelLeftClose className="w-4 h-4 text-slate-500" />,
        action: () => {
          onClose();
          onToggleSidebar();
        }
      });
    }

    // 2. Navigation Tabs
    ALL_TABS_CONFIG.forEach((tab) => {
      items.push({
        id: `tab-${tab.id}`,
        category: 'Tabs',
        title: tab.title,
        subtitle: tab.subtitle,
        badge: 'View',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: tab.icon,
        action: () => {
          onClose();
          onSelectTab(tab.id);
        }
      });
    });

    // 3. Orders (From Reconciled or Live)
    const orderPool: RawOrderRow[] = (reconciliationResult?.reconciledOrders && reconciliationResult.reconciledOrders.length > 0)
      ? (reconciliationResult.reconciledOrders as unknown as RawOrderRow[])
      : (liveOrders || []);

    const seenOrderIds = new Set<string>();
    const orderItems: PaletteItem[] = [];

    const sortedPool = [...orderPool].sort(compareOrdersByNumber);
    for (const order of sortedPool) {
      const oid = String(order.orderId || order['Order ID'] || order.id || '');
      if (!oid || seenOrderIds.has(oid)) continue;
      seenOrderIds.add(oid);

      const custName = getExportCustomerName(order);
      const phone = getExportPhoneNumber(order);
      const amount = Number(order.orderAmount || order['Order Amount'] || order.total || 0);
      const status = String(order.deliveryStatus || order.orderDeliveryStatus || order.status || 'Pending');
      const branch = String(order.fulfillmentLocation || order.fulfillmentBranch || 'Online');

      let statusBadgeColor = 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300';
      if (status.includes('Delivered')) statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60';
      else if (status.includes('Return')) statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60';
      else if (status.includes('Partial')) statusBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60';

      orderItems.push({
        id: `order-${oid}`,
        category: 'Orders',
        title: `Order #${oid}`,
        subtitle: `${custName}${phone ? ` • ${phone}` : ''} • ৳${amount.toLocaleString()} • ${branch}`,
        badge: status,
        badgeColor: statusBadgeColor,
        icon: <ShoppingBag className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
        action: () => {
          onClose();
          if (onInspectOrder) {
            onInspectOrder(order);
          } else {
            onSelectTab('tabOrders', oid);
          }
        }
      });

      if (orderItems.length >= 150) break; // Keep index snappy
    }
    items.push(...orderItems);

    // 4. Customers & Phone Numbers (From customerRiskProfiles or orders)
    if (reconciliationResult?.customerRiskProfiles) {
      reconciliationResult.customerRiskProfiles.slice(0, 50).forEach((cust) => {
        const isHigh = cust.riskTier === 'HIGH_RISK';
        items.push({
          id: `cust-${cust.phone}`,
          category: 'Customers',
          title: cust.customerName || 'Customer',
          subtitle: `Phone: ${cust.phone} • ${cust.totalOrders} orders (Return Rate: ${cust.returnRate.toFixed(1)}%)`,
          badge: isHigh ? 'High Risk' : cust.riskTier,
          badgeColor: isHigh
            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60',
          icon: <UserCheck className="w-4 h-4 text-slate-500" />,
          action: () => {
            onClose();
            onSelectTab('tabCustomerRisk', cust.phone);
          }
        });
      });
    }

    // 5. SKU Catalog
    if (reconciliationResult?.skuAnalytics) {
      reconciliationResult.skuAnalytics.slice(0, 50).forEach((sku) => {
        items.push({
          id: `sku-${sku.sku}`,
          category: 'SKUs',
          title: sku.itemName || sku.sku,
          subtitle: `SKU: ${sku.sku} • Delivered: ${sku.deliveredQty}/${sku.grossQty} (৳${sku.deliveredRevenue.toLocaleString()})`,
          badge: `${sku.returnRate.toFixed(0)}% RTO`,
          badgeColor: sku.returnRate > 35
            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60'
            : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300',
          icon: <Tag className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
          action: () => {
            onClose();
            onSelectTab('tabSku', sku.sku);
          }
        });
      });
    }

    return items;
  }, [reconciliationResult, liveOrders, onClose, onSelectTab, onToggleCopilot, onTriggerSync, onExportExcel, onToggleTheme, onInspectOrder, onToggleSidebar]);

  // Filter items by search query and category
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dynamicItems: PaletteItem[] = [];

    // If user entered a search query, prepend a dynamic "Ask DEEN Assistant" action at the top
    if (query.trim().length > 0 && (activeCategory === 'All' || activeCategory === 'AI Assistant')) {
      dynamicItems.push({
        id: 'action-dynamic-copilot',
        category: 'AI Assistant',
        title: `Ask DEEN Assistant: "${query.trim()}"`,
        subtitle: `Ask AI Copilot to analyze "${query.trim()}" with live orders, returns, and delivery telemetry`,
        badge: 'Ask AI ↵',
        badgeColor: 'bg-primary text-white border-primary-dark shadow-xs',
        icon: <Sparkles className="w-4 h-4 text-primary animate-pulse" />,
        action: () => {
          onClose();
          onToggleCopilot?.(query.trim());
        }
      });
    }

    const matched = allItems.filter((item) => {
      if (activeCategory !== 'All' && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;

      const titleMatch = item.title.toLowerCase().includes(q);
      const subMatch = item.subtitle ? item.subtitle.toLowerCase().includes(q) : false;
      const badgeMatch = item.badge ? item.badge.toLowerCase().includes(q) : false;
      return titleMatch || subMatch || badgeMatch;
    });

    return [...dynamicItems, ...matched];
  }, [allItems, query, activeCategory, onClose, onToggleCopilot]);

  // Adjust selection if filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, activeCategory, query]);

  // Handle arrow key and enter execution
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItem = filteredItems[selectedIndex];
      if (selectedItem) {
        selectedItem.action();
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative w-full max-w-2xl bg-white dark:bg-deepBlack-card rounded-2xl shadow-2xl border border-slate-200 dark:border-deepBlack-border overflow-hidden flex flex-col max-h-[75vh] sm:max-h-[80vh] z-10 animate-slideDown"
      >
        
        {/* Top Search Input Box */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-deepBlack-border flex items-center gap-3 bg-slate-50/50 dark:bg-deepBlack-sidebar">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filteredItems.length > 0}
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Copilot, or search orders (#17967), phone, SKU, or tabs..."
            className="w-full bg-transparent border-0 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:ring-0"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              ESC
            </span>
          )}
        </div>

        {/* Filter Category Pills */}
        <div className="px-3 sm:px-4 py-2 bg-white dark:bg-deepBlack-card border-b border-slate-100 dark:border-deepBlack-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {(['All', 'AI Assistant', 'Actions', 'Tabs', 'Orders', 'Customers', 'SKUs'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-primary text-white shadow-2xs font-bold'
                  : 'bg-slate-100 dark:bg-deepBlack-hover text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-deepBlack-border'
              }`}
            >
              {cat === 'AI Assistant' ? '✨ AI Assistant' : cat}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
            {filteredItems.length} results
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Command search results"
          className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1 no-scrollbar divide-y divide-slate-100/50 dark:divide-slate-900/50"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold">No matching commands or orders found</p>
              <p className="text-xs mt-1">Try searching for an order number like &quot;17967&quot; or &quot;sync&quot;</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  role="option"
                  aria-selected={isSelected}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 shadow-2xs'
                      : 'hover:bg-slate-50 dark:hover:bg-deepBlack-hover border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-white dark:bg-deepBlack-card border-orange-300 dark:border-orange-800 shadow-2xs'
                          : 'bg-slate-100 dark:bg-deepBlack-hover border-slate-200 dark:border-deepBlack-border'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold border shrink-0 ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-primary-dark dark:text-orange-400">
                        <span>Select</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-60" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-deepBlack-sidebar border-t border-slate-200 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border font-mono text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border font-mono text-[10px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border font-mono text-[10px]">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border font-mono text-[10px]">ESC</kbd>
            <span>to close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
