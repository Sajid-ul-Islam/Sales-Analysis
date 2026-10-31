"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { ReconciledOrderRow } from '@/types';
import { Search, ChevronLeft, ChevronRight, Eye, Copy, Check } from 'lucide-react';
import { OrderDetailModal } from '@/components/OrderDetailModal';
import { getManualOverrides, ManualOverride } from '@/lib/overrideStore';
import { FulfillmentBadge, StatusBadge, SuffixHygieneBadge, NoSearchResults } from '@/components/common';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber,
} from '@/lib/excelExport';

interface OrdersLedgerTabProps {
  orders: ReconciledOrderRow[];
  initialStatusFilter?: string;
  initialTerritoryFilter?: string;
  onClearAiTags?: () => void;
}

export function OrdersLedgerTab({ orders, initialStatusFilter, initialTerritoryFilter, onClearAiTags }: OrdersLedgerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [territoryFilter, setTerritoryFilter] = useState(initialTerritoryFilter || 'ALL');
  const [aiTagFilter, setAiTagFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, ManualOverride>>({});
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const handleCopyOrderId = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    setTimeout(() => {
      setCopiedOrderId((prev) => (prev === orderId ? null : prev));
    }, 2000);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setBranchFilter('ALL');
    setTerritoryFilter('ALL');
    setAiTagFilter('ALL');
    setCurrentPage(1);
  };

  const availableAiTags = useMemo(() => {
    const tagSet = new Set<string>();
    orders.forEach((o) => {
      if (o.aiAuditTag) tagSet.add(o.aiAuditTag);
    });
    return Array.from(tagSet);
  }, [orders]);

  const hasActiveFilter =
    statusFilter !== 'ALL' ||
    branchFilter !== 'ALL' ||
    territoryFilter !== 'ALL' ||
    aiTagFilter !== 'ALL' ||
    searchTerm.trim() !== '';

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
    const list = orders.filter(o => {
      // Search
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesOid = o.orderId.toLowerCase().includes(s);
        const matchesName = (getExportCustomerName(o) || o.customerName || '').toLowerCase().includes(s);
        const matchesPhone = (getExportPhoneNumber(o) || o.phone || '').toLowerCase().includes(s);
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
        const loc = o.fulfillmentLocation || 'Online Store (Central Warehouse)';
        if (branchFilter === 'Online Store (Central Warehouse)') {
          if (loc !== 'Online Store (Central Warehouse)' && loc !== 'Warehouse (Mirpur)') return false;
        } else if (branchFilter === 'Mirpur Outlet POS') {
          if (!loc.includes('Mirpur') && o.branchSuffix !== 'm') return false;
        } else if (branchFilter === 'Cumilla Branch') {
          if (!loc.includes('Cumilla') && !loc.includes('Comilla') && o.branchSuffix !== 'c') return false;
        } else if (branchFilter === 'Wari Branch') {
          if (!loc.includes('Wari') && o.branchSuffix !== 'w') return false;
        } else if (branchFilter === 'Sylhet Branch') {
          if (!loc.includes('Sylhet') && o.branchSuffix !== 's') return false;
        } else if (loc !== branchFilter) {
          return false;
        }
      }

      // Territory
      if (territoryFilter !== 'ALL') {
        if (o.districtArea !== territoryFilter) return false;
      }

      // AI Tag Filter
      if (aiTagFilter !== 'ALL') {
        if (o.aiAuditTag !== aiTagFilter) return false;
      }

      return true;
    });

    return list.sort(compareOrdersByNumber);
  }, [orders, searchTerm, statusFilter, branchFilter, territoryFilter, aiTagFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Active AI Dataset Audit Banner */}
      {availableAiTags.length > 0 && (
        <div className="bg-orange-50/70 border border-orange-200/90 rounded-2xl p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"></span>
            <span className="font-bold text-navy-deep">
              AI Audited Dataset: {orders.filter((o) => Boolean(o.aiAuditTag)).length} orders tagged
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {availableAiTags.map((tag, tIdx) => (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => {
                    setAiTagFilter(tag === aiTagFilter ? 'ALL' : tag);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] border transition-colors cursor-pointer ${
                    aiTagFilter === tag
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-primary border-orange-200 hover:bg-orange-100/50'
                  }`}
                  title={`Filter table by tag "${tag}"`}
                >
                  🏷️ {tag} ({orders.filter((o) => o.aiAuditTag === tag).length})
                </button>
              ))}
            </div>
          </div>
          {onClearAiTags && (
            <button
              type="button"
              onClick={onClearAiTags}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
            >
              Clear AI Tags
            </button>
          )}
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-4 border border-slate-200 dark:border-deepBlack-border shadow-sm flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative w-full sm:w-72 md:w-80 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Phone, Customer, SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setBranchFilter('ALL');
                setTerritoryFilter('ALL');
                setAiTagFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                hasActiveFilter
                  ? 'bg-primary text-white border border-primary shadow-xs hover:bg-primary-hover'
                  : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-deepBlack-border cursor-not-allowed hover:bg-slate-200/60 dark:hover:bg-deepBlack-hover'
              }`}
              title={hasActiveFilter ? 'Clear all filters (resets search, status, territory, and page to 1)' : 'No active filter to clear'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Clear Filters</span>
            </button>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas"
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
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas"
            >
              <option value="ALL">All Outlets / Branches</option>
              <option value="Online Store (Central Warehouse)">Online Store (Central Warehouse)</option>
              <option value="Mirpur Outlet POS">Mirpur Outlet POS (m)</option>
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
              className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas"
            >
              <option value="ALL">All Territories</option>
              <option value="Inside Dhaka">Inside Dhaka</option>
              <option value="Outside Dhaka">Outside Dhaka</option>
            </select>

            {availableAiTags.length > 0 && (
              <select
                value={aiTagFilter}
                onChange={(e) => {
                  setAiTagFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-orange-50/70 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/40 rounded-xl px-3 py-2 text-xs font-bold text-primary focus:outline-none focus:border-primary"
              >
                <option value="ALL">All AI Tags ({orders.filter((o) => Boolean(o.aiAuditTag)).length})</option>
                {availableAiTags.map((tag, tIdx) => (
                  <option key={tIdx} value={tag}>🏷️ {tag}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{filteredOrders.length.toLocaleString()}</strong> records
          </span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200 dark:border-deepBlack-border rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-deepBlack-canvas"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
        {/* Mobile Swipe Hint */}
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-deepBlack-sidebar/60 border-b border-slate-100 dark:border-deepBlack-border">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span>Swipe horizontally to view all columns</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">Order ID pinned</span>
        </div>

        <div
          className="overflow-x-auto overflow-y-auto max-h-[72vh] min-w-0 relative focus:outline-none"
          tabIndex={0}
          role="region"
          aria-label="Orders Ledger Table"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border sticky top-0 z-20">
              <tr>
                <th className="py-3 px-3.5 bg-slate-50 dark:bg-deepBlack-sidebar sticky left-0 top-0 z-20 min-w-[140px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">Order ID</th>
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
            <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-700 dark:text-slate-200">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <NoSearchResults searchTerm={searchTerm} onReset={hasActiveFilter ? handleResetFilters : undefined} />
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o, idx) => {
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
                      className="hover:bg-orange-50/40 dark:hover:bg-deepBlack-hover cursor-pointer transition-colors group"
                      title="Click to view full order drill-down & item outcomes"
                    >
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap sticky left-0 bg-white dark:bg-deepBlack-card group-hover:bg-[#FFF7ED] dark:group-hover:bg-deepBlack-hover z-10 min-w-[140px] border-r border-slate-200 dark:border-deepBlack-border shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="group-hover:text-primary transition-colors flex items-center gap-1 font-mono">
                            {o.orderId}
                            <SuffixHygieneBadge orderId={o.orderId} />
                            <Eye className="w-3 h-3 text-slate-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyOrderId(e, o.orderId)}
                            className="p-1 rounded text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-100 dark:hover:bg-deepBlack-elevated transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title={copiedOrderId === o.orderId ? "Copied!" : "Copy Order ID"}
                          >
                            {copiedOrderId === o.orderId ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <FulfillmentBadge location={o.fulfillmentLocation} suffix={o.branchSuffix} size="sm" />
                          {o.hasSplitSuffix && (
                            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-mono border border-amber-200 dark:border-amber-800">
                              split
                            </span>
                          )}
                          {o.aiAuditTag && (
                            <span
                              className="text-[10px] bg-orange-100 text-primary px-1.5 py-0.5 rounded-full font-bold border border-orange-200 flex items-center gap-0.5 shrink-0"
                              title={o.aiAuditNote || o.aiAuditTag}
                            >
                              🏷️ {o.aiAuditTag}
                            </span>
                          )}
                          {o.requiresManualReview && (
                            <span
                              className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 shrink-0"
                              title={o.decisionEvidence?.explanation || 'Ambiguous partial delivery: manual review recommended'}
                            >
                              ⚠️ Review Needed
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {o.lineStatus.includes('Primary') ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-deepBlack-sidebar text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-deepBlack-border">
                            Primary
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 dark:bg-deepBlack-sidebar text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-deepBlack-border">
                            Line Item
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={orderStatusLabel} isPaidReturn={o.isPaidReturn} size="sm" />
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <StatusBadge status={itemStatusLabel} isPaidReturn={o.isPaidReturn} size="sm" showIcon={false} />
                          {isOverridden && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary text-white font-bold" title="Manually overridden">
                              Override
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">{getExportCustomerName(o) || o.customerName || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{getExportPhoneNumber(o) || o.phone || 'N/A'}</div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold ${
                          o.districtArea === 'Inside Dhaka' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {o.districtArea}
                        </span>
                        {o.city && <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate max-w-[110px]">{o.city}</span>}
                      </td>

                      <td className="py-3 px-3.5 max-w-[220px]">
                        <span className="text-[11px] font-bold text-primary block truncate">{o.sku || 'N/A'}</span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate">{o.itemName}</span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-bold text-slate-900 dark:text-white">
                        {o.quantity}
                      </td>

                      <td className="py-3 px-3.5 text-right font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {o.orderAmount > 0 ? `৳ ${Math.round(o.orderAmount).toLocaleString()}` : '-'}
                      </td>

                      <td className="py-3 px-3.5 text-right font-bold whitespace-nowrap">
                        {o.netRevenueImpact > 0 ? (
                          <span className="text-emerald-600">৳ {Math.round(o.netRevenueImpact).toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">৳ 0</span>
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
        <div className="p-4 border-t border-slate-100 dark:border-deepBlack-border bg-slate-50/70 dark:bg-deepBlack-sidebar/70 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Page <strong className="text-slate-900 dark:text-white">{currentPage}</strong> of <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-deepBlack-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-slate-700 dark:text-slate-300 font-semibold px-2">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-white dark:bg-deepBlack-card border border-slate-200 dark:border-deepBlack-border text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-deepBlack-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
