import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows, cleanCustomerPhone } from '../src/lib/woocommerceClient';

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
  outletId: string;
  isCheckout: boolean;
  isPos: boolean;
  isExchange: boolean;
  itemsSummary: string;
}

// Outlet ID → Branch name
const OUTLET_NAMES: Record<string, string> = {
  '2': 'Mirpur Outlet',
  '7': 'Cumilla Branch',
  '8': 'Wari Branch',
  '9': 'Sylhet Branch',
};

// POS cashier user IDs
const POS_CASHIER_IDS = new Set(['3', '35', '69', '572']);

function getOutletName(outletId: string): string {
  return OUTLET_NAMES[outletId] || 'Central Warehouse';
}

async function main() {
  console.log('====================================================');
  console.log('🚀 NOVEMBER 2026 WOOCOMMERCE ORDERS → EXCEL EXPORT');
  console.log('Source: src/data/november2026_raw_orders.json');
  console.log('Output: Sample Docs/Nov/November 2026 Checkout Orders List.xlsx');
  console.log('====================================================\n');

  // ── Step 1: Load November raw data (already fetched) ──────────────────────
  const rawJsonPath = path.join(process.cwd(), 'src', 'data', 'november2026_raw_orders.json');
  if (!fs.existsSync(rawJsonPath)) {
    console.error('❌ Raw November orders JSON not found at:', rawJsonPath);
    console.error('   Please run the fetch script first.');
    process.exit(1);
  }

  const rawOrders: any[] = JSON.parse(fs.readFileSync(rawJsonPath, 'utf8'));
  console.log(`⚡ Loaded ${rawOrders.length} November 2026 orders from cache.`);

  // ── Step 2: Transform to line items ───────────────────────────────────────
  const formattedRows = formatWooCommerceToOrderRows(rawOrders);
  console.log(`📋 Transformed into ${formattedRows.length} line item records.`);

  // ── Step 3: Build order-level summaries ───────────────────────────────────
  const orderSummaries: OrderSummary[] = [];
  const createdViaCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const checkoutStatusCounts: Record<string, number> = {};
  const outletSalesCounts: Record<string, number> = {};

  let totalCheckoutOrders = 0;
  let totalCheckoutGrossRevenue = 0;
  let totalPosOrders = 0;
  let totalExchangeOrders = 0;

  for (const o of rawOrders) {
    const rawCreatedVia = String(o.created_via || '').toLowerCase();
    const status = String(o.status || 'unknown').toLowerCase();

    // Classify channel
    const isExchange = rawCreatedVia === 'sip_exchange' ||
      rawCreatedVia === 'admin' || rawCreatedVia === 'manual' || rawCreatedVia === 'no-checkout' ||
      (typeof o.number === 'string' && /^D-|^DD-/i.test(o.number));

    // POS: empty created_via with _sip_outlet_id meta, or explicit 'pos'
    let outletId = '';
    let consignmentId = '';
    let courierStatus = '';
    let trackingNumber = '';

    if (Array.isArray(o.meta_data)) {
      for (const m of o.meta_data) {
        if (m.key === '_sip_outlet_id' || m.key === 'sip_outlet_id') outletId = String(m.value || '');
        if (m.key === 'ptc_consignment_id' || m.key === '_ptc_consignment_id') consignmentId = String(m.value || '');
        if (m.key === 'ptc_status' || m.key === '_ptc_status') courierStatus = String(m.value || '');
        if (m.key === 'tracking_number') trackingNumber = String(m.value || '');
      }
    }

    const isPos = rawCreatedVia === 'pos' ||
      (outletId !== '' && outletId !== '1') ||
      (rawCreatedVia === '' && Boolean(o.meta_data?.some((m: any) => m.key === '_sip_outlet_id')));

    const isCheckout = !isPos && !isExchange && (
      rawCreatedVia === 'checkout' || rawCreatedVia === 'store-api' || rawCreatedVia === ''
    );

    // Count
    const displayVia = rawCreatedVia || (isPos ? 'pos' : 'checkout');
    createdViaCounts[displayVia] = (createdViaCounts[displayVia] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (isCheckout) {
      totalCheckoutOrders++;
      totalCheckoutGrossRevenue += parseFloat(o.total || '0');
      checkoutStatusCounts[status] = (checkoutStatusCounts[status] || 0) + 1;
    } else if (isPos) {
      totalPosOrders++;
      const branchName = getOutletName(outletId);
      outletSalesCounts[branchName] = (outletSalesCounts[branchName] || 0) + 1;
    } else if (isExchange) {
      totalExchangeOrders++;
    }

    // Line items
    const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
    const totalQty = lineItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0);
    const itemNames = lineItems.map((it: any) => `${it.name || 'Product'} (x${it.quantity || 1})`).join(', ');

    const rawPhone = o.billing?.phone || o.shipping?.phone || '';
    const { displayPhone } = cleanCustomerPhone(rawPhone);

    const fulfillmentBranch = isPos ? getOutletName(outletId) : 'Central Warehouse';

    orderSummaries.push({
      id: o.id,
      orderNumber: String(o.number || o.id),
      dateCreated: o.date_created || '',
      status: o.status || '',
      createdVia: displayVia,
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
      outletId,
      isCheckout,
      isPos,
      isExchange,
      itemsSummary: itemNames,
    });
  }

  // ── Step 4: Console summary ───────────────────────────────────────────────
  console.log('\n📊 Order Classification:');
  console.log(`  Total November Orders : ${rawOrders.length}`);
  console.log(`  Checkout (Ecommerce)  : ${totalCheckoutOrders}`);
  console.log(`  POS (In-Store Retail) : ${totalPosOrders}`);
  console.log(`  Exchange Replacements : ${totalExchangeOrders}`);
  console.log(`  Total Checkout Value  : ৳${totalCheckoutGrossRevenue.toLocaleString()}`);
  console.log('\n  created_via breakdown:');
  console.table(createdViaCounts);
  console.log('\n  All Orders by Status:');
  console.table(statusCounts);
  console.log('\n  Checkout Orders by Status:');
  console.table(checkoutStatusCounts);
  console.log('\n  POS Outlet Breakdown:');
  console.table(outletSalesCounts);

  // ── Step 5: Build Excel sheets ────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // ── SHEET 1: Summary ──────────────────────────────────────────────────────
  const summaryData = [
    { 'Metric': 'Report Period', 'Value': 'November 2026 (2026-11-01 to present)' },
    { 'Metric': 'Total Orders', 'Value': rawOrders.length },
    { 'Metric': 'Ecommerce Checkout Orders', 'Value': totalCheckoutOrders },
    { 'Metric': 'POS In-Store Orders', 'Value': totalPosOrders },
    { 'Metric': 'Exchange/Replacement Orders', 'Value': totalExchangeOrders },
    { 'Metric': 'Total Checkout Gross Revenue (৳)', 'Value': totalCheckoutGrossRevenue },
    { 'Metric': '---STATUS BREAKDOWN---', 'Value': '' },
    ...Object.entries(checkoutStatusCounts).map(([st, cnt]) => ({
      'Metric': `Checkout - ${st.toUpperCase()}`,
      'Value': cnt,
    })),
    { 'Metric': '---OUTLET BREAKDOWN---', 'Value': '' },
    ...Object.entries(outletSalesCounts).map(([branch, cnt]) => ({
      'Metric': `POS - ${branch}`,
      'Value': cnt,
    })),
    { 'Metric': 'Generated At', 'Value': new Date().toISOString() },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── SHEET 2: November Checkout Orders ─────────────────────────────────────
  const checkoutOrders = orderSummaries.filter(o => o.isCheckout);
  const checkoutOrderRows = checkoutOrders.map(o => ({
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
  const wsCheckout = XLSX.utils.json_to_sheet(checkoutOrderRows);
  XLSX.utils.book_append_sheet(wb, wsCheckout, 'November Checkout Orders');

  // ── SHEET 3: Checkout Line Items ──────────────────────────────────────────
  // Filter formattedRows to checkout-only by matching order IDs
  const checkoutOrderIds = new Set(checkoutOrders.map(o => o.id));
  const checkoutLineItems = formattedRows.filter(r => checkoutOrderIds.has(Number(r.orderId || (r as any).id)));
  const wsLineItems = XLSX.utils.json_to_sheet(checkoutLineItems.length > 0 ? checkoutLineItems : formattedRows);
  XLSX.utils.book_append_sheet(wb, wsLineItems, 'Checkout Line Items');

  // ── SHEET 4: All November Orders ──────────────────────────────────────────
  const allOrderRows = orderSummaries.map(o => ({
    'Order ID': o.id,
    'Order Number': o.orderNumber,
    'Order Date': o.dateCreated.slice(0, 10),
    'Date & Time': o.dateCreated,
    'Channel': o.isCheckout ? 'Ecommerce Web Checkout' : o.isPos ? `POS Retail - ${o.fulfillmentBranch}` : 'Admin / Exchange',
    'Status': o.status,
    'Created Via': o.createdVia,
    'Customer Name': o.customerName,
    'Customer Phone': o.customerPhone,
    'City': o.shippingCity,
    'Payment Method': o.paymentMethodTitle || o.paymentMethod,
    'Total Units': o.totalQuantity,
    'Order Value (৳)': o.total,
    'Delivery Charge (৳)': o.shippingTotal,
    'Discount (৳)': o.discountTotal,
    'Outlet Branch': o.fulfillmentBranch,
    'Consignment ID': o.consignmentId,
    'Courier Status': o.courierStatus,
    'Purchased Items': o.itemsSummary,
  }));
  const wsAll = XLSX.utils.json_to_sheet(allOrderRows);
  XLSX.utils.book_append_sheet(wb, wsAll, 'All November Orders');

  // ── SHEET 5: Delivery Status Summary ─────────────────────────────────────
  const deliveryStatusRows = Object.entries(checkoutStatusCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([st, count]) => ({
      'Order Status': st.toUpperCase(),
      'Checkout Orders': count,
      'Percentage of Total': `${((count / totalCheckoutOrders) * 100).toFixed(1)}%`,
      'Est. Revenue (৳)': checkoutOrders
        .filter(o => o.status.toLowerCase() === st)
        .reduce((acc, o) => acc + o.total, 0)
        .toLocaleString(),
    }));
  const wsDelivery = XLSX.utils.json_to_sheet(deliveryStatusRows);
  XLSX.utils.book_append_sheet(wb, wsDelivery, 'Delivery Status Summary');

  // ── SHEET 6: POS Outlet Sales ─────────────────────────────────────────────
  const posOrders = orderSummaries.filter(o => o.isPos);
  const posRows = posOrders.map(o => ({
    'Order ID': o.id,
    'Order Number': o.orderNumber,
    'Order Date': o.dateCreated.slice(0, 10),
    'Date & Time': o.dateCreated,
    'Outlet Branch': o.fulfillmentBranch,
    'Outlet ID': o.outletId,
    'Status': o.status,
    'Customer Name': o.customerName,
    'Customer Phone': o.customerPhone,
    'Payment Method': o.paymentMethodTitle || o.paymentMethod,
    'Total Units': o.totalQuantity,
    'Order Value (৳)': o.total,
    'Purchased Items': o.itemsSummary,
  }));
  const wsPos = XLSX.utils.json_to_sheet(posRows.length > 0 ? posRows : [{ 'Note': 'No POS orders found' }]);
  XLSX.utils.book_append_sheet(wb, wsPos, 'POS Outlet Sales');

  // ── SHEET 7: Exchange Orders ──────────────────────────────────────────────
  const exchangeOrders = orderSummaries.filter(o => o.isExchange);
  const exchangeRows = exchangeOrders.map(o => ({
    'Order ID': o.id,
    'Order Number': o.orderNumber,
    'Order Date': o.dateCreated.slice(0, 10),
    'Created Via': o.createdVia,
    'Status': o.status,
    'Customer Name': o.customerName,
    'Customer Phone': o.customerPhone,
    'City': o.shippingCity,
    'Total Units': o.totalQuantity,
    'Order Value (৳)': o.total,
    'Purchased Items': o.itemsSummary,
  }));
  const wsExchange = XLSX.utils.json_to_sheet(exchangeRows.length > 0 ? exchangeRows : [{ 'Note': 'No exchange orders found' }]);
  XLSX.utils.book_append_sheet(wb, wsExchange, 'Exchange Orders');

  // ── SHEET 8: Product Performance ──────────────────────────────────────────
  // Aggregate by product name from all checkout line items
  const productMap: Record<string, { qty: number; revenue: number; orders: Set<string> }> = {};
  for (const row of formattedRows) {
    const productName = String((row as any).productName || (row as any).product_name || (row as any).name || 'Unknown');
    const qty = Number((row as any).quantity || 1);
    const revenue = Number((row as any).lineTotal || (row as any).line_total || (row as any).total || 0);
    const orderId = String((row as any).orderId || (row as any).order_id || '');
    if (!productMap[productName]) productMap[productName] = { qty: 0, revenue: 0, orders: new Set() };
    productMap[productName].qty += qty;
    productMap[productName].revenue += revenue;
    if (orderId) productMap[productName].orders.add(orderId);
  }
  const productPerfRows = Object.entries(productMap)
    .map(([name, data]) => ({
      'Product Name': name,
      'Total Units Sold': data.qty,
      'Total Revenue (৳)': Math.round(data.revenue),
      'Unique Orders': data.orders.size,
    }))
    .sort((a, b) => b['Total Units Sold'] - a['Total Units Sold']);
  const wsProduct = XLSX.utils.json_to_sheet(productPerfRows.length > 0 ? productPerfRows : [{ 'Note': 'No data' }]);
  XLSX.utils.book_append_sheet(wb, wsProduct, 'Product Performance');

  // ── SHEET 9: SKU Performance ──────────────────────────────────────────────
  const skuMap: Record<string, { qty: number; revenue: number; orders: Set<string> }> = {};
  for (const row of formattedRows) {
    const sku = String((row as any).sku || (row as any).SKU || 'NO_SKU');
    const qty = Number((row as any).quantity || 1);
    const revenue = Number((row as any).lineTotal || (row as any).line_total || (row as any).total || 0);
    const orderId = String((row as any).orderId || (row as any).order_id || '');
    if (!skuMap[sku]) skuMap[sku] = { qty: 0, revenue: 0, orders: new Set() };
    skuMap[sku].qty += qty;
    skuMap[sku].revenue += revenue;
    if (orderId) skuMap[sku].orders.add(orderId);
  }
  const skuPerfRows = Object.entries(skuMap)
    .map(([sku, data]) => ({
      'SKU': sku,
      'Total Units Sold': data.qty,
      'Total Revenue (৳)': Math.round(data.revenue),
      'Unique Orders': data.orders.size,
    }))
    .sort((a, b) => b['Total Units Sold'] - a['Total Units Sold']);
  const wsSku = XLSX.utils.json_to_sheet(skuPerfRows.length > 0 ? skuPerfRows : [{ 'Note': 'No data' }]);
  XLSX.utils.book_append_sheet(wb, wsSku, 'SKU Performance');

  // ── SHEET 10: City / Location Performance ────────────────────────────────
  const cityMap: Record<string, { orders: number; revenue: number }> = {};
  for (const o of checkoutOrders) {
    const city = o.shippingCity || 'Unknown';
    if (!cityMap[city]) cityMap[city] = { orders: 0, revenue: 0 };
    cityMap[city].orders++;
    cityMap[city].revenue += o.total;
  }
  const cityRows = Object.entries(cityMap)
    .map(([city, data]) => ({
      'City': city,
      'Checkout Orders': data.orders,
      'Revenue (৳)': Math.round(data.revenue),
      'Avg Order Value (৳)': Math.round(data.revenue / data.orders),
    }))
    .sort((a, b) => b['Checkout Orders'] - a['Checkout Orders']);
  const wsCity = XLSX.utils.json_to_sheet(cityRows.length > 0 ? cityRows : [{ 'Note': 'No data' }]);
  XLSX.utils.book_append_sheet(wb, wsCity, 'City Performance');

  // ── Auto-fit columns ──────────────────────────────────────────────────────
  const AUTO_WIDTH = 20;
  [wsCheckout, wsLineItems, wsAll, wsDelivery, wsPos, wsExchange, wsProduct, wsSku, wsCity].forEach((ws) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const cols = [];
    for (let c = range.s.c; c <= range.e.c; c++) cols.push({ wch: AUTO_WIDTH });
    ws['!cols'] = cols;
  });

  // ── Write output ──────────────────────────────────────────────────────────
  const outDir = path.join(process.cwd(), 'Sample Docs', 'Nov');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const excelPath = path.join(outDir, 'November 2026 Checkout Orders List.xlsx');
  XLSX.writeFile(wb, excelPath);
  console.log(`\n✅ Excel workbook created: ${excelPath}`);
  console.log(`   Sheets (${wb.SheetNames.length}): ${wb.SheetNames.join(' · ')}`);
  console.log('\n🎉 Done! November 2026 order export complete.\n');
}

main().catch(console.error);
