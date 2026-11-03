import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { getSecretsConfig } from '../src/lib/secrets';
import { formatWooCommerceToOrderRows, cleanCustomerPhone } from '../src/lib/woocommerceClient';
import { RawOrderRow } from '../src/types';

interface OrderSummary {
  id: number;
  orderNumber: string;
  dateCreated: string;
  status: string;
  createdVia: string;
  paymentMethod: string;
  paymentMethodTitle: string;
  customerName: string;
  customerPhone: string;
  shippingCity: string;
  shippingAddress: string;
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  consignmentId: string;
  trackingNumber: string;
  courierStatus: string;
  fulfillmentBranch: string;
  isCheckout: boolean;
  isPos: boolean;
  itemsSummary: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const secrets = getSecretsConfig();
  const wc = secrets.woocommerce;
  console.log('====================================================');
  console.log('🚀 PROCESSING FULL OCTOBER 2026 WOOCOMMERCE ORDERS');
  console.log('Store URL:', wc.store_url);
  console.log('Date Window: 2026-10-01T00:00:00 to 2026-10-31T23:59:59');
  console.log('====================================================\n');

  const authHeader = 'Basic ' + Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');
  const rawJsonPath = path.join(process.cwd(), 'src', 'data', 'october2026_raw_orders.json');
  let rawOrders: any[] = [];

  if (fs.existsSync(rawJsonPath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(rawJsonPath, 'utf8'));
      if (Array.isArray(cached) && cached.length >= 1740) {
        console.log(`⚡ Loaded ${cached.length} verified October orders from ${rawJsonPath}`);
        rawOrders = cached;
      }
    } catch {
      rawOrders = [];
    }
  }

  if (rawOrders.length === 0) {
    const perPage = 100;
    let page = 1;
    let totalPages = 18;

    while (page <= totalPages) {
      const url = new URL(`${wc.store_url.replace(/\/+$/, '')}/wp-json/wc/v3/orders`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('after', '2026-10-01T00:00:00');
      url.searchParams.set('before', '2026-10-31T23:59:59');
      url.searchParams.set('status', 'any');
      url.searchParams.set('orderby', 'date');
      url.searchParams.set('order', 'asc');

      process.stdout.write(`Fetching Page ${page}... `);
      const start = performance.now();

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0',
        },
      });

      const elapsed = Math.round(performance.now() - start);

      if (!res.ok) {
        console.error(`\n❌ Error fetching page ${page}: HTTP ${res.status}`);
        const text = await res.text();
        console.error(text.slice(0, 300));
        break;
      }

      const headerTotalPages = res.headers.get('x-wp-totalpages');
      const headerTotalOrders = res.headers.get('x-wp-total');
      if (headerTotalPages) totalPages = parseInt(headerTotalPages, 10);

      const pageOrders = await res.json();
      if (!Array.isArray(pageOrders) || pageOrders.length === 0) {
        console.log(`0 orders returned. Ending pagination.`);
        break;
      }

      rawOrders.push(...pageOrders);
      console.log(`OK! Got ${pageOrders.length} orders in ${elapsed}ms (Cumulative: ${rawOrders.length} / ${headerTotalOrders || '?'})`);

      if (pageOrders.length < perPage || page >= totalPages) break;
      page++;
      await sleep(250);
    }

    fs.writeFileSync(rawJsonPath, JSON.stringify(rawOrders, null, 2), 'utf8');
    console.log(`\n💾 Saved raw JSON backup to: ${rawJsonPath}`);
  }

  // Transform into Flat Line Items using standard DEEN reconciliation schema
  const formattedRows = formatWooCommerceToOrderRows(rawOrders);
  console.log(`Transformed into ${formattedRows.length} item line records.`);

  // Build Detailed Order-Level Summaries
  const orderSummaries: OrderSummary[] = [];
  const createdViaCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const checkoutStatusCounts: Record<string, number> = {};

  let totalCheckoutOrders = 0;
  let totalCheckoutGrossRevenue = 0;
  let totalPosOrders = 0;
  let totalAdminOrders = 0;

  for (const o of rawOrders) {
    const createdVia = String(o.created_via || 'checkout').toLowerCase();
    const status = String(o.status || 'unknown').toLowerCase();
    createdViaCounts[createdVia] = (createdViaCounts[createdVia] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Check if this is a web checkout order
    const isCheckout = createdVia === 'checkout' || createdVia === 'store-api' || (!createdVia && !o.billing?.phone?.includes('pos'));
    const isPos = createdVia === 'pos' || Boolean(o.meta_data?.some((m: any) => m.key === '_sip_outlet_id' && m.value !== '1'));

    if (isCheckout) {
      totalCheckoutOrders++;
      totalCheckoutGrossRevenue += parseFloat(o.total || '0');
      checkoutStatusCounts[status] = (checkoutStatusCounts[status] || 0) + 1;
    } else if (createdVia === 'pos') {
      totalPosOrders++;
    } else {
      totalAdminOrders++;
    }

    // Extract Courier Tracking
    let consignmentId = '';
    let courierStatus = '';
    let trackingNumber = '';
    let fulfillmentBranch = 'Central Warehouse';

    if (Array.isArray(o.meta_data)) {
      for (const m of o.meta_data) {
        if (m.key === 'ptc_consignment_id' || m.key === '_ptc_consignment_id') consignmentId = String(m.value || '');
        if (m.key === 'ptc_status' || m.key === '_ptc_status') courierStatus = String(m.value || '');
        if (m.key === 'tracking_number') trackingNumber = String(m.value || '');
      }
    }

    // Extract Line Items
    const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
    const totalQty = lineItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0);
    const itemNames = lineItems.map((it: any) => `${it.name || 'Product'} (x${it.quantity || 1})`).join(', ');

    const rawPhone = o.billing?.phone || o.shipping?.phone || '';
    const { displayPhone } = cleanCustomerPhone(rawPhone);

    orderSummaries.push({
      id: o.id,
      orderNumber: String(o.number || o.id),
      dateCreated: o.date_created || '',
      status: o.status || '',
      createdVia: o.created_via || 'checkout',
      paymentMethod: o.payment_method || '',
      paymentMethodTitle: o.payment_method_title || '',
      customerName: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Customer',
      customerPhone: displayPhone,
      shippingCity: o.shipping?.city || o.billing?.city || '',
      shippingAddress: `${o.shipping?.address_1 || ''} ${o.shipping?.address_2 || ''}`.trim() || o.billing?.address_1 || '',
      itemCount: lineItems.length,
      totalQuantity: totalQty,
      subtotal: parseFloat(o.subtotal || o.total || '0'),
      shippingTotal: parseFloat(o.shipping_total || '0'),
      discountTotal: parseFloat(o.discount_total || '0'),
      total: parseFloat(o.total || '0'),
      consignmentId,
      trackingNumber,
      courierStatus,
      fulfillmentBranch,
      isCheckout,
      isPos,
      itemsSummary: itemNames,
    });
  }

  console.log('\n====================================================');
  console.log('📊 OCTOBER 2026 ORDER BREAKDOWN');
  console.log('====================================================');
  console.log(`Total Orders in October: ${rawOrders.length}`);
  console.log(`Total Checkout Orders (Web / Store-API): ${totalCheckoutOrders}`);
  console.log(`Total POS Orders (In-Store Retail): ${totalPosOrders}`);
  console.log(`Total Admin / Manual Exchange Orders: ${totalAdminOrders}`);
  console.log(`Total Checkout Gross Value: ৳${totalCheckoutGrossRevenue.toLocaleString()}`);
  console.log('\nBreakdown by created_via:');
  console.table(createdViaCounts);
  console.log('\nBreakdown of ALL Orders by Status:');
  console.table(statusCounts);
  console.log('\nBreakdown of CHECKOUT Orders by Status:');
  console.table(checkoutStatusCounts);

  // 1. Update baselineSample.json with the real October 2026 data
  const baselineDataset = {
    orders: formattedRows,
    returns: [],
    partials: [],
    exchanges: [],
    pathaoDelivery: [],
    updatedAt: new Date().toISOString(),
    sourceName: `⚡ Real WooCommerce October 2026 (${rawOrders.length} Orders · ${formattedRows.length} Items)`,
  };
  const baselinePath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
  fs.writeFileSync(baselinePath, JSON.stringify(baselineDataset, null, 2), 'utf8');
  console.log(`\n💾 Updated src/data/baselineSample.json with real October dataset!`);

  // 2. Generate Comprehensive Excel Workbook for User
  const checkoutOrdersOnly = orderSummaries.filter((o) => o.isCheckout);
  const checkoutOrderRows = checkoutOrdersOnly.map((o) => ({
    'Order ID': o.id,
    'Order Number': o.orderNumber,
    'Order Date': o.dateCreated.slice(0, 10),
    'Date & Time': o.dateCreated,
    'Status': o.status,
    'Created Via': o.createdVia,
    'Customer Name': o.customerName,
    'Customer Phone': o.customerPhone,
    'City': o.shippingCity,
    'Address': o.shippingAddress,
    'Payment Method': o.paymentMethodTitle || o.paymentMethod,
    'Unique Items': o.itemCount,
    'Total Units': o.totalQuantity,
    'Order Value (৳)': o.total,
    'Delivery Charge (৳)': o.shippingTotal,
    'Discount (৳)': o.discountTotal,
    'Consignment ID': o.consignmentId,
    'Courier Status': o.courierStatus,
    'Purchased Items': o.itemsSummary,
  }));

  const allOrdersRows = orderSummaries.map((o) => ({
    'Order ID': o.id,
    'Order Number': o.orderNumber,
    'Order Date': o.dateCreated.slice(0, 10),
    'Channel': o.isCheckout ? 'Ecommerce Web Checkout' : o.isPos ? 'POS Retail' : 'Admin Replacement',
    'Status': o.status,
    'Customer Name': o.customerName,
    'Customer Phone': o.customerPhone,
    'City': o.shippingCity,
    'Payment Method': o.paymentMethodTitle || o.paymentMethod,
    'Total Units': o.totalQuantity,
    'Order Value (৳)': o.total,
    'Consignment ID': o.consignmentId,
    'Courier Status': o.courierStatus,
    'Purchased Items': o.itemsSummary,
  }));

  // Create Excel Workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Checkout Orders Master List
  const wsCheckout = XLSX.utils.json_to_sheet(checkoutOrderRows);
  XLSX.utils.book_append_sheet(wb, wsCheckout, 'October Checkout Orders');

  // Sheet 2: Item-Wise Line Items (Checkout only)
  const checkoutLineItems = formattedRows.filter((r) => !r.isPos && (r.createdVia === 'checkout' || r.createdVia === 'store-api' || !r.createdVia));
  const wsItems = XLSX.utils.json_to_sheet(checkoutLineItems);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Checkout Line Items');

  // Sheet 3: All Orders Summary (Checkout + POS + Admin)
  const wsAll = XLSX.utils.json_to_sheet(allOrdersRows);
  XLSX.utils.book_append_sheet(wb, wsAll, 'All October Orders');

  // Sheet 4: Status Breakdown Summary
  const summarySheetRows = Object.entries(checkoutStatusCounts).map(([st, count]) => ({
    'Order Status': st.toUpperCase(),
    'Checkout Orders Count': count,
    'Percentage': `${((count / totalCheckoutOrders) * 100).toFixed(1)}%`,
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summarySheetRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Status Summary');

  // Auto-fit column widths
  [wsCheckout, wsItems, wsAll, wsSummary].forEach((ws) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const cols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cols.push({ wch: 18 });
    }
    ws['!cols'] = cols;
  });

  const excelOutDir = path.join(process.cwd(), 'Sample Docs');
  if (!fs.existsSync(excelOutDir)) fs.mkdirSync(excelOutDir, { recursive: true });

  const excelPath = path.join(excelOutDir, 'October 2026 Checkout Orders List.xlsx');
  XLSX.writeFile(wb, excelPath);
  console.log(`📗 Created Excel workbook: ${excelPath}`);

  // Also write a CSV export of the checkout orders for immediate use
  const csvPath = path.join(excelOutDir, 'October_2026_Checkout_Orders.csv');
  const csvContent = XLSX.utils.sheet_to_csv(wsCheckout);
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log(`📄 Created CSV export: ${csvPath}`);
}

main().catch(console.error);
