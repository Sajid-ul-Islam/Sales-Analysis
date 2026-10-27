"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { ReturnedItemRow } from '@/types';
import {
  RotateCcw,
  Search,
  Layers,
  Split,
  Tag,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Package,
  ShoppingBag,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AIReturnDiagnosisCard } from '@/components/after-sales/AIReturnDiagnosisCard';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber,
} from '@/lib/excelExport';

export interface OrderWiseReturnGroup {
  orderId: string;
  orderDate: Date | null;
  orderDateFormatted: string;
  customerName: string;
  phone: string;
  districtArea: string;
  returnSource: string;
  deliveryStatus: string;
  totalReturnedUnits: number;
  totalReturnedValue: number;
  orderAmount: number;
  items: ReturnedItemRow[];
  sipInventories: string[];
}

export function SipInventoryBadge({
  inventory,
  className = '',
}: {
  inventory?: string;
  className?: string;
}) {
  const inv = String(inventory || '').trim();

  if (/mirpur/i.test(inv)) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-sans shadow-2xs ${className}`}
        title="SIP Inventory: Mirpur Outlet"
      >
        <span>🏬</span>
        <span>Mirpur Outlet</span>
      </span>
    );
  }
  if (/cumilla|comilla/i.test(inv)) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-sans shadow-2xs ${className}`}
        title="SIP Inventory: Cumilla Branch"
      >
        <span>🏬</span>
        <span>Cumilla Branch</span>
      </span>
    );
  }
  if (/wari/i.test(inv)) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 font-sans shadow-2xs ${className}`}
        title="SIP Inventory: Wari Branch"
      >
        <span>🏬</span>
        <span>Wari Branch</span>
      </span>
    );
  }
  if (/sylhet/i.test(inv)) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 font-sans shadow-2xs ${className}`}
        title="SIP Inventory: Sylhet Branch"
      >
        <span>🏬</span>
        <span>Sylhet Branch</span>
      </span>
    );
  }
  if (/exchange/i.test(inv)) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800 font-sans shadow-2xs ${className}`}
        title="Exchange Replacement"
      >
        <span>🔄</span>
        <span>Exchange</span>
      </span>
    );
  }
  // Default: Central Warehouse
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 font-sans shadow-2xs ${className}`}
      title="SIP Inventory: Central Warehouse"
    >
      <span>🌐</span>
      <span>Central Warehouse</span>
    </span>
  );
}

function formatReturnDate(val: unknown): string {
  if (!val) return 'N/A';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  const s = String(val).trim();
  if (!s) return 'N/A';
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return s;
}

interface ItemReturnsTabProps {
  returnedItems: ReturnedItemRow[];
  onSelectOrder?: (orderId: string) => void;
}

export function ItemReturnsTab({ returnedItems, onSelectOrder }: ItemReturnsTabProps) {
  const [viewMode, setViewMode] = useState<'ORDER_WISE' | 'ITEM_WISE'>('ORDER_WISE');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FULL' | 'PAID' | 'NON_PAID' | 'PARTIAL'>('ALL');
  const [territoryFilter, setTerritoryFilter] = useState('ALL');

  // Filter individual line items
  const filteredItems = useMemo(() => {
    const list = returnedItems.filter((item) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const mOid = item.orderId.toLowerCase().includes(q);
        const mName = (getExportCustomerName(item) || item.customerName || '').toLowerCase().includes(q);
        const mPhone = (getExportPhoneNumber(item) || item.phone || '').toLowerCase().includes(q);
        const mSku = item.sku.toLowerCase().includes(q);
        const mItem = item.itemName.toLowerCase().includes(q);
        const mSip = (item.sipInventory || '').toLowerCase().includes(q);
        if (!mOid && !mName && !mPhone && !mSku && !mItem && !mSip) return false;
      }

      if (typeFilter === 'PAID' && !item.returnSource.includes('Paid Return')) return false;
      if (typeFilter === 'NON_PAID' && !item.returnSource.includes('Non-Paid Return')) return false;
      if (typeFilter === 'FULL' && !item.returnSource.includes('Full Return')) return false;
      if (typeFilter === 'PARTIAL' && !item.returnSource.includes('Partial Order')) return false;

      if (territoryFilter !== 'ALL' && item.districtArea !== territoryFilter) return false;

      return true;
    });

    return list.sort(compareOrdersByNumber);
  }, [returnedItems, searchTerm, typeFilter, territoryFilter]);

  // Consolidate filtered items into authoritative Order-Wise return groups
  const orderWiseGroups = useMemo(() => {
    const groupMap = new Map<string, OrderWiseReturnGroup>();

    for (const item of filteredItems) {
      const oid = item.orderId;
      let grp = groupMap.get(oid);
      if (!grp) {
        let retSource: string = item.returnSource;
        if (item.returnSource.includes('Partial')) {
          retSource = 'Partial Order Return (Rejected Item)';
        } else if (item.returnSource.includes('Paid Return')) {
          retSource = 'Full Return (RTO / Paid Return)';
        } else {
          retSource = 'Full Return (Non-Paid Return)';
        }

        grp = {
          orderId: oid,
          orderDate: item.orderDate,
          orderDateFormatted: formatReturnDate(item.orderDate),
          customerName: getExportCustomerName(item) || item.customerName || 'Customer',
          phone: getExportPhoneNumber(item) || item.phone || 'N/A',
          districtArea: item.districtArea || 'Outside Dhaka',
          returnSource: retSource,
          deliveryStatus: item.deliveryStatus || 'Returned',
          totalReturnedUnits: 0,
          totalReturnedValue: 0,
          orderAmount: item.orderAmount || 0,
          items: [],
          sipInventories: [],
        };
        groupMap.set(oid, grp);
      }

      // If any item is partial, mark the master order as Partial Return
      if (item.returnSource.includes('Partial')) {
        grp.returnSource = 'Partial Order Return (Rejected Item)';
      } else if (item.returnSource.includes('Paid Return') && !grp.returnSource.includes('Partial')) {
        grp.returnSource = 'Full Return (RTO / Paid Return)';
      }

      grp.totalReturnedUnits += (item.quantity || 1);
      grp.totalReturnedValue += (item.returnedValue || (item.quantity * item.itemCost) || 0);
      if (item.orderAmount && item.orderAmount > grp.orderAmount) {
        grp.orderAmount = item.orderAmount;
      }
      grp.items.push(item);

      if (item.sipInventory && !grp.sipInventories.includes(item.sipInventory)) {
        grp.sipInventories.push(item.sipInventory);
      }
    }

    const list = Array.from(groupMap.values());
    return list.sort((a, b) => compareOrdersByNumber({ orderId: a.orderId }, { orderId: b.orderId }));
  }, [filteredItems]);

  const toggleOrderExpand = useCallback((orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const toggleAllExpanded = useCallback((expandAll: boolean) => {
    if (expandAll) {
      setExpandedOrderIds(new Set(orderWiseGroups.map((g) => g.orderId)));
    } else {
      setExpandedOrderIds(new Set());
    }
  }, [orderWiseGroups]);

  // Overall metrics across entire dataset
  const totalValue = useMemo(() => returnedItems.reduce((acc, i) => acc + i.returnedValue, 0), [returnedItems]);
  const totalUnits = useMemo(() => returnedItems.reduce((acc, i) => acc + i.quantity, 0), [returnedItems]);
  const totalUniqueOrders = useMemo(() => new Set(returnedItems.map((i) => i.orderId)).size, [returnedItems]);

  const fullItems = useMemo(() => returnedItems.filter((i) => i.returnSource.includes('Full Return')), [returnedItems]);
  const fullCount = fullItems.length;
  const fullUnits = useMemo(() => fullItems.reduce((acc, i) => acc + i.quantity, 0), [fullItems]);
  const fullOrdersCount = useMemo(() => new Set(fullItems.map((i) => i.orderId)).size, [fullItems]);

  const partialItems = useMemo(() => returnedItems.filter((i) => i.returnSource.includes('Partial Order')), [returnedItems]);
  const partialCount = partialItems.length;
  const partialUnits = useMemo(() => partialItems.reduce((acc, i) => acc + i.quantity, 0), [partialItems]);
  const partialOrdersCount = useMemo(() => new Set(partialItems.map((i) => i.orderId)).size, [partialItems]);

  // Handle Export based on active view mode
  const handleExportCsv = () => {
    const dateStr = new Date().toISOString().split('T')[0];

    if (viewMode === 'ORDER_WISE') {
      const exportData = orderWiseGroups.map((g) => ({
        'Order ID': g.orderId,
        'Date': g.orderDateFormatted,
        'Customer Name': g.customerName,
        'Phone Number': g.phone,
        'Territory': g.districtArea,
        'Return Classification': g.returnSource,
        'Total Returned Units': g.totalReturnedUnits,
        'Total Returned Value (BDT)': Math.round(g.totalReturnedValue),
        'Total Order Amount (BDT)': Math.round(g.orderAmount),
        'Line Items Count': g.items.length,
        'Products': g.items.map((i) => `${i.sku} - ${i.itemName} (x${i.quantity})`).join('; '),
        'SIP Inventory': g.sipInventories.join(', ') || 'Central Warehouse',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DEEN_Returned_Orders_OrderWise_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const exportData = filteredItems.map((item) => ({
        'Order ID': item.orderId,
        'Date': formatReturnDate(item.orderDate),
        'Customer Name': getExportCustomerName(item) || item.customerName || 'Customer',
        'Phone Number': getExportPhoneNumber(item) || item.phone || 'N/A',
        'Territory': item.districtArea,
        'Return Classification': item.returnSource,
        'SKU': item.sku,
        'Item Name': item.itemName,
        'Returned Qty': item.quantity,
        'Unit Price (BDT)': Math.round(item.itemCost),
        'Returned Value (BDT)': Math.round(item.returnedValue),
        'Order Amount (BDT)': Math.round(item.orderAmount || 0),
        'SIP Inventory': item.sipInventory || 'Central Warehouse',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DEEN_Returned_Items_ItemWise_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Executive KPI Cards for Item Returns (Interactive Drilldowns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-4.5 xl:gap-5">
        {/* Card 1: Total Returned Quantity (Combined) */}
        <div
          onClick={() => setTypeFilter('ALL')}
          className={`kpi-card bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group min-w-0 ${
            typeFilter === 'ALL'
              ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-sm bg-rose-50/20 dark:bg-rose-950/20'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-rose-300'
          }`}
          title="Click to view all returned units"
        >
          <div className="flex items-center justify-between mb-3 min-w-0">
            <span className="text-[10px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-wider truncate">Total Returned Quantity</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs group-hover:scale-105 transition-transform">
                <RotateCcw className="w-4 h-4" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${typeFilter === 'ALL' ? 'text-rose-600' : 'text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-2.5 min-w-0">
            <div className="text-xl sm:text-2xl xl:text-3xl font-black text-slate-900 dark:text-white font-headline tracking-tight truncate block" title={`${Math.round(totalUnits).toLocaleString()} units`}>
              {Math.round(totalUnits).toLocaleString()} <span className="text-sm font-bold text-rose-600 dark:text-rose-400">units</span>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block mt-1 truncate">
              <strong className="text-slate-800 dark:text-slate-200">{Math.round(fullUnits).toLocaleString()}</strong> Regular + <strong className="text-amber-700 dark:text-amber-400">{Math.round(partialUnits).toLocaleString()}</strong> Partial Qty
            </span>
          </div>
          <div className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold pt-3 border-t border-rose-100 dark:border-rose-900/40 flex items-center justify-between gap-1 flex-wrap min-w-0">
            <span className="truncate">{totalUniqueOrders.toLocaleString()} Unique Orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${typeFilter === 'ALL' ? 'bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200' : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'}`}>
              {typeFilter === 'ALL' ? 'Active' : 'All Qty'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
        </div>

        {/* Card 2: Total Returned Orders */}
        <div
          onClick={() => setTypeFilter('FULL')}
          className={`kpi-card bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group min-w-0 ${
            typeFilter === 'FULL'
              ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-sm dark:bg-indigo-950/20'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-indigo-300'
          }`}
          title="Click to filter by 100% Returned-to-Origin (RTO) orders"
        >
          <div className="flex items-center justify-between mb-3 min-w-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total Returned Orders</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${typeFilter === 'FULL' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-2.5 min-w-0">
            <div className="text-xl sm:text-2xl xl:text-3xl font-black text-slate-900 dark:text-white font-headline tracking-tight truncate block" title={`${fullOrdersCount.toLocaleString()} orders`}>
              {fullOrdersCount.toLocaleString()} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">orders</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1 font-medium truncate">
              {fullCount.toLocaleString()} Line Items ({Math.round(fullUnits).toLocaleString()} Qty)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between gap-1 flex-wrap min-w-0">
            <span className="truncate">100% RTO Parcels</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${typeFilter === 'FULL' ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
              {typeFilter === 'FULL' ? 'Active Filter' : 'Full RTO'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"></div>
        </div>

        {/* Card 3: Total Partial Products */}
        <div
          onClick={() => setTypeFilter('PARTIAL')}
          className={`kpi-card bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group min-w-0 ${
            typeFilter === 'PARTIAL'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm bg-amber-50/20 dark:bg-amber-950/20'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-amber-300'
          }`}
          title="Click to filter by Rejected Items from Partial Deliveries"
        >
          <div className="flex items-center justify-between mb-3 min-w-0">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider truncate">Total Partial Products</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Split className="w-4 h-4" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${typeFilter === 'PARTIAL' ? 'text-amber-600' : 'text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-2.5 min-w-0">
            <div className="text-xl sm:text-2xl xl:text-3xl font-black text-amber-600 dark:text-amber-400 font-headline tracking-tight truncate block" title={`${partialCount.toLocaleString()} products`}>
              {partialCount.toLocaleString()} <span className="text-sm font-bold text-amber-700 dark:text-amber-300">products</span>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block mt-1 font-medium truncate">
              Across {partialOrdersCount.toLocaleString()} Orders ({Math.round(partialUnits).toLocaleString()} Qty rejected)
            </span>
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400 pt-3 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between font-semibold gap-1 flex-wrap min-w-0">
            <span className="truncate">Rejected Item Splits</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${typeFilter === 'PARTIAL' ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'}`}>
              {typeFilter === 'PARTIAL' ? 'Active Filter' : 'Partials'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* Card 4: Returned Merchandise Value */}
        <div
          onClick={() => setTypeFilter('ALL')}
          className="kpi-card bg-white dark:bg-deepBlack-card rounded-2xl p-3.5 sm:p-4.5 xl:p-5 border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden group min-w-0"
          title="Total displaced merchandise value"
        >
          <div className="flex items-center justify-between mb-3 min-w-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Returned Inventory Value</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Tag className="w-4 h-4" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>
          <div className="my-2.5 min-w-0">
            <div className="text-xl sm:text-2xl xl:text-3xl font-black text-slate-900 dark:text-white font-headline tracking-tight truncate block" title={`৳ ${Math.round(totalValue).toLocaleString()}`}>
              ৳ {Math.round(totalValue).toLocaleString()}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1 truncate">Displaced Retail Inventory Value</span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between gap-1 flex-wrap min-w-0">
            <span className="truncate">Unrealized Gross Revenue</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 shrink-0">
              Merchandise
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>
      </div>

      {/* AI Return Root Cause Diagnosis */}
      <AIReturnDiagnosisCard returnedItems={returnedItems} />

      {/* Controls & Filters Bar: Search, Filters, Granularity Switcher, and Export */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-4 border border-slate-200 dark:border-deepBlack-border shadow-sm flex flex-col lg:flex-row gap-3.5 items-stretch lg:items-center justify-between">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap min-w-0">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer, Phone, SKU, Item, SIP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'FULL' | 'PAID' | 'NON_PAID' | 'PARTIAL')}
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-all cursor-pointer"
            >
              <option value="ALL">All Return Types</option>
              <option value="PAID">Paid Returns (Full)</option>
              <option value="NON_PAID">Non-Paid Returns (Full)</option>
              <option value="FULL">All Full Returns</option>
              <option value="PARTIAL">Partial Order Rejected Only</option>
            </select>

            <select
              value={territoryFilter}
              onChange={(e) => setTerritoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-all cursor-pointer"
            >
              <option value="ALL">All Territories</option>
              <option value="Inside Dhaka">Inside Dhaka</option>
              <option value="Outside Dhaka">Outside Dhaka</option>
            </select>
          </div>
        </div>

        {/* View Switcher (Order-Wise vs Item-Wise) & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap justify-between lg:justify-end">
          {/* View Mode Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-deepBlack-sidebar border border-slate-200/80 dark:border-deepBlack-border text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('ORDER_WISE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'ORDER_WISE'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Order-Wise: Consolidate multi-item returns into single master rows with expandable line items"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Order-Wise</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  viewMode === 'ORDER_WISE'
                    ? 'bg-orange-800 text-white'
                    : 'bg-slate-200 dark:bg-deepBlack-card text-slate-700 dark:text-slate-300'
                }`}
              >
                {orderWiseGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('ITEM_WISE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'ITEM_WISE'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Item-Wise: View individual returned apparel line items"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Item-Wise</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  viewMode === 'ITEM_WISE'
                    ? 'bg-orange-800 text-white'
                    : 'bg-slate-200 dark:bg-deepBlack-card text-slate-700 dark:text-slate-300'
                }`}
              >
                {filteredItems.length}
              </span>
            </button>
          </div>

          {/* Expand/Collapse All (Order-Wise only) */}
          {viewMode === 'ORDER_WISE' && orderWiseGroups.length > 0 && (
            <button
              type="button"
              onClick={() => toggleAllExpanded(expandedOrderIds.size < orderWiseGroups.length)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title={expandedOrderIds.size === orderWiseGroups.length ? 'Collapse all orders' : 'Expand all orders to view line items'}
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>{expandedOrderIds.size === orderWiseGroups.length ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title={`Export returned records (${viewMode === 'ORDER_WISE' ? 'Order-Wise CSV' : 'Item-Wise CSV'})`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Section: Order-Wise or Item-Wise */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
        {/* Table Description Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-deepBlack-sidebar/80 border-b border-slate-100 dark:border-deepBlack-border text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            {viewMode === 'ORDER_WISE' ? (
              <>
                Showing <strong className="text-slate-900 dark:text-white font-bold">{orderWiseGroups.length}</strong> returned orders (consolidating multi-item returns)
              </>
            ) : (
              <>
                Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredItems.length}</strong> individual returned line items
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            {viewMode === 'ORDER_WISE' ? 'Click row or chevron to expand nested line items' : 'Item-Wise Granular Manifest'}
          </span>
        </div>

        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to inspect financial losses & line items</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">Order ID pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0">
          {viewMode === 'ORDER_WISE' ? (
            /* ========================================================================= */
            /* ORDER-WISE CONSOLIDATED TABLE                                             */
            /* ========================================================================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border text-[10px]">
                <tr>
                  <th className="py-3 px-3.5 bg-slate-50 dark:bg-deepBlack-sidebar sticky left-0 z-20 min-w-[130px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Order ID</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Classification</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Customer & Contact</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Territory</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Returned Products</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Returned Qty</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Order Total (৳)</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Returned Value (৳)</th>
                  <th className="py-3 px-3.5 min-w-[130px]">SIP Origin</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-700 dark:text-slate-200">
                {orderWiseGroups.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No returned orders found matching the filter criteria.</p>
                    </td>
                  </tr>
                ) : (
                  orderWiseGroups.map((group) => {
                    const isExpanded = expandedOrderIds.has(group.orderId);
                    const hasMultiple = group.items.length > 1;
                    const primaryItem = group.items[0];
                    const isPartial = group.returnSource.includes('Partial');
                    const isPaid = group.returnSource.includes('Paid Return');

                    return (
                      <React.Fragment key={group.orderId}>
                        <tr
                          onClick={() => toggleOrderExpand(group.orderId)}
                          className={`hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors group cursor-pointer ${
                            isExpanded ? 'bg-orange-50/30 dark:bg-deepBlack-elevated' : ''
                          }`}
                        >
                          {/* Pinned Order ID */}
                          <td className="py-3.5 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap sticky left-0 bg-white dark:bg-deepBlack-card group-hover:bg-[#FFF7ED] dark:group-hover:bg-deepBlack-hover z-10 min-w-[130px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 group-hover:text-primary transition-colors">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                              <span
                                onClick={(e) => {
                                  if (onSelectOrder) {
                                    e.stopPropagation();
                                    onSelectOrder(group.orderId);
                                  }
                                }}
                                className={`font-mono text-xs ${
                                  onSelectOrder ? 'hover:text-primary hover:underline' : ''
                                }`}
                              >
                                #{group.orderId}
                              </span>
                            </div>
                          </td>

                          {/* Order Date */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                            {group.orderDateFormatted}
                          </td>

                          {/* Classification Badge */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            {isPartial ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                                <Split className="w-3 h-3" />
                                Partial Rejected
                              </span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/50">
                                <RotateCcw className="w-3 h-3" />
                                Paid Return
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                                <RotateCcw className="w-3 h-3" />
                                Non-Paid Return
                              </span>
                            )}
                          </td>

                          {/* Customer Name & Phone */}
                          <td className="py-3.5 px-3.5">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                              {group.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {group.phone}
                            </div>
                          </td>

                          {/* Territory */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold ${
                                group.districtArea === 'Inside Dhaka'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {group.districtArea}
                            </span>
                          </td>

                          {/* Products Summary */}
                          <td className="py-3.5 px-3.5 max-w-[240px]">
                            {primaryItem ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-primary truncate max-w-[170px]">
                                    {primaryItem.sku || 'N/A'}
                                  </span>
                                  {hasMultiple && (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-deepBlack-border shrink-0">
                                      +{group.items.length - 1} more
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate max-w-[220px]">
                                  {primaryItem.itemName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>

                          {/* Returned Qty */}
                          <td className="py-3.5 px-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                            <span className="inline-flex items-center gap-1 font-mono">
                              {group.totalReturnedUnits}
                              <span className="text-[10px] text-slate-400 font-sans">un</span>
                            </span>
                            {hasMultiple && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                ({group.items.length} items)
                              </span>
                            )}
                          </td>

                          {/* Order Amount */}
                          <td className="py-3.5 px-3.5 text-right font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono">
                            {group.orderAmount > 0 ? `৳ ${Math.round(group.orderAmount).toLocaleString()}` : '—'}
                          </td>

                          {/* Returned Value */}
                          <td className="py-3.5 px-3.5 text-right font-black text-rose-600 whitespace-nowrap font-mono">
                            ৳ {Math.round(group.totalReturnedValue).toLocaleString()}
                          </td>

                          {/* SIP Inventory Badges */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {group.sipInventories.length > 0 ? (
                                group.sipInventories.map((inv, idx) => (
                                  <SipInventoryBadge key={idx} inventory={inv} />
                                ))
                              ) : (
                                <SipInventoryBadge inventory="Central Warehouse" />
                              )}
                            </div>
                          </td>

                          {/* Breakdown Toggle Button */}
                          <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOrderExpand(group.orderId);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-deepBlack-sidebar hover:bg-slate-200 dark:hover:bg-deepBlack-hover transition-colors"
                            >
                              {isExpanded ? 'Hide' : `View (${group.items.length})`}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Nested Line Items Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-[#050505] border-y border-orange-200/50 dark:border-deepBlack-border">
                            <td colSpan={11} className="py-3 px-4 sm:px-6">
                              <div className="rounded-xl border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card p-3.5 shadow-xs">
                                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-deepBlack-border text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      Returned Line Items for Order #{group.orderId}
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                      ({group.items.length} {group.items.length === 1 ? 'line item' : 'line items'}, {group.totalReturnedUnits} total units)
                                    </span>
                                  </div>
                                  <span className="font-bold font-mono text-rose-600 text-xs">
                                    Total Return Value: ৳ {Math.round(group.totalReturnedValue).toLocaleString()}
                                  </span>
                                </div>

                                <div className="overflow-x-auto min-w-0">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50/60 dark:bg-deepBlack-sidebar/60 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-deepBlack-border">
                                      <tr>
                                        <th className="py-2 px-3">#</th>
                                        <th className="py-2 px-3">SKU</th>
                                        <th className="py-2 px-3">Product Name</th>
                                        <th className="py-2 px-3">SIP Inventory</th>
                                        <th className="py-2 px-3 text-center">Qty</th>
                                        <th className="py-2 px-3 text-right">Unit Cost (৳)</th>
                                        <th className="py-2 px-3 text-right">Returned Value (৳)</th>
                                        <th className="py-2 px-3">Return Reason / Type</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium">
                                      {group.items.map((subItem, sIdx) => (
                                        <tr key={`${subItem.sku}-${sIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-deepBlack-hover">
                                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{sIdx + 1}</td>
                                          <td className="py-2.5 px-3 font-mono font-bold text-primary">{subItem.sku || 'N/A'}</td>
                                          <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{subItem.itemName}</td>
                                          <td className="py-2.5 px-3">
                                            <SipInventoryBadge inventory={subItem.sipInventory || 'Central Warehouse'} />
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-bold font-mono text-rose-600">{subItem.quantity}</td>
                                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">৳ {Math.round(subItem.itemCost).toLocaleString()}</td>
                                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">৳ {Math.round(subItem.returnedValue).toLocaleString()}</td>
                                          <td className="py-2.5 px-3 text-[11px] text-slate-500">
                                            <span className="inline-flex items-center gap-1">
                                              {subItem.returnSource.includes('Partial') ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium">Rejected in Partial</span>
                                              ) : subItem.returnSource.includes('Paid Return') ? (
                                                <span className="text-teal-600 dark:text-teal-400 font-medium">Paid Return</span>
                                              ) : (
                                                <span className="text-rose-600 dark:text-rose-400 font-medium">Full RTO</span>
                                              )}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ========================================================================= */
            /* ITEM-WISE GRANULAR TABLE                                                  */
            /* ========================================================================= */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border text-[10px]">
                <tr>
                  <th className="py-3 px-3.5 bg-slate-50 dark:bg-deepBlack-sidebar sticky left-0 z-20 min-w-[120px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Order ID</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Return Classification</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Customer & Contact</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Territory</th>
                  <th className="py-3 px-3.5 min-w-[200px]">SKU & Item Name</th>
                  <th className="py-3 px-3.5 min-w-[130px]">SIP Inventory</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Returned Qty</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Unit Price (৳)</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Returned Value (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-700 dark:text-slate-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No returned item records found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isPartial = item.returnSource.includes('Partial Order');

                    return (
                      <tr key={`${item.orderId}-${item.sku}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors group">
                        <td className="py-3.5 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap sticky left-0 bg-white dark:bg-deepBlack-card group-hover:bg-[#FFF7ED] dark:group-hover:bg-deepBlack-hover z-10 min-w-[120px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                          <span
                            onClick={() => onSelectOrder && onSelectOrder(item.orderId)}
                            className={`font-mono text-xs ${onSelectOrder ? 'cursor-pointer hover:text-primary hover:underline' : ''}`}
                          >
                            #{item.orderId}
                          </span>
                        </td>

                        <td className="py-3.5 px-3.5 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                          {formatReturnDate(item.orderDate)}
                        </td>

                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {isPartial ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                              <Split className="w-3 h-3" />
                              Partial Rejected
                            </span>
                          ) : item.returnSource.includes('Paid Return') ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/50">
                              <RotateCcw className="w-3 h-3" />
                              Paid Return
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                              <RotateCcw className="w-3 h-3" />
                              Non-Paid Return
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                            {getExportCustomerName(item) || item.customerName || 'Customer'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {getExportPhoneNumber(item) || item.phone || 'N/A'}
                          </div>
                        </td>

                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold ${
                            item.districtArea === 'Inside Dhaka' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {item.districtArea}
                          </span>
                        </td>

                        <td className="py-3.5 px-3.5 max-w-[220px]">
                          <span className="text-[11px] font-bold text-primary block truncate">{item.sku || 'N/A'}</span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate">{item.itemName}</span>
                        </td>

                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <SipInventoryBadge inventory={item.sipInventory || 'Central Warehouse'} />
                        </td>

                        <td className="py-3.5 px-3.5 text-center font-bold text-rose-600 font-mono">
                          {item.quantity}
                        </td>

                        <td className="py-3.5 px-3.5 text-right font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                          ৳ {Math.round(item.itemCost).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-3.5 text-right font-black text-rose-600 whitespace-nowrap font-mono">
                          ৳ {Math.round(item.returnedValue).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
