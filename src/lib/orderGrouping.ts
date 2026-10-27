/**
 * Order-Wise Aggregation & Grouping Engine
 * Consolidates granular line items into single authoritative order-level records
 * for the Everyday Dispatched Orders Ledger.
 */

import * as XLSX from 'xlsx';
import { RawOrderRow } from '@/types';
import { getCategoryForSales, getSubCategoryForSales, getShortSubCategoryLabel } from './liveCategoryEngine';
import { classifyProductLine } from './selectsAnalytics';
import {
  isOrderOnline,
  isOrderOutlet,
  isOrderProcessing,
  isOrderOnHold,
  isOrderShipped,
  extractExchangeInfo,
  ExchangeInfo,
  LiveOpsReport,
} from './liveOpsProcessor';
import {
  detectFulfillmentBranch,
  FulfillmentBranchInfo,
} from './sync/liveTerminalSync';
import {
  getExportCustomerName,
  getExportPhoneNumber,
  compareOrdersByNumber,
  saveWorkbook,
} from './excelExport';
import { resolveSipOutlet } from './woocommerceClient';

export interface OrderWiseItem {
  itemName: string;
  sku: string;
  category: string;
  subCategory: string;
  quantity: number;
  itemCost: number;
  amount: number;
  isSelects: boolean;
  sipInventory?: string;
  sipOutletId?: string;
  sipOutletSlug?: string;
  branchCode?: 'ONLINE' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET' | 'EXCHANGE';
  row: RawOrderRow;
}

export interface OrderWiseGroup {
  orderId: string;
  baseOrderId: string;
  orderDate: string;
  dateModified?: string;
  customerName: string;
  phone: string;
  city: string;
  wcStatus: string;
  courierStatus: string;
  consignmentId: string;
  consignmentIds: string[];
  items: OrderWiseItem[];
  totalQuantity: number;
  totalAmount: number;
  collectionType: 'SELECTS' | 'REGULAR' | 'MIXED';
  hasDiscrepancy: boolean;
  discrepancyType?: string;
  discrepancyMessage?: string;
  branch: FulfillmentBranchInfo;
  isExchange: boolean;
  exchangeInfo: ExchangeInfo;
  isPos: boolean;
  isOnline: boolean;
  isEcommerce?: boolean;
  isOutlet?: boolean;
  orderSource?: string;
  orderNotes?: string;
  primaryRow: RawOrderRow;
  rawRows: RawOrderRow[];
}

export interface GroupOrdersFilterOptions {
  searchQuery?: string;
  categoryFilter?: string;
  courierFilter?: string;
  pipelineFilter?: string;
  selectedView?: string;
  channelFilter?: 'ALL' | 'ONLINE' | 'POS' | 'ECOMMERCE' | 'OUTLET';
  posBranchFilter?: 'ALL' | 'MIRPUR' | 'WARI' | 'CUMILLA' | 'SYLHET';
}

/**
 * Groups an array of raw order line-items into consolidated order records.
 */
export function groupOrdersByOrderId(rows: RawOrderRow[]): OrderWiseGroup[] {
  if (!rows || rows.length === 0) return [];

  const groupMap = new Map<string, OrderWiseGroup>();

  for (const row of rows) {
    const rawOid = String(row['Order ID'] || row.orderId || '').trim();
    if (!rawOid) continue;

    let group = groupMap.get(rawOid);
    if (!group) {
      const baseOid = rawOid.replace(/[ \-_]?[cwsm]$/i, '').trim();
      const branch = detectFulfillmentBranch(row);
      const exInfo = extractExchangeInfo(row);
      const isOnline = isOrderOnline(row);
      const isOutlet = isOrderOutlet(row);

      group = {
        orderId: rawOid,
        baseOrderId: baseOid,
        isPos: isOutlet,
        isOnline: isOnline,
        isEcommerce: isOnline,
        isOutlet: isOutlet,
        orderSource: String(row['Order Source'] || (row as Record<string, unknown>).orderSource || (isOnline ? 'Online' : isOutlet ? 'POS' : 'Outlet Ecom Dispatch')),
        orderDate: String(row['Order Date'] || row.orderDate || row.date_created || ''),
        dateModified: String(row['Date Modified'] || row.dateModified || ''),
        customerName: String(getExportCustomerName(row) || row['Customer Name'] || row.customerName || 'Customer'),
        phone: String(getExportPhoneNumber(row) || row.Phone || row.phone || ''),
        city: String(row.City || row.city || 'Dhaka'),
        wcStatus: String(row['Delivery Status'] || (row as Record<string, unknown>).status || 'shipped'),
        courierStatus: String(row['Courier Status'] || row.courierStatus || 'Untracked'),
        consignmentId: '',
        consignmentIds: [],
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
        collectionType: 'REGULAR',
        hasDiscrepancy: false,
        discrepancyType: undefined,
        discrepancyMessage: undefined,
        branch,
        isExchange: Boolean(exInfo.isExchange || branch.branchCode === 'EXCHANGE'),
        exchangeInfo: exInfo,
        orderNotes: String(row['Order Notes'] || row.orderNotes || row.customer_note || ''),
        primaryRow: row,
        rawRows: [],
      };

      groupMap.set(rawOid, group);
    }

    // Add row to group
    group.rawRows.push(row);

    // Track consignment ID
    const cid = String(row['Consignment ID'] || row.consignmentId || row.tracking_number || '').trim();
    if (cid && !group.consignmentIds.includes(cid)) {
      group.consignmentIds.push(cid);
    }

    // Discrepancy propagation
    if (row.hasDiscrepancy) {
      group.hasDiscrepancy = true;
      group.discrepancyType = (row.discrepancyType as string) || group.discrepancyType;
      group.discrepancyMessage = (row.discrepancyMessage as string) || group.discrepancyMessage;
    }

    // Line item details
    const itemName = String(row['Item Name'] || row.itemName || row.item_name || row.name || 'Apparel Item');
    const sku = String(row.SKU || row.sku || '');
    const category = getCategoryForSales(itemName);
    const subCategory = getSubCategoryForSales(itemName, category);
    const quantity = Math.max(1, Math.round(Number(row.Quantity ?? row.quantity ?? row.qty) || 1));
    const itemCost = Number(row['Item Cost'] ?? row.itemCost ?? row.price ?? row.item_cost) || 0;
    const rowAmt = Number(row['Order Amount'] ?? row.orderAmount ?? row.amount ?? row.total);
    const amount = itemCost > 0 ? itemCost * quantity : (rowAmt > 0 ? rowAmt : 0);
    const isSelects = classifyProductLine(itemName, sku, category) === 'DEEN Selects';

    const rawSip = String(
      row.sipInventory ||
      row.sip_inventory ||
      row.inventorySource ||
      row.fulfillmentBranch ||
      (group.branch?.branchName ?? '')
    ).trim();
    const resolvedItemSip = resolveSipOutlet(
      String(row.sipOutletId || row.sip_outlet_id || row['Outlet ID'] || row.outletId || ''),
      rawSip
    );
    const sipInventory = rawSip || resolvedItemSip.inventorySource;
    const sipOutletId = String(row.sipOutletId || row.sip_outlet_id || resolvedItemSip.outletId || '').trim();
    const sipOutletSlug = String(row.sipOutletSlug || resolvedItemSip.outletSlug || '').trim();
    const branchCode = (row.branchCode as 'ONLINE' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET' | 'EXCHANGE') || resolvedItemSip.inventoryCode || group.branch?.branchCode || 'ONLINE';

    group.items.push({
      itemName,
      sku,
      category,
      subCategory,
      quantity,
      itemCost,
      amount,
      isSelects,
      sipInventory,
      sipOutletId,
      sipOutletSlug,
      branchCode,
      row,
    });

    group.totalQuantity += quantity;
    group.totalAmount += amount;
  }

  // Finalize aggregated fields for each group
  const finalizedGroups: OrderWiseGroup[] = [];
  for (const group of groupMap.values()) {
    // Primary consignment ID
    group.consignmentId = group.consignmentIds.length > 0 ? group.consignmentIds[0] : '';

    // Collection Mix
    const hasSelects = group.items.some((i) => i.isSelects);
    const hasRegular = group.items.some((i) => !i.isSelects);
    if (hasSelects && hasRegular) {
      group.collectionType = 'MIXED';
    } else if (hasSelects) {
      group.collectionType = 'SELECTS';
    } else {
      group.collectionType = 'REGULAR';
    }

    // Courier status resolution:
    // If all rawRows are Delivered -> Delivered
    // If all rawRows are Returned -> Returned
    // If any In Transit -> In Transit
    const cStatuses = group.rawRows.map((r) => String(r['Courier Status'] || r.courierStatus || 'Untracked'));
    if (cStatuses.every((s) => s === 'Delivered')) {
      group.courierStatus = 'Delivered';
    } else if (cStatuses.every((s) => s === 'Returned')) {
      group.courierStatus = 'Returned';
    } else if (cStatuses.some((s) => s === 'In Transit')) {
      group.courierStatus = 'In Transit';
    } else if (cStatuses.some((s) => s === 'Delivered')) {
      group.courierStatus = 'Partial';
    } else if (cStatuses.some((s) => s === 'Pending Pickup')) {
      group.courierStatus = 'Pending Pickup';
    }

    finalizedGroups.push(group);
  }

  // Sort groups naturally by Order ID number
  return finalizedGroups.sort((a, b) => compareOrdersByNumber(a.primaryRow, b.primaryRow));
}

/**
 * Applies active ledger filters (search, category, courier, pipeline) to Order-Wise groups.
 */
export function filterOrderWiseGroups(
  groups: OrderWiseGroup[],
  options: GroupOrdersFilterOptions = {}
): OrderWiseGroup[] {
  const {
    searchQuery = '',
    categoryFilter = 'ALL',
    courierFilter = 'ALL',
    pipelineFilter = 'ALL',
    selectedView = 'Today Shipped',
    channelFilter = 'ONLINE',
    posBranchFilter = 'ALL',
  } = options;

  const query = searchQuery.toLowerCase().trim();

  return groups.filter((group) => {
    // Channel filter: Ecommerce vs Outlet vs All (Ecommerce + Outlet / Both)
    const isEcom = channelFilter === 'ONLINE' || channelFilter === 'ECOMMERCE';
    const isOut = channelFilter === 'POS' || channelFilter === 'OUTLET';

    if (isEcom && !group.isEcommerce) return false;
    if (isOut && !group.isOutlet) return false;
    if (isOut && posBranchFilter !== 'ALL' && group.branch.branchCode !== posBranchFilter) return false;
    if (!isEcom && !isOut && !group.isEcommerce && !group.isOutlet) return false;

    // Exchange view isolation
    if (courierFilter === 'EXCHANGES_ONLY') {
      if (!group.isExchange) return false;
    } else {
      if (group.isExchange) return false;
    }

    // Search query filter (matches Order ID, Customer, Phone, Consignments, or ANY item/sku in the order)
    if (query) {
      const matchOid = group.orderId.toLowerCase().includes(query) || group.baseOrderId.toLowerCase().includes(query);
      const matchCust = group.customerName.toLowerCase().includes(query);
      const matchPhone = group.phone.toLowerCase().includes(query);
      const matchCid = group.consignmentIds.some((cid) => cid.toLowerCase().includes(query));
      const matchItems = group.items.some(
        (i) =>
          i.itemName.toLowerCase().includes(query) ||
          i.sku.toLowerCase().includes(query) ||
          (i.sipInventory && i.sipInventory.toLowerCase().includes(query))
      );

      if (!matchOid && !matchCust && !matchPhone && !matchCid && !matchItems) {
        return false;
      }
    }

    // Category / Sub-Category filter (matches if ANY item in order belongs to category)
    if (categoryFilter !== 'ALL') {
      const hasMatchingCategory = group.items.some((item) => {
        const cat = item.category;
        const sub = item.subCategory;
        const shortSub = getShortSubCategoryLabel(sub);
        return (
          cat === categoryFilter ||
          sub === categoryFilter ||
          shortSub === categoryFilter ||
          (categoryFilter === 'Regular Fit' && /regular/i.test(item.itemName) && cat === 'Jeans') ||
          (categoryFilter === 'Slim Fit' && /slim/i.test(item.itemName) && cat === 'Jeans') ||
          (categoryFilter === 'Straight Fit' && /straight/i.test(item.itemName) && cat === 'Jeans')
        );
      });

      if (!hasMatchingCategory) return false;
    }

    // Courier filter
    if (courierFilter !== 'ALL' && courierFilter !== 'EXCHANGES_ONLY') {
      if (courierFilter === 'DISCREPANCY_ONLY') {
        if (!group.hasDiscrepancy) return false;
      } else if (
        courierFilter === 'RETURNED_BUT_SHIPPED' ||
        courierFilter === 'DELIVERED_BUT_PROCESSING' ||
        courierFilter === 'COD_MISMATCH' ||
        courierFilter === 'UNCOLLECTED_COD' ||
        courierFilter === 'DOUBLE_COLLECTION_RISK'
      ) {
        if (!group.hasDiscrepancy || group.discrepancyType !== courierFilter) return false;
      } else {
        if (group.courierStatus !== courierFilter) return false;
      }
    }

    // Pipeline status filter (for Today's Orders view)
    if ((selectedView === "Today's Orders" || selectedView === 'All Orders') && pipelineFilter !== 'ALL') {
      if (!isOrderOnline(group.primaryRow)) return false;
      if (pipelineFilter === 'PROCESSING' && !isOrderProcessing(group.primaryRow)) return false;
      if (pipelineFilter === 'HOLD' && !isOrderOnHold(group.primaryRow)) return false;
      if (pipelineFilter === 'SHIPPED_TODAY' && !isOrderShipped(group.primaryRow)) return false;
    }

    return true;
  });
}

/**
  * Builds the official multi-sheet Excel workbook for Order-Wise Consolidated Ledger.
  * Invariant Rule: Strictly excludes POS retail store orders and isolates exchanges.
  */
export function buildOrderWiseWorkbook(
  groups: OrderWiseGroup[],
  report: LiveOpsReport,
  options: {
    isExchangesView?: boolean;
    ratings?: Record<string, { ratingLabel?: string; successRate?: number }>;
  } = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const isExchangesView = Boolean(options.isExchangesView);

  const exportData = groups.map((g) => {
    const r = options.ratings?.[g.phone];
    const sipInventory = Array.from(
      new Set(g.items.map((i) => i.sipInventory).filter(Boolean))
    ).join(', ') || g.branch.branchName || 'Central Warehouse';

    return {
      'Order ID': g.orderId,
      'Order Date': g.orderDate,
      'Customer Name': g.customerName,
      'Phone': g.phone,
      'Customer Rating': r?.ratingLabel || 'Standard Buyer',
      'Delivery Success Rate': r?.successRate !== undefined ? `${r.successRate}%` : 'N/A',
      'City': g.city,
      'Total Items (Pcs)': g.totalQuantity,
      'Items Summary': g.items.map((i) => `${i.itemName} (x${i.quantity})`).join('; '),
      'SIP Inventory': sipInventory,
      'Collection Type':
        g.collectionType === 'SELECTS'
          ? 'DEEN Selects'
          : g.collectionType === 'REGULAR'
          ? 'DEEN Regular'
          : 'Mixed (Selects + Regular)',
      'Order Total (TK)': g.totalAmount,
      'WooCommerce Status': g.wcStatus,
      'Pathao Courier Status': g.courierStatus,
      'Pathao Consignment ID': g.consignmentIds.join(', ') || 'N/A',
      'Fulfillment Branch': g.branch.branchName,
      'Courier Discrepancy': g.hasDiscrepancy ? `Yes (${g.discrepancyType || 'Mismatch'})` : 'None',
    };
  });

  const sheetName = isExchangesView ? 'Exchanges (Order-Wise)' : 'Shipped Orders (Order-Wise)';
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // If there are replacement/non-checkout orders and not already on exchanges view, include sheet 2
  if (!isExchangesView && report?.exchangeStats?.replacementOrders?.length) {
    const exchangeGroups = groupOrdersByOrderId(report.exchangeStats.replacementOrders);
    const exData = exchangeGroups.map((g) => {
      const r = options.ratings?.[g.phone];
      const sipInventory = Array.from(
        new Set(g.items.map((i) => i.sipInventory).filter(Boolean))
      ).join(', ') || 'Exchange Replacement';

      return {
        'Replacement Order ID': g.orderId,
        'Original Order ID': g.exchangeInfo.referencedOrderId || 'N/A',
        'Exchange Tag': g.exchangeInfo.displayTag || 'Exchange',
        'Date': g.orderDate,
        'Customer Name': g.customerName,
        'Phone': g.phone,
        'Customer Rating': r?.ratingLabel || 'Standard Buyer',
        'Delivery Success Rate': r?.successRate !== undefined ? `${r.successRate}%` : 'N/A',
        'City': g.city,
        'Total Items (Pcs)': g.totalQuantity,
        'Items Summary': g.items.map((i) => `${i.itemName} (x${i.quantity})`).join('; '),
        'SIP Inventory': sipInventory,
        'Courier Status': g.courierStatus,
        'Pathao Consignment ID': g.consignmentIds.join(', ') || 'N/A',
        'Commercial Revenue Recognized': 0,
        'Operational Notes': 'Customer exchange replacement parcel created manually via staff admin (zero new revenue)',
      };
    });
    const wsEx = XLSX.utils.json_to_sheet(exData);
    XLSX.utils.book_append_sheet(wb, wsEx, 'Exchanges & Non-Checkout');
  }

  return wb;
}

/**
 * Downloads the Order-Wise Excel report with cross-browser reliability.
 */
export function exportOrderWiseLedgerExcel(
  groups: OrderWiseGroup[],
  report: LiveOpsReport,
  options: {
    isExchangesView?: boolean;
    filenamePrefix?: string;
    ratings?: Record<string, { ratingLabel?: string; successRate?: number }>;
  } = {}
) {
  const wb = buildOrderWiseWorkbook(groups, report, options);
  const prefix = options.filenamePrefix || 'DEEN_Live_OrderWise_Ledger';
  const finalFilename = `${prefix}_${report.referenceDate}.xlsx`;
  saveWorkbook(wb, finalFilename);
}

