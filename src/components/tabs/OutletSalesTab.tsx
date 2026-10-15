"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReconciledOrderRow, SummaryAnalytics, RawOrderRow } from '@/types';
import {
  ShoppingBag,
  Store,
  Building2,
  Warehouse,
  TrendingUp,
  RotateCcw,
  PackageCheck,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  PieChart,
  BarChart3,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  Globe
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface OutletSalesTabProps {
  orders?: ReconciledOrderRow[];
  summary?: SummaryAnalytics;
  onSelectOrder?: (orderId: string) => void;
}

export interface WcOrderRecord {
  id: string;
  orderNumber: string;
  dateCreated: string;
  customerName: string;
  phone: string;
  city: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentMethodTitle: string;
  orderSource: 'pos' | 'checkout' | 'admin' | 'online';
  outletId: string;
  outletName: string;
  itemsCount: number;
  itemsSummary: string;
  lineItems: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  discounts: number;
}

interface OutletSalesMetric {
  id: string;
  name: string;
  channelType: 'Online E-Commerce' | 'Retail Branch POS';
  badgeColor: string;
  ordersCount: number;
  unitsSold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  aov: number;
  revenueShare: number;
}

export function OutletSalesTab({ orders: reconciledOrders = [], summary }: OutletSalesTabProps) {
  const [wcOrders, setWcOrders] = useState<WcOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeViewMode, setActiveViewMode] = useState<'SUMMARY' | 'ORDERS'>('SUMMARY');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Resolve Outlet Name: Online Store and Mirpur are NOT the same!
  // Mirpur is an in-store Outlet POS, distinct from Online Store (Website).
  const resolveOutletFromWcOrder = useCallback((rawOrder: any): { outletId: string; outletName: string; orderSource: 'pos' | 'checkout' | 'admin' | 'online' } => {
    const meta = Array.isArray(rawOrder.meta_data) ? rawOrder.meta_data : [];
    const sourceMeta = meta.find((m: any) => m.key === '_sip_order_source');
    const outletMeta = meta.find((m: any) => m.key === '_sip_outlet_id');
    const posDomainMeta = meta.find((m: any) => m.key === '_sip_pos_domain');
    const createdByMeta = meta.find((m: any) => m.key === '_sip_created_by');
    const note = String(rawOrder.customer_note || '').toLowerCase();
    const orderIdStr = String(rawOrder.id || rawOrder.number || '');

    const isPos = sourceMeta?.value === 'pos' || Boolean(posDomainMeta?.value) || meta.some((m: any) => m.key === '_sip_pos_order');
    const outletId = String(outletMeta?.value || '');
    const createdBy = String(createdByMeta?.value || '');

    if (isPos || outletId) {
      if (outletId === '1' || createdBy === '1508' || note.includes('mirpur')) {
        return { outletId: '1', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
      }
      if (outletId === '9' || createdBy === '572' || note.includes('wari')) {
        return { outletId: '9', outletName: 'Wari Branch POS', orderSource: 'pos' };
      }
      if (outletId === '2' || createdBy === '3' || note.includes('cumilla') || note.includes('comilla')) {
        return { outletId: '2', outletName: 'Cumilla Branch POS', orderSource: 'pos' };
      }
      if (outletId === '7' || outletId === '8' || createdBy === '35' || createdBy === '69' || note.includes('sylhet')) {
        return { outletId: '7', outletName: 'Sylhet Branch POS', orderSource: 'pos' };
      }
      if (outletId === '1') {
        return { outletId: '1', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
      }
      return { outletId: outletId || '1', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
    }

    // Check for branch hints in notes or order number suffixes
    if (/\b\d+\s*c\b|[-_\s]c$/i.test(orderIdStr) || note.includes('cumilla') || note.includes('comilla')) {
      return { outletId: 'c', outletName: 'Cumilla Branch POS', orderSource: 'pos' };
    }
    if (/\b\d+\s*w\b|[-_\s]w$/i.test(orderIdStr) || note.includes('wari')) {
      return { outletId: 'w', outletName: 'Wari Branch POS', orderSource: 'pos' };
    }
    if (/\b\d+\s*s\b|[-_\s]s$/i.test(orderIdStr) || note.includes('sylhet')) {
      return { outletId: 's', outletName: 'Sylhet Branch POS', orderSource: 'pos' };
    }
    if (/\b\d+\s*m\b|[-_\s]m$/i.test(orderIdStr) || note.includes('mirpur')) {
      return { outletId: '1', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
    }

    // Default: Online Store (Website Checkout) - STRICTLY DISTINCT FROM MIRPUR OUTLET POS
    return { outletId: 'online_store', outletName: 'Online Store (Website)', orderSource: 'checkout' };
  }, []);

  // Format raw WooCommerce orders into structured records
  const parseRawWcOrders = useCallback((rawOrdersList: any[]): WcOrderRecord[] => {
    return rawOrdersList.map(o => {
      const { outletId, outletName, orderSource } = resolveOutletFromWcOrder(o);
      const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
      let itemsCount = 0;
      const itemsList: Array<{ name: string; sku: string; quantity: number; price: number; total: number }> = [];

      lineItems.forEach((it: any) => {
        const qty = parseInt(it.quantity || '1', 10) || 1;
        itemsCount += qty;
        itemsList.push({
          name: it.name || 'DEEN Apparel',
          sku: it.sku || 'N/A',
          quantity: qty,
          price: parseFloat(it.price || '0') || 0,
          total: parseFloat(it.total || '0') || 0
        });
      });

      const customerName = `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() ||
        o.shipping?.first_name ||
        'Customer';

      return {
        id: String(o.id || o.number || ''),
        orderNumber: String(o.number || o.id || ''),
        dateCreated: o.date_created || '',
        customerName,
        phone: o.billing?.phone || o.shipping?.phone || '',
        city: o.billing?.city || o.shipping?.city || 'Dhaka',
        total: parseFloat(o.total || '0') || 0,
        status: o.status || 'completed',
        paymentMethod: o.payment_method || 'cod',
        paymentMethodTitle: o.payment_method_title || 'Cash on Delivery',
        orderSource,
        outletId,
        outletName,
        itemsCount: Math.max(1, itemsCount),
        itemsSummary: itemsList.map(i => `${i.quantity}x ${i.name}`).slice(0, 2).join(', '),
        lineItems: itemsList,
        discounts: parseFloat(o.discount_total || '0') || 0
      };
    });
  }, [resolveOutletFromWcOrder]);

  // Pull live orders from WooCommerce REST API
  const handlePullFromWooCommerce = useCallback(async (perPage: number = 100, maxPages: number = 5) => {
    setIsLoading(true);
    setSyncStatusMsg('Connecting to WooCommerce REST API (https://deencommerce.com)...');

    try {
      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perPage,
          maxPages,
          fetchAllPages: true,
          status: 'any'
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.rawOrders) && data.rawOrders.length > 0) {
        const parsed = parseRawWcOrders(data.rawOrders);
        setWcOrders(parsed);
        setSyncStatusMsg(`Successfully pulled ${parsed.length} orders from WooCommerce store.`);
      } else if (data.orders && data.orders.length > 0) {
        // Fallback using formatted rows if rawOrders was omitted
        const parsedFallback: WcOrderRecord[] = data.orders.map((r: any, idx: number) => {
          const oid = String(r['Order ID'] || r.orderId || idx);
          const total = parseFloat(r['Order Amount'] || r['Item Cost'] || '0') || 0;
          return {
            id: oid,
            orderNumber: oid,
            dateCreated: r['Order Date'] || '',
            customerName: r['Customer Name'] || 'Customer',
            phone: r['Phone'] || '',
            city: r['City'] || 'Dhaka',
            total,
            status: r['Delivery Status'] || 'completed',
            paymentMethod: 'cod',
            paymentMethodTitle: r['Payment Method'] || 'Cash on Delivery',
            orderSource: 'online',
            outletId: 'online_store',
            outletName: 'Online Store (Website)',
            itemsCount: parseInt(r['Quantity'] || '1', 10) || 1,
            itemsSummary: r['Item Name'] || 'DEEN Apparel',
            lineItems: [{
              name: r['Item Name'] || 'DEEN Apparel',
              sku: r['SKU'] || 'N/A',
              quantity: parseInt(r['Quantity'] || '1', 10) || 1,
              price: parseFloat(r['Item Cost'] || '0') || 0,
              total
            }],
            discounts: 0
          };
        });
        setWcOrders(parsedFallback);
        setSyncStatusMsg(`Pulled ${parsedFallback.length} orders from WooCommerce.`);
      } else {
        setSyncStatusMsg(data.message || 'WooCommerce API returned 0 orders.');
      }
    } catch (err: any) {
      console.error('Failed to pull from WooCommerce:', err);
      setSyncStatusMsg(`WooCommerce API connection note: ${err?.message || 'Check credentials'}`);
    } finally {
      setIsLoading(false);
    }
  }, [parseRawWcOrders]);

  // Auto-load on mount if wcOrders is empty: pull initially (500 orders across 5 pages)
  useEffect(() => {
    if (wcOrders.length === 0) {
      handlePullFromWooCommerce(100, 5);
    }
  }, [wcOrders.length, handlePullFromWooCommerce]);

  // Compute Outlet Sales Aggregates with Mirpur separate from Online Store
  const { outletMetrics, aggregateTotals, paymentMethodTotals } = useMemo(() => {
    const outletMap = new Map<string, {
      id: string;
      name: string;
      channelType: 'Online E-Commerce' | 'Retail Branch POS';
      badgeColor: string;
      ordersCount: number;
      unitsSold: number;
      grossSales: number;
      discounts: number;
      netSales: number;
    }>();

    // Canonical Outlets: Online Store and Mirpur are DISTINCT!
    const canonicals = [
      { id: 'online_store', name: 'Online Store (Website)', channelType: 'Online E-Commerce' as const, badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      { id: '1', name: 'Mirpur Outlet POS', channelType: 'Retail Branch POS' as const, badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
      { id: '9', name: 'Wari Branch POS', channelType: 'Retail Branch POS' as const, badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' },
      { id: '2', name: 'Cumilla Branch POS', channelType: 'Retail Branch POS' as const, badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { id: '7', name: 'Sylhet Branch POS', channelType: 'Retail Branch POS' as const, badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' }
    ];

    canonicals.forEach(c => {
      outletMap.set(c.name, {
        id: c.id,
        name: c.name,
        channelType: c.channelType,
        badgeColor: c.badgeColor,
        ordersCount: 0,
        unitsSold: 0,
        grossSales: 0,
        discounts: 0,
        netSales: 0
      });
    });

    const paymentMap = new Map<string, { count: number; total: number }>();
    let totalSales = 0;
    let totalOrders = 0;
    let totalUnits = 0;
    let totalDiscounts = 0;
    let posSales = 0;
    let posOrders = 0;
    let onlineSales = 0;
    let onlineOrders = 0;

    wcOrders.forEach(o => {
      totalSales += o.total;
      totalOrders++;
      totalUnits += o.itemsCount;
      totalDiscounts += o.discounts;

      if (o.orderSource === 'pos') {
        posSales += o.total;
        posOrders++;
      } else {
        onlineSales += o.total;
        onlineOrders++;
      }

      // Outlet grouping (Fallback: POS goes to Mirpur Outlet POS, web goes to Online Store)
      const targetName = outletMap.has(o.outletName)
        ? o.outletName
        : (o.orderSource === 'pos' ? 'Mirpur Outlet POS' : 'Online Store (Website)');

      const m = outletMap.get(targetName)!;
      m.ordersCount++;
      m.unitsSold += o.itemsCount;
      m.grossSales += (o.total + o.discounts);
      m.discounts += o.discounts;
      m.netSales += o.total;

      // Payment method grouping
      const pKey = o.paymentMethodTitle || o.paymentMethod || 'Cash on Delivery';
      if (!paymentMap.has(pKey)) {
        paymentMap.set(pKey, { count: 0, total: 0 });
      }
      const p = paymentMap.get(pKey)!;
      p.count++;
      p.total += o.total;
    });

    const metricsList: OutletSalesMetric[] = Array.from(outletMap.values()).map(m => {
      const aov = m.ordersCount > 0 ? Math.round(m.netSales / m.ordersCount) : 0;
      const revenueShare = totalSales > 0 ? (m.netSales / totalSales) * 100 : 0;
      return {
        ...m,
        aov,
        revenueShare
      };
    });

    // Sort by net sales descending
    metricsList.sort((a, b) => b.netSales - a.netSales);

    const paymentList = Array.from(paymentMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      total: Math.round(data.total),
      pct: totalSales > 0 ? (data.total / totalSales) * 100 : 0
    })).sort((a, b) => b.total - a.total);

    const overallAov = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const posShare = totalSales > 0 ? (posSales / totalSales) * 100 : 0;

    return {
      outletMetrics: metricsList,
      aggregateTotals: {
        totalSales: Math.round(totalSales),
        totalOrders,
        totalUnits,
        totalDiscounts: Math.round(totalDiscounts),
        overallAov,
        posSales: Math.round(posSales),
        posOrders,
        onlineSales: Math.round(onlineSales),
        onlineOrders,
        posShare
      },
      paymentMethodTotals: paymentList
    };
  }, [wcOrders]);

  // Filtered orders for the live ledger
  const filteredOrders = useMemo(() => {
    return wcOrders.filter(o => {
      if (selectedOutletFilter !== 'ALL' && o.outletName !== selectedOutletFilter) {
        return false;
      }

      if (statusFilter !== 'ALL' && o.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (sourceFilter !== 'ALL') {
        if (sourceFilter === 'POS' && o.orderSource !== 'pos') return false;
        if (sourceFilter === 'ONLINE' && o.orderSource === 'pos') return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesId = o.orderNumber.toLowerCase().includes(term);
        const matchesCustomer = o.customerName.toLowerCase().includes(term);
        const matchesPhone = o.phone.includes(term);
        const matchesCity = o.city.toLowerCase().includes(term);
        const matchesItems = o.itemsSummary.toLowerCase().includes(term);
        return matchesId || matchesCustomer || matchesPhone || matchesCity || matchesItems;
      }

      return true;
    });
  }, [wcOrders, selectedOutletFilter, statusFilter, sourceFilter, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  // Export to Excel
  const handleExportSalesExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Outlet Sales Summary
    const summaryData = outletMetrics.map((m, idx) => ({
      'SL': idx + 1,
      'Outlet / Sales Channel': m.name,
      'Channel Type': m.channelType,
      'Orders Pulled': m.ordersCount,
      'Units Sold': m.unitsSold,
      'Gross Sales (BDT)': m.grossSales,
      'Discounts Given (BDT)': m.discounts,
      'Net Sales Revenue (BDT)': m.netSales,
      'Average Order Value (BDT)': m.aov,
      'Revenue Share (%)': m.revenueShare.toFixed(1) + '%'
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Outlet Sales Summary');

    // Sheet 2: WooCommerce Orders Stream
    const ordersData = filteredOrders.map(o => ({
      'WooCommerce Order #': o.orderNumber,
      'Outlet Channel': o.outletName,
      'Channel Source': o.orderSource === 'pos' ? 'In-Store POS Register' : 'Online Website Checkout',
      'Order Date': o.dateCreated ? o.dateCreated.slice(0, 19).replace('T', ' ') : '',
      'Customer Name': o.customerName,
      'Phone': o.phone,
      'City': o.city,
      'Items Count': o.itemsCount,
      'Items Summary': o.itemsSummary,
      'Total Amount (BDT)': o.total,
      'Status': o.status,
      'Payment Method': o.paymentMethodTitle
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'WooCommerce Orders Stream');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `DEEN_WooCommerce_Outlet_Sales_${dateStamp}.xlsx`;

    try {
      XLSX.writeFile(wb, filename);
    } catch {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 60000);
    }
  };

  // 5 Distinct colors for the 5 channels
  const donutColors = ['#4f46e5', '#a855f7', '#0ea5e9', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Top Banner & WooCommerce Sync Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 font-headline">
                  Outlet Sales & WooCommerce Revenue Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live WooCommerce REST API
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time sales revenue from Online Store (Website) and in-store POS register transactions across Mirpur, Wari, Cumilla, and Sylhet outlets.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Pull Button, View Toggle, Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pull from WooCommerce Button */}
          <button
            onClick={() => handlePullFromWooCommerce(100, 5)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
            title="Fetch latest live orders from deencommerce.com via WooCommerce API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Pulling from WooCommerce...' : 'Pull from WooCommerce'}</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveViewMode('SUMMARY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeViewMode === 'SUMMARY'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className={`w-3.5 h-3.5 ${activeViewMode === 'SUMMARY' ? 'text-primary' : 'text-slate-400'}`} />
              <span>Outlet Summary</span>
            </button>
            <button
              onClick={() => setActiveViewMode('ORDERS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeViewMode === 'ORDERS'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${activeViewMode === 'ORDERS' ? 'text-primary' : 'text-slate-400'}`} />
              <span>Orders Stream</span>
            </button>
          </div>

          {/* Export .XLSX Button */}
          <button
            onClick={handleExportSalesExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200/90 hover:border-emerald-300"
            title="Export WooCommerce outlet sales report to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Sales .XLSX</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{syncStatusMsg}</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-mono font-bold">
            {wcOrders.length} records in memory
          </span>
        </div>
      )}

      {/* 5 High-Impact KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total WooCommerce Sales */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">WooCommerce Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-600">
              ৳ {aggregateTotals.totalSales.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Top-line recognized sales
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Total Discounts:</span>
            <span className="font-bold text-slate-700">৳ {aggregateTotals.totalDiscounts.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 2: Total Orders Pulled */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Orders Pulled</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">
              {aggregateTotals.totalOrders.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 ml-1">Orders</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              From in-store POS & web checkout
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Store Status:</span>
            <span className="font-bold text-emerald-700">Live Synchronized</span>
          </div>
        </div>

        {/* KPI 3: Total Garments / Items Sold */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Units Sold</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-sky-600">
              {aggregateTotals.totalUnits.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 ml-1">Pcs</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Total apparel units ordered
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Avg Units / Order:</span>
            <span className="font-bold text-slate-700">
              {aggregateTotals.totalOrders > 0 ? (aggregateTotals.totalUnits / aggregateTotals.totalOrders).toFixed(1) : 0}
            </span>
          </div>
        </div>

        {/* KPI 4: Average Order Value (AOV) */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average Order Value</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-600">
              ৳ {aggregateTotals.overallAov.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Per completed transaction
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Transaction Quality:</span>
            <span className="font-bold text-emerald-700">Healthy</span>
          </div>
        </div>

        {/* KPI 5: In-Store POS Outlets vs Online Web Share */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">POS Outlets Share</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-purple-600">
              {aggregateTotals.posShare.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              ৳ {aggregateTotals.posSales.toLocaleString()} ({aggregateTotals.posOrders} POS sales)
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Online Store (Website):</span>
            <span className="font-bold text-indigo-700">
              ৳ {aggregateTotals.onlineSales.toLocaleString()} ({aggregateTotals.onlineOrders} orders)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts: Comparison & Payment Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Outlet Sales Revenue Comparison (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Outlet Sales Revenue Breakdown (BDT)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison of sales revenue pulled from WooCommerce across Online Store and physical Branch POS registers (Mirpur, Wari, Cumilla, Sylhet)
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                Sorted by Revenue
              </span>
            </div>

            {/* Visual Bar Comparison */}
            <div className="space-y-4 pt-2">
              {outletMetrics.map((m) => {
                const maxSales = Math.max(...outletMetrics.map(x => x.netSales), 1);
                const barPct = (m.netSales / maxSales) * 100;

                return (
                  <div key={m.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{m.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.badgeColor}`}>
                          {m.channelType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {m.ordersCount} orders • <span className="font-bold text-slate-800">{m.unitsSold} units</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex-1 bg-slate-200/80 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(barPct, 2)}%` }}
                        ></div>
                      </div>
                      <span className="w-24 text-right font-bold text-emerald-600 text-xs shrink-0">
                        ৳ {m.netSales.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                      <span>AOV: ৳{m.aov}</span>
                      <span>Share: {m.revenueShare.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: Payment Method Velocity (1 Col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                Payment Method Velocity
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">By BDT Volume</span>
            </div>

            {/* Payment Method Progress Breakdown */}
            <div className="py-2 space-y-3.5">
              {paymentMethodTotals.slice(0, 5).map((pm, i) => (
                <div key={pm.method} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 truncate max-w-[140px]">{pm.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">{pm.count} orders</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[11px]">
                        ৳ {pm.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pm.pct, 2)}%`,
                        backgroundColor: donutColors[i % donutColors.length]
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Summary Note */}
            <div className="mt-5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>In-Store POS Revenue:</span>
                <span className="text-purple-700">৳ {aggregateTotals.posSales.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>Online Web Revenue:</span>
                <span className="text-indigo-700">৳ {aggregateTotals.onlineSales.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Summary Matrix View or Live Orders Stream */}
      {activeViewMode === 'SUMMARY' ? (
        /* OUTLET SALES SUMMARY MATRIX TABLE */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-headline">
                <Store className="w-4 h-4 text-primary" />
                Outlet Sales Performance Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidated transaction metrics pulled from WooCommerce for Online Store (Website) and in-store Branch POS registers (Mirpur, Wari, Cumilla, Sylhet)
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Total {aggregateTotals.totalOrders.toLocaleString()} sales records analyzed
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Outlet / Sales Channel</th>
                  <th className="py-3 px-3">Channel Type</th>
                  <th className="py-3 px-3 text-right">Orders Pulled</th>
                  <th className="py-3 px-3 text-right">Units Sold</th>
                  <th className="py-3 px-3 text-right">Gross Sales (BDT)</th>
                  <th className="py-3 px-3 text-right">Discounts (BDT)</th>
                  <th className="py-3 px-3 text-right">Net Sales (BDT)</th>
                  <th className="py-3 px-3 text-right">AOV (BDT)</th>
                  <th className="py-3 px-4 text-center">Revenue Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {outletMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <span className="text-[10px] text-slate-400">Channel ID: {m.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.badgeColor}`}>
                        {m.channelType}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                      {m.ordersCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                      {m.unitsSold.toLocaleString()} pcs
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-600">
                      ৳ {m.grossSales.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right text-amber-600">
                      ৳ {m.discounts.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                      ৳ {m.netSales.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                      ৳ {m.aov}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-black text-slate-900">{m.revenueShare.toFixed(1)}%</span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(m.revenueShare, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                <tr>
                  <td className="py-3 px-4 font-black" colSpan={2}>
                    Total Consolidated WooCommerce Sales
                  </td>
                  <td className="py-3 px-3 text-right text-indigo-700">
                    {aggregateTotals.totalOrders.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {aggregateTotals.totalUnits.toLocaleString()} pcs
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">
                    ৳ {(aggregateTotals.totalSales + aggregateTotals.totalDiscounts).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-600">
                    ৳ {aggregateTotals.totalDiscounts.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600">
                    ৳ {aggregateTotals.totalSales.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-800">
                    ৳ {aggregateTotals.overallAov}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-700">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* LIVE WOOCOMMERCE ORDERS STREAM TABLE */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Outlet Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Outlet:</span>
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => {
                    setSelectedOutletFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Outlets ({wcOrders.length} orders)</option>
                  {outletMetrics.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter (POS vs Online) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Channel:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Channels</option>
                  <option value="POS">In-Store POS Registers Only (Mirpur, Wari, Cumilla, Sylhet)</option>
                  <option value="ONLINE">Online Store (Website) Only</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="on-hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Order #, customer, phone, items..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">WooCommerce # & Date</th>
                  <th className="py-3 px-3">Outlet / Channel</th>
                  <th className="py-3 px-3">Customer & Location</th>
                  <th className="py-3 px-3">Items Ordered</th>
                  <th className="py-3 px-3 text-right">Order Total</th>
                  <th className="py-3 px-3 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No WooCommerce orders matched the active outlet and filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            #{o.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {o.dateCreated ? o.dateCreated.slice(0, 16).replace('T', ' ') : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{o.outletName}</div>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                          o.orderSource === 'pos'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {o.orderSource === 'pos' ? 'POS Register' : 'Online Website'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{o.customerName}</div>
                        <div className="text-[10px] text-slate-400">{o.city} {o.phone ? `• ${o.phone}` : ''}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium truncate max-w-xs">{o.itemsSummary}</div>
                        <span className="text-[10px] text-slate-400">{o.itemsCount} total units</span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-600">
                        ৳ {o.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {o.paymentMethodTitle}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          o.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : o.status === 'processing'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length.toLocaleString()} WooCommerce orders
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-bold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
