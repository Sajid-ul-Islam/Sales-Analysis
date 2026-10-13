"use client";

import React, { useState, useMemo, useRef } from 'react';
import { ReconciledOrderRow, SkuAnalytics } from '@/types';
import {
  X,
  Tag,
  Shirt,
  Search,
  PackageCheck,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  MapPin,
  Calendar
} from 'lucide-react';

interface SkuHistoryModalProps {
  sku: string | null;
  skuData?: SkuAnalytics | null;
  allOrderItems: ReconciledOrderRow[];
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (orderId: string) => void;
}

export function SkuHistoryModal({
  sku,
  skuData,
  allOrderItems,
  isOpen,
  onClose,
  onSelectOrder
}: SkuHistoryModalProps) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'DELIVERED' | 'RETURNED' | 'EXCHANGE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!isOpen || !sku) return null;

  // Filter orders containing this SKU
  const matchedRows = allOrderItems.filter((o) => o.sku === sku);

  const filteredRows = matchedRows.filter((r) => {
    if (filterStatus === 'DELIVERED') {
      if (r.itemDeliveryStatus !== 'Delivered' && r.orderCategory !== 'DELIVERED') return false;
    } else if (filterStatus === 'RETURNED') {
      if (r.itemDeliveryStatus !== 'Returned' && r.orderCategory !== 'FULL_RETURN') return false;
    } else if (filterStatus === 'EXCHANGE') {
      if (!r.isExchange && r.itemDeliveryStatus !== 'Exchange') return false;
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchesOid = r.orderId.toLowerCase().includes(q);
      const matchesCustomer = (r.customerName || '').toLowerCase().includes(q);
      const matchesPhone = (r.phone || '').toLowerCase().includes(q);
      if (!matchesOid && !matchesCustomer && !matchesPhone) return false;
    }

    return true;
  });

  const totalDispatched = matchedRows.reduce((sum, r) => sum + (r.quantity || 1), 0);
  const totalDelivered = matchedRows
    .filter((r) => r.itemDeliveryStatus === 'Delivered' || r.orderCategory === 'DELIVERED')
    .reduce((sum, r) => sum + (r.quantity || 1), 0);
  const totalReturned = matchedRows
    .filter((r) => r.itemDeliveryStatus === 'Returned' || r.orderCategory === 'FULL_RETURN')
    .reduce((sum, r) => sum + (r.quantity || 1), 0);
  const totalRevenue = matchedRows
    .filter((r) => r.itemDeliveryStatus === 'Delivered' || r.orderCategory === 'DELIVERED')
    .reduce((sum, r) => sum + (r.netRevenueImpact || 0), 0);

  const returnRate = totalDispatched > 0 ? ((totalReturned / totalDispatched) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-deep/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-orange-50 text-primary border border-orange-200">
                  {sku}
                </span>
                <h2 className="font-headline font-black text-lg text-navy-deep">
                  {skuData?.itemName || matchedRows[0]?.itemName || 'Product Order History'}
                </h2>
                {skuData?.category && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    {skuData.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Order-by-order audit log and customer delivery outcomes across all recorded manifests.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200/80">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Dispatched</span>
            <span className="text-lg font-black text-navy-deep font-headline">{totalDispatched} units</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{matchedRows.length} distinct orders</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Net Delivered</span>
            <span className="text-lg font-black text-emerald-700 font-headline">{totalDelivered} units</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">৳ {Math.round(totalRevenue).toLocaleString()}</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-rose-600 block">Total Returned</span>
            <span className="text-lg font-black text-rose-600 font-headline">{totalReturned} units</span>
            <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">{returnRate}% return rate</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Unit Cost</span>
            <span className="text-lg font-black text-slate-800 font-headline">
              ৳ {Math.round(skuData?.unitPrice || matchedRows[0]?.itemCost || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Catalog base price</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'DELIVERED', 'RETURNED', 'EXCHANGE'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === tab
                    ? 'bg-white text-navy-deep shadow-2xs'
                    : 'text-slate-600 hover:text-navy-deep'
                }`}
              >
                {tab === 'ALL' ? 'All Orders' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search order ID, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white"
            />
          </div>
        </div>

        {/* Orders Table */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Territory</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Net Impact</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No matching orders found for this SKU filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => {
                    const isDelivered = r.itemDeliveryStatus === 'Delivered' || r.orderCategory === 'DELIVERED';
                    const isReturned = r.itemDeliveryStatus === 'Returned' || r.orderCategory === 'FULL_RETURN';

                    return (
                      <tr key={`${r.orderId}_${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-navy-deep font-mono">
                          #{r.orderId}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800 block">{r.customerName || 'Customer'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{r.phone}</span>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className={`text-[11px] font-semibold ${r.districtArea === 'Inside Dhaka' ? 'text-blue-600' : 'text-amber-600'}`}>
                            {r.districtArea || 'Outside Dhaka'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isDelivered
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : isReturned
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-purple-50 text-purple-800 border-purple-300'
                            }`}
                          >
                            {r.itemDeliveryStatus || r.orderDeliveryStatus || r.orderCategory}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                          {r.quantity}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold">
                          {isDelivered ? (
                            <span className="text-emerald-700">৳ {Math.round(r.netRevenueImpact).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400">৳ 0</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {onSelectOrder && (
                            <button
                              onClick={() => {
                                onSelectOrder(r.orderId);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-primary hover:bg-orange-50 border border-orange-200 transition-colors"
                            >
                              <span>Inspect</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Showing {filteredRows.length} of {matchedRows.length} order entries
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
