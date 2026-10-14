"use client";

import React, { useState, useMemo } from 'react';
import { ExchangedOrderRow, SummaryAnalytics } from '@/types';
import { StatusBadge } from '@/components/common';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRightLeft,
  DollarSign,
  Download,
  Phone,
  MapPin,
  Package,
  Layers,
  FileCheck2
} from 'lucide-react';

interface ExchangedOrdersTabProps {
  exchangedOrders: ExchangedOrderRow[];
  summary?: SummaryAnalytics;
}

export function ExchangedOrdersTab({
  exchangedOrders,
  summary
}: ExchangedOrdersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED' | 'DELIVERED'>('ALL');

  const filteredOrders = useMemo(() => {
    return exchangedOrders.filter((order) => {
      if (statusFilter === 'MATCHED' && !order.matchedInOrders) return false;
      if (statusFilter === 'UNMATCHED' && order.matchedInOrders) return false;
      if (statusFilter === 'DELIVERED' && !order.deliveryStatus.toLowerCase().includes('deliver')) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesOid = order.orderId.toLowerCase().includes(q) || order.rawOrderId.toLowerCase().includes(q);
        const matchesCons = order.consignmentId.toLowerCase().includes(q);
        const matchesName = order.recipientName.toLowerCase().includes(q);
        const matchesPhone = order.phone.includes(q);
        const matchesAddr = order.address.toLowerCase().includes(q);
        const matchesStatus = order.deliveryStatus.toLowerCase().includes(q);
        if (!matchesOid && !matchesCons && !matchesName && !matchesPhone && !matchesAddr && !matchesStatus) return false;
      }
      return true;
    });
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Exchanges & Items Qty */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Total Exchanges</span>
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-navy-deep font-headline">
                {totalCount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-semibold">orders</span>
            </div>
            <div className="flex items-baseline gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200/60 shadow-2xs">
              <span className="text-xs font-black font-headline">
                {totalItemsQty.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold">items</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{totalItemsQty.toLocaleString()} physical items in replacement manifest</p>
        </div>

        {/* Card 2: COD Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">COD Collected</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 font-headline">
              ৳{totalCodCollected.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">Doorstep Fees</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Average ৳{avgCod} per exchange order</p>
        </div>

        {/* Card 3: Courier Net Expense */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Courier Cost</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-headline">
              ৳{netCourierCost.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Gross ৳{totalCharges.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">৳{totalDiscounts.toLocaleString()} courier promo discount</p>
        </div>

        {/* Card 4: Matched in Order Ledger */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Ledger Matched</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 font-headline">
              {matchedCount}
            </span>
            <span className="text-[10px] text-slate-500">
              ({totalCount > 0 ? ((matchedCount / totalCount) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Linked via clean Order ID or phone</p>
        </div>

        {/* Card 5: COD Net Offset */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-medium">Courier Recovery</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-primary font-headline">
              {netCourierCost > 0 ? ((totalCodCollected / netCourierCost) * 100).toFixed(0) : 100}%
            </span>
            <span className="text-[10px] text-slate-500">Expense offset</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Doorstep fee recovers delivery cost</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID (15598), D-15598, Consignment, Phone, Name..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Exchanges ({totalCount} odr / {totalItemsQty} items)
          </button>
          <button
            onClick={() => setStatusFilter('MATCHED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'MATCHED'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Matched in Ledger ({matchedCount})
          </button>
          <button
            onClick={() => setStatusFilter('DELIVERED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'DELIVERED'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Delivered ({exchangedOrders.filter(o => o.deliveryStatus.toLowerCase().includes('deliver')).length})
          </button>
          <button
            onClick={() => setStatusFilter('UNMATCHED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              statusFilter === 'UNMATCHED'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Direct / Unmatched ({totalCount - matchedCount})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/90 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Order ID & Prefix</th>
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
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <ArrowRightLeft className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No exchanged orders match your criteria</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try searching for a different order ID or clearing the filter.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr key={`${order.orderId}-${order.consignmentId}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    {/* Order ID & Prefix */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">
                          #{order.orderId}
                        </span>
                        {order.rawOrderId !== order.orderId && (
                          <span className="text-[10px] font-medium bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200/60">
                            {order.rawOrderId}
                          </span>
                        )}
                      </div>
                      {order.statusUpdatedOn && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {order.statusUpdatedOn}
                        </div>
                      )}
                    </td>

                    {/* Consignment ID */}
                    <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-700">
                      {order.consignmentId || '—'}
                    </td>

                    {/* Recipient & Contact */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 truncate max-w-[150px]">
                        {order.recipientName || 'Valued Customer'}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{order.phone || '—'}</span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3 px-3 text-[11px] text-slate-600 max-w-[200px] truncate" title={order.address}>
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{order.address || '—'}</span>
                      </div>
                    </td>

                    {/* Items Qty */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-black text-xs bg-purple-50 text-purple-700 border border-purple-200/60 font-mono">
                        {order.quantity || 1} pcs
                      </span>
                      {order.itemDescription && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[130px] mt-0.5 mx-auto" title={order.itemDescription}>
                          {order.itemDescription}
                        </div>
                      )}
                    </td>

                    {/* Delivery Status */}
                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={order.deliveryStatus} size="sm" />
                    </td>

                    {/* Exchange COD */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ৳ {order.codAmount.toLocaleString()}
                    </td>

                    {/* Courier Fee */}
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      <div className="text-xs font-semibold">
                        ৳ {Math.max(0, order.courierCharge - order.discount).toLocaleString()}
                      </div>
                      {order.discount > 0 && (
                        <div className="text-[10px] text-emerald-600">
                          -৳ {order.discount} disc
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                        {order.paymentStatus || 'Paid'}
                      </span>
                    </td>

                    {/* Ledger Sync Status */}
                    <td className="py-3 px-4 text-center">
                      {order.matchedInOrders ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Matched in Ledger</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
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
        <div className="bg-slate-50/60 px-4 py-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredOrders.length} of {totalCount} exchange records</span>
          <span className="text-[11px] text-slate-400">Prefix 'D-' automatically normalized for reconciliation</span>
        </div>
      </div>
    </div>
  );
}
