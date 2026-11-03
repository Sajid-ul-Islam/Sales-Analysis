import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';
import { RawOrderRow } from '../src/types';
import { filterOrdersByDateScope, DateScope } from '../src/lib/dateFilter';

// 1. Load September
const septPath = path.join(process.cwd(), 'legacy', 'baseline_september_backup', 'Reconciled_Net_Sales_Report.xlsx');
const wbSept = XLSX.readFile(septPath);
const septReconciled = XLSX.utils.sheet_to_json(wbSept.Sheets['Reconciled Orders']) as any[];

const septOrderRows: RawOrderRow[] = septReconciled.map((r) => {
  const oId = String(r['Order ID']);
  const serialDate = Number(r['Order Date']);
  const jsDate = new Date(Math.round((serialDate - 25569) * 86400 * 1000));
  const isoDate = !isNaN(jsDate.getTime()) ? jsDate.toISOString() : '2026-09-15T12:00:00';
  const delivStatus = String(r['Delivery Status'] || '');
  const isDelivered = delivStatus.toLowerCase().includes('delivered');
  const isPaidReturn = delivStatus.toLowerCase().includes('paid return');
  const isReturned = delivStatus.toLowerCase().includes('return') || isPaidReturn;
  const isPartial = delivStatus.toLowerCase().includes('partial');

  return {
    'Order ID': oId,
    orderId: oId,
    orderNumber: oId,
    'Order Date': isoDate,
    orderDate: isoDate,
    'Date Modified': isoDate,
    dateModified: isoDate,
    'Date Completed': isDelivered ? isoDate : '',
    dateCompleted: isDelivered ? isoDate : '',
    date_completed: isDelivered ? isoDate : '',
    Substatus: isPaidReturn ? 'Paid Return' : isReturned ? 'Return' : isPartial ? 'Partial' : isDelivered ? 'Delivered' : '',
    substatus: isPaidReturn ? 'Paid Return' : isReturned ? 'Return' : isPartial ? 'Partial' : isDelivered ? 'Delivered' : '',
    isExchange: delivStatus.toLowerCase().includes('exchange'),
    'Customer Name': r['Customer Name'] || 'Customer',
    customerName: r['Customer Name'] || 'Customer',
    rawCustomerName: r['Customer Name'] || 'Customer',
    Phone: r['Phone'] || '',
    phone: r['Phone'] || '',
    rawPhone: r['Phone'] || '',
    formattedPhone: `880${String(r['Phone'] || '').replace(/^0+/, '')}`,
    Email: '',
    email: '',
    Address: '',
    address: '',
    City: r['City / District'] || '',
    city: r['City / District'] || '',
    State: '',
    state: '',
    districtArea: r['District Area'] || 'Outside Dhaka',
    'District Area': r['District Area'] || 'Outside Dhaka',
    LocationType: r['District Area'] || 'Outside Dhaka',
    SKU: r['SKU'] || 'GENERAL',
    sku: r['SKU'] || 'GENERAL',
    'Item Name': r['Item Name'] || 'Apparel Item',
    itemName: r['Item Name'] || 'Apparel Item',
    Size: '',
    size: '',
    Color: '',
    color: '',
    Category: '',
    category: '',
    Subcategory: '',
    subCategory: '',
    'Apparel Line': 'DEEN Regular',
    isSelects: false,
    Quantity: Number(r['Quantity'] || 1),
    quantity: Number(r['Quantity'] || 1),
    'Item Cost': Number(r['Item Cost'] || 0),
    itemCost: Number(r['Item Cost'] || 0),
    'Order Amount': Number(r['Order Total Amount'] || 0),
    orderAmount: Number(r['Order Total Amount'] || 0),
    'Payment Method': 'Cash on delivery',
    paymentMethod: 'Cash on delivery',
    isPrepaid: false,
    isCod: true,
    'Order Notes': '',
    orderNotes: '',
    'Delivery Status': isDelivered ? 'completed' : isReturned ? 'cancelled' : 'completed',
    status: isDelivered ? 'completed' : isReturned ? 'cancelled' : 'completed',
    'Order Source': 'Online',
    'Outlet ID': '',
    outletId: '',
    fulfillmentBranch: 'Online Store (Central Warehouse)',
    branchCode: 'ONLINE',
    sipInventory: 'Central Warehouse',
    sip_inventory: 'Central Warehouse',
    sipOutletId: '1',
    sip_outlet_id: '1',
    sipOutletSlug: 'warehouse',
    inventorySource: 'Central Warehouse',
    'Created Via': 'checkout',
    created_via: 'checkout',
    createdVia: 'checkout',
    isNoCheckout: false,
    'Shipping Fee': 90,
    shippingFee: 90,
    'Discount Total': 0,
    'Coupon Codes': '',
    'Consignment ID': '',
    consignmentId: '',
    tracking_number: '',
    'Pathao Status': delivStatus,
    pathaoStatus: delivStatus,
    'Pathao Delivery Fee': 0,
    pathaoDeliveryFee: 0,
    'Pathao Collected Amount': 0,
    pathaoCollectedAmount: 0,
    wpDeliveryStatus: isDelivered ? 'Delivered' : isPaidReturn ? 'Paid Return' : isReturned ? 'Not Paid Return' : 'Delivered',
    wpMarkSource: 'reconciliation_sheet',
    wpMarkReason: 'Reconciled September dataset',
    isReturnFromWp: isReturned,
    isPartialFromWp: isPartial,
    isExchangeFromWp: false,
    isPaidReturnFromWp: isPaidReturn,
    isPos: false,
    isBranchFulfillment: false,
  };
});

// 2. Load October
const octRaw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'october2026_raw_orders.json'), 'utf8'));
const octOrderRows = formatWooCommerceToOrderRows(octRaw);

// 3. Load November
const novRaw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'november2026_raw_orders.json'), 'utf8'));
const novOrderRows = formatWooCommerceToOrderRows(novRaw);

console.log(`September Rows: ${septOrderRows.length}`);
console.log(`October Rows:   ${octOrderRows.length}`);
console.log(`November Rows:  ${novOrderRows.length}`);

const combinedOrders = [...septOrderRows, ...octOrderRows, ...novOrderRows];
console.log(`Total Combined Multi-Month Rows: ${combinedOrders.length}`);

// Test date filter
const filterRes = filterOrdersByDateScope(combinedOrders, 'all');
console.log(`Detected available months:`, filterRes.availableMonths.map((m) => `${m.label} (${m.orderCount} rows, isCurrent: ${m.isCurrentMonth})`));

