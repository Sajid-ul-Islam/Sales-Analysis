"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { ReconciledOrderRow } from '@/types';
import { Search, ChevronLeft, ChevronRight, Eye, AlertCircle } from 'lucide-react';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { getManualOverrides, ManualOverride } from '@/lib/overrideStore';

interface OrdersLedgerTabProps {
  orders: ReconciledOrderRow[];
  initialStatusFilter?: string;
  initialTerritoryFilter?: string;
}

export function OrdersLedgerTab({ orders, initialStatusFilter, initialTerritoryFilter }: OrdersLedgerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [territoryFilter, setTerritoryFilter] = useState(initialTerritoryFilter || 'ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, ManualOverride>>({});

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      setCurrentPage(1);
    }
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialTerritoryFilter) {
      setTerritoryFilter(initialTerritoryFilter);
      setCurrentPage(1);
    }
  }, [initialTerritoryFilter]);

  useEffect(() => {
    setOverrides(getManualOverrides());
    const handleUpdate = () => setOverrides(getManualOverrides());
    window.addEventListener('deen_overrides_updated', handleUpdate);
    return () => window.removeEventListener('deen_overrides_updated', handleUpdate);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Search
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesOid = o.orderId.toLowerCase().includes(s);
        const matchesName = o.customerName.toLowerCase().includes(s);
        const matchesPhone = o.phone.toLowerCase().includes(s);
        const matchesSku = o.sku.toLowerCase().includes(s);
        const matchesItem = o.itemName.toLowerCase().includes(s);
        const matchesBranch = (o.fulfillmentLocation || '').toLowerCase().includes(s);
        if (!matchesOid && !matchesName && !matchesPhone && !matchesSku && !matchesItem && !matchesBranch) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DELIVERED' && o.orderCategory !== 'DELIVERED') return false;
        if (statusFilter === 'PARTIAL' && o.orderCategory !== 'PARTIAL') return false;
        if (statusFilter === 'EXCHANGE' && !o.isExchange && o.orderCategory !== 'EXCHANGE') return false;
        if (statusFilter === 'PAID_RETURN' && (!o.isPaidReturn || o.orderCategory !== 'FULL_RETURN')) return false;
        if (statusFilter === 'NON_PAID_RETURN' && (o.isPaidReturn || o.orderCategory !== 'FULL_RETURN')) return false;
        if (statusFilter === 'FULL_RETURN' && o.orderCategory !== 'FULL_RETURN') return false;
      }

      // Branch
      if (branchFilter !== 'ALL') {
        if ((o.fulfillmentLocation || 'Warehouse (Mirpur)') !== branchFilter) return false;
      }

      // Territory
      if (territoryFilter !== 'ALL') {
        if (o.districtArea !== territoryFilter) return false;
      }

      return true;
    });
  }, [orders, searchTerm, statusFilter, branchFilter, territoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Phone, Customer, SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered Only</option>
              <option value="PARTIAL">Partial Orders</option>
              <option value="EXCHANGE">Exchanges (D- / DD-)</option>
              <option value="PAID_RETURN">Paid Returns</option>
              <option value="NON_PAID_RETURN">Non-Paid Returns</option>
              <option value="FULL_RETURN">All Returns (Full)</option>
            </select>

            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
            >
              <option value="ALL">All Branches</option>
              <option value="Warehouse (Mirpur)">Warehouse / Mirpur (Direct)</option>
              <option value="Cumilla Branch">Cumilla Branch (c)</option>
              <option value="Wari Branch">Wari Branch (w)</option>
              <option value="Sylhet Branch">Sylhet Branch (s)</option>
            </select>

            <select
              value={territoryFilter}
              onChange={(e) => {
                setTerritoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
            >
              <option value="ALL">All Territories</option>
              <option value="Inside Dhaka">Inside Dhaka</option>
              <option value="Outside Dhaka">Outside Dhaka</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900">{filteredOrders.length.toLocaleString()}</strong> records
          </span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-primary focus:bg-white"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Order ID</th>
                <th className="py-3 px-3.5">Line Type</th>
                <th className="py-3 px-3.5">Order Status</th>
                <th className="py-3 px-3.5">Item Status</th>
                <th className="py-3 px-3.5">Customer & Phone</th>
                <th className="py-3 px-3.5">Territory</th>
                <th className="py-3 px-3.5">SKU & Product</th>
                <th className="py-3 px-3.5 text-center">Qty</th>
                <th className="py-3 px-3.5 text-right">Invoiced (৳)</th>
                <th className="py-3 px-3.5 text-right">Net Revenue (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No matching order records found for the active filter.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o, idx) => {
                  const isDelivered = o.orderCategory === 'DELIVERED';
                  const isPartial = o.orderCategory === 'PARTIAL';
                  const isReturn = o.orderCategory === 'FULL_RETURN';
                  const isExchange = o.isExchange || o.orderCategory === 'EXCHANGE';

                  const baseOrderStatusLabel = o.orderDeliveryStatus || (
                    isExchange ? 'Exchange' :
                    isPartial ? 'Partial' :
                    isReturn ? (o.isPaidReturn ? 'Paid Return' : 'Not Paid Return') :
                    'Delivered'
                  );

                  const baseItemStatusLabel = o.itemDeliveryStatus || (
                    isExchange ? 'Exchange' :
                    isReturn ? 'Returned' :
                    isPartial ? (o.deliveryStatus.includes('Kept') || o.netRevenueImpact > 0 ? 'Delivered' : 'Returned') :
                    'Delivered'
                  );

                  const overrideKey = `${o.orderId}___${o.sku}`;
                  const override = overrides[overrideKey] || overrides[o.orderId];
                  const orderStatusLabel = override?.orderDeliveryStatus || baseOrderStatusLabel;
                  const itemStatusLabel = override?.itemDeliveryStatus || baseItemStatusLabel;
                  const isOverridden = Boolean(override);

                  return (
                    <tr
                      key={`${o.orderId}-${idx}`}
                      onClick={() => {
                        setSelectedOrderId(o.orderId);
                        setIsModalOpen(true);
                      }}
                      className="hover:bg-orange-50/40 cursor-pointer transition-colors group"
                      title="Click to view full order drill-down & item outcomes"
                    >
                      <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="group-hover:text-primary transition-colors flex items-center gap-1">
                            {o.orderId}
                            <Eye className="w-3 h-3 text-slate-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          {o.fulfillmentLocation === 'Cumilla Branch' && (
                            <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-mono border border-teal-200" title="Fulfilled from Cumilla Branch">
                              Cumilla (c)
                            </span>
                          )}
                          {o.fulfillmentLocation === 'Wari Branch' && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono border border-purple-200" title="Fulfilled from Wari Branch">
                              Wari (w)
                            </span>
                          )}
                          {o.fulfillmentLocation === 'Sylhet Branch' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono border border-indigo-200" title="Fulfilled from Sylhet Branch">
                              Sylhet (s)
                            </span>
                          )}
                          {(!o.fulfillmentLocation || o.fulfillmentLocation === 'Warehouse (Mirpur)') && (
                            <span className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200" title="Dispatched from Main Warehouse / Mirpur">
                              Mirpur
                            </span>
                          )}
                          {o.hasSplitSuffix && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-mono border border-amber-200">
                              split
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {o.lineStatus.includes('Primary') ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Primary
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
                            Line Item
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {orderStatusLabel === 'Delivered' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Delivered
                          </span>
                        )}
                        {orderStatusLabel === 'Partial' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            Partial
                          </span>
                        )}
                        {orderStatusLabel === 'Exchange' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                            Exchange
                          </span>
                        )}
                        {orderStatusLabel === 'Paid Return' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                            Paid Return
                          </span>
                        )}
                        {orderStatusLabel === 'Not Paid Return' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            Not Paid Return
                          </span>
                        )}
                        {orderStatusLabel === 'Dispute' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                            Dispute
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {itemStatusLabel === 'Delivered' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200">
                              Delivered
                            </span>
                          )}
                          {itemStatusLabel === 'Returned' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50/70 px-2 py-0.5 rounded border border-rose-200">
                              Returned
                            </span>
                          )}
                          {itemStatusLabel === 'Exchange' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50/70 px-2 py-0.5 rounded border border-sky-200">
                              Exchange
                            </span>
                          )}
                          {itemStatusLabel === 'Dispute' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-300">
                              Dispute
                            </span>
                          )}
                          {isOverridden && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-primary text-white font-bold" title="Manually overridden">
                              Override
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900 truncate max-w-[140px]">{o.customerName || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{o.phone}</div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold ${
                          o.districtArea === 'Inside Dhaka' ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {o.districtArea}
                        </span>
                        {o.city && <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">{o.city}</span>}
                      </td>

                      <td className="py-3 px-3.5 max-w-[220px]">
                        <span className="text-[11px] font-bold text-primary block truncate">{o.sku || 'N/A'}</span>
                        <span className="text-[11px] text-slate-600 block truncate">{o.itemName}</span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-bold text-slate-900">
                        {o.quantity}
                      </td>

                      <td className="py-3 px-3.5 text-right font-medium text-slate-500 whitespace-nowrap">
                        {o.orderAmount > 0 ? `৳ ${Math.round(o.orderAmount).toLocaleString()}` : '-'}
                      </td>

                      <td className="py-3 px-3.5 text-right font-bold whitespace-nowrap">
                        {o.netRevenueImpact > 0 ? (
                          <span className="text-emerald-600">৳ {Math.round(o.netRevenueImpact).toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">৳ 0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-slate-700 font-semibold px-2">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Drill-Down Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        allOrderItems={orders}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOverrideChange={() => setOverrides(getManualOverrides())}
      />
    </div>
  );
}
