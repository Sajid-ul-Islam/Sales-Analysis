import { RawOrderRow } from '@/types';

export type DateScope = 'all' | 'today' | '7d' | 'month';

export interface DateScopeCounts {
  all: number;
  today: number;
  '7d': number;
  month: number;
}

export interface DateFilterResult {
  scope: DateScope;
  filteredOrders: RawOrderRow[];
  totalOrders: number;
  matchedOrders: number;
  label: string;
  subLabel?: string;
  startMs: number;
  endMs: number;
  counts: DateScopeCounts;
  isFiltered: boolean;
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
export function getScopeRange(scope: DateScope, analysis: DateAnalysis): {
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

  return { startMs: 0, endMs: Infinity, label: 'All Records' };
}

/**
 * Filters orders by date scope and returns filtered rows along with metadata and counts.
 */
export function filterOrdersByDateScope(orders: RawOrderRow[], scope: DateScope = 'all'): DateFilterResult {
  const totalOrders = orders.length;
  if (!orders || orders.length === 0) {
    return {
      scope,
      filteredOrders: [],
      totalOrders: 0,
      matchedOrders: 0,
      label: 'All Records',
      startMs: 0,
      endMs: Infinity,
      counts: { all: 0, today: 0, '7d': 0, month: 0 },
      isFiltered: false,
    };
  }

  const analysis = analyzeDates(orders);

  // Calculate order counts for all 4 scopes
  const allRange = getScopeRange('all', analysis);
  const todayRange = getScopeRange('today', analysis);
  const sevenDaysRange = getScopeRange('7d', analysis);
  const monthRange = getScopeRange('month', analysis);

  let countToday = 0;
  let count7d = 0;
  let countMonth = 0;

  const orderDateMap: (number | null)[] = new Array(orders.length);

  for (let i = 0; i < orders.length; i++) {
    const d = getOrderDate(orders[i]);
    const ms = d ? d.getTime() : null;
    orderDateMap[i] = ms;

    if (ms !== null) {
      if (ms >= todayRange.startMs && ms < todayRange.endMs) countToday++;
      if (ms >= sevenDaysRange.startMs && ms < sevenDaysRange.endMs) count7d++;
      if (ms >= monthRange.startMs && ms < monthRange.endMs) countMonth++;
    }
  }

  const counts: DateScopeCounts = {
    all: totalOrders,
    today: countToday,
    '7d': count7d,
    month: countMonth,
  };

  const targetRange = getScopeRange(scope, analysis);

  if (scope === 'all') {
    return {
      scope: 'all',
      filteredOrders: orders,
      totalOrders,
      matchedOrders: totalOrders,
      label: allRange.label,
      subLabel: allRange.subLabel,
      startMs: allRange.startMs,
      endMs: allRange.endMs,
      counts,
      isFiltered: false,
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
    filteredOrders,
    totalOrders,
    matchedOrders: filteredOrders.length,
    label: targetRange.label,
    subLabel: targetRange.subLabel,
    startMs: targetRange.startMs,
    endMs: targetRange.endMs,
    counts,
    isFiltered: true,
  };
}
