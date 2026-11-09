import { ReconciledOrderRow, RawOrderRow } from '@/types';

export interface MonthlyStatementSummary {
  id: string; // e.g. 'month-2026-10'
  monthKey: string; // '2026-10'
  label: string; // 'October 2026'
  shortLabel: string; // 'Oct 2026'
  year: number;
  monthIndex: number; // 0-11
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  isCurrentMonth: boolean;
  status: 'CLOSED' | 'ONGOING_LIVE';
  orderCount: number;
  unitCount: number;
  grossRevenue: number;
  deliveredRevenue: number;
  returnedRevenue: number;
  deliveredUnits: number;
  returnedUnits: number;
  exchangedUnits: number;
  paidReturnUnits: number;
  nonPaidReturnUnits: number;
  deliveryRate: number; // %
  returnRate: number; // %
  exchangeRate: number; // %
  netCodSettlement: number;
  phantomDiscrepancyCount: number;
  phantomDiscrepancyRevenue: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Extracts YYYY-MM from an order date string or serial number.
 */
export function extractOrderMonthKey(dateVal: unknown): string | null {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // ISO format: 2026-10-15...
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

    // DMY format: DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^\d{1,2}[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const mm = dmyMatch[1].padStart(2, '0');
      return `${dmyMatch[2]}-${mm}`;
    }

    // Try Date parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  } else if (typeof dateVal === 'number') {
    // Excel serial: evaluate in UTC to prevent timezone rollover
    if (dateVal > 20000 && dateVal < 70000) {
      const parsed = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  }
  return null;
}

/**
 * Computes authoritative monthly statement summaries across all given orders.
 */
export function computeMonthlyStatementSummaries(
  orders: (ReconciledOrderRow | RawOrderRow)[]
): MonthlyStatementSummary[] {
  if (!orders || orders.length === 0) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;

  const groups = new Map<string, {
    year: number;
    monthIndex: number;
    orders: (ReconciledOrderRow | RawOrderRow)[];
    orderIds: Set<string>;
  }>();

  for (const order of orders) {
    const ordObj = order as Record<string, unknown>;
    const rawDate = (ordObj['Order Date'] as string) || (ordObj.orderDate as string) || (ordObj.dateCreated as string) || '';
    const mKey = extractOrderMonthKey(rawDate);
    if (!mKey) continue;

    const [yStr, mStr] = mKey.split('-');
    const year = parseInt(yStr, 10);
    const monthIndex = parseInt(mStr, 10) - 1;

    if (!groups.has(mKey)) {
      groups.set(mKey, {
        year,
        monthIndex,
        orders: [],
        orderIds: new Set<string>(),
      });
    }

    const grp = groups.get(mKey)!;
    grp.orders.push(order);
    const oId = String(ordObj['Order ID'] || ordObj.orderId || '');
    if (oId) grp.orderIds.add(oId);
  }

  const summaries: MonthlyStatementSummary[] = [];

  groups.forEach((grp, mKey) => {
    const { year, monthIndex, orders: mOrders, orderIds } = grp;
    const isCurrent = mKey === currentMonthKey;
    const status = isCurrent ? 'ONGOING_LIVE' : 'CLOSED';

    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    let unitCount = 0;
    let grossRevenue = 0;
    let deliveredRevenue = 0;
    let returnedRevenue = 0;
    let deliveredUnits = 0;
    let returnedUnits = 0;
    let exchangedUnits = 0;
    let paidReturnUnits = 0;
    let nonPaidReturnUnits = 0;
    let netCodSettlement = 0;
    let phantomDiscrepancyCount = 0;
    let phantomDiscrepancyRevenue = 0;

    for (const r of mOrders) {
      const row = r as Record<string, unknown>;
      const qty = Number(row.Quantity || row.quantity || 1);
      const cost = Number(row['Item Cost'] || row.itemCost || 0);
      const val = qty * cost;

      unitCount += qty;
      grossRevenue += val;

      const delivStatus = String(row.orderDeliveryStatus || row.wpDeliveryStatus || row['Delivery Status'] || row.status || '').toLowerCase();
      const pathaoStatus = String(row['Pathao Status'] || row.pathaoStatus || row['Courier Delivery Status'] || '').toLowerCase();
      const substatus = String(row.Substatus || row.substatus || '').toLowerCase();
      const isExch = Boolean(row.isExchange || delivStatus.includes('exchange') || pathaoStatus.includes('exchange') || substatus.includes('exchange'));

      const isDelivered = delivStatus.includes('deliver') || pathaoStatus.includes('deliver');
      const isPaidReturn = delivStatus.includes('paid return') || pathaoStatus.includes('paid return') || substatus.includes('paid return');
      const isReturned = isPaidReturn || delivStatus.includes('return') || pathaoStatus.includes('return') || substatus.includes('return');

      if (isExch) {
        exchangedUnits += qty;
      } else if (isReturned) {
        returnedUnits += qty;
        returnedRevenue += val;
        if (isPaidReturn) paidReturnUnits += qty;
        else nonPaidReturnUnits += qty;

        // Check phantom discrepancy (store completed but courier returned)
        if (delivStatus === 'completed' || delivStatus === 'shipped') {
          phantomDiscrepancyCount++;
          phantomDiscrepancyRevenue += val;
        }
      } else if (isDelivered) {
        deliveredUnits += qty;
        deliveredRevenue += val;
      }
    }

    const deliveryRate = unitCount > 0 ? (deliveredUnits / unitCount) * 100 : 0;
    const returnRate = unitCount > 0 ? (returnedUnits / unitCount) * 100 : 0;
    const exchangeRate = unitCount > 0 ? (exchangedUnits / unitCount) * 100 : 0;
    netCodSettlement = deliveredRevenue - (returnedUnits * 100); // estimated net courier settlement

    summaries.push({
      id: `month-${mKey}`,
      monthKey: mKey,
      label: `${MONTH_NAMES[monthIndex]} ${year}`,
      shortLabel: `${MONTH_SHORT_NAMES[monthIndex]} ${year}`,
      year,
      monthIndex,
      startDate,
      endDate,
      isCurrentMonth: isCurrent,
      status,
      orderCount: orderIds.size || mOrders.length,
      unitCount,
      grossRevenue: Math.round(grossRevenue),
      deliveredRevenue: Math.round(deliveredRevenue),
      returnedRevenue: Math.round(returnedRevenue),
      deliveredUnits,
      returnedUnits,
      exchangedUnits,
      paidReturnUnits,
      nonPaidReturnUnits,
      deliveryRate: Number(deliveryRate.toFixed(1)),
      returnRate: Number(returnRate.toFixed(1)),
      exchangeRate: Number(exchangeRate.toFixed(1)),
      netCodSettlement: Math.round(netCodSettlement),
      phantomDiscrepancyCount,
      phantomDiscrepancyRevenue: Math.round(phantomDiscrepancyRevenue),
    });
  });

  // Sort chronologically descending (newest month first)
  return summaries.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
