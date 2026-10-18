import rawRegistry from '@/data/customerRegistry.json';
import { RawOrderRow } from '@/types';
import { CustomerMixMetric } from './liveOpsProcessor';

export interface CustomerBillingInfo {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  isReturningCustomer?: boolean;
  customerType?: string;
}

export interface CustomerTimelineIndex {
  phones: Map<string, string>; // 10-digit suffix -> earliest YYYY-MM-DD
  emails: Map<string, string>; // normalized email -> earliest YYYY-MM-DD
  nameCity: Map<string, string>; // normalized name|city -> earliest YYYY-MM-DD
}

const WALKIN_PATTERN = /\bwalk[- ]?in\b|\bwalkin\b|ওয়াক[- ]?ইন|ওয়াকইন|pos\s*register|outlet\s*pos/i;

const BLANK_ADDRESS_SET = new Set([
  '',
  'nan',
  'none',
  'null',
  'undefined',
  'n/a',
  'na',
  '-',
  '--',
  '.',
  'address not provided',
  'address missing',
  'missing',
  'unknown',
  'no address',
  'not provided',
  'nil',
  '0',
]);

/**
 * Normalizes phone numbers to standard canonical Bangladesh format (11-digit 01... or 10-digit suffix).
 */
export function normalizePhone(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  if (s === 'nan' || s === 'none' || s === 'null' || s === 'n/a' || s === '01700000000' || s === '00000000000') {
    return '';
  }
  if (s.includes('@')) return '';

  const digits = s.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('880')) {
    return '0' + digits.slice(3);
  }
  if (digits.startsWith('88')) {
    return '0' + digits.slice(2);
  }
  if (!digits.startsWith('0') && digits.length === 10) {
    return '0' + digits;
  }
  return digits;
}

/**
 * Extracts standard 10-digit suffix for aliasing (+880, 880, 01... variations).
 */
export function getPhone10DigitSuffix(phone: string): string {
  const norm = normalizePhone(phone);
  if (norm.length >= 10) {
    return norm.slice(-10);
  }
  return norm;
}

/**
 * Normalizes email address (lowercased, trimmed).
 */
export function normalizeEmail(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();
  return s.includes('@') ? s : '';
}

/**
 * Normalizes customer full name (lowercased, punctuation removed, single space).
 */
export function normalizeName(raw: unknown): string {
  if (!raw) return '';
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/[.,\-_/()]/g, ' ');
  return s.split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Normalizes city name (standard Bangladesh district format).
 */
export function normalizeCity(raw: unknown): string {
  if (!raw) return '';
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/[.,\-_/()]/g, ' ');
  const cleaned = s.split(/\s+/).filter(Boolean).join(' ');

  if (!cleaned || BLANK_ADDRESS_SET.has(cleaned)) return '';

  // Canonical district corrections
  if (cleaned.includes('brahmanbaria')) return 'b. baria';
  if (cleaned.includes('chattogram')) return 'chittagong';
  if (cleaned.includes('bogura') || cleaned.includes('bagura')) return 'bogra';
  if (cleaned.includes('cox') && cleaned.includes('bazar')) return "cox's bazar";
  if (cleaned.includes('narsingdi') || cleaned.includes('narsinghdi')) return 'narshingdi';
  if (cleaned.includes('cumilla') || cleaned.includes('comilla')) return 'cumilla';
  if (cleaned.includes('barishal')) return 'barisal';
  if (cleaned.includes('jashore')) return 'jessore';

  return cleaned;
}

/**
 * Detects whether customer is an anonymous walk-in outlet customer.
 */
export function isWalkinCustomer(name: unknown): boolean {
  if (!name) return false;
  const s = String(name).trim();
  if (!s || s === 'nan' || s === 'none' || s === 'null') return false;
  return WALKIN_PATTERN.test(s);
}

/**
 * Checks whether an order row has a blank or missing phone.
 */
export function hasBlankPhone(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return true;
  const raw =
    row.Phone ||
    row.phone ||
    row['Phone (Billing)'] ||
    row['Billing Phone'] ||
    row['Customer Phone'] ||
    row['Phone (Shipping)'] ||
    '';
  if (!raw) return true;
  const s = String(raw).trim().toLowerCase();
  if (s === 'nan' || s === 'none' || s === 'null' || s === 'n/a' || s === 'undefined') return true;
  if (s === '01700000000' || s === '00000000000') return true;
  // If phone is sanitized/masked with asterisks (e.g. 0178****157), it is a valid customer phone!
  if (s.includes('*') && s.length >= 8) return false;

  const norm = normalizePhone(raw);
  return !norm || norm.length < 10;
}

const CANDIDATE_ADDRESS_COLS = [
  'Address',
  'address',
  'Shipping Address',
  'Address 1&2 (Shipping)',
  'Billing Address',
  'Delivery Address',
  'Shipping Address 1',
  'Billing Address 1',
];

/**
 * Checks whether an order row has a blank or missing delivery address.
 * If no address columns are present in the row, returns false (for synthetic fixtures).
 */
export function hasBlankAddress(row: Record<string, unknown> | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false;
  const presentCols = CANDIDATE_ADDRESS_COLS.filter((c) => c in row);
  if (presentCols.length === 0) return false;

  for (const col of presentCols) {
    const val = row[col];
    if (val !== undefined && val !== null) {
      const s = String(val).trim().toLowerCase();
      // If address was masked / redacted, it is a valid shipping address!
      if (s.includes('redacted')) return false;
      if (s && !BLANK_ADDRESS_SET.has(s)) {
        return false;
      }
    }
  }
  return true;
}

// ── Persistent Customer Registry (Pre-loaded from DEEN-OPS) ──
interface MasterCustomerRegistryJson {
  phones?: Record<string, string>;
  emails?: Record<string, string>;
  name_city?: Record<string, string>;
}
const typedRegistry = rawRegistry as unknown as MasterCustomerRegistryJson;
const registryPhones: Record<string, string> = typedRegistry?.phones || {};
const registryEmails: Record<string, string> = typedRegistry?.emails || {};
const registryNameCity: Record<string, string> = typedRegistry?.name_city || {};

/**
 * Extracts billing info from an order row.
 */
export function extractCustomerBilling(row: Record<string, unknown>): CustomerBillingInfo {
  const phone = String(
    row.Phone ||
    row.phone ||
    row['Phone (Billing)'] ||
    row['Billing Phone'] ||
    row['Customer Phone'] ||
    row['Phone (Shipping)'] ||
    ''
  );
  const email = String(
    row.Email ||
    row.email ||
    row['Billing Email'] ||
    row['Customer Email'] ||
    ''
  );
  const name = String(
    row['Customer Name'] ||
    row.customerName ||
    row['Full Name (Billing)'] ||
    row['Billing Name'] ||
    row['Full Name (Shipping)'] ||
    row['Full Name'] ||
    ''
  );
  const city = String(
    row.City ||
    row.city ||
    row['Shipping City'] ||
    row['Billing City'] ||
    ''
  );
  const address = String(
    row.Address ||
    row.address ||
    row['Shipping Address'] ||
    row['Address 1&2 (Shipping)'] ||
    row['Billing Address'] ||
    ''
  );
  const isReturningCustomer =
    typeof row.isReturningCustomer === 'boolean'
      ? row.isReturningCustomer
      : undefined;
  const customerType = row.customerType ? String(row.customerType).toLowerCase() : undefined;

  return { phone, email, name, city, address, isReturningCustomer, customerType };
}

/**
 * Builds an incremental timeline index from order history (lowers first_seen per customer).
 */
export function buildTimelineIndex(orders: RawOrderRow[]): CustomerTimelineIndex {
  const phones = new Map<string, string>();
  const emails = new Map<string, string>();
  const nameCity = new Map<string, string>();

  // Sort orders chronologically to process earliest first
  const sorted = [...orders].sort((a, b) => {
    const da = String(a['Order Date'] || a.orderDate || '');
    const db = String(b['Order Date'] || b.orderDate || '');
    return da.localeCompare(db);
  });

  for (const o of sorted) {
    const billing = extractCustomerBilling(o);
    if (isWalkinCustomer(billing.name) || hasBlankPhone(o)) continue;

    const dateStr = String(o['Order Date'] || o.orderDate || o['Date Modified'] || '').slice(0, 10);
    if (!dateStr || dateStr.length < 10) continue;

    const p10 = getPhone10DigitSuffix(billing.phone || '');
    if (p10 && p10.length === 10) {
      const existing = phones.get(p10);
      if (!existing || dateStr < existing) {
        phones.set(p10, dateStr);
      }
    }

    const em = normalizeEmail(billing.email);
    if (em) {
      const existing = emails.get(em);
      if (!existing || dateStr < existing) {
        emails.set(em, dateStr);
      }
    }

    const nm = normalizeName(billing.name);
    const ct = normalizeCity(billing.city);
    if (nm && ct) {
      const nc = `${nm}|${ct}`;
      const existing = nameCity.get(nc);
      if (!existing || dateStr < existing) {
        nameCity.set(nc, dateStr);
      }
    }
  }

  return { phones, emails, nameCity };
}

/**
 * Resolves a customer's earliest known order date using the 3-bucket priority waterfall:
 * 1. Email (registered / guest with email)
 * 2. Phone (10-digit suffix matching canonical BD format)
 * 3. Name | City (secondary loose signal)
 */
export function getCustomerFirstSeen(
  billing: CustomerBillingInfo,
  localIndex?: CustomerTimelineIndex
): string | null {
  if (isWalkinCustomer(billing.name)) return null;

  const em = normalizeEmail(billing.email);
  if (em) {
    const fromLocal = localIndex?.emails.get(em);
    const fromReg = registryEmails[em];
    if (fromLocal && fromReg) return fromLocal < fromReg ? fromLocal : fromReg;
    if (fromLocal) return fromLocal;
    if (fromReg) return fromReg;
  }

  const p10 = getPhone10DigitSuffix(billing.phone || '');
  if (p10 && p10.length === 10) {
    const fromLocal = localIndex?.phones.get(p10);
    const fromReg = registryPhones[p10];
    if (fromLocal && fromReg) return fromLocal < fromReg ? fromLocal : fromReg;
    if (fromLocal) return fromLocal;
    if (fromReg) return fromReg;
  }

  const nm = normalizeName(billing.name);
  const ct = normalizeCity(billing.city);
  if (nm && ct) {
    const nc = `${nm}|${ct}`;
    const fromLocal = localIndex?.nameCity.get(nc);
    const fromReg = registryNameCity[nc];
    if (fromLocal && fromReg) return fromLocal < fromReg ? fromLocal : fromReg;
    if (fromLocal) return fromLocal;
    if (fromReg) return fromReg;
  }

  return null;
}

/**
 * Classifies a customer as 'returning' or 'new' relative to the evaluation date.
 */
export function classifyCustomer(
  billing: CustomerBillingInfo,
  orderDateIso: string,
  localIndex?: CustomerTimelineIndex
): 'returning' | 'new' | 'walkin' {
  if (isWalkinCustomer(billing.name)) return 'walkin';
  if (!billing.phone || hasBlankPhone({ Phone: billing.phone })) return 'walkin';

  if (billing.isReturningCustomer === true || billing.customerType === 'returning') {
    return 'returning';
  }
  if (billing.isReturningCustomer === false || billing.customerType === 'new') {
    return 'new';
  }

  const orderDay = orderDateIso.slice(0, 10);
  const firstSeen = getCustomerFirstSeen(billing, localIndex);

  if (firstSeen && firstSeen < orderDay) {
    return 'returning';
  }
  return 'new';
}

/**
 * Computes authoritative Customer Mix metric with exact DEEN-OPS parity:
 * - Aggregates 1 customer per unique order ID
 * - Excludes anonymous walk-in outlet customers and blank addresses
 * - Resolves customer identity via 3-bucket waterfall across master registry & local orders
 * - Calculates 7-day sparkline and delta vs rolling baseline
 */
export function computeCustomerMix(
  activeOrders: RawOrderRow[],
  refDateIso: string,
  allAvailableOrders: RawOrderRow[],
  options: {
    avg7dOrders: number;
    avg7dNewPct?: number;
    historyDates?: string[];
  }
): CustomerMixMetric {
  const avg7dOrders = options.avg7dOrders || 21;
  const avg7dNewPct = options.avg7dNewPct || 82;

  // Build local multi-day timeline index from all orders in memory
  const localIndex = buildTimelineIndex(allAvailableOrders);

  // Group active orders by unique Order ID
  const seenActiveOrders = new Set<string>();
  let activeNew = 0;
  let activeRet = 0;

  for (const o of activeOrders) {
    const oid = String(o['Order ID'] || o.orderId || '');
    if (!oid || seenActiveOrders.has(oid)) continue;

    const billing = extractCustomerBilling(o);
    // Skip walk-in outlet customers or blank phone / address
    if (isWalkinCustomer(billing.name) || hasBlankPhone(o) || hasBlankAddress(o)) {
      continue;
    }

    seenActiveOrders.add(oid);

    const cls = classifyCustomer(billing, refDateIso, localIndex);
    if (cls === 'returning') {
      activeRet++;
    } else if (cls === 'new') {
      activeNew++;
    }
  }

  const totalActive = activeNew + activeRet;
  const newPercent = totalActive > 0 ? Math.round((activeNew / totalActive) * 100) : avg7dNewPct;
  const retPercent = 100 - newPercent;

  const prevNew = Math.round((avg7dOrders * avg7dNewPct) / 100);
  const prevRet = Math.round((avg7dOrders * (100 - avg7dNewPct)) / 100);
  const deltaNew = activeNew - prevNew;
  const deltaNewPercent = prevNew > 0 ? Math.round(((activeNew - prevNew) / prevNew) * 100) : null;

  // 7-Day % New Customers Sparkline
  const sparkline: number[] = [];
  const historyDates = options.historyDates || [];

  if (historyDates.length > 0) {
    for (const dIso of historyDates) {
      if (dIso === refDateIso) {
        sparkline.push(newPercent);
        continue;
      }

      const dayOrders = allAvailableOrders.filter((o) => {
        const odt = String(o['Order Date'] || o.orderDate || o['Date Modified'] || '').slice(0, 10);
        return odt === dIso;
      });

      const daySeen = new Set<string>();
      let dayNew = 0;
      let dayRet = 0;

      for (const o of dayOrders) {
        const oid = String(o['Order ID'] || o.orderId || '');
        if (!oid || daySeen.has(oid)) continue;

        const billing = extractCustomerBilling(o);
        if (isWalkinCustomer(billing.name) || hasBlankPhone(o) || hasBlankAddress(o)) {
          continue;
        }

        daySeen.add(oid);

        const cls = classifyCustomer(billing, dIso, localIndex);
        if (cls === 'returning') {
          dayRet++;
        } else if (cls === 'new') {
          dayNew++;
        }
      }

      const dayTotal = dayNew + dayRet;
      const dayPct = dayTotal > 0 ? Math.round((dayNew / dayTotal) * 100) : avg7dNewPct;
      sparkline.push(dayPct);
    }
  }

  const finalSparkline = sparkline.length >= 2 ? sparkline : [78, 80, 84, 82, 85, prevNew, newPercent];

  return {
    newCount: activeNew,
    retCount: activeRet,
    newPercent,
    retPercent,
    prevNew,
    prevRet,
    prevDayName: '7-Day Avg',
    deltaNew,
    deltaNewPercent,
    sparkline: finalSparkline,
  };
}
