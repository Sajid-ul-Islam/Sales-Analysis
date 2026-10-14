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
  Building2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import {
  getManualOverrides,
  saveManualOverride,
  removeManualOverride,
  ManualOverride
} from '@/lib/overrideStore';
import { FulfillmentBadge, StatusBadge } from '@/components/common';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-deep/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-headline font-black text-xl text-navy-deep">
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
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{primary.orderDate ? new Date(primary.orderDate).toLocaleDateString() : 'N/A'}</span>
                <span>•</span>
                <span>{items.length} item line{items.length > 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{totalQuantity} total unit{totalQuantity > 1 ? 's' : ''}</span>
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

        {/* Content Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Customer & Courier Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Customer Details */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Customer Details</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-bold text-navy-deep">{primary.customerName || 'N/A'}</div>
                <div className="flex items-center gap-1.5 text-slate-600 font-mono">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{primary.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Destination Territory */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Delivery Territory</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className={`font-bold ${primary.districtArea === 'Inside Dhaka' ? 'text-blue-700' : 'text-amber-700'}`}>
                  {primary.districtArea || 'Outside Dhaka'}
                </div>
                <div className="text-slate-500">{primary.city || 'District Area'}</div>
              </div>
            </div>

            {/* Payment & Logistics */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Financial Impact</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Order Amount:</span>
                  <span className="font-bold text-navy-deep">৳ {Math.round(totalOrderAmount).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Net Settled:</span>
                  <span className="font-bold text-emerald-700">৳ {Math.round(totalNetRevenue).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Item Breakdown & Status Override Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-sm text-navy-deep flex items-center gap-2">
                <span>Items in Order & Fulfillment Outcomes</span>
                <span className="text-xs font-normal text-slate-400">
                  (Toggle any status below to manually override & recalculate)
                </span>
              </h3>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">SKU & Item Name</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-center">Delivery Status</th>
                    <th className="py-2.5 px-3 text-center">Manual Override</th>
                    <th className="py-2.5 px-3 text-right">Net Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const overrideKey = `${orderId}___${it.sku}`;
                    const override = overrides[overrideKey];
                    const effectiveStatus = override?.itemDeliveryStatus || it.itemDeliveryStatus || (it.orderCategory === 'DELIVERED' ? 'Delivered' : 'Returned');
                    const isOverridden = Boolean(override);

                    return (
                      <tr key={`${it.sku}_${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-bold text-primary font-mono block">{it.sku}</span>
                          <span className="text-slate-700 text-[11px] font-medium">{it.itemName}</span>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {it.quantity}
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-slate-600">
                          ৳ {Math.round(it.itemCost || (it.orderAmount / (it.quantity || 1))).toLocaleString()}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusBadge status={effectiveStatus} isPaidReturn={it.isPaidReturn} size="sm" />
                            {isOverridden && (
                              <span className="text-[9px] font-bold text-primary flex items-center gap-0.5">
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
                              className="text-[11px] font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700 hover:border-primary focus:outline-none focus:border-primary"
                            >
                              <option value="Delivered">Delivered</option>
                              <option value="Returned">Returned</option>
                              <option value="Exchange">Exchange</option>
                              <option value="Dispute">Courier Dispute</option>
                            </select>

                            {isOverridden && (
                              <button
                                onClick={() => handleResetOverride(it.sku)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Reset to auto-calculated status"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {effectiveStatus === 'Delivered' ? (
                            <span className="text-emerald-700">
                              ৳ {Math.round((it.itemCost || (it.orderAmount / (it.quantity || 1))) * (it.quantity || 1)).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">৳ 0</span>
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Overrides are saved to local browser storage and reflected across all reconciliation cards.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
