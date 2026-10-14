"use client";

import React, { useState, useMemo } from 'react';
import { ReconciledOrderRow } from '@/types';
import { CreditCard, Banknote, ShieldCheck, AlertCircle, Sparkles, ArrowRightLeft } from 'lucide-react';

interface PaymentMethodMixCardProps {
  orders: ReconciledOrderRow[];
  title?: string;
  subtitle?: string;
}

export type PaymentBreakdownMode = 'BINARY' | 'GATEWAYS';
export type PaymentMetricMode = 'ORDERS' | 'REVENUE';

export function PaymentMethodMixCard({
  orders = [],
  title = "Payment Settlement Mix: COD vs Online Paid",
  subtitle = "Interactive ratio analysis of Cash on Delivery volume versus digital prepaid settlements (bKash, SSLCommerz, Cards & Bank)"
}: PaymentMethodMixCardProps) {
  const [breakdownMode, setBreakdownMode] = useState<PaymentBreakdownMode>('BINARY');
  const [metricMode, setMetricMode] = useState<PaymentMetricMode>('ORDERS');
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);

  // Group unique orders to prevent multi-line item double counting of orders
  const stats = useMemo(() => {
    const orderMap = new Map<string, {
      orderId: string;
      paymentMethod: string;
      orderAmount: number;
      netRevenue: number;
      isDelivered: boolean;
      isReturned: boolean;
      isPartial: boolean;
    }>();

    orders.forEach(r => {
      const oid = r.orderId;
      if (!orderMap.has(oid)) {
        orderMap.set(oid, {
          orderId: oid,
          paymentMethod: r.paymentMethod || 'Cash on delivery',
          orderAmount: r.orderAmount || 0,
          netRevenue: 0,
          isDelivered: r.orderCategory === 'DELIVERED',
          isReturned: r.orderCategory === 'FULL_RETURN',
          isPartial: r.orderCategory === 'PARTIAL',
        });
      }
      const existing = orderMap.get(oid)!;
      existing.netRevenue += (r.netRevenueImpact || 0);
    });

    const uniqueOrders = Array.from(orderMap.values());
    const totalOrderCount = uniqueOrders.length;

    let codCount = 0;
    let codRevenue = 0;
    let codDelivered = 0;
    let codReturns = 0;

    let onlineCount = 0;
    let onlineRevenue = 0;
    let onlineDelivered = 0;
    let onlineReturns = 0;

    // Granular channels
    let bkashCount = 0;
    let bkashRevenue = 0;
    let bkashReturns = 0;

    let sslCount = 0;
    let sslRevenue = 0;
    let sslReturns = 0;

    let nagadCount = 0;
    let nagadRevenue = 0;
    let nagadReturns = 0;

    uniqueOrders.forEach(o => {
      const pm = (o.paymentMethod || '').toLowerCase().trim();
      const isBkash = /bkash/i.test(pm);
      const isNagad = /nagad|rocket|upay/i.test(pm);
      const isSSL = /ssl|sslcommerz|pay\s*online|card|bank|dbbl|ucb|ecom|visa|mastercard|city\s*bank/i.test(pm);
      const isOnline = isBkash || isNagad || isSSL || /online|prepaid|advance/i.test(pm);

      if (isOnline) {
        onlineCount++;
        onlineRevenue += o.orderAmount;
        if (o.isDelivered || (o.isPartial && o.netRevenue > 0)) onlineDelivered++;
        if (o.isReturned) onlineReturns++;

        if (isBkash) {
          bkashCount++;
          bkashRevenue += o.orderAmount;
          if (o.isReturned) bkashReturns++;
        } else if (isSSL) {
          sslCount++;
          sslRevenue += o.orderAmount;
          if (o.isReturned) sslReturns++;
        } else {
          nagadCount++;
          nagadRevenue += o.orderAmount;
          if (o.isReturned) nagadReturns++;
        }
      } else {
        codCount++;
        codRevenue += o.orderAmount;
        if (o.isDelivered || (o.isPartial && o.netRevenue > 0)) codDelivered++;
        if (o.isReturned) codReturns++;
      }
    });

    const totalRevenue = codRevenue + onlineRevenue;

    const codOrderShare = totalOrderCount > 0 ? (codCount / totalOrderCount) * 100 : 0;
    const onlineOrderShare = totalOrderCount > 0 ? (onlineCount / totalOrderCount) * 100 : 0;

    const codRevenueShare = totalRevenue > 0 ? (codRevenue / totalRevenue) * 100 : 0;
    const onlineRevenueShare = totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 0;

    const codReturnRate = codCount > 0 ? (codReturns / codCount) * 100 : 0;
    const onlineReturnRate = onlineCount > 0 ? (onlineReturns / onlineCount) * 100 : 0;

    // Approximate ratio e.g. "3.2 : 1"
    const ratioMultiplier = onlineCount > 0 ? (codCount / onlineCount).toFixed(1) : codCount > 0 ? '∞' : '1.0';

    return {
      totalOrderCount,
      totalRevenue,
      cod: {
        count: codCount,
        revenue: Math.round(codRevenue),
        orderShare: codOrderShare,
        revenueShare: codRevenueShare,
        returnRate: codReturnRate,
        returns: codReturns,
        delivered: codDelivered,
      },
      online: {
        count: onlineCount,
        revenue: Math.round(onlineRevenue),
        orderShare: onlineOrderShare,
        revenueShare: onlineRevenueShare,
        returnRate: onlineReturnRate,
        returns: onlineReturns,
        delivered: onlineDelivered,
      },
      gateways: {
        bkash: {
          count: bkashCount,
          revenue: Math.round(bkashRevenue),
          orderShare: totalOrderCount > 0 ? (bkashCount / totalOrderCount) * 100 : 0,
          revenueShare: totalRevenue > 0 ? (bkashRevenue / totalRevenue) * 100 : 0,
          returnRate: bkashCount > 0 ? (bkashReturns / bkashCount) * 100 : 0,
        },
        ssl: {
          count: sslCount,
          revenue: Math.round(sslRevenue),
          orderShare: totalOrderCount > 0 ? (sslCount / totalOrderCount) * 100 : 0,
          revenueShare: totalRevenue > 0 ? (sslRevenue / totalRevenue) * 100 : 0,
          returnRate: sslCount > 0 ? (sslReturns / sslCount) * 100 : 0,
        },
        nagad: {
          count: nagadCount,
          revenue: Math.round(nagadRevenue),
          orderShare: totalOrderCount > 0 ? (nagadCount / totalOrderCount) * 100 : 0,
          revenueShare: totalRevenue > 0 ? (nagadRevenue / totalRevenue) * 100 : 0,
          returnRate: nagadCount > 0 ? (nagadReturns / nagadCount) * 100 : 0,
        }
      },
      ratioMultiplier,
    };
  }, [orders]);

  // Slices generation for Donut Chart
  const donutSlices = useMemo(() => {
    if (breakdownMode === 'BINARY') {
      const codVal = metricMode === 'ORDERS' ? stats.cod.count : stats.cod.revenue;
      const onlineVal = metricMode === 'ORDERS' ? stats.online.count : stats.online.revenue;
      return [
        {
          id: 'cod',
          label: 'Cash on Delivery (COD)',
          shortLabel: 'COD',
          value: codVal,
          color: '#F97316', // Vibrant Orange
          textColor: 'text-orange-600',
          bgLight: 'bg-orange-50',
          borderCol: 'border-orange-200',
          share: metricMode === 'ORDERS' ? stats.cod.orderShare : stats.cod.revenueShare,
          subLabel: `Return rate: ${stats.cod.returnRate.toFixed(1)}%`,
          returnRate: stats.cod.returnRate,
        },
        {
          id: 'online',
          label: 'Online Paid (bKash / SSL / Bank)',
          shortLabel: 'Online Paid',
          value: onlineVal,
          color: '#0284C7', // Sky Blue / Deep Cyan
          textColor: 'text-sky-600',
          bgLight: 'bg-sky-50',
          borderCol: 'border-sky-200',
          share: metricMode === 'ORDERS' ? stats.online.orderShare : stats.online.revenueShare,
          subLabel: `Return rate: ${stats.online.returnRate.toFixed(1)}%`,
          returnRate: stats.online.returnRate,
        }
      ];
    }

    // GATEWAYS Mode
    const codVal = metricMode === 'ORDERS' ? stats.cod.count : stats.cod.revenue;
    const bkashVal = metricMode === 'ORDERS' ? stats.gateways.bkash.count : stats.gateways.bkash.revenue;
    const sslVal = metricMode === 'ORDERS' ? stats.gateways.ssl.count : stats.gateways.ssl.revenue;
    const nagadVal = metricMode === 'ORDERS' ? stats.gateways.nagad.count : stats.gateways.nagad.revenue;

    const list = [
      {
        id: 'cod',
        label: 'Cash on Delivery (COD)',
        shortLabel: 'COD',
        value: codVal,
        color: '#F97316',
        textColor: 'text-orange-600',
        bgLight: 'bg-orange-50',
        borderCol: 'border-orange-200',
        share: metricMode === 'ORDERS' ? stats.cod.orderShare : stats.cod.revenueShare,
        subLabel: `Return rate: ${stats.cod.returnRate.toFixed(1)}%`,
        returnRate: stats.cod.returnRate,
      },
      {
        id: 'bkash',
        label: 'bKash MFS Direct',
        shortLabel: 'bKash',
        value: bkashVal,
        color: '#E2136E', // Signature bKash Magenta
        textColor: 'text-pink-600',
        bgLight: 'bg-pink-50',
        borderCol: 'border-pink-200',
        share: metricMode === 'ORDERS' ? stats.gateways.bkash.orderShare : stats.gateways.bkash.revenueShare,
        subLabel: `Return rate: ${stats.gateways.bkash.returnRate.toFixed(1)}%`,
        returnRate: stats.gateways.bkash.returnRate,
      },
      {
        id: 'ssl',
        label: 'SSLCommerz / Cards / Bank',
        shortLabel: 'SSL / Cards',
        value: sslVal,
        color: '#6366F1', // Indigo / Gateway
        textColor: 'text-indigo-600',
        bgLight: 'bg-indigo-50',
        borderCol: 'border-indigo-200',
        share: metricMode === 'ORDERS' ? stats.gateways.ssl.orderShare : stats.gateways.ssl.revenueShare,
        subLabel: `Return rate: ${stats.gateways.ssl.returnRate.toFixed(1)}%`,
        returnRate: stats.gateways.ssl.returnRate,
      }
    ];

    if (nagadVal > 0) {
      list.push({
        id: 'nagad',
        label: 'Nagad / Other MFS',
        shortLabel: 'Nagad',
        value: nagadVal,
        color: '#F59E0B',
        textColor: 'text-amber-600',
        bgLight: 'bg-amber-50',
        borderCol: 'border-amber-200',
        share: metricMode === 'ORDERS' ? stats.gateways.nagad.orderShare : stats.gateways.nagad.revenueShare,
        subLabel: `Return rate: ${stats.gateways.nagad.returnRate.toFixed(1)}%`,
        returnRate: stats.gateways.nagad.returnRate,
      });
    }

    return list;
  }, [breakdownMode, metricMode, stats]);

  // Compute percentage and SVG dash segments (Circumference of r=15.9155 is exactly 100)
  const totalValue = donutSlices.reduce((acc, s) => acc + s.value, 0);
  let accumulatedPercent = 0;
  const segments = donutSlices.map(slice => {
    const sharePercent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0;
    const dashArray = `${sharePercent.toFixed(2)} ${(100 - sharePercent).toFixed(2)}`;
    const dashOffset = (-accumulatedPercent).toFixed(2);
    accumulatedPercent += sharePercent;

    return {
      ...slice,
      sharePercent,
      dashArray,
      dashOffset,
    };
  });

  const activeSlice = hoveredSliceId ? segments.find(s => s.id === hoveredSliceId) : null;

  const formatDisplay = (v: number) => {
    if (metricMode === 'REVENUE') return `৳${v.toLocaleString()}`;
    return `${v.toLocaleString()} orders`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
      {/* Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100/70 text-orange-600 flex items-center justify-center font-bold shadow-2xs border border-orange-200/60 shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline text-sm sm:text-base font-bold text-slate-900">
                {title}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80">
                {stats.ratioMultiplier} : 1 Ratio
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Action Controls: Breakdown Mode & Metric Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Breakdown Filter: Binary (COD vs Online) vs Gateways (bKash / SSL) */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setBreakdownMode('BINARY')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                breakdownMode === 'BINARY'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              COD vs Online
            </button>
            <button
              type="button"
              onClick={() => setBreakdownMode('GATEWAYS')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                breakdownMode === 'GATEWAYS'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Gateways (bKash / SSL)
            </button>
          </div>

          {/* Metric Filter: Orders vs Revenue */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMetricMode('ORDERS')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                metricMode === 'ORDERS'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('REVENUE')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                metricMode === 'REVENUE'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revenue (৳)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Donut Chart with Center Display */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 190, height: 190 }}>
          <svg
            className="-rotate-90 transform shrink-0 w-full h-full"
            viewBox="0 0 36 36"
            width="190"
            height="190"
          >
            {/* Background Empty Ring */}
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth="4"
            />

            {/* Slices */}
            {segments.map((seg) => {
              const isHovered = hoveredSliceId === seg.id;
              const isAnyHovered = hoveredSliceId !== null;

              return (
                <circle
                  key={seg.id}
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? 5.2 : 4}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    opacity: isAnyHovered && !isHovered ? 0.35 : 1,
                  }}
                  onMouseEnter={() => setHoveredSliceId(seg.id)}
                  onMouseLeave={() => setHoveredSliceId(null)}
                />
              );
            })}
          </svg>

          {/* Interactive Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 line-clamp-1 max-w-[120px]">
              {activeSlice ? activeSlice.shortLabel : `${stats.cod.orderShare.toFixed(0)}% COD : ${stats.online.orderShare.toFixed(0)}% Online`}
            </span>
            <span className="font-headline text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
              {activeSlice ? formatDisplay(activeSlice.value) : (metricMode === 'ORDERS' ? `${stats.totalOrderCount.toLocaleString()} Orders` : `৳${stats.totalRevenue.toLocaleString()}`)}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {activeSlice ? `${activeSlice.sharePercent.toFixed(1)}% Share` : 'Consolidated Mix'}
            </span>
          </div>
        </div>

        {/* Right: Detailed Legend & Comparative Return Risk Insights */}
        <div className="w-full flex-1 flex flex-col gap-3 min-w-0">
          {/* Proportional Dual-Split Bar */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-orange-600 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" />
                COD ({stats.cod.orderShare.toFixed(1)}%)
              </span>
              <span className="text-sky-600 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Online Paid ({stats.online.orderShare.toFixed(1)}%)
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-200 shadow-inner">
              <div
                className="h-full bg-orange-500 transition-all duration-500"
                style={{ width: `${stats.cod.orderShare}%` }}
                title={`COD: ${stats.cod.count} orders (${stats.cod.orderShare.toFixed(1)}%)`}
              />
              <div
                className="h-full bg-sky-500 transition-all duration-500"
                style={{ width: `${stats.online.orderShare}%` }}
                title={`Online Paid: ${stats.online.count} orders (${stats.online.orderShare.toFixed(1)}%)`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-0.5">
              <span>{stats.cod.count.toLocaleString()} orders • ৳{stats.cod.revenue.toLocaleString()}</span>
              <span>{stats.online.count.toLocaleString()} orders • ৳{stats.online.revenue.toLocaleString()}</span>
            </div>
          </div>

          {/* Interactive Slices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {segments.map((seg) => {
              const isHovered = hoveredSliceId === seg.id;
              return (
                <div
                  key={seg.id}
                  onMouseEnter={() => setHoveredSliceId(seg.id)}
                  onMouseLeave={() => setHoveredSliceId(null)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    isHovered
                      ? 'bg-slate-50 border-slate-400 shadow-2xs scale-[1.01]'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-bold text-slate-900 truncate text-[11px] sm:text-xs">
                        {seg.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                      {seg.sharePercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[11px]">
                    <span className="font-semibold text-slate-700 font-mono">
                      {formatDisplay(seg.value)}
                    </span>
                    <span className={`text-[10px] font-bold ${seg.returnRate === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {seg.returnRate === 0 ? '0% Returns' : `${seg.returnRate.toFixed(1)}% RTO`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Executive Return Risk Insight Card */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">
                Cash Flow Insight: Online Prepaid vs COD Return Variance
              </span>
              <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                Online prepaid orders ({stats.online.count.toLocaleString()} orders) achieved a{' '}
                <strong className="text-emerald-900 font-extrabold">{stats.online.returnRate.toFixed(1)}% return rate</strong> (100% retained cash flow), whereas COD orders experienced a{' '}
                <strong className="text-rose-700 font-extrabold">{stats.cod.returnRate.toFixed(1)}% return rate</strong>. Increasing online payments directly reduces courier return freight losses.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
