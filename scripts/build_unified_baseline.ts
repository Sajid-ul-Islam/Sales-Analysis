import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';
import { getCategoryForSales, getSubCategoryForSales } from '../src/lib/liveCategoryEngine';
import { RawOrderRow } from '../src/types';

async function main() {
  console.log('Building Unified Multi-Month Dataset (Sept + Oct + Nov)...');

  // 1. Process September Data
  const septPath = path.join(process.cwd(), 'legacy', 'baseline_september_backup', 'Reconciled_Net_Sales_Report.xlsx');
  console.log(`Reading September Reconciled Orders: ${septPath}`);
  const wbSept = XLSX.readFile(septPath);
  const septReconciled = XLSX.utils.sheet_to_json(wbSept.Sheets['Reconciled Orders']) as any[];

  const septRows: RawOrderRow[] = septReconciled.map((r) => {
    const oId = String(r['Order ID']);
    const serialDate = Number(r['Order Date']);
    const jsDate = new Date(Math.round((serialDate - 25569) * 86400 * 1000));
    const isoDate = !isNaN(jsDate.getTime()) ? jsDate.toISOString() : '2026-09-15T12:00:00';
    const delivStatus = String(r['Delivery Status'] || '');
    const isDelivered = delivStatus.toLowerCase().includes('delivered');
    const isPaidReturn = delivStatus.toLowerCase().includes('paid return');
    const isReturned = delivStatus.toLowerCase().includes('return') || isPaidReturn;
    const isPartial = delivStatus.toLowerCase().includes('partial');
    const prodName = String(r['Item Name'] || 'Apparel Item').trim();
    const cat = getCategoryForSales(prodName);
    const subCat = getSubCategoryForSales(prodName);

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
      'Item Name': prodName,
      itemName: prodName,
      Size: '',
      size: '',
      Color: '',
      color: '',
      Category: cat,
      category: cat,
      Subcategory: subCat,
      subCategory: subCat,
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
  console.log(`Formatted ${septRows.length} September item rows.`);

  // 2. Process October Data
  const octRawPath = path.join(process.cwd(), 'src', 'data', 'october2026_raw_orders.json');
  console.log(`Reading October Raw Orders: ${octRawPath}`);
  const octRaw = JSON.parse(fs.readFileSync(octRawPath, 'utf8'));
  const octRows = formatWooCommerceToOrderRows(octRaw);
  console.log(`Formatted ${octRows.length} October item rows.`);

  // 3. Process November Data
  const novRawPath = path.join(process.cwd(), 'src', 'data', 'november2026_raw_orders.json');
  console.log(`Reading November Raw Orders: ${novRawPath}`);
  const novRaw = JSON.parse(fs.readFileSync(novRawPath, 'utf8'));
  const novRows = formatWooCommerceToOrderRows(novRaw);
  console.log(`Formatted ${novRows.length} November item rows.`);

  // 4. Combine All Orders
  const allOrders = [...septRows, ...octRows, ...novRows];
  console.log(`Total Multi-Month Line Items: ${allOrders.length}`);

  // 5. Load Preserved Historical Pathao Delivery Records
  const existingBaseline = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'baselineSample.json'), 'utf8'));
  const pathaoDelivery = existingBaseline.pathaoDelivery || [];
  const returns = existingBaseline.returns || [];
  const partials = existingBaseline.partials || [];
  const exchanges = existingBaseline.exchanges || [];

  console.log(`Preserving ${pathaoDelivery.length} Pathao delivery records for customer rating & store history.`);

  const unifiedDataset = {
    orders: allOrders,
    returns,
    partials,
    exchanges,
    pathaoDelivery,
    updatedAt: new Date().toISOString(),
    sourceName: `⚡ Multi-Month Unified Dataset (Sept ${septRows.length} · Oct ${octRows.length} · Nov ${novRows.length})`,
  };

  const outBaselinePath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
  fs.writeFileSync(outBaselinePath, JSON.stringify(unifiedDataset, null, 2), 'utf8');
  console.log(`💾 Successfully updated ${outBaselinePath}`);
}

main().catch(console.error);
