"use client";

import React, { useState, useEffect } from 'react';
import { ReconciledOrderRow } from '@/types';
import {
  X,
  Package,
  MapPin,
  Phone,
  User,
  CreditCard,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import {
  getManualOverrides,
  saveManualOverride,
  removeManualOverride,
  ManualOverride
} from '@/lib/overrideStore';
import { FulfillmentBadge, StatusBadge } from '@/components/common';
import {
  getExportCustomerName,
  getExportPhoneNumber,
} from '@/lib/excelExport';

interface OrderDetailModalProps {
  orderId: string | null;
  allOrderItems: ReconciledOrderRow[];
  isOpen: boolean;
  onClose: () => void;
  onOverrideChange?: () => void;
}

export function OrderDetailModal({
  orderId,
  allOrderItems,
  isOpen,
  onClose,
  onOverrideChange
}: OrderDetailModalProps) {
  const [overrides, setOverrides] = useState<Record<string, ManualOverride>>({});

  useEffect(() => {
    if (isOpen) {
      setOverrides(getManualOverrides());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !orderId) return null;

  // Filter all line items belonging to this order (by base ID or full orderId)
  const items = allOrderItems.filter(
    (o) => o.orderId === orderId || o.orderId.replace(/[ \-_][cws]$/i, '') === orderId.replace(/[ \-_][cws]$/i, '')
  );

  const primary = items[0] || null;
  if (!primary) return null;

  // Branch fulfillment identification
  const hasCumilla = items.some((i) => i.fulfillmentLocation === 'Cumilla Branch' || i.branchSuffix === 'c');
  const hasWari = items.some((i) => i.fulfillmentLocation === 'Wari Branch' || i.branchSuffix === 'w');
  const hasSylhet = items.some((i) => i.fulfillmentLocation === 'Sylhet Branch' || i.branchSuffix === 's');
  const hasMirpur = items.some((i) => i.fulfillmentLocation === 'Mirpur Outlet POS' || i.fulfillmentLocation === 'Mirpur Outlet' || i.branchSuffix === 'm');

  const handleStatusOverride = (sku: string, newStatus: 'Delivered' | 'Returned' | 'Exchange' | 'Dispute') => {
    saveManualOverride({
      orderId,
      sku,
      itemDeliveryStatus: newStatus,
      updatedAt: new Date().toISOString()
    });
    setOverrides(getManualOverrides());
    onOverrideChange?.();
  };

  const handleResetOverride = (sku: string) => {
    removeManualOverride(orderId, sku);
    setOverrides(getManualOverrides());
    onOverrideChange?.();
  };

  // Calculate live financial impacts considering overrides
  let totalOrderAmount = 0;
  let totalNetRevenue = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    totalOrderAmount += item.orderAmount || 0;
    totalQuantity += item.quantity || 1;

    const overrideKey = `${orderId}___${item.sku}`;
    const override = overrides[overrideKey];
    const effectiveStatus = override?.itemDeliveryStatus || item.itemDeliveryStatus || (item.orderCategory === 'DELIVERED' ? 'Delivered' : 'Returned');

    if (effectiveStatus === 'Delivered') {
      totalNetRevenue += (item.itemCost || (item.orderAmount / (item.quantity || 1))) * (item.quantity || 1);
    }
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order details for #${primary.orderId}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        className="bg-white dark:bg-deepBlack-card w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200/90 dark:border-deepBlack-border overflow-hidden flex flex-col max-h-[90vh] transition-all cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-deepBlack-border bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-deepBlack-sidebar dark:via-deepBlack-card dark:to-deepBlack-sidebar flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/50 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-headline font-black text-lg sm:text-xl text-slate-900 dark:text-white">
                  Order #{primary.orderId}
                </h2>
                {/* Standardized Branch & Status Indicators */}
                {hasCumilla && <FulfillmentBadge location="Cumilla Branch" suffix="c" size="sm" />}
                {hasWari && <FulfillmentBadge location="Wari Branch" suffix="w" size="sm" />}
                {hasSylhet && <FulfillmentBadge location="Sylhet Branch" suffix="s" size="sm" />}
                {hasMirpur && <FulfillmentBadge location="Mirpur Outlet POS" suffix="m" size="sm" />}
                {!hasCumilla && !hasWari && !hasSylhet && !hasMirpur && (
                  <FulfillmentBadge location="Online Store (Central Warehouse)" size="sm" />
                )}
                <StatusBadge
                  status={primary.orderDeliveryStatus || primary.orderCategory}
                  isPaidReturn={primary.isPaidReturn}
                  size="sm"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span>{primary.orderDate ? new Date(primary.orderDate).toLocaleDateString() : 'N/A'}</span>
                <span>•</span>
                <span>{items.length} item line{items.length > 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{totalQuantity} total unit{totalQuantity > 1 ? 's' : ''}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close order details modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Customer & Courier Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Customer Details */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200/70 dark:border-deepBlack-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Customer Details</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">{getExportCustomerName(primary) || primary.customerName || 'N/A'}</div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{getExportPhoneNumber(primary) || primary.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Destination Territory */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200/70 dark:border-deepBlack-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Delivery Territory</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className={`font-bold ${primary.districtArea === 'Inside Dhaka' ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {primary.districtArea || 'Outside Dhaka'}
                </div>
                <div className="text-slate-500 dark:text-slate-400">{primary.city || 'District Area'}</div>
              </div>
            </div>

            {/* Payment & Logistics */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-deepBlack-sidebar border border-slate-200/70 dark:border-deepBlack-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Financial Impact</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Order Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">৳ {Math.round(totalOrderAmount).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Net Settled:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">৳ {Math.round(totalNetRevenue).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Item Breakdown & Status Override Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Items in Order & Fulfillment Outcomes</span>
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                  (Toggle any status below to manually override & recalculate)
                </span>
              </h3>
            </div>

            <div className="border border-slate-200 dark:border-deepBlack-border rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-deepBlack-sidebar border-b border-slate-200 dark:border-deepBlack-border text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">SKU & Item Name</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-center">Delivery Status</th>
                    <th className="py-2.5 px-3 text-center">Manual Override</th>
                    <th className="py-2.5 px-3 text-right">Net Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border">
                  {items.map((it, idx) => {
                    const overrideKey = `${orderId}___${it.sku}`;
                    const override = overrides[overrideKey];
                    const effectiveStatus = override?.itemDeliveryStatus || it.itemDeliveryStatus || (it.orderCategory === 'DELIVERED' ? 'Delivered' : 'Returned');
                    const isOverridden = Boolean(override);

                    return (
                      <tr key={`${it.sku}_${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-deepBlack-hover transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-bold text-primary dark:text-orange-400 font-mono block">{it.sku}</span>
                          <span className="text-slate-700 dark:text-slate-300 text-[11px] font-medium">{it.itemName}</span>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">
                          {it.quantity}
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-slate-600 dark:text-slate-400">
                          ৳ {Math.round(it.itemCost || (it.orderAmount / (it.quantity || 1))).toLocaleString()}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusBadge status={effectiveStatus} isPaidReturn={it.isPaidReturn} size="sm" />
                            {isOverridden && (
                              <span className="text-[9px] font-bold text-primary dark:text-orange-400 flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" /> Manual Override
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <select
                              value={effectiveStatus}
                              onChange={(e) =>
                                handleStatusOverride(
                                  it.sku,
                                  e.target.value as 'Delivered' | 'Returned' | 'Exchange' | 'Dispute'
                                )
                              }
                              className="text-[11px] font-bold bg-white dark:bg-deepBlack-hover border border-slate-300 dark:border-deepBlack-border rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 hover:border-primary dark:hover:border-primary focus:outline-none focus:border-primary cursor-pointer"
                            >
                              <option value="Delivered">Delivered</option>
                              <option value="Returned">Returned</option>
                              <option value="Exchange">Exchange</option>
                              <option value="Dispute">Courier Dispute</option>
                            </select>

                            {isOverridden && (
                              <button
                                type="button"
                                onClick={() => handleResetOverride(it.sku)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Reset to auto-calculated status"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {effectiveStatus === 'Delivered' ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              ৳ {Math.round((it.itemCost || (it.orderAmount / (it.quantity || 1))) * (it.quantity || 1)).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">৳ 0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-deepBlack-border bg-slate-50/80 dark:bg-deepBlack-sidebar flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
            Overrides are saved to local browser storage and reflected across all reconciliation cards.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 min-h-[40px] rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
