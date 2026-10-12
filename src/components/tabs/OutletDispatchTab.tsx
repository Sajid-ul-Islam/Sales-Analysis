"use client";

import React, { useState, useMemo } from 'react';
import { ReconciledOrderRow, SummaryAnalytics } from '@/types';
import {
  Store,
  Building2,
  Warehouse,
  Truck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  PackageCheck,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  PieChart,
  BarChart3,
  MapPin,
  Shirt,
  ArrowRightLeft,
  DollarSign,
  Package
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface OutletDispatchTabProps {
  orders: ReconciledOrderRow[];
  summary: SummaryAnalytics;
  onSelectOrder?: (orderId: string) => void;
}

interface OutletMetric {
  id: string;
  name: string;
  suffix: string;
  locationType: 'Warehouse HQ' | 'Retail Branch';
  city: string;
  badgeColor: string;
  dispatchedParcels: number;
  dispatchedGmv: number;
  deliveredParcels: number;
  deliveredRevenue: number;
  returnedParcels: number;
  returnedLoss: number;
  paidReturnsCount: number;
  exchangeCount: number;
  partialCount: number;
  returnRate: number;
  retentionRate: number;
  aov: number;
}

export function OutletDispatchTab({ orders, summary }: OutletDispatchTabProps) {
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeViewMode, setActiveViewMode] = useState<'MATRIX' | 'LEDGER'>('MATRIX');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Canonical Outlets
  const OUTLET_CONFIG = [
    {
      id: 'Warehouse (Mirpur)',
      name: 'Warehouse (Mirpur)',
      suffix: 'Base (None)',
      locationType: 'Warehouse HQ' as const,
      city: 'Dhaka',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
      id: 'Cumilla Branch',
      name: 'Cumilla Branch',
      suffix: 'c',
      locationType: 'Retail Branch' as const,
      city: 'Cumilla',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      id: 'Wari Branch',
      name: 'Wari Branch',
      suffix: 'w',
      locationType: 'Retail Branch' as const,
      city: 'Dhaka (Old Dhaka)',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200'
    },
    {
      id: 'Sylhet Branch',
      name: 'Sylhet Branch',
      suffix: 's',
      locationType: 'Retail Branch' as const,
      city: 'Sylhet',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
    }
  ];

  // Helper to resolve an order line's outlet
  const getOrderOutlet = (o: ReconciledOrderRow): string => {
    if (o.fulfillmentLocation) return o.fulfillmentLocation;
    if (o.branchSuffix === 'c' || /\b\d+\s*c\b|[-_\s]c$/i.test(o.orderId)) return 'Cumilla Branch';
    if (o.branchSuffix === 'w' || /\b\d+\s*w\b|[-_\s]w$/i.test(o.orderId)) return 'Wari Branch';
    if (o.branchSuffix === 's' || /\b\d+\s*s\b|[-_\s]s$/i.test(o.orderId)) return 'Sylhet Branch';
    return 'Warehouse (Mirpur)';
  };

  // Compute parcel-level metrics for each outlet
  const outletMetrics = useMemo<OutletMetric[]>(() => {
    return OUTLET_CONFIG.map(cfg => {
      const outletOrders = orders.filter(o => getOrderOutlet(o) === cfg.id);

      // Group into unique parcels by orderId
      const parcelMap = new Map<string, {
        orderId: string;
        orderAmount: number;
        netRevenue: number;
        returnLoss: number;
        isDelivered: boolean;
        isReturned: boolean;
        isPaidReturn: boolean;
        isExchange: boolean;
        isPartial: boolean;
      }>();

      outletOrders.forEach(o => {
        const oid = o.orderId;
        const qty = o.quantity || 1;
        const lineOrderAmt = o.orderAmount || (qty * o.itemCost);
        const lineNetRev = o.netRevenueImpact || 0;
        const lineLoss = (o.itemDeliveryStatus === 'Returned' || o.orderCategory === 'FULL_RETURN') ? (o.itemCost * qty) : 0;

        const isDelivered = o.orderDeliveryStatus === 'Delivered' || (o.deliveryStatus.includes('Delivered') && lineNetRev > 0);
        const isReturned = o.orderDeliveryStatus === 'Paid Return' || o.orderDeliveryStatus === 'Not Paid Return' || o.orderCategory === 'FULL_RETURN';
        const isPaidReturn = o.isPaidReturn || o.orderDeliveryStatus === 'Paid Return' || o.deliveryStatus.includes('Paid Return');
        const isExchange = o.orderDeliveryStatus === 'Exchange' || o.orderCategory === 'EXCHANGE' || o.isExchange;
        const isPartial = o.orderDeliveryStatus === 'Partial' || o.orderCategory === 'PARTIAL';

        if (!parcelMap.has(oid)) {
          parcelMap.set(oid, {
            orderId: oid,
            orderAmount: lineOrderAmt,
            netRevenue: lineNetRev,
            returnLoss: lineLoss,
            isDelivered,
            isReturned,
            isPaidReturn,
            isExchange,
            isPartial
          });
        } else {
          const p = parcelMap.get(oid)!;
          p.orderAmount = Math.max(p.orderAmount, lineOrderAmt);
          p.netRevenue += lineNetRev;
          p.returnLoss += lineLoss;
          if (isPaidReturn) p.isPaidReturn = true;
          if (isExchange) p.isExchange = true;
          if (isPartial) p.isPartial = true;
          if (isDelivered) p.isDelivered = true;
        }
      });

      let dispatchedParcels = 0;
      let deliveredParcels = 0;
      let returnedParcels = 0;
      let dispatchedGmv = 0;
      let deliveredRevenue = 0;
      let returnedLoss = 0;
      let paidReturnsCount = 0;
      let exchangeCount = 0;
      let partialCount = 0;

      parcelMap.forEach(p => {
        dispatchedParcels++;
        dispatchedGmv += p.orderAmount;
        deliveredRevenue += p.netRevenue;
        returnedLoss += p.returnLoss;

        if (p.isReturned) {
          returnedParcels++;
          if (p.isPaidReturn) paidReturnsCount++;
        } else if (p.isDelivered) {
          deliveredParcels++;
        }

        if (p.isExchange) exchangeCount++;
        if (p.isPartial) partialCount++;
      });

      const returnRate = dispatchedParcels > 0 ? (returnedParcels / dispatchedParcels) * 100 : 0;
      const retentionRate = dispatchedParcels > 0 ? (deliveredParcels / dispatchedParcels) * 100 : 0;
      const aov = dispatchedParcels > 0 ? Math.round(dispatchedGmv / dispatchedParcels) : 0;

      return {
        id: cfg.id,
        name: cfg.name,
        suffix: cfg.suffix,
        locationType: cfg.locationType,
        city: cfg.city,
        badgeColor: cfg.badgeColor,
        dispatchedParcels,
        dispatchedGmv: Math.round(dispatchedGmv),
        deliveredParcels,
        deliveredRevenue: Math.round(deliveredRevenue),
        returnedParcels,
        returnedLoss: Math.round(returnedLoss),
        paidReturnsCount,
        exchangeCount,
        partialCount,
        returnRate,
        retentionRate,
        aov
      };
    });
  }, [orders]);

  // Aggregate summary totals across all outlets (Strictly Parcels)
  const aggregateTotals = useMemo(() => {
    let totalDispatchedParcels = 0;
    let totalDispatchedGmv = 0;
    let totalDeliveredParcels = 0;
    let totalDeliveredRevenue = 0;
    let totalReturnedParcels = 0;
    let totalReturnedLoss = 0;
    let totalPaidReturns = 0;
    let totalExchanges = 0;

    let branchDispatchedParcels = 0;
    let branchDeliveredParcels = 0;
    let branchReturnedParcels = 0;
    let branchDispatchedGmv = 0;
    let branchRealizedGmv = 0;

    outletMetrics.forEach(m => {
      totalDispatchedParcels += m.dispatchedParcels;
      totalDispatchedGmv += m.dispatchedGmv;
      totalDeliveredParcels += m.deliveredParcels;
      totalDeliveredRevenue += m.deliveredRevenue;
      totalReturnedParcels += m.returnedParcels;
      totalReturnedLoss += m.returnedLoss;
      totalPaidReturns += m.paidReturnsCount;
      totalExchanges += m.exchangeCount;

      if (m.locationType === 'Retail Branch') {
        branchDispatchedParcels += m.dispatchedParcels;
        branchDeliveredParcels += m.deliveredParcels;
        branchReturnedParcels += m.returnedParcels;
        branchDispatchedGmv += m.dispatchedGmv;
        branchRealizedGmv += m.deliveredRevenue;
      }
    });

    const overallRetention = totalDispatchedParcels > 0 ? (totalDeliveredParcels / totalDispatchedParcels) * 100 : 0;
    const overallReturnRate = totalDispatchedParcels > 0 ? (totalReturnedParcels / totalDispatchedParcels) * 100 : 0;
    const branchVolumeShare = totalDispatchedParcels > 0 ? (branchDispatchedParcels / totalDispatchedParcels) * 100 : 0;

    // Best performing branch
    const sortedByRetention = [...outletMetrics].sort((a, b) => b.retentionRate - a.retentionRate);
    const topPerformer = sortedByRetention[0];

    return {
      totalDispatchedParcels,
      totalDispatchedGmv,
      totalDeliveredParcels,
      totalDeliveredRevenue,
      totalReturnedParcels,
      totalReturnedLoss,
      totalPaidReturns,
      totalExchanges,
      overallRetention,
      overallReturnRate,
      branchDispatchedParcels,
      branchDeliveredParcels,
      branchReturnedParcels,
      branchDispatchedGmv,
      branchRealizedGmv,
      branchVolumeShare,
      topPerformer
    };
  }, [outletMetrics]);

  // Filtered orders for the drilldown ledger
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const outlet = getOrderOutlet(o);
      if (selectedOutletFilter !== 'ALL' && outlet !== selectedOutletFilter) {
        return false;
      }

      if (statusFilter !== 'ALL') {
        const orderStatus = o.orderDeliveryStatus || o.deliveryStatus;
        if (statusFilter === 'DELIVERED' && !orderStatus.toLowerCase().includes('delivered')) return false;
        if (statusFilter === 'RETURNED' && !orderStatus.toLowerCase().includes('return')) return false;
        if (statusFilter === 'PARTIAL' && !orderStatus.toLowerCase().includes('partial')) return false;
        if (statusFilter === 'EXCHANGE' && !orderStatus.toLowerCase().includes('exchange') && !o.isExchange) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesId = o.orderId.toLowerCase().includes(term);
        const matchesCustomer = (o.customerName || '').toLowerCase().includes(term);
        const matchesPhone = (o.phone || '').includes(term);
        const matchesSku = (o.sku || '').toLowerCase().includes(term);
        const matchesCity = (o.city || '').toLowerCase().includes(term);
        const matchesItem = (o.itemName || '').toLowerCase().includes(term);
        return matchesId || matchesCustomer || matchesPhone || matchesSku || matchesCity || matchesItem;
      }

      return true;
    });
  }, [orders, selectedOutletFilter, statusFilter, searchTerm]);

  // Pagination for ledger
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  // Export Outlet Dispatch Report to Excel (.xlsx) using Parcel Counts
  const handleExportOutletReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Outlet Summary Matrix (Parcels)
    const summaryData = outletMetrics.map((m, i) => ({
      'SL': i + 1,
      'Outlet Name': m.name,
      'Outlet Type': m.locationType,
      'Courier Suffix Code': m.suffix,
      'Operating City': m.city,
      'Dispatched Parcels': m.dispatchedParcels,
      'Dispatched GMV (BDT)': m.dispatchedGmv,
      'Delivered Parcels': m.deliveredParcels,
      'Net Realized Sales (BDT)': m.deliveredRevenue,
      'Returned Parcels': m.returnedParcels,
      'Returned Loss Value (BDT)': m.returnedLoss,
      'Paid Returns (Parcels)': m.paidReturnsCount,
      'Exchanges Handled': m.exchangeCount,
      'Partial Shipments': m.partialCount,
      'Parcel Retention Rate (%)': m.retentionRate.toFixed(1) + '%',
      'Parcel Return Rate (%)': m.returnRate.toFixed(1) + '%',
      'Average Parcel Value (BDT)': m.aov
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Outlet Parcel Performance');

    // Sheet 2: Dispatched Orders Ledger
    const ordersData = filteredOrders.map(o => ({
      'Order ID (Parcel)': o.orderId,
      'Outlet Fulfilled From': getOrderOutlet(o),
      'Branch Suffix': o.branchSuffix || 'Base',
      'Order Delivery Status': o.orderDeliveryStatus || 'Delivered',
      'Item Delivery Status': o.itemDeliveryStatus || 'Delivered',
      'Customer Name': o.customerName,
      'Phone': o.phone,
      'City': o.city,
      'Territory': o.districtArea,
      'SKU': o.sku,
      'Item Description': o.itemName,
      'Quantity': o.quantity,
      'Unit Cost (BDT)': o.itemCost,
      'Order Total (BDT)': o.orderAmount,
      'Recognized Net Sales (BDT)': Math.round(o.netRevenueImpact),
      'Payment Method': o.paymentMethod
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Outlet Parcels Ledger');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `DEEN_Outlet_Dispatch_Parcels_${dateStamp}.xlsx`;

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

  // Donut chart calculations based strictly on Parcels
  const totalVolume = aggregateTotals.totalDispatchedParcels || 1;
  const donutColors = ['#4f46e5', '#10b981', '#0ea5e9', '#f59e0b']; // Indigo, Emerald, Sky, Amber
  let accumulatedAngle = 0;
  const donutSlices = outletMetrics.map((m, idx) => {
    const pct = m.dispatchedParcels / totalVolume;
    const startAngle = accumulatedAngle;
    accumulatedAngle += pct * 360;
    return {
      name: m.name,
      parcels: m.dispatchedParcels,
      pct: pct * 100,
      color: donutColors[idx % donutColors.length],
      startAngle,
      endAngle: accumulatedAngle
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-primary shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 font-headline">
                  Outlet Dispatch & Branch Fulfillment Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Parcel Count Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Courier parcel dispatches, delivery retention rates, and returned consignment values for Mirpur HQ, Cumilla, Wari, and Sylhet.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: View Toggle & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveViewMode('MATRIX')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeViewMode === 'MATRIX'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className={`w-3.5 h-3.5 ${activeViewMode === 'MATRIX' ? 'text-primary' : 'text-slate-400'}`} />
              <span>Parcel Summary</span>
            </button>
            <button
              onClick={() => setActiveViewMode('LEDGER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeViewMode === 'LEDGER'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageCheck className={`w-3.5 h-3.5 ${activeViewMode === 'LEDGER' ? 'text-primary' : 'text-slate-400'}`} />
              <span>Dispatched Parcels</span>
            </button>
          </div>

          <button
            onClick={handleExportOutletReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200/90 hover:border-emerald-300"
            title="Download multi-sheet Excel report (.xlsx) for all outlet parcel dispatches"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Parcel .XLSX</span>
          </button>
        </div>
      </div>

      {/* 5 High-Impact KPI Overview Cards (Strictly Parcel Counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Gross Dispatched Parcels */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gross Dispatched</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">
              {aggregateTotals.totalDispatchedParcels.toLocaleString()}
              <span className="text-xs font-bold text-indigo-600 ml-1">Parcels</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Dispatched from 4 outlet nodes
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Retail Value:</span>
            <span className="font-bold text-slate-700">৳ {aggregateTotals.totalDispatchedGmv.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 2: Clean Delivered Parcels */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivered Parcels</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-600">
              {aggregateTotals.totalDeliveredParcels.toLocaleString()}
              <span className="text-xs font-bold text-emerald-700 ml-1">Parcels</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Net Sales: <span className="font-bold text-emerald-700">৳ {aggregateTotals.totalDeliveredRevenue.toLocaleString()}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Retention Rate:</span>
            <span className="font-bold text-emerald-700">{aggregateTotals.overallRetention.toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 3: Returned Parcels & Value Loss */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Returned Parcels</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-rose-600">
              {aggregateTotals.totalReturnedParcels.toLocaleString()}
              <span className="text-xs font-bold text-rose-700 ml-1">Parcels</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Lost Retail Value: <span className="font-bold text-rose-700">৳ {aggregateTotals.totalReturnedLoss.toLocaleString()}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Return Rate:</span>
            <span className="font-bold text-rose-600">{aggregateTotals.overallReturnRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 4: Top Performing Outlet */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Outlet</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-base font-black text-slate-900 truncate" title={aggregateTotals.topPerformer?.name}>
              {aggregateTotals.topPerformer?.name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Retention: <span className="font-bold text-emerald-600">{aggregateTotals.topPerformer?.retentionRate.toFixed(1)}%</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Delivered Sales:</span>
            <span className="font-bold text-slate-700">৳ {aggregateTotals.topPerformer?.deliveredRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 5: Branch Network Contribution */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Branch Share (c, w, s)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-sky-600">
              {aggregateTotals.branchVolumeShare.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              <span className="font-bold text-slate-700">{aggregateTotals.branchDispatchedParcels}</span> parcels dispatched from branches
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Branch Realized:</span>
            <span className="font-bold text-sky-700">৳ {aggregateTotals.branchRealizedGmv.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts: Comparison & Donut Share (Strictly Parcels) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Outlet Dispatched vs Delivered vs Returned Parcels (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Outlet Dispatch & Return Parcel Breakdown
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison of courier parcels dispatched, delivered to buyers, and returned back per outlet
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
                  <span className="text-slate-600 font-medium">Dispatched Parcels</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                  <span className="text-slate-600 font-medium">Delivered Parcels</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                  <span className="text-slate-600 font-medium">Returned Parcels</span>
                </div>
              </div>
            </div>

            {/* Custom Bar Comparison Visualization using Parcels */}
            <div className="space-y-4 pt-2">
              {outletMetrics.map((m) => {
                const maxVal = Math.max(...outletMetrics.map(x => x.dispatchedParcels), 1);
                const dispatchPct = (m.dispatchedParcels / maxVal) * 100;
                const deliveredPct = (m.deliveredParcels / maxVal) * 100;
                const returnedPct = (m.returnedParcels / maxVal) * 100;

                return (
                  <div key={m.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{m.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.badgeColor}`}>
                          {m.suffix}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Retention: <span className="font-bold text-emerald-600">{m.retentionRate.toFixed(1)}%</span>
                        {' • '}
                        Return: <span className="font-bold text-rose-600">{m.returnRate.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {/* Dispatched Parcels Bar */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-[11px] text-slate-400 font-medium shrink-0">Dispatched:</span>
                        <div className="flex-1 bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(dispatchPct, 2)}%` }}
                          ></div>
                        </div>
                        <span className="w-20 text-right font-bold text-slate-800 text-[11px] shrink-0">
                          {m.dispatchedParcels.toLocaleString()} parcels
                        </span>
                      </div>

                      {/* Delivered Parcels Bar */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-[11px] text-slate-400 font-medium shrink-0">Delivered:</span>
                        <div className="flex-1 bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(deliveredPct, 2)}%` }}
                          ></div>
                        </div>
                        <span className="w-20 text-right font-bold text-emerald-600 text-[11px] shrink-0">
                          {m.deliveredParcels.toLocaleString()} parcels
                        </span>
                      </div>

                      {/* Returned Parcels Bar */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-[11px] text-slate-400 font-medium shrink-0">Returned:</span>
                        <div className="flex-1 bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(returnedPct, 2)}%` }}
                          ></div>
                        </div>
                        <span className="w-20 text-right font-bold text-rose-600 text-[11px] shrink-0">
                          {m.returnedParcels.toLocaleString()} parcels
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: Outlet Parcel Share Donut / Financial Metrics (1 Col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-500" />
                Parcel Volume Share
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">By Outlet</span>
            </div>

            {/* Visual Parcel Share Progress Breakdown */}
            <div className="py-2 space-y-4">
              {donutSlices.map((slice) => (
                <div key={slice.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }}></span>
                      <span className="font-bold text-slate-800">{slice.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500">{slice.parcels} parcels</span>
                      <span className="font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {slice.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(slice.pct, 1)}%`, backgroundColor: slice.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Financial Summary */}
            <div className="mt-5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Financial Velocity Breakdown
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Gross Dispatch GMV:</span>
                <span className="font-bold text-slate-900">৳ {aggregateTotals.totalDispatchedGmv.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Clean Realized Sales:</span>
                <span className="font-bold text-emerald-600">৳ {aggregateTotals.totalDeliveredRevenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Return Merchandise Loss:</span>
                <span className="font-bold text-rose-600">৳ {aggregateTotals.totalReturnedLoss.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Matrix View or Ledger View (Strictly Parcels) */}
      {activeViewMode === 'MATRIX' ? (
        /* OUTLET SUMMARY MATRIX TABLE (PARCELS) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-headline">
                <Store className="w-4 h-4 text-primary" />
                Comprehensive Outlet Dispatch & Return Matrix (Parcel Units)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full operational metrics per fulfillment location showing courier parcel dispatches, delivery retention, and return values
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Showing all 4 registered DEEN fulfillment nodes</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Outlet Name & Suffix</th>
                  <th className="py-3 px-3">Location Type</th>
                  <th className="py-3 px-3 text-right">Dispatched Parcels</th>
                  <th className="py-3 px-3 text-right">Dispatched GMV</th>
                  <th className="py-3 px-3 text-right">Delivered Parcels</th>
                  <th className="py-3 px-3 text-right">Realized Net Sales</th>
                  <th className="py-3 px-3 text-right">Returned Parcels</th>
                  <th className="py-3 px-3 text-right">Return Loss (BDT)</th>
                  <th className="py-3 px-3 text-center">Parcel Return Rate</th>
                  <th className="py-3 px-4 text-center">Parcel Retention Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {outletMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${m.badgeColor}`}>
                              Suffix: {m.suffix}
                            </span>
                            <span className="text-[10px] text-slate-400">{m.city}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        m.locationType === 'Warehouse HQ'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {m.locationType}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                      {m.dispatchedParcels.toLocaleString()}
                      <span className="text-[10px] text-indigo-600 font-normal block">
                        parcels
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800">
                      ৳ {m.dispatchedGmv.toLocaleString()}
                      <span className="text-[10px] text-slate-400 font-normal block">
                        AOV ৳{m.aov}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                      {m.deliveredParcels.toLocaleString()}
                      <span className="text-[10px] text-emerald-600/70 font-normal block">
                        delivered
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-700">
                      ৳ {m.deliveredRevenue.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-rose-600">
                      {m.returnedParcels.toLocaleString()}
                      {m.paidReturnsCount > 0 && (
                        <span className="text-[10px] text-emerald-600 font-normal block">
                          ({m.paidReturnsCount} paid)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-rose-700">
                      ৳ {m.returnedLoss.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        m.returnRate > 20
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : m.returnRate > 10
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {m.returnRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-black text-emerald-700">{m.retentionRate.toFixed(1)}%</span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(m.retentionRate, 100)}%` }}
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
                    Total Outlet Network Performance
                  </td>
                  <td className="py-3 px-3 text-right text-indigo-700">
                    {aggregateTotals.totalDispatchedParcels.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    ৳ {aggregateTotals.totalDispatchedGmv.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600">
                    {aggregateTotals.totalDeliveredParcels.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700">
                    ৳ {aggregateTotals.totalDeliveredRevenue.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600">
                    {aggregateTotals.totalReturnedParcels.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700">
                    ৳ {aggregateTotals.totalReturnedLoss.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center text-rose-600">
                    {aggregateTotals.overallReturnRate.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-700">
                    {aggregateTotals.overallRetention.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* DISPATCHED PARCELS DRILLDOWN LEDGER */
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
                  <option value="ALL">All Outlets ({orders.length} records)</option>
                  {OUTLET_CONFIG.map(cfg => (
                    <option key={cfg.id} value={cfg.id}>
                      {cfg.name} ({cfg.suffix})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter Dropdown */}
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
                  <option value="DELIVERED">Delivered Only</option>
                  <option value="RETURNED">Returned Only</option>
                  <option value="PARTIAL">Partial Only</option>
                  <option value="EXCHANGE">Exchange Only</option>
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
                placeholder="Search Parcel / Order ID, SKU, customer..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Parcel ID & Outlet</th>
                  <th className="py-3 px-3">Customer & Area</th>
                  <th className="py-3 px-3">SKU & Item Description</th>
                  <th className="py-3 px-3 text-center">Items</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-3 text-right">Parcel Value</th>
                  <th className="py-3 px-3 text-right">Net Revenue</th>
                  <th className="py-3 px-4 text-center">Parcel Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No dispatched parcels matched the active outlet and filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o, idx) => {
                    const outlet = getOrderOutlet(o);
                    const isDelivered = o.itemDeliveryStatus === 'Delivered' || (o.deliveryStatus.includes('Delivered') && o.netRevenueImpact > 0);
                    const isReturned = o.itemDeliveryStatus === 'Returned' || o.orderCategory === 'FULL_RETURN';

                    return (
                      <tr key={`${o.orderId}-${o.sku}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              #{o.orderId}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-slate-500 font-medium">{outlet}</span>
                              {o.branchSuffix && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200/80 text-slate-700">
                                  tag: {o.branchSuffix}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{o.customerName || 'Valued Customer'}</div>
                          <div className="text-[10px] text-slate-400">{o.city} • {o.districtArea}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-slate-700 font-bold">{o.sku}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{o.itemName}</div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {o.quantity}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-700">
                          ৳ {o.itemCost.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          ৳ {o.orderAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600">
                          ৳ {Math.round(o.netRevenueImpact).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isReturned
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {o.deliveryStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length.toLocaleString()} parcel records
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
