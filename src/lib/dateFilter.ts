import { RawOrderRow } from '@/types';

export type DateScope = 'all' | 'today' | '7d' | '30d' | 'month' | '90d' | 'custom';

export interface CustomDateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  label?: string;    // e.g. 'Week 1', 'Week 2'
}

export interface FileWeek {
  id: string; // e.g. 'week-1'
  weekIndex: number; // 1, 2, 3...
  label: string; // 'Week 1'
  dateRangeLabel: string; // '1 Sep – 7 Sep'
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  startMs: number;
  endMs: number;
  orderCount: number;
}

export interface PeriodMetrics {
  label: string;
  subLabel: string;
  startMs: number;
  endMs: number;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  partialOrders: number;
  exchangeOrders: number;
  deliveryRate: number; // %
  returnRate: number;   // %
  grossRevenue: number; // Total order amount in ৳
  deliveredRevenue: number; // Delivered revenue in ৳
  aov: number; // grossRevenue / totalOrders
}

export interface PeriodComparisonResult {
  periodA: PeriodMetrics;
  periodB: PeriodMetrics;
  deltas: {
    ordersDelta: number;
    ordersPct: number;
    deliveryRateDiff: number; // percentage points
    returnRateDiff: number;   // percentage points
    grossRevenueDelta: number;
    grossRevenuePct: number;
    deliveredRevenueDelta: number;
    deliveredRevenuePct: number;
    aovDelta: number;
    aovPct: number;
  };
}

export interface DateScopeCounts {
  all: number;
  today: number;
  '7d': number;
  '30d': number;
  month: number;
  '90d': number;
  custom?: number;
}

export interface DateFilterResult {
  scope: DateScope;
  customRange?: CustomDateRange;
  filteredOrders: RawOrderRow[];
  totalOrders: number;
  matchedOrders: number;
  label: string;
  subLabel?: string;
  startMs: number;
  endMs: number;
  counts: DateScopeCounts;
  isFiltered: boolean;
  minDateIso?: string;
  maxDateIso?: string;
  fileWeeks: FileWeek[];
}

/**
 * Dynamic Column Alias Resolver.
 */
function findCol(row: Record<string, any>, candidates: string[]): any {
  if (!row || typeof row !== 'object') return null;
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === c.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
      return row[found];
    }
  }
  return null;
}

/**
 * Parses varied Excel, CSV, ISO, and database date representations into a valid Date object.
 */
export function parseOrderDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // 1. Excel serial number (days since 1899-12-30)
  if (typeof val === 'number') {
    if (val > 20000 && val < 70000) {
      return new Date(Math.round((val - 25569) * 86400 * 1000));
    }
    // Unix timestamp in ms
    if (val > 1500000000000) {
      return new Date(val);
    }
    // Unix timestamp in seconds
    if (val > 1500000000 && val < 2500000000) {
      return new Date(val * 1000);
    }
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Numeric string representing Excel serial
    const num = Number(trimmed);
    if (!isNaN(num) && num > 20000 && num < 70000) {
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    }

    // Common Bangladesh / UK date formats: DD/MM/YYYY or DD-MM-YYYY (with optional HH:mm:ss)
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      return isNaN(d.getTime()) ? null : d;
    }

    // Standard ISO / JS string parse fallback
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Extracts order date from an order row using common header aliases.
 */
export function getOrderDate(row: RawOrderRow): Date | null {
  const val = findCol(row, [
    'orderdate', 'order_date', 'date', 'createdat', 'created_at',
    'creationdate', 'creation_date', 'ordercreatedat', 'order_created_at',
    'Order Date', 'Date', 'Creation Date'
  ]);
  return parseOrderDate(val);
}

export interface DateAnalysis {
  validDatesCount: number;
  minDate: Date | null;
  maxDate: Date | null;
  anchorDay: Date;
  dominantYearMonth: { year: number; month: number };
  dominantMonthName: string;
}

/**
 * Analyzes the date distribution across the dataset to intelligently determine
 * the anchor date for 'Today' and 'This Month'.
 */
export function analyzeDates(orders: RawOrderRow[]): DateAnalysis {
  const dates: { d: Date; ms: number }[] = [];

  for (const r of orders) {
    const d = getOrderDate(r);
    if (d && !isNaN(d.getTime())) {
      dates.push({ d, ms: d.getTime() });
    }
  }

  const now = new Date();
  if (dates.length === 0) {
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      validDatesCount: 0,
      minDate: null,
      maxDate: null,
      anchorDay: todayMid,
      dominantYearMonth: { year: now.getFullYear(), month: now.getMonth() },
      dominantMonthName: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    };
  }

  dates.sort((a, b) => a.ms - b.ms);
  const minDate = dates[0].d;
  const maxDate = dates[dates.length - 1].d;

  // Check if today exists in the dataset
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000;
  const hasOrdersToday = dates.some(e => e.ms >= todayStart && e.ms < todayEnd);

  // If live orders from today exist, anchor is today; otherwise anchor is the latest day in the dataset
  const anchorDay = hasOrdersToday
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

  // Find dominant month in dataset
  const monthCounts = new Map<string, { count: number; year: number; month: number }>();
  dates.forEach(e => {
    const y = e.d.getFullYear();
    const m = e.d.getMonth();
    const k = `${y}-${m}`;
    const curr = monthCounts.get(k) || { count: 0, year: y, month: m };
    curr.count++;
    monthCounts.set(k, curr);
  });

  let best = { count: 0, year: anchorDay.getFullYear(), month: anchorDay.getMonth() };
  monthCounts.forEach(item => {
    if (item.count > best.count) {
      best = item;
    }
  });

  const domDate = new Date(best.year, best.month, 1);
  const dominantMonthName = domDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return {
    validDatesCount: dates.length,
    minDate,
    maxDate,
    anchorDay,
    dominantYearMonth: { year: best.year, month: best.month },
    dominantMonthName,
  };
}

/**
 * Computes exact start and end timestamps (milliseconds) for a given date scope.
 */
export function getScopeRange(
  scope: DateScope,
  analysis: DateAnalysis,
  customRange?: CustomDateRange
): {
  startMs: number;
  endMs: number;
  label: string;
  subLabel?: string;
} {
  if (scope === 'all') {
    return {
      startMs: 0,
      endMs: Infinity,
      label: 'All Records',
      subLabel: analysis.validDatesCount > 0 && analysis.minDate && analysis.maxDate
        ? `${analysis.minDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${analysis.maxDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : undefined,
    };
  }

  const anchorMs = analysis.anchorDay.getTime();

  if (scope === 'today') {
    const startMs = anchorMs;
    const endMs = anchorMs + 86400000;
    const dayStr = analysis.anchorDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      startMs,
      endMs,
      label: 'Today',
      subLabel: dayStr,
    };
  }

  if (scope === '7d') {
    const startMs = anchorMs - 6 * 86400000;
    const endMs = anchorMs + 86400000;
    const sStr = new Date(startMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const eStr = analysis.anchorDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      startMs,
      endMs,
      label: 'Last 7 Days',
      subLabel: `${sStr} – ${eStr}`,
    };
  }

  if (scope === '30d') {
    const startMs = anchorMs - 29 * 86400000;
    const endMs = anchorMs + 86400000;
    const sStr = new Date(startMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const eStr = analysis.anchorDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      startMs,
      endMs,
      label: 'Last 30 Days',
      subLabel: `${sStr} – ${eStr}`,
    };
  }

  if (scope === 'month') {
    const { year, month } = analysis.dominantYearMonth;
    const mStart = new Date(year, month, 1);
    const mEnd = new Date(year, month + 1, 1);
    return {
      startMs: mStart.getTime(),
      endMs: mEnd.getTime(),
      label: 'This Month',
      subLabel: analysis.dominantMonthName,
    };
  }

  if (scope === '90d') {
    const startMs = anchorMs - 89 * 86400000;
    const endMs = anchorMs + 86400000;
    const sStr = new Date(startMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const eStr = analysis.anchorDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      startMs,
      endMs,
      label: 'Last 90 Days',
      subLabel: `${sStr} – ${eStr}`,
    };
  }

  if (scope === 'custom') {
    if (customRange?.startDate && customRange?.endDate) {
      const sDate = new Date(`${customRange.startDate}T00:00:00`);
      const eDate = new Date(`${customRange.endDate}T23:59:59.999`);
      const startMs = isNaN(sDate.getTime()) ? 0 : sDate.getTime();
      const endMs = isNaN(eDate.getTime()) ? Infinity : eDate.getTime() + 1;
      const sStr = !isNaN(sDate.getTime())
        ? sDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : customRange.startDate;
      const eStr = !isNaN(eDate.getTime())
        ? eDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : customRange.endDate;
      return {
        startMs,
        endMs,
        label: customRange.label || 'Custom Range',
        subLabel: `${sStr} – ${eStr}`,
      };
    }
  }

  return { startMs: 0, endMs: Infinity, label: 'All Records' };
}

/**
 * Dynamically computes consecutive 7-day week chunks covering the uploaded file dataset.
 */
export function computeFileWeeks(orders: RawOrderRow[], analysis: DateAnalysis): FileWeek[] {
  if (!analysis.minDate || !analysis.maxDate || orders.length === 0) return [];

  const minYear = analysis.minDate.getFullYear();
  const minMonth = analysis.minDate.getMonth();
  const minDay = analysis.minDate.getDate();
  const minStartOfDay = new Date(minYear, minMonth, minDay, 0, 0, 0, 0);

  const maxYear = analysis.maxDate.getFullYear();
  const maxMonth = analysis.maxDate.getMonth();
  const maxDay = analysis.maxDate.getDate();
  const maxEndOfDay = new Date(maxYear, maxMonth, maxDay, 23, 59, 59, 999);

  const minMs = minStartOfDay.getTime();
  const maxMs = maxEndOfDay.getTime() + 1;

  // Extract order timestamps
  const orderTimestamps: number[] = [];
  for (const r of orders) {
    const d = getOrderDate(r);
    if (d && !isNaN(d.getTime())) {
      orderTimestamps.push(d.getTime());
    }
  }

  const weeks: FileWeek[] = [];
  let currStart = minMs;
  let weekIdx = 1;

  while (currStart < maxMs) {
    const nextStart = currStart + 7 * 86400000;
    const currEnd = Math.min(nextStart, maxMs);

    const sDate = new Date(currStart);
    const eDate = new Date(currEnd - 1000);

    const formatIso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const sIso = formatIso(sDate);
    const eIso = formatIso(eDate);

    const sStr = sDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const eStr = eDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    let count = 0;
    for (let i = 0; i < orderTimestamps.length; i++) {
      if (orderTimestamps[i] >= currStart && orderTimestamps[i] < currEnd) {
        count++;
      }
    }

    weeks.push({
      id: `week-${weekIdx}`,
      weekIndex: weekIdx,
      label: `Week ${weekIdx}`,
      dateRangeLabel: `${sStr} – ${eStr}`,
      startDate: sIso,
      endDate: eIso,
      startMs: currStart,
      endMs: currEnd,
      orderCount: count,
    });

    currStart = nextStart;
    weekIdx++;
  }

  return weeks;
}

/**
 * Computes essential order, realization, and return metrics for a specific timestamp interval.
 */
export function computePeriodMetrics(
  orders: RawOrderRow[],
  startMs: number,
  endMs: number,
  label: string,
  subLabel: string
): PeriodMetrics {
  let totalOrders = 0;
  let deliveredOrders = 0;
  let returnedOrders = 0;
  let partialOrders = 0;
  let exchangeOrders = 0;
  let grossRevenue = 0;
  let deliveredRevenue = 0;

  const seenOrderIds = new Set<string>();

  for (const r of orders) {
    const d = getOrderDate(r);
    const ms = d ? d.getTime() : null;
    if (ms === null || ms < startMs || ms >= endMs) continue;

    const rawId = findCol(r, ['order_id', 'orderid', 'id', 'order number', 'invoice', 'invoice_no']);
    const orderId = rawId !== null && rawId !== undefined ? String(rawId).trim() : '';

    const rawAmount = findCol(r, ['orderamount', 'order_amount', 'total_amount', 'total', 'amount', 'itemcost', 'item_cost', 'price', 'total price']);
    const amountNum = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]/g, '')) || 0;

    const cat = (r.orderCategory || r.deliveryCategory || '').toString().toUpperCase();
    const status = (r.deliveryStatus || r.reconciledDeliveryStatus || r.status || '').toString().toLowerCase();

    const isDelivered = cat === 'DELIVERED' || status.includes('delivered') || status.includes('received') || status.includes('kept');
    const isReturned = cat === 'FULL_RETURN' || status.includes('return') || status.includes('rto') || status.includes('cancel');
    const isPartial = cat === 'PARTIAL' || status.includes('partial');
    const isExchange = cat === 'EXCHANGE' || status.includes('exchange');

    if (!orderId || !seenOrderIds.has(orderId)) {
      if (orderId) seenOrderIds.add(orderId);
      totalOrders++;
      grossRevenue += amountNum;

      if (isDelivered) deliveredOrders++;
      else if (isReturned) returnedOrders++;
      else if (isPartial) partialOrders++;
      else if (isExchange) exchangeOrders++;
      else deliveredOrders++;
    }

    if (isDelivered || isExchange) {
      deliveredRevenue += amountNum;
    } else if (isPartial) {
      deliveredRevenue += Math.round(amountNum * 0.5);
    }
  }

  const deliveryRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
  const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;
  const aov = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

  return {
    label,
    subLabel,
    startMs,
    endMs,
    totalOrders,
    deliveredOrders,
    returnedOrders,
    partialOrders,
    exchangeOrders,
    deliveryRate,
    returnRate,
    grossRevenue,
    deliveredRevenue,
    aov,
  };
}

/**
 * Compares two periods side-by-side with delta analysis.
 */
export function comparePeriods(
  orders: RawOrderRow[],
  periodA: { startMs: number; endMs: number; label: string; subLabel?: string },
  periodB: { startMs: number; endMs: number; label: string; subLabel?: string }
): PeriodComparisonResult {
  const metricsA = computePeriodMetrics(orders, periodA.startMs, periodA.endMs, periodA.label, periodA.subLabel || '');
  const metricsB = computePeriodMetrics(orders, periodB.startMs, periodB.endMs, periodB.label, periodB.subLabel || '');

  const calcPct = (a: number, b: number) => {
    if (b === 0) return a === 0 ? 0 : 100;
    return ((a - b) / b) * 100;
  };

  return {
    periodA: metricsA,
    periodB: metricsB,
    deltas: {
      ordersDelta: metricsA.totalOrders - metricsB.totalOrders,
      ordersPct: calcPct(metricsA.totalOrders, metricsB.totalOrders),
      deliveryRateDiff: metricsA.deliveryRate - metricsB.deliveryRate,
      returnRateDiff: metricsA.returnRate - metricsB.returnRate,
      grossRevenueDelta: metricsA.grossRevenue - metricsB.grossRevenue,
      grossRevenuePct: calcPct(metricsA.grossRevenue, metricsB.grossRevenue),
      deliveredRevenueDelta: metricsA.deliveredRevenue - metricsB.deliveredRevenue,
      deliveredRevenuePct: calcPct(metricsA.deliveredRevenue, metricsB.deliveredRevenue),
      aovDelta: metricsA.aov - metricsB.aov,
      aovPct: calcPct(metricsA.aov, metricsB.aov),
    },
  };
}

/**
 * Filters orders by date scope and returns filtered rows along with metadata, counts, and dynamic file weeks.
 * Default is 'all' to ensure 100% of uploaded records are shown by default.
 */
export function filterOrdersByDateScope(
  orders: RawOrderRow[],
  scope: DateScope = 'all',
  customRange?: CustomDateRange
): DateFilterResult {
  const totalOrders = orders.length;
  if (!orders || orders.length === 0) {
    return {
      scope,
      customRange,
      filteredOrders: [],
      totalOrders: 0,
      matchedOrders: 0,
      label: 'All Records',
      startMs: 0,
      endMs: Infinity,
      counts: { all: 0, today: 0, '7d': 0, '30d': 0, month: 0, '90d': 0 },
      isFiltered: false,
      fileWeeks: [],
    };
  }

  const analysis = analyzeDates(orders);
  const minDateIso = analysis.minDate ? analysis.minDate.toISOString().slice(0, 10) : undefined;
  const maxDateIso = analysis.maxDate ? analysis.maxDate.toISOString().slice(0, 10) : undefined;
  const fileWeeks = computeFileWeeks(orders, analysis);

  // Calculate order counts for all preset scopes
  const allRange = getScopeRange('all', analysis);
  const todayRange = getScopeRange('today', analysis);
  const sevenDaysRange = getScopeRange('7d', analysis);
  const thirtyDaysRange = getScopeRange('30d', analysis);
  const monthRange = getScopeRange('month', analysis);
  const ninetyDaysRange = getScopeRange('90d', analysis);
  const customCalculatedRange = customRange ? getScopeRange('custom', analysis, customRange) : null;

  let countToday = 0;
  let count7d = 0;
  let count30d = 0;
  let countMonth = 0;
  let count90d = 0;
  let countCustom = 0;

  const orderDateMap: (number | null)[] = new Array(orders.length);

  for (let i = 0; i < orders.length; i++) {
    const d = getOrderDate(orders[i]);
    const ms = d ? d.getTime() : null;
    orderDateMap[i] = ms;

    if (ms !== null) {
      if (ms >= todayRange.startMs && ms < todayRange.endMs) countToday++;
      if (ms >= sevenDaysRange.startMs && ms < sevenDaysRange.endMs) count7d++;
      if (ms >= thirtyDaysRange.startMs && ms < thirtyDaysRange.endMs) count30d++;
      if (ms >= monthRange.startMs && ms < monthRange.endMs) countMonth++;
      if (ms >= ninetyDaysRange.startMs && ms < ninetyDaysRange.endMs) count90d++;
      if (customCalculatedRange && ms >= customCalculatedRange.startMs && ms < customCalculatedRange.endMs) {
        countCustom++;
      }
    }
  }

  const counts: DateScopeCounts = {
    all: totalOrders,
    today: countToday,
    '7d': count7d,
    '30d': count30d,
    month: countMonth,
    '90d': count90d,
    custom: customRange ? countCustom : undefined,
  };

  const targetRange = getScopeRange(scope, analysis, customRange);

  if (scope === 'all') {
    return {
      scope: 'all',
      customRange,
      filteredOrders: orders,
      totalOrders,
      matchedOrders: totalOrders,
      label: allRange.label,
      subLabel: allRange.subLabel,
      startMs: allRange.startMs,
      endMs: allRange.endMs,
      counts,
      isFiltered: false,
      minDateIso,
      maxDateIso,
      fileWeeks,
    };
  }

  const filteredOrders: RawOrderRow[] = [];
  for (let i = 0; i < orders.length; i++) {
    const ms = orderDateMap[i];
    if (ms !== null && ms >= targetRange.startMs && ms < targetRange.endMs) {
      filteredOrders.push(orders[i]);
    }
  }

  return {
    scope,
    customRange,
    filteredOrders,
    totalOrders,
    matchedOrders: filteredOrders.length,
    label: targetRange.label,
    subLabel: targetRange.subLabel,
    startMs: targetRange.startMs,
    endMs: targetRange.endMs,
    counts,
    isFiltered: true,
    minDateIso,
    maxDateIso,
    fileWeeks,
  };
}
