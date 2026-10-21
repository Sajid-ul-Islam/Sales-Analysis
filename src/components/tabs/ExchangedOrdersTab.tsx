"use client";

import React, { useState, useMemo } from 'react';
import { ExchangedOrderRow, SummaryAnalytics } from '@/types';
import { StatusBadge } from '@/components/common';
import {
  Search,
  CheckCircle2,
  Truck,
  ArrowRightLeft,
  DollarSign,
  Download,
  Phone,
  MapPin,
  Package,
  ArrowUpRight
} from 'lucide-react';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber,
} from '@/lib/excelExport';

interface ExchangedOrdersTabProps {
  exchangedOrders: ExchangedOrderRow[];
  summary?: SummaryAnalytics;
}

export function ExchangedOrdersTab({
  exchangedOrders,
  summary: _summary
}: ExchangedOrdersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED' | 'DELIVERED'>('ALL');

  const filteredOrders = useMemo(() => {
    const list = exchangedOrders.filter((order) => {
      if (statusFilter === 'MATCHED' && !order.matchedInOrders) return false;
      if (statusFilter === 'UNMATCHED' && order.matchedInOrders) return false;
      if (statusFilter === 'DELIVERED' && !order.deliveryStatus.toLowerCase().includes('deliver')) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesOid = order.orderId.toLowerCase().includes(q) || order.rawOrderId.toLowerCase().includes(q);
        const matchesCons = order.consignmentId.toLowerCase().includes(q);
        const matchesName = (getExportCustomerName(order) || order.recipientName).toLowerCase().includes(q);
        const matchesPhone = (getExportPhoneNumber(order) || order.phone).includes(q);
        const matchesAddr = order.address.toLowerCase().includes(q);
        const matchesStatus = order.deliveryStatus.toLowerCase().includes(q);
        if (!matchesOid && !matchesCons && !matchesName && !matchesPhone && !matchesAddr && !matchesStatus) return false;
      }
      return true;
    });

    return list.sort(compareOrdersByNumber);
  }, [exchangedOrders, statusFilter, searchTerm]);

  // Aggregate Metrics
  const totalCount = exchangedOrders.length;
  const totalItemsQty = exchangedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
  const matchedCount = exchangedOrders.filter(o => o.matchedInOrders).length;
  const totalCodCollected = exchangedOrders.reduce((sum, o) => sum + (o.codAmount || 0), 0);
  const totalCharges = exchangedOrders.reduce((sum, o) => sum + (o.courierCharge || 0), 0);
  const totalDiscounts = exchangedOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const netCourierCost = Math.max(0, totalCharges - totalDiscounts);
  const avgCod = totalCount > 0 ? Math.round(totalCodCollected / totalCount) : 0;

  const handleExportCsv = () => {
    const headers = ['Order ID', 'Raw Order ID', 'Consignment ID', 'Recipient', 'Phone', 'Address', 'Status', 'Items Qty', 'Item Description', 'COD Amount', 'Courier Charge', 'Discount', 'Payment Status', 'Matched In Orders'];
    const rows = filteredOrders.map(o => [
      `"${o.orderId}"`,
      `"${o.rawOrderId}"`,
      `"${o.consignmentId}"`,
      `"${o.recipientName}"`,
      `"${o.phone}"`,
      `"${o.address.replace(/"/g, '""')}"`,
      `"${o.deliveryStatus}"`,
      o.quantity || 1,
      `"${(o.itemDescription || '').replace(/"/g, '""')}"`,
      o.codAmount,
      o.courierCharge,
      o.discount,
      `"${o.paymentStatus}"`,
      o.matchedInOrders ? 'Yes' : 'No'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DEEN_Exchanged_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 font-bold">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-purple-600 font-bold">
                Customer Size & Product Exchange Ledger
              </span>
              <h2 className="font-headline text-base sm:text-lg font-bold text-navy-deep">
                Exchanged Orders & Parcel Replacement Audit
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Tracks customer size replacement orders, strips <code>D-</code> prefix from order IDs, reconciles exchange COD doorstep collections against courier charges, and verifies delivery fulfillment.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Exchange CSV</span>
        </button>
      </div>

      {/* KPI Summary Cards (Interactive Drilldowns) */}
      {/* 5 Executive KPI Cards for Exchanged Orders (Interactive Drilldowns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* Card 1: Total Exchanges & Items Qty */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            statusFilter === 'ALL'
              ? 'border-purple-600 ring-2 ring-purple-600/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-purple-300'
          }`}
          title="Click to view all exchange orders"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Exchanges</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-2xs group-hover:scale-105 transition-transform">
                <ArrowRightLeft className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${statusFilter === 'ALL' ? 'text-purple-600' : 'text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl xl:text-4xl font-black text-navy-deep dark:text-white font-headline tracking-tight">
                {totalCount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">orders</span>
            </div>
            <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 shadow-2xs">
              <span className="text-xs font-black font-headline">
                {totalItemsQty.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold">items</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span className="truncate">{totalItemsQty.toLocaleString()} replacement items</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusFilter === 'ALL' ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200' : 'text-slate-400 dark:text-slate-500'}`}>
              {statusFilter === 'ALL' ? 'Active' : 'All'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600"></div>
        </div>

        {/* Card 2: COD Collected */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className="bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden group"
          title="Doorstep fee collected from customers"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">COD Collected</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform">
                <DollarSign className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-headline tracking-tight">
              ৳{totalCodCollected.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <span>Avg ৳{avgCod}</span>
              <span className="text-[10px] text-slate-400 font-normal">/ exchange order</span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>Doorstep Recovery</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
              Recovered
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* Card 3: Courier Net Expense */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className="bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden group"
          title="Courier charges incurred for replacement parcels"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">Courier Cost</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs group-hover:scale-105 transition-transform">
                <Truck className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-slate-900 dark:text-white font-headline tracking-tight">
              ৳{netCourierCost.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>Gross ৳{totalCharges.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-600 font-bold">(-৳{totalDiscounts.toLocaleString()} promo)</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>After courier discount</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              Logistics
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
        </div>

        {/* Card 4: Matched in Order Ledger */}
        <div
          onClick={() => setStatusFilter('MATCHED')}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            statusFilter === 'MATCHED'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-emerald-300'
          }`}
          title="Click to filter by Matched in Order Ledger"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">Ledger Matched</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${statusFilter === 'MATCHED' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-headline tracking-tight">
              {matchedCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              {totalCount > 0 ? ((matchedCount / totalCount) * 100).toFixed(0) : 0}% Reconciliation Match
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>Linked to Order ID</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusFilter === 'MATCHED' ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {statusFilter === 'MATCHED' ? 'Active Filter' : 'Verified'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        {/* Card 5: COD Net Offset */}
        <div
          onClick={() => setStatusFilter('DELIVERED')}
          className={`bg-white dark:bg-deepBlack-card p-5 sm:p-5.5 xl:p-6 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] relative overflow-hidden group ${
            statusFilter === 'DELIVERED'
              ? 'border-primary ring-2 ring-primary/20 shadow-sm'
              : 'border-slate-200/90 dark:border-deepBlack-border shadow-xs hover:border-primary/40'
          }`}
          title="Click to view Delivered replacements"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Courier Recovery</span>
            <div className="flex items-center gap-1.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-2xs group-hover:scale-105 transition-transform">
                <Package className="w-4.5 h-4.5" />
              </div>
              <ArrowUpRight className={`w-4 h-4 transition-all ${statusFilter === 'DELIVERED' ? 'text-primary' : 'text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl xl:text-4xl font-black text-primary font-headline tracking-tight">
              {netCourierCost > 0 ? ((totalCodCollected / netCourierCost) * 100).toFixed(0) : 100}%
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Expense Offset Rate
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between">
            <span>Doorstep fee vs expense</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusFilter === 'DELIVERED' ? 'bg-primary/10 text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
              {statusFilter === 'DELIVERED' ? 'Delivered' : 'Offset'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID (15598), D-15598, Consignment, Phone, Name..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 dark:bg-deepBlack-sidebar rounded-lg border border-slate-200 dark:border-deepBlack-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all text-slate-800 dark:text-slate-200"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-deepBlack-hover'
            }`}
          >
            All Exchanges ({totalCount} odr / {totalItemsQty} items)
          </button>
          <button
            onClick={() => setStatusFilter('MATCHED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'MATCHED'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-deepBlack-hover'
            }`}
          >
            Matched in Ledger ({matchedCount})
          </button>
          <button
            onClick={() => setStatusFilter('DELIVERED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'DELIVERED'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-deepBlack-hover'
            }`}
          >
            Delivered ({exchangedOrders.filter(o => o.deliveryStatus.toLowerCase().includes('deliver')).length})
          </button>
          <button
            onClick={() => setStatusFilter('UNMATCHED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'UNMATCHED'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-deepBlack-hover'
            }`}
          >
            Direct / Unmatched ({totalCount - matchedCount})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-deepBlack-card rounded-xl border border-slate-200/80 dark:border-deepBlack-border shadow-xs overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to view consignment & addresses</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">Exchange ID pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0 max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-deepBlack-border">
              <tr>
                <th className="py-3 px-4 bg-slate-50 dark:bg-deepBlack-sidebar sticky top-0 left-0 z-20 min-w-[140px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Order ID & Prefix</th>
                <th className="py-3 px-3">Consignment ID</th>
                <th className="py-3 px-3">Recipient & Contact</th>
                <th className="py-3 px-3">Destination / Address</th>
                <th className="py-3 px-3 text-center">Items Qty</th>
                <th className="py-3 px-3 text-center">Delivery Status</th>
                <th className="py-3 px-3 text-right">Exchange COD</th>
                <th className="py-3 px-3 text-right">Courier Fee</th>
                <th className="py-3 px-3 text-center">Payment Status</th>
                <th className="py-3 px-4 text-center">Ledger Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <ArrowRightLeft className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">No exchanged orders match your criteria</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Try searching for a different order ID or clearing the filter.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr key={`${order.orderId}-${order.consignmentId}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors group">
                    {/* Order ID & Prefix */}
                    <td className="py-3 px-4 font-mono sticky left-0 bg-white dark:bg-deepBlack-card group-hover:bg-slate-50 dark:group-hover:bg-deepBlack-hover z-10 min-w-[140px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          #{order.orderId}
                        </span>
                        {order.rawOrderId !== order.orderId && (
                          <span className="text-[10px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/40">
                            {order.rawOrderId}
                          </span>
                        )}
                      </div>
                      {order.statusUpdatedOn && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {order.statusUpdatedOn}
                        </div>
                      )}
                    </td>

                    {/* Consignment ID */}
                    <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {order.consignmentId || '—'}
                    </td>

                    {/* Recipient & Contact */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                        {getExportCustomerName(order) || order.recipientName || 'Valued Customer'}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{getExportPhoneNumber(order) || order.phone || '—'}</span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={order.address}>
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{order.address || '—'}</span>
                      </div>
                    </td>

                    {/* Items Qty */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-black text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 font-mono">
                        {order.quantity || 1} pcs
                      </span>
                      {order.itemDescription && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[130px] mt-0.5 mx-auto" title={order.itemDescription}>
                          {order.itemDescription}
                        </div>
                      )}
                    </td>

                    {/* Delivery Status */}
                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={order.deliveryStatus} size="sm" />
                    </td>

                    {/* Exchange COD */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ৳ {order.codAmount.toLocaleString()}
                    </td>

                    {/* Courier Fee */}
                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      <div className="text-xs font-semibold">
                        ৳ {Math.max(0, order.courierCharge - order.discount).toLocaleString()}
                      </div>
                      {order.discount > 0 && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          -৳ {order.discount} disc
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                        {order.paymentStatus || 'Paid'}
                      </span>
                    </td>

                    {/* Ledger Sync Status */}
                    <td className="py-3 px-4 text-center">
                      {order.matchedInOrders ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Matched in Ledger</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                          <span>Direct Exchange</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50/60 dark:bg-deepBlack-sidebar/60 px-4 py-2.5 border-t border-slate-200/80 dark:border-deepBlack-border flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Showing {filteredOrders.length} of {totalCount} exchange records</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Prefix &apos;D-&apos; automatically normalized for reconciliation</span>
        </div>
      </div>
    </div>
  );
}
