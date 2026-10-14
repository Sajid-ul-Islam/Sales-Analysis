"use client";

import React, { useState, useMemo } from 'react';
import { ReturnedItemRow } from '@/types';
import { RotateCcw, Search, Layers, Split, Tag } from 'lucide-react';
import { AIReturnDiagnosisCard } from '@/components/after-sales/AIReturnDiagnosisCard';

interface ItemReturnsTabProps {
  returnedItems: ReturnedItemRow[];
}

export function ItemReturnsTab({ returnedItems }: ItemReturnsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FULL' | 'PAID' | 'NON_PAID' | 'PARTIAL'>('ALL');
  const [territoryFilter, setTerritoryFilter] = useState('ALL');

  const filteredItems = useMemo(() => {
    return returnedItems.filter(item => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const mOid = item.orderId.toLowerCase().includes(q);
        const mName = item.customerName.toLowerCase().includes(q);
        const mPhone = item.phone.toLowerCase().includes(q);
        const mSku = item.sku.toLowerCase().includes(q);
        const mItem = item.itemName.toLowerCase().includes(q);
        if (!mOid && !mName && !mPhone && !mSku && !mItem) return false;
      }

      if (typeFilter === 'PAID' && !item.returnSource.includes('Paid Return')) return false;
      if (typeFilter === 'NON_PAID' && !item.returnSource.includes('Non-Paid Return')) return false;
      if (typeFilter === 'FULL' && !item.returnSource.includes('Full Return')) return false;
      if (typeFilter === 'PARTIAL' && !item.returnSource.includes('Partial Order')) return false;

      if (territoryFilter !== 'ALL' && item.districtArea !== territoryFilter) return false;

      return true;
    });
  }, [returnedItems, searchTerm, typeFilter, territoryFilter]);

  const totalCount = returnedItems.length;
  const totalValue = useMemo(() => returnedItems.reduce((acc, i) => acc + i.returnedValue, 0), [returnedItems]);
  const totalUnits = useMemo(() => returnedItems.reduce((acc, i) => acc + i.quantity, 0), [returnedItems]);

  const fullItems = useMemo(() => returnedItems.filter(i => i.returnSource.includes('Full Return')), [returnedItems]);
  const fullCount = fullItems.length;
  const fullValue = useMemo(() => fullItems.reduce((acc, i) => acc + i.returnedValue, 0), [fullItems]);
  const fullUnits = useMemo(() => fullItems.reduce((acc, i) => acc + i.quantity, 0), [fullItems]);
  const fullOrdersCount = useMemo(() => new Set(fullItems.map(i => i.orderId)).size, [fullItems]);

  const partialItems = useMemo(() => returnedItems.filter(i => i.returnSource.includes('Partial Order')), [returnedItems]);
  const partialCount = partialItems.length;
  const partialValue = useMemo(() => partialItems.reduce((acc, i) => acc + i.returnedValue, 0), [partialItems]);
  const partialUnits = useMemo(() => partialItems.reduce((acc, i) => acc + i.quantity, 0), [partialItems]);
  const partialOrdersCount = useMemo(() => new Set(partialItems.map(i => i.orderId)).size, [partialItems]);

  return (
    <div className="space-y-6">
      {/* 4 Executive KPI Cards for Item Returns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Returned Quantity (Combined) */}
        <div className="bg-gradient-to-br from-white to-rose-50/40 rounded-2xl p-5 border border-rose-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-800 uppercase tracking-wider">Total Returned Quantity</span>
            <RotateCcw className="w-5 h-5 text-rose-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">
              {Math.round(totalUnits).toLocaleString()} <span className="text-sm font-bold text-rose-600">units</span>
            </div>
            <span className="text-xs text-slate-600 font-medium block mt-1">
              <strong className="text-slate-800">{Math.round(fullUnits).toLocaleString()}</strong> Regular + <strong className="text-amber-700">{Math.round(partialUnits).toLocaleString()}</strong> Partial Qty
            </span>
          </div>
          <span className="text-[11px] text-rose-700 font-semibold pt-2 border-t border-rose-100 flex items-center justify-between">
            <span>Combined Total Qty</span>
            <span className="bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">Regular + Partial</span>
          </span>
        </div>

        {/* Card 2: Total Returned Orders */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Returned Orders</span>
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">
              {fullOrdersCount.toLocaleString()} <span className="text-sm font-semibold text-slate-500">orders</span>
            </div>
            <span className="text-xs text-slate-500 block mt-1 font-medium">
              {fullCount.toLocaleString()} Product Line Items ({Math.round(fullUnits).toLocaleString()} Qty)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            100% Returned-to-Origin (RTO)
          </span>
        </div>

        {/* Card 3: Total Partial Products */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Total Partial Products</span>
            <Split className="w-5 h-5 text-amber-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-amber-600">
              {partialCount.toLocaleString()} <span className="text-sm font-bold text-amber-700">products</span>
            </div>
            <span className="text-xs text-slate-600 block mt-1 font-medium">
              Across {partialOrdersCount.toLocaleString()} Orders ({Math.round(partialUnits).toLocaleString()} Qty rejected)
            </span>
          </div>
          <span className="text-[11px] text-amber-700 pt-2 border-t border-amber-100 font-semibold">
            Rejected Items from Partial Deliveries
          </span>
        </div>

        {/* Card 4: Returned Merchandise Value */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Returned Inventory Value</span>
            <Tag className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-black text-slate-900">৳ {Math.round(totalValue).toLocaleString()}</div>
            <span className="text-xs text-slate-500 block mt-1">Displaced Retail Inventory Value</span>
          </div>
          <span className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Unrealized Gross Revenue
          </span>
        </div>
      </div>

      {/* AI Return Root Cause Diagnosis */}
      <AIReturnDiagnosisCard returnedItems={returnedItems} />

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Phone, SKU, Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            >
              <option value="ALL">All Territories</option>
              <option value="Inside Dhaka">Inside Dhaka</option>
              <option value="Outside Dhaka">Outside Dhaka</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{filteredItems.length.toLocaleString()}</strong> returned items
        </span>
      </div>

      {/* Detailed Item Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 bg-slate-50/60 border-b border-slate-100">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to view financial losses</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">Order ID pinned</span>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 bg-slate-50 sticky left-0 z-20 min-w-[120px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Order ID</th>
                <th className="py-3 px-3.5">Return Classification</th>
                <th className="py-3 px-3.5">Customer & Contact</th>
                <th className="py-3 px-3.5">Territory</th>
                <th className="py-3 px-3.5">SKU & Item Name</th>
                <th className="py-3 px-3.5 text-center">Returned Qty</th>
                <th className="py-3 px-3.5 text-right">Unit Price (৳)</th>
                <th className="py-3 px-3.5 text-right">Returned Value (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No returned item records found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isPartial = item.returnSource.includes('Partial Order');

                  return (
                    <tr key={`${item.orderId}-${item.sku}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3.5 px-3.5 font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 z-10 min-w-[120px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                        {item.orderId}
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {isPartial ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Split className="w-3 h-3" />
                            Partial Rejected
                          </span>
                        ) : item.returnSource.includes('Paid Return') ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            <RotateCcw className="w-3 h-3" />
                            Paid Return
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <RotateCcw className="w-3 h-3" />
                            Non-Paid Return
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5">
                        <div className="font-semibold text-slate-900 truncate max-w-[130px]">{item.customerName || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.phone}</div>
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold ${
                          item.districtArea === 'Inside Dhaka' ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {item.districtArea}
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 max-w-[220px]">
                        <span className="text-[11px] font-bold text-primary block truncate">{item.sku || 'N/A'}</span>
                        <span className="text-[11px] text-slate-600 block truncate">{item.itemName}</span>
                      </td>

                      <td className="py-3.5 px-3.5 text-center font-bold text-rose-600">
                        {item.quantity}
                      </td>

                      <td className="py-3.5 px-3.5 text-right font-medium text-slate-500 whitespace-nowrap">
                        ৳ {Math.round(item.itemCost).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-3.5 text-right font-black text-rose-600 whitespace-nowrap">
                        ৳ {Math.round(item.returnedValue).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
