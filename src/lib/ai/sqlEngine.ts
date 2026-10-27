import alasql from 'alasql';
import { RawOrderRow, ReconciledOrderRow } from '@/types';
import { classifyProductCategory } from '@/lib/reconciliationEngine';
import { getCategoryForSales } from '@/lib/liveCategoryEngine';
import { classifyProductLine } from '@/lib/selectsAnalytics';

export interface SqlOrderRow {
  orderId: string;
  orderDate: string;
  customerName: string;
  phone: string;
  districtArea: string;
  fulfillmentLocation: string;
  sipInventory: string;
  paymentMethod: string;
  isPrepaid: number;
  isCod: number;
  deliveryStatus: string;
  orderDeliveryStatus: string;
  courierStatus: string;
  consignmentId: string;
  itemName: string;
  sku: string;
  category: string;
  collection: string;
  quantity: number;
  itemCost: number;
  totalPrice: number;
  orderAmount: number;
  returnedValue: number;
  isReturn: number;
  isPaidReturn: number;
  isPartial: number;
  isExchange: number;
  isPos: number;
  isOnline: number;
}

export interface SqlQueryResult {
  success: boolean;
  query: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

/**
 * Normalizes any dataset of raw or reconciled order rows into clean, strongly-typed SqlOrderRow records.
 */
export function normalizeRowsForSql(
  rows: (RawOrderRow | ReconciledOrderRow | Record<string, unknown>)[]
): SqlOrderRow[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((r) => {
    const raw = r as Record<string, unknown>;
    const orderId = String(raw['Order ID'] || raw.orderId || raw.id || '').trim();
    const itemName = String(raw['Item Name'] || raw.itemName || raw.name || '').trim();
    const sku = String(raw.SKU || raw.sku || '').trim();

    // Resolve date
    let orderDate = '';
    const rawDate = raw['Order Date'] || raw.orderDate || raw.date_created || raw.date;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      orderDate = rawDate.toISOString().split('T')[0];
    } else if (rawDate) {
      orderDate = String(rawDate).split('T')[0].slice(0, 10);
    }

    const customerName = String(
      raw['Customer Name'] || raw.customerName || (raw.billing as Record<string, unknown>)?.first_name || 'Customer'
    ).trim();

    const phone = String(raw.Phone || raw.phone || (raw.billing as Record<string, unknown>)?.phone || '').trim();

    const districtArea = String(raw['District/Area'] || raw.districtArea || raw.city || 'Outside Dhaka').trim();

    const fulfillmentLocation = String(
      raw['Fulfillment Location'] || raw.fulfillmentLocation || raw.store || 'Online Store (Central Warehouse)'
    ).trim();

    const sipInventory = String(
      raw.sipInventory || raw.sip_inventory || raw['SIP Inventory'] || fulfillmentLocation || 'Central Warehouse'
    ).trim();

    const paymentMethod = String(
      raw['Payment Method'] || raw.paymentMethod || raw.payment_method_title || 'Cash on Delivery'
    ).trim();

    const isPrepaid = /bkash|nagad|rocket|card|bank|ssl|prepaid|online/i.test(paymentMethod) ? 1 : 0;
    const isCod = isPrepaid ? 0 : 1;

    const deliveryStatus = String(raw['Delivery Status'] || raw.status || raw.orderDeliveryStatus || '').trim();
    const courierStatus = String(raw['Courier Status'] || raw.courierStatus || raw.pathaoStatus || 'Untracked').trim();
    const consignmentId = String(raw['Consignment ID'] || raw.consignmentId || raw.tracking_number || '').trim();

    const quantity = Math.max(1, parseInt(String(raw.Quantity || raw.quantity || 1), 10) || 1);
    const itemCost = parseFloat(String(raw['Item Cost'] || raw.itemCost || raw.price || 0)) || 0;
    const totalPrice = quantity * itemCost;
    const orderAmount = parseFloat(String(raw['Order Amount'] || raw.orderAmount || raw.total || totalPrice)) || totalPrice;

    const category = getCategoryForSales(itemName) || classifyProductCategory(itemName, sku);
    const collection = classifyProductLine(itemName, sku, category);

    // Return & classification flags
    const isReturn = /return|rto/i.test(deliveryStatus) || /return|rto/i.test(courierStatus) ? 1 : 0;
    const isPaidReturn = isReturn && (Boolean(raw.isPaidReturn) || /paid return/i.test(deliveryStatus)) ? 1 : 0;
    const isPartial = /partial/i.test(deliveryStatus) || /partial/i.test(courierStatus) ? 1 : 0;
    const isExchange = /exchange/i.test(deliveryStatus) || orderId.startsWith('D-') ? 1 : 0;
    const isPos = Boolean(raw.isPos) || /pos/i.test(fulfillmentLocation) ? 1 : 0;
    const isOnline = isPos ? 0 : 1;

    const returnedValue = parseFloat(String(raw.returnedValue || (isReturn ? totalPrice : 0))) || 0;

    return {
      orderId,
      orderDate,
      customerName,
      phone,
      districtArea,
      fulfillmentLocation,
      sipInventory,
      paymentMethod,
      isPrepaid,
      isCod,
      deliveryStatus,
      orderDeliveryStatus: String(raw.orderDeliveryStatus || deliveryStatus || (isReturn ? 'Returned' : 'Delivered')),
      courierStatus,
      consignmentId,
      itemName,
      sku,
      category,
      collection,
      quantity,
      itemCost,
      totalPrice,
      orderAmount,
      returnedValue,
      isReturn,
      isPaidReturn,
      isPartial,
      isExchange,
      isPos,
      isOnline,
    };
  });
}

/**
 * Validates that an incoming SQL query is strictly read-only and safe to execute.
 */
export function validateSqlSafety(sql: string): { isValid: boolean; reason?: string } {
  if (!sql || typeof sql !== 'string') {
    return { isValid: false, reason: 'Query string must not be empty.' };
  }

  const clean = sql.trim();

  // Must begin with SELECT or WITH (for CTEs)
  if (!/^(SELECT|WITH)\s+/i.test(clean)) {
    return { isValid: false, reason: 'Only read-only SELECT queries are permitted.' };
  }

  // Reject destructive SQL DDL/DML keywords
  const forbiddenPatterns = [
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|RENAME|REPLACE)\b/i,
    /\b(EXEC|EXECUTE|DECLARE|SET|GRANT|REVOKE)\b/i,
    /\bINTO\s+(OUTFILE|DUMPFILE)\b/i,
    /\bLOAD\s+DATA\b/i,
    /\b(ATTACH|DETACH|PRAGMA)\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(clean)) {
      return { isValid: false, reason: `Query contains forbidden statement or keyword: ${pattern.source}` };
    }
  }

  // Prevent multiple queries / statement chaining
  const semicolons = (clean.match(/;/g) || []).length;
  if (semicolons > 1 || (semicolons === 1 && !clean.endsWith(';'))) {
    return { isValid: false, reason: 'Multiple chained statements (;) are not permitted.' };
  }

  return { isValid: true };
}

/**
 * Enforces a reasonable LIMIT clause if none is supplied or if user queries too many rows.
 */
export function sanitizeSqlLimit(sql: string, maxRows = 50): string {
  let clean = sql.trim().replace(/;$/, '');
  const limitMatch = clean.match(/\bLIMIT\s+(\d+)\b/i);

  if (limitMatch && limitMatch[1]) {
    const existingLimit = parseInt(limitMatch[1], 10);
    if (existingLimit > maxRows) {
      clean = clean.replace(/\bLIMIT\s+\d+\b/i, `LIMIT ${maxRows}`);
    }
  } else {
    clean = `${clean} LIMIT ${maxRows}`;
  }

  return clean;
}

/**
 * Executes a safe, read-only SQL query over the loaded store orders dataset in memory.
 */
export function executeInMemorySql(
  sqlQuery: string,
  orders: (RawOrderRow | ReconciledOrderRow | Record<string, unknown>)[]
): SqlQueryResult {
  const startTime = Date.now();

  // 1. Safety validation
  const validation = validateSqlSafety(sqlQuery);
  if (!validation.isValid) {
    return {
      success: false,
      query: sqlQuery,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: validation.reason,
    };
  }

  try {
    const sanitizedQuery = sanitizeSqlLimit(sqlQuery, 50);
    const normalizedData = normalizeRowsForSql(orders);

    // Initialize AlaSQL in-memory database instance
    const db = new alasql.Database();
    db.exec('CREATE TABLE orders');
    (db.tables as Record<string, { data?: unknown[] }>).orders.data = normalizedData;

    // Execute query synchronously
    const rawResult = db.exec(sanitizedQuery);
    const executionTimeMs = Date.now() - startTime;

    if (!Array.isArray(rawResult)) {
      return {
        success: true,
        query: sanitizedQuery,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs,
      };
    }

    const rows = rawResult as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      success: true,
      query: sanitizedQuery,
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'SQL query execution failed.';
    return {
      success: false,
      query: sqlQuery,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}

/**
 * Formats a SqlQueryResult into a GitHub Flavored Markdown table.
 */
export function formatSqlResultToMarkdownTable(result: SqlQueryResult): string {
  if (!result.success) {
    return `❌ **SQL Query Error:** ${result.error || 'Execution failed'}\n\`\`\`sql\n${result.query}\n\`\`\``;
  }

  if (result.rows.length === 0) {
    return `🔍 *Query executed in ${result.executionTimeMs}ms with 0 matching rows.*`;
  }

  const cols = result.columns;
  const header = `| ${cols.join(' | ')} |`;
  const separator = `| ${cols.map(() => '---').join(' | ')} |`;
  const bodyRows = result.rows.map((r) => {
    return `| ${cols
      .map((c) => {
        const val = r[c];
        if (val === null || val === undefined) return '—';
        if (typeof val === 'number') {
          return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
        }
        return String(val);
      })
      .join(' | ')} |`;
  });

  return [header, separator, ...bodyRows].join('\n');
}

/**
 * Returns a human-readable schema specification of the `orders` table to guide the LLM.
 */
export function getOrdersTableSchemaDescription(): string {
  return `Table: orders (reconciled store order line items)
Columns:
- orderId (string): Unique order number (e.g. '18914')
- orderDate (string): YYYY-MM-DD dispatch or placement date
- customerName (string): Buyer full name
- phone (string): Buyer telephone number
- districtArea (string): 'Inside Dhaka' or 'Outside Dhaka'
- fulfillmentLocation (string): 'Online Store (Central Warehouse)', 'Mirpur Outlet POS', 'Cumilla Branch', etc.
- sipInventory (string): Smart inventory origin ('Central Warehouse', 'Mirpur Outlet', 'Cumilla Branch', 'Wari Branch', 'Sylhet Branch')
- paymentMethod (string): e.g. 'Cash on delivery', 'bKash', 'Nagad'
- isPrepaid (number): 1 if paid in advance online/bKash/card, 0 if COD
- isCod (number): 1 if Cash on Delivery, 0 if prepaid
- deliveryStatus (string): e.g. 'shipped', 'processing', 'completed', 'delivered'
- orderDeliveryStatus (string): 'Delivered', 'Paid Return', 'Not Paid Return', 'Partial', 'Exchange'
- courierStatus (string): Real-time Pathao courier status ('Delivered', 'In Transit', 'Returned', 'Untracked')
- consignmentId (string): Pathao tracking code (e.g. 'RD280926SCNU4X')
- itemName (string): Product title (e.g. 'Vintage Blue Slim Jeans')
- sku (string): Product inventory SKU (e.g. '101-SLIM-32')
- category (string): 'Jeans', 'Shirts', 'Panjabi', 'T-Shirt', 'Polo', 'Drop Shoulder', 'Accessories'
- collection (string): 'DEEN Selects' or 'DEEN Regular'
- quantity (number): Units ordered (integer)
- itemCost (number): Unit retail price in BDT (৳)
- totalPrice (number): Line-item price in BDT (quantity * itemCost)
- orderAmount (number): Total order invoice amount (৳)
- returnedValue (number): BDT loss value if returned (৳)
- isReturn (number): 1 if parcel returned to warehouse, 0 otherwise
- isPaidReturn (number): 1 if customer paid courier delivery fee on return, 0 otherwise
- isPartial (number): 1 if customer accepted some items and rejected others, 0 otherwise
- isExchange (number): 1 if order is a replacement/size exchange, 0 otherwise
- isPos (number): 1 if in-store physical walk-in retail sale, 0 if ecommerce
- isOnline (number): 1 if placed online via checkout, 0 if physical outlet`;
}

/**
 * Detects if the user query is a direct SQL statement.
 * Matches if trimmed query starts with SELECT or WITH.
 */
export function detectDirectSql(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();
  if (/^(SELECT|WITH|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|EXEC)\b/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Detects analytical intent from natural language merchant questions and generates a tailored SQL query.
 * Works 100% offline with zero latency and zero hallucination.
 */
export function detectAnalyticalSqlIntent(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  const q = query.toLowerCase().trim();

  // 1. Top returning items / SKUs
  if (/(top|most|highest|worst).*return/i.test(q) || /return.*(rate|loss|item|product|sku)/i.test(q)) {
    return 'SELECT sku, itemName, SUM(quantity) AS returnedUnits, SUM(returnedValue) AS totalReturnedLoss FROM orders WHERE isReturn = 1 GROUP BY sku, itemName ORDER BY totalReturnedLoss DESC LIMIT 5';
  }

  // 2. Top selling products / Best sellers
  if (/(top|best|highest|most).*(sell|sold|product|item|revenue)/i.test(q)) {
    return 'SELECT sku, itemName, category, SUM(quantity) AS unitsSold, SUM(totalPrice) AS totalRevenue FROM orders WHERE isReturn = 0 GROUP BY sku, itemName, category ORDER BY unitsSold DESC LIMIT 5';
  }

  // 3. Outlet / Branch dispatches or sales breakdown
  if (/(outlet|branch|sip|warehouse|mirpur|cumilla|wari|sylhet).*(sale|order|dispatch|volume)/i.test(q)) {
    return 'SELECT sipInventory, COUNT(*) AS dispatches, SUM(totalPrice) AS totalSales, SUM(isReturn) AS returns FROM orders GROUP BY sipInventory ORDER BY dispatches DESC';
  }

  // 4. District / Territory breakdown (Inside Dhaka vs Outside Dhaka)
  if (/(district|territory|dhaka|inside|outside).*(order|revenue|sale|breakdown|ratio)/i.test(q)) {
    return 'SELECT districtArea, COUNT(*) AS totalOrders, SUM(totalPrice) AS grossRevenue, SUM(isReturn) AS returnedOrders FROM orders GROUP BY districtArea';
  }

  // 5. Payment method breakdown (COD vs Prepaid / bKash)
  if (/(payment|cod|cash on delivery|bkash|nagad|prepaid)/i.test(q)) {
    return 'SELECT paymentMethod, COUNT(*) AS totalOrders, SUM(orderAmount) AS totalCollected FROM orders GROUP BY paymentMethod ORDER BY totalOrders DESC';
  }

  // 6. Courier delivery status / Pathao telemetry
  if (/(courier|pathao|transit|delivered.*vs|rto).*(status|rate|count|parcels)/i.test(q)) {
    return 'SELECT courierStatus, COUNT(*) AS totalParcels, SUM(orderAmount) AS totalAmount FROM orders GROUP BY courierStatus ORDER BY totalParcels DESC';
  }

  // 7. Category volume breakdown
  if (/(category|categories|jean|shirt|panjabi|polo).*(breakdown|sales|volume)/i.test(q)) {
    return 'SELECT category, SUM(quantity) AS unitsSold, SUM(totalPrice) AS totalRevenue FROM orders GROUP BY category ORDER BY unitsSold DESC';
  }

  return null;
}

