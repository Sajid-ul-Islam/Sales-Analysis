"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReconciledOrderRow, SummaryAnalytics, RawOrderRow } from '@/types';
import {
  ShoppingBag,
  Store,
  Building2,
  TrendingUp,
  PackageCheck,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  Layers,
  Award,
  MapPin,
  Shirt,
  Zap,
  Trash2,
  ArrowUpRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  compareOrdersByNumber,
  getExportCustomerName,
  getExportPhoneNumber
} from '@/lib/excelExport';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { DateScope, CustomDateRange, parseOrderDate } from '@/lib/dateFilter';
import { classifyProductCategory } from '@/lib/reconciliationEngine';
import { cleanProductMainName, extractMasterSku } from './ExecutiveOverviewTab';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';
import { isEcomPaymentMethod } from '@/lib/woocommerceClient';

interface OutletSalesTabProps {
  orders?: ReconciledOrderRow[];
  summary?: SummaryAnalytics;
  onSelectOrder?: (orderId: string) => void;
}

export interface WcOrderRecord {
  id: string;
  orderNumber: string;
  dateCreated: string;
  customerName: string;
  phone: string;
  city: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentMethodTitle: string;
  orderSource: 'pos';
  outletId: string;
  outletName: string;
  itemsCount: number;
  itemsSummary: string;
  lineItems: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  discounts: number;
}

interface OutletSalesMetric {
  id: string;
  name: string;
  channelType: 'Retail Branch POS';
  badgeColor: string;
  dotColor: string;
  ordersCount: number;
  unitsSold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  aov: number;
  revenueShare: number;
}

// Canonical Physical Retail Branches (Online Store excluded by business rule)
export const PHYSICAL_OUTLETS = [
  {
    id: '1',
    name: 'Mirpur Outlet POS',
    channelType: 'Retail Branch POS' as const,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    dotColor: '#a855f7'
  },
  {
    id: '9',
    name: 'Wari Branch POS',
    channelType: 'Retail Branch POS' as const,
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    dotColor: '#0ea5e9'
  },
  {
    id: '2',
    name: 'Cumilla Branch POS',
    channelType: 'Retail Branch POS' as const,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: '#10b981'
  },
  {
    id: '7',
    name: 'Sylhet Branch POS',
    channelType: 'Retail Branch POS' as const,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: '#f59e0b'
  }
];

export type SyncDepth = '300' | '800' | '1500';

export const SYNC_DEPTH_CONFIG: Record<SyncDepth, { label: string; pages: number; badge: string; desc: string }> = {
  '300': { label: 'Quick (300)', pages: 3, badge: '⚡ Quick (300)', desc: 'Scans latest 300 orders (~3s)' },
  '800': { label: 'Standard (800)', pages: 8, badge: '⭐ Standard (800)', desc: 'Default recommended: pulls all branch & Mirpur POS orders (~7s)' },
  '1500': { label: 'Deep (1,500)', pages: 15, badge: '🔍 Deep (1,500)', desc: 'Multi-week historical POS audit depth (~14s)' },
};

export const POS_CACHE_STORAGE_KEY = 'deen_outlet_pos_orders_cache_v1';

export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function OutletSalesTab({ orders: reconciledOrders = [] }: OutletSalesTabProps) {
  const [wcOrders, setWcOrders] = useState<WcOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Instant Local Caching & Sync Depth Controls
  const [syncDepth, setSyncDepth] = useState<SyncDepth>('800');
  const [lastCachedTimestamp, setLastCachedTimestamp] = useState<number | null>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  
  // 4 View Modes: Branch Summary Matrix, Category Sales, Item/SKU Sales, POS Orders Stream
  type ActiveViewMode = 'SUMMARY' | 'CATEGORY' | 'ITEM' | 'ORDERS';
  const [activeViewMode, setActiveViewMode] = useState<ActiveViewMode>('SUMMARY');
  
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Item & Category Search / Filter states
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [itemCurrentPage, setItemCurrentPage] = useState<number>(1);
  const itemPageSize = 20;

  // Local Date Range Filter state
  const [dateScope, setDateScope] = useState<DateScope>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange | undefined>(undefined);

  // Resolve Outlet from WooCommerce Order:
  // Strictly matches retail POS branches (Mirpur, Wari, Cumilla, Sylhet).
  // Returns null for Online Store (Website) orders to exclude them.
  const resolveOutletFromWcOrder = useCallback((rawOrder: Record<string, unknown>): { outletId: string; outletName: string; orderSource: 'pos' } | null => {
    const meta = Array.isArray(rawOrder.meta_data) ? (rawOrder.meta_data as Record<string, unknown>[]) : [];
    const sourceMeta = meta.find((m) => m.key === '_sip_order_source');
    const outletMeta = meta.find((m) => m.key === '_sip_outlet_id');
    const posDomainMeta = meta.find((m) => m.key === '_sip_pos_domain');
    const createdByMeta = meta.find((m) => m.key === '_sip_created_by');
    const note = String(rawOrder.customer_note || '').toLowerCase();
    const orderIdStr = String(rawOrder.id || rawOrder.number || '').toLowerCase();
    const paymentMethod = String(rawOrder.payment_method || '').toLowerCase();
    const paymentTitle = String(rawOrder.payment_method_title || '').toLowerCase();

    // User rule: If payment is marked as ecom, then exclude them (these are ecommerce orders dispatched from outlet)
    const isEcomPayment = isEcomPaymentMethod(paymentMethod, paymentTitle);
    if (isEcomPayment) {
      return null;
    }

    // Web checkout orders are online orders (even if fulfilled from an outlet), exclude them
    const createdVia = String(rawOrder.created_via || '').toLowerCase().trim();
    if (createdVia === 'checkout' || createdVia === 'store-api') {
      return null;
    }

    // Check if order has courier tracking (Pathao consignment ID, tracking code, shipping fee)
    const hasCourierConsignment = meta.some((m) => {
      const k = String(m.key || '').toLowerCase();
      const v = String(m.value || '').trim();
      return (k.includes('consignment') || k.includes('pathao') || k.includes('tracking')) && v && v !== '-' && v !== 'null';
    });
    if (hasCourierConsignment) {
      return null;
    }

    // In DEEN operations, suffixes w, s, c denote Online orders dispatched from outlets.
    // They are not in-store POS walk-in orders unless explicitly created via POS register.
    const isExplicitPos = sourceMeta?.value === 'pos' || 
                          Boolean(posDomainMeta?.value) || 
                          meta.some((m) => m.key === '_sip_pos_order') ||
                          (paymentMethod.startsWith('sip_') && !isEcomPayment) ||
                          createdVia === 'pos' ||
                          Boolean(createdByMeta?.value);

    // If an order only has branch suffix w, s, c without POS metadata, it is an online dispatch from outlet -> exclude
    if (!isExplicitPos && (/[-_\s]?[wcs]$/i.test(orderIdStr) || /\b\d+\s*[wcs]\b/i.test(orderIdStr))) {
      return null;
    }

    const outletId = String(outletMeta?.value || '');
    const createdBy = String(createdByMeta?.value || '');

    // 1. Check explicit POS outlet IDs or POS register domains
    if (isExplicitPos || outletId) {
      if (outletId === '2' || outletId === '1' || createdBy === '3' || createdBy === '1508' || note.includes('mirpur') || /\b\d+\s*m\b|[-_\s]m$/i.test(orderIdStr)) {
        return { outletId: outletId || '2', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
      }
      if (outletId === '8' || createdBy === '69' || note.includes('wari') || /\b\d+\s*w\b|[-_\s]w$/i.test(orderIdStr)) {
        return { outletId: outletId || '8', outletName: 'Wari Branch POS', orderSource: 'pos' };
      }
      if (outletId === '7' || createdBy === '35' || note.includes('cumilla') || note.includes('comilla') || /\b\d+\s*c\b|[-_\s]c$/i.test(orderIdStr)) {
        return { outletId: outletId || '7', outletName: 'Cumilla Branch POS', orderSource: 'pos' };
      }
      if (outletId === '9' || createdBy === '572' || note.includes('sylhet') || /\b\d+\s*s\b|[-_\s]s$/i.test(orderIdStr)) {
        return { outletId: outletId || '9', outletName: 'Sylhet Branch POS', orderSource: 'pos' };
      }
      // Unspecified POS outlet defaults to primary Mirpur register
      return { outletId: outletId || '2', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
    }

    // 2. Check for Mirpur POS suffix on order number (17263 m)
    if (/\b\d+\s*m\b|[-_\s]m$/i.test(orderIdStr) || note.includes('mirpur')) {
      return { outletId: '2', outletName: 'Mirpur Outlet POS', orderSource: 'pos' };
    }

    // Default: Online Store website checkout order — strictly filtered out from Outlet Sales
    return null;
  }, []);

  // Format raw WooCommerce orders into structured records, filtering out Online Store & Ecom payments
  const parseRawWcOrders = useCallback((rawOrdersList: Record<string, unknown>[]): WcOrderRecord[] => {
    const outletRecords: WcOrderRecord[] = [];

    rawOrdersList.forEach(o => {
      // User rule: If payment is marked as ecom, exclude them
      const pMethod = String(o.payment_method || '').toLowerCase();
      const pTitle = String(o.payment_method_title || '').toLowerCase();
      if (pMethod === 'sip_ecom' || pMethod === 'ecom' || pTitle === 'ecom' || pTitle.includes('ecom')) {
        return; // Exclude Ecom marked orders from Outlet Sales
      }

      const outlet = resolveOutletFromWcOrder(o);
      // Strictly exclude Online Store (Website) orders
      if (!outlet) return;

      const lineItems = Array.isArray(o.line_items) ? (o.line_items as Record<string, unknown>[]) : [];
      let itemsCount = 0;
      const itemsList: Array<{ name: string; sku: string; quantity: number; price: number; total: number }> = [];

      lineItems.forEach((it) => {
        const qty = parseInt(String(it.quantity || '1'), 10) || 1;
        itemsCount += qty;
        const price = parseFloat(String(it.price || '0')) || 0;
        const total = parseFloat(String(it.total || '0')) || (price * qty);
        itemsList.push({
          name: String(it.name || it.parent_name || 'DEEN Apparel'),
          sku: String(it.sku || 'N/A'),
          quantity: qty,
          price,
          total
        });
      });

      const billing = (o.billing || {}) as Record<string, unknown>;
      const shipping = (o.shipping || {}) as Record<string, unknown>;
      const customerName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() ||
        String(shipping.first_name || '') ||
        'In-Store Customer';

      outletRecords.push({
        id: String(o.id || o.number || ''),
        orderNumber: String(o.number || o.id || ''),
        dateCreated: String(o.date_created || ''),
        customerName,
        phone: String(billing.phone || shipping.phone || ''),
        city: String(billing.city || shipping.city || 'Dhaka'),
        total: parseFloat(String(o.total || '0')) || 0,
        status: String(o.status || 'completed'),
        paymentMethod: String(o.payment_method || 'cash'),
        paymentMethodTitle: String(o.payment_method_title || (o.payment_method === 'cod' ? 'Cash' : o.payment_method || 'Cash Register')),
        orderSource: 'pos',
        outletId: outlet.outletId,
        outletName: outlet.outletName,
        itemsCount: Math.max(1, itemsCount),
        itemsSummary: itemsList.map(i => `${i.quantity}x ${i.name}`).slice(0, 2).join(', ') || 'In-Store Item',
        lineItems: itemsList,
        discounts: parseFloat(String(o.discount_total || '0')) || 0
      });
    });

    return outletRecords;
  }, [resolveOutletFromWcOrder]);

  // Convert Reconciled Orders (from spreadsheets/baseline) to consolidated Outlet POS records as seed/fallback
  const extractOutletOrdersFromReconciled = useCallback((ordersList: ReconciledOrderRow[]): WcOrderRecord[] => {
    const orderMap = new Map<string, {
      record: WcOrderRecord;
      items: Array<{ name: string; sku: string; quantity: number; price: number; total: number }>;
    }>();

    ordersList.forEach(r => {
      const rowAny = r as unknown as Record<string, unknown>;
      const pMethod = String(rowAny.paymentMethod || rowAny['Payment Method'] || r.paymentMethod || '').toLowerCase();
      const pTitle = String(rowAny.paymentMethodTitle || rowAny['Payment Method Title'] || '').toLowerCase();
      if (isEcomPaymentMethod(pMethod, pTitle)) {
        return; // Exclude ecom marked orders from Outlet POS Sales
      }

      // Exclude online orders dispatched from outlets (courier dispatches)
      if (rowAny.isPos === false || (rowAny.isBranchFulfillment === true && !rowAny.isPos)) {
        return;
      }
      if (rowAny.consignmentId || rowAny['Consignment ID']) {
        return;
      }
      if (String(rowAny.created_via || rowAny['Created Via'] || '').toLowerCase().trim() === 'checkout') {
        return;
      }

      let outletId = '';
      let outletName = '';

      const oid = String(r.orderId || '').toLowerCase();
      const bOutlet = String(r.fulfillmentLocation || rowAny.branchOutlet || '');
      const bSuffix = String(r.branchSuffix || '');

      if (rowAny.posOutletId === '2' || rowAny.posOutletId === '1' || bOutlet.includes('Mirpur Outlet POS') || (!bSuffix && /[-_\s]m$/i.test(oid))) {
        outletId = '2';
        outletName = 'Mirpur Outlet POS';
      } else if (rowAny.posOutletId === '8' || bOutlet.includes('Wari Branch POS') || (!bSuffix && /[-_\s]w$/i.test(oid))) {
        outletId = '8';
        outletName = 'Wari Branch POS';
      } else if (rowAny.posOutletId === '7' || bOutlet.includes('Cumilla Branch POS') || (!bSuffix && /[-_\s]c$/i.test(oid))) {
        outletId = '7';
        outletName = 'Cumilla Branch POS';
      } else if (rowAny.posOutletId === '9' || bOutlet.includes('Sylhet Branch POS') || (!bSuffix && /[-_\s]s$/i.test(oid))) {
        outletId = '9';
        outletName = 'Sylhet Branch POS';
      }

      if (!outletId) return; // Skip Online Store and branch courier dispatches

      const dateStr = r.orderDate instanceof Date 
        ? r.orderDate.toISOString() 
        : String(rowAny.rawOrder ? (rowAny.rawOrder as Record<string, unknown>)['Order Date'] : r.orderDate || '');

      const cleanOid = r.orderId;
      const itemQty = Number(rowAny.quantity || r.quantity || 1);
      const itemPrice = r.itemCost || 0;
      const itemTotal = itemPrice * itemQty;

      if (!orderMap.has(cleanOid)) {
        orderMap.set(cleanOid, {
          record: {
            id: cleanOid,
            orderNumber: cleanOid,
            dateCreated: dateStr,
            customerName: getExportCustomerName(r) || r.customerName || 'In-Store Customer',
            phone: getExportPhoneNumber(r) || r.phone || '',
            city: r.city || 'Dhaka',
            total: 0,
            status: r.deliveryStatus === 'Delivered' ? 'completed' : (r.deliveryStatus || 'completed').toLowerCase(),
            paymentMethod: 'cash',
            paymentMethodTitle: String((rowAny.rawOrder as Record<string, unknown>)?.[`Payment Method`] || 'In-Store Register'),
            orderSource: 'pos',
            outletId,
            outletName,
            itemsCount: 0,
            itemsSummary: '',
            lineItems: [],
            discounts: 0
          },
          items: []
        });
      }

      const existing = orderMap.get(cleanOid)!;
      existing.items.push({
        name: String(r.itemName || rowAny.productName || 'DEEN Apparel'),
        sku: r.sku || 'N/A',
        quantity: itemQty,
        price: itemPrice,
        total: itemTotal
      });
      existing.record.itemsCount += itemQty;
      existing.record.total += itemTotal;
    });

    return Array.from(orderMap.values()).map(({ record, items }) => ({
      ...record,
      itemsSummary: items.map(i => `${i.quantity}x ${i.name}`).slice(0, 2).join(', ') || 'In-Store Apparel',
      lineItems: items,
      total: record.total > 0 ? record.total : 1200
    }));
  }, []);

  // Pull live orders from WooCommerce REST API with optional date filtering & bulletproof HTML protection
  const handlePullFromWooCommerce = useCallback(async (
    perPage: number = 100, 
    maxPagesOverride?: number,
    depthOverride?: SyncDepth
  ) => {
    const activeDepth = depthOverride || syncDepth;
    const pagesToFetch = maxPagesOverride || SYNC_DEPTH_CONFIG[activeDepth].pages;
    const orderCap = pagesToFetch * perPage;

    setIsLoading(true);
    setSyncStatusMsg(`Connecting to WooCommerce REST API (Scanning up to ${orderCap.toLocaleString()} orders)...`);

    try {
      let afterIso: string | undefined;
      let beforeIso: string | undefined;

      if (dateScope === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        afterIso = today.toISOString();
      } else if (dateScope === '7d') {
        afterIso = new Date(Date.now() - 7 * 86400000).toISOString();
      } else if (dateScope === '30d') {
        afterIso = new Date(Date.now() - 30 * 86400000).toISOString();
      } else if (dateScope === '90d') {
        afterIso = new Date(Date.now() - 90 * 86400000).toISOString();
      } else if (dateScope === 'custom' && customRange?.startDate) {
        afterIso = new Date(customRange.startDate).toISOString();
        if (customRange?.endDate) {
          const end = new Date(customRange.endDate);
          end.setHours(23, 59, 59, 999);
          beforeIso = end.toISOString();
        }
      }

      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          perPage,
          maxPages: pagesToFetch,
          fetchAllPages: true,
          status: 'any',
          after: afterIso,
          before: beforeIso
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: { success?: boolean; rawOrders?: Record<string, unknown>[]; orders?: RawOrderRow[]; message?: string } = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`Server returned HTML error (HTTP ${res.status}). Ensure dev server is active and endpoint is reachable.`);
        }
        throw new Error(`Server returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 80)}`);
      }

      if (data.success && Array.isArray(data.rawOrders) && data.rawOrders.length > 0) {
        const parsed = parseRawWcOrders(data.rawOrders);
        if (parsed.length > 0) {
          setWcOrders(prev => {
            const incomingIds = new Set(parsed.map(p => p.orderNumber));
            const existingRetained = prev.filter(p => !incomingIds.has(p.orderNumber));
            const combined = [...parsed, ...existingRetained];

            // Save to localStorage for instant 0ms future reloads
            try {
              localStorage.setItem(POS_CACHE_STORAGE_KEY, JSON.stringify({
                version: 1,
                timestamp: Date.now(),
                syncDepth: activeDepth,
                orders: combined
              }));
              setLastCachedTimestamp(Date.now());
              setIsFromCache(false);
            } catch (err) {
              console.warn('LocalStorage save failed:', err);
            }

            return combined;
          });
          setSyncStatusMsg(`Successfully pulled ${data.rawOrders.length} orders from WooCommerce (${parsed.length} branch POS outlet orders synchronized).`);
        } else {
          setSyncStatusMsg(`Fetched ${data.rawOrders.length} orders from WooCommerce, but all were Online Store web checkouts (no POS orders in this window).`);
        }
      } else if (data.orders && data.orders.length > 0) {
        // Fallback using formatted order rows if rawOrders was not provided
        const parsedFallback: WcOrderRecord[] = [];
        data.orders.forEach((r: RawOrderRow, idx: number) => {
          const pMethod = String(r['Payment Method'] || r.paymentMethod || '').toLowerCase();
          const pTitle = String((r as Record<string, unknown>).payment_method_title || '').toLowerCase();
          if (isEcomPaymentMethod(pMethod, pTitle)) {
            return; // Exclude ecom marked orders from Outlet Sales
          }
          if (r.isPos === false || (r.isBranchFulfillment === true && !r.isPos)) {
            return; // Exclude online orders dispatched from outlets
          }
          if (r['Consignment ID'] || r.consignmentId) {
            return; // Exclude courier tracked orders
          }
          const createdVia = String(r['Created Via'] || (r as Record<string, unknown>).created_via || '').toLowerCase().trim();
          if (createdVia === 'checkout' || createdVia === 'store-api') {
            return;
          }

          const isPos = r.isPos || r['Order Source'] === 'POS';
          const oid = String(r['Order ID'] || r.orderId || idx);
          const rawOutletId = String(r.outletId || r['Outlet ID'] || '');

          let outletId = '';
          let outletName = '';

          if (rawOutletId === '2' || rawOutletId === '1' || (!rawOutletId && /[-_\s]m$/i.test(oid))) {
            outletId = '2';
            outletName = 'Mirpur Outlet POS';
          } else if (rawOutletId === '8' || (!rawOutletId && /[-_\s]w$/i.test(oid))) {
            outletId = '8';
            outletName = 'Wari Branch POS';
          } else if (rawOutletId === '7' || (!rawOutletId && /[-_\s]c$/i.test(oid))) {
            outletId = '7';
            outletName = 'Cumilla Branch POS';
          } else if (rawOutletId === '9' || (!rawOutletId && /[-_\s]s$/i.test(oid))) {
            outletId = '9';
            outletName = 'Sylhet Branch POS';
          } else if (isPos) {
            outletId = '2';
            outletName = 'Mirpur Outlet POS';
          }

          if (!outletId) return; // Exclude Online Store & online branch dispatches

          const total = parseFloat(String(r['Order Amount'] || r['Item Cost'] || '0')) || 0;
          parsedFallback.push({
            id: oid,
            orderNumber: oid,
            dateCreated: String(r['Order Date'] || ''),
            customerName: String(getExportCustomerName(r) || r['Customer Name'] || 'In-Store Customer'),
            phone: String(getExportPhoneNumber(r) || r['Phone'] || ''),
            city: String(r['City'] || 'Dhaka'),
            total,
            status: String(r['Delivery Status'] || 'completed'),
            paymentMethod: 'cash',
            paymentMethodTitle: String(r['Payment Method'] || 'In-Store Register'),
            orderSource: 'pos',
            outletId,
            outletName,
            itemsCount: parseInt(String(r['Quantity'] || '1'), 10) || 1,
            itemsSummary: String(r['Item Name'] || 'DEEN Apparel'),
            lineItems: [{
              name: String(r['Item Name'] || 'DEEN Apparel'),
              sku: String(r['SKU'] || 'N/A'),
              quantity: parseInt(String(r['Quantity'] || '1'), 10) || 1,
              price: parseFloat(String(r['Item Cost'] || '0')) || 0,
              total
            }],
            discounts: 0
          });
        });

        if (parsedFallback.length > 0) {
          setWcOrders(prev => {
            const incomingIds = new Set(parsedFallback.map(p => p.orderNumber));
            const existingRetained = prev.filter(p => !incomingIds.has(p.orderNumber));
            const combined = [...parsedFallback, ...existingRetained];

            try {
              localStorage.setItem(POS_CACHE_STORAGE_KEY, JSON.stringify({
                version: 1,
                timestamp: Date.now(),
                syncDepth: activeDepth,
                orders: combined
              }));
              setLastCachedTimestamp(Date.now());
              setIsFromCache(false);
            } catch (err) {
              console.warn('LocalStorage save failed:', err);
            }

            return combined;
          });
          setSyncStatusMsg(`Successfully pulled ${parsedFallback.length} outlet POS records from WooCommerce.`);
        } else {
          setSyncStatusMsg('Fetched WooCommerce orders, but no POS branch orders were found in this query.');
        }
      } else {
        setSyncStatusMsg(data.message || 'WooCommerce API returned 0 orders.');
      }
    } catch (err: unknown) {
      console.error('Failed to pull from WooCommerce:', err);
      const msg = err instanceof Error ? err.message : 'Check credentials';
      setSyncStatusMsg(`WooCommerce API connection: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [dateScope, customRange, syncDepth, parseRawWcOrders]);

  // Clear Browser Cache Handler
  const handleClearCache = useCallback(() => {
    try {
      localStorage.removeItem(POS_CACHE_STORAGE_KEY);
      setLastCachedTimestamp(null);
      setIsFromCache(false);
      setSyncStatusMsg('Local cache cleared. Click "Sync Live" to pull fresh orders from WooCommerce.');
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }, []);

  // Seed from Reconciled Orders if available and no live/cached orders exist
  useEffect(() => {
    if (wcOrders.length === 0 && reconciledOrders.length > 0) {
      const seedOrders = extractOutletOrdersFromReconciled(reconciledOrders);
      if (seedOrders.length > 0) {
        setWcOrders(seedOrders);
      }
    }
  }, [reconciledOrders, wcOrders.length, extractOutletOrdersFromReconciled]);

  // Initial mount: Restore instantaneously from localStorage (0ms load), or trigger live pull
  useEffect(() => {
    let hasRestoredFromCache = false;
    try {
      const cachedRaw = localStorage.getItem(POS_CACHE_STORAGE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Array.isArray(cached?.orders) && cached.orders.length > 0) {
          setWcOrders(cached.orders);
          setLastCachedTimestamp(cached.timestamp || Date.now());
          setIsFromCache(true);
          if (cached.syncDepth && (cached.syncDepth === '300' || cached.syncDepth === '800' || cached.syncDepth === '1500')) {
            setSyncDepth(cached.syncDepth);
          }
          const timeText = cached.timestamp ? formatTimeAgo(cached.timestamp) : 'recently';
          setSyncStatusMsg(`⚡ Instant 0ms Load: Loaded ${cached.orders.length} POS orders from browser cache (${timeText}).`);
          hasRestoredFromCache = true;
        }
      }
    } catch (e) {
      console.warn('Failed to restore from local cache:', e);
    }

    // Only if there was no cached data, pull live from WooCommerce
    if (!hasRestoredFromCache) {
      handlePullFromWooCommerce(100, SYNC_DEPTH_CONFIG[syncDepth].pages, syncDepth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local Date Range Scope Analysis & Boundaries
  const { dateBounds, dateCounts, dateSubLabel } = useMemo(() => {
    const timestamps: number[] = [];
    for (const o of wcOrders) {
      const d = parseOrderDate(o.dateCreated);
      if (d) timestamps.push(d.getTime());
    }

    const nowMs = Date.now();
    const anchorMs = timestamps.length > 0 ? Math.max(...timestamps) : nowMs;
    const minMs = timestamps.length > 0 ? Math.min(...timestamps) : anchorMs;
    const maxMs = anchorMs;

    const startOfTodayMs = new Date(anchorMs).setHours(0, 0, 0, 0);
    const endOfTodayMs = startOfTodayMs + 86400000;

    const last7dStart = anchorMs - 7 * 86400000;
    const last30dStart = anchorMs - 30 * 86400000;
    const last90dStart = anchorMs - 90 * 86400000;

    const anchorDate = new Date(anchorMs);
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1).getTime();
    const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1).getTime();

    let todayCount = 0;
    let last7dCount = 0;
    let last30dCount = 0;
    let monthCount = 0;
    let last90dCount = 0;
    let customCount = 0;

    let customStartMs = 0;
    let customEndMs = Infinity;
    if (customRange?.startDate) {
      customStartMs = new Date(customRange.startDate).setHours(0, 0, 0, 0);
    }
    if (customRange?.endDate) {
      customEndMs = new Date(customRange.endDate).setHours(23, 59, 59, 999);
    }

    for (const o of wcOrders) {
      const d = parseOrderDate(o.dateCreated);
      const ms = d ? d.getTime() : anchorMs;
      if (ms >= startOfTodayMs && ms < endOfTodayMs) todayCount++;
      if (ms >= last7dStart && ms <= anchorMs + 86400000) last7dCount++;
      if (ms >= last30dStart && ms <= anchorMs + 86400000) last30dCount++;
      if (ms >= monthStart && ms < monthEnd) monthCount++;
      if (ms >= last90dStart && ms <= anchorMs + 86400000) last90dCount++;
      if (ms >= customStartMs && ms <= customEndMs) customCount++;
    }

    let activeStartMs = 0;
    let activeEndMs = Infinity;
    let subLabel = '';

    if (dateScope === 'today') {
      activeStartMs = startOfTodayMs;
      activeEndMs = endOfTodayMs;
      subLabel = new Date(anchorMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } else if (dateScope === '7d') {
      activeStartMs = last7dStart;
      activeEndMs = anchorMs + 86400000;
      subLabel = `${new Date(last7dStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(anchorMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    } else if (dateScope === '30d') {
      activeStartMs = last30dStart;
      activeEndMs = anchorMs + 86400000;
      subLabel = `${new Date(last30dStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(anchorMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    } else if (dateScope === 'month') {
      activeStartMs = monthStart;
      activeEndMs = monthEnd;
      subLabel = new Date(anchorMs).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } else if (dateScope === '90d') {
      activeStartMs = last90dStart;
      activeEndMs = anchorMs + 86400000;
      subLabel = `${new Date(last90dStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(anchorMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    } else if (dateScope === 'custom' && customRange?.startDate && customRange?.endDate) {
      activeStartMs = customStartMs;
      activeEndMs = customEndMs;
      subLabel = `${customRange.startDate} – ${customRange.endDate}`;
    } else {
      subLabel = timestamps.length > 0
        ? `${new Date(minMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(maxMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : 'All Physical Records';
    }

    return {
      dateBounds: {
        startMs: activeStartMs,
        endMs: activeEndMs,
        minDateIso: timestamps.length > 0 ? new Date(minMs).toISOString().slice(0, 10) : undefined,
        maxDateIso: timestamps.length > 0 ? new Date(maxMs).toISOString().slice(0, 10) : undefined
      },
      dateCounts: {
        all: wcOrders.length,
        today: todayCount,
        '7d': last7dCount,
        '30d': last30dCount,
        month: monthCount,
        '90d': last90dCount,
        custom: customCount
      },
      dateSubLabel: subLabel
    };
  }, [wcOrders, dateScope, customRange]);

  // Date-filtered orders
  const dateFilteredOrders = useMemo(() => {
    if (dateScope === 'all') return wcOrders;
    return wcOrders.filter(o => {
      const d = parseOrderDate(o.dateCreated);
      if (!d) return true;
      const ms = d.getTime();
      return ms >= dateBounds.startMs && ms <= dateBounds.endMs;
    });
  }, [wcOrders, dateScope, dateBounds]);

  // Compute Outlet Sales Aggregates across the 4 Retail Branches
  const { outletMetrics, aggregateTotals, paymentMethodTotals, topBranch } = useMemo(() => {
    const outletMap = new Map<string, OutletSalesMetric>();

    PHYSICAL_OUTLETS.forEach(c => {
      outletMap.set(c.name, {
        id: c.id,
        name: c.name,
        channelType: c.channelType,
        badgeColor: c.badgeColor,
        dotColor: c.dotColor,
        ordersCount: 0,
        unitsSold: 0,
        grossSales: 0,
        discounts: 0,
        netSales: 0,
        aov: 0,
        revenueShare: 0
      });
    });

    const paymentMap = new Map<string, { count: number; total: number }>();
    let totalSales = 0;
    let totalOrders = 0;
    let totalUnits = 0;
    let totalDiscounts = 0;

    dateFilteredOrders.forEach(o => {
      totalSales += o.total;
      totalOrders++;
      totalUnits += o.itemsCount;
      totalDiscounts += o.discounts;

      // Group into canonical outlet
      const targetName = outletMap.has(o.outletName) ? o.outletName : 'Mirpur Outlet POS';
      const m = outletMap.get(targetName)!;
      m.ordersCount++;
      m.unitsSold += o.itemsCount;
      m.grossSales += (o.total + o.discounts);
      m.discounts += o.discounts;
      m.netSales += o.total;

      // Payment method grouping
      const pKey = o.paymentMethodTitle || o.paymentMethod || 'Cash Register';
      if (!paymentMap.has(pKey)) {
        paymentMap.set(pKey, { count: 0, total: 0 });
      }
      const p = paymentMap.get(pKey)!;
      p.count++;
      p.total += o.total;
    });

    const metricsList: OutletSalesMetric[] = Array.from(outletMap.values()).map(m => {
      const aov = m.ordersCount > 0 ? Math.round(m.netSales / m.ordersCount) : 0;
      const revenueShare = totalSales > 0 ? (m.netSales / totalSales) * 100 : 0;
      return {
        ...m,
        aov,
        revenueShare
      };
    });

    // Sort by net sales descending
    metricsList.sort((a, b) => b.netSales - a.netSales);

    const paymentList = Array.from(paymentMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      total: Math.round(data.total),
      pct: totalSales > 0 ? (data.total / totalSales) * 100 : 0
    })).sort((a, b) => b.total - a.total);

    const overallAov = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const topBranchLeader = metricsList[0]?.ordersCount > 0 ? metricsList[0] : null;

    return {
      outletMetrics: metricsList,
      aggregateTotals: {
        totalSales: Math.round(totalSales),
        totalOrders,
        totalUnits,
        totalDiscounts: Math.round(totalDiscounts),
        overallAov
      },
      paymentMethodTotals: paymentList,
      topBranch: topBranchLeader
    };
  }, [dateFilteredOrders]);

  // ============================================================================
  // CATEGORY-WISE SALES BREAKDOWN (Just like the Main Executive Overview page)
  // ============================================================================
  const categorySales = useMemo(() => {
    const groups: Record<string, {
      name: string;
      sub: string;
      icon: string;
      unitsSold: number;
      revenue: number;
      ordersCount: number;
      branchSales: Record<string, number>;
    }> = {
      'Jeans': { name: 'Jeans', sub: 'Slim & Regular Fit Jeans', icon: '👖', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'Casual & Formal Shirts': { name: 'Casual & Formal Shirts', sub: 'Full Sleeve, Half Sleeve, Cuban & Formal Shirts', icon: '👔', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'Polo Shirts': { name: 'Polo Shirts', sub: 'Classic Pique, Solid & Knitted Polos', icon: '👕', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'T-Shirts': { name: 'T-Shirts', sub: 'Solid, Printed & Heavyweight GSM Tees', icon: '👕', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'Twill Pants & Chinos': { name: 'Twill Pants & Chinos', sub: 'Urban Slim Comfort Chinos, Trousers & Cargo', icon: '👖', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'Jackets': { name: 'Jackets', sub: 'Denim Jackets & Outerwear', icon: '🧥', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'Sweatshirts & Hoodies': { name: 'Sweatshirts & Hoodies', sub: 'Hoodies & French-Terry Sweatshirts', icon: '🧥', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} },
      'Apparel & Accessories': { name: 'Apparel & Accessories', sub: 'Boxers, Masks & Core Essentials', icon: '📦', unitsSold: 0, revenue: 0, ordersCount: 0, branchSales: {} }
    };

    let totalCatRevenue = 0;
    let _totalCatUnits = 0;

    dateFilteredOrders.forEach(order => {
      const orderBranch = order.outletName;
      (order.lineItems || []).forEach(it => {
        const cat = classifyProductCategory(it.name, it.sku) || 'Apparel & Accessories';
        const target = groups[cat] || groups['Apparel & Accessories'];
        const lineTotal = it.total || (it.quantity * it.price) || 0;
        target.unitsSold += it.quantity;
        target.revenue += lineTotal;
        target.ordersCount++;
        target.branchSales[orderBranch] = (target.branchSales[orderBranch] || 0) + lineTotal;
        totalCatRevenue += lineTotal;
        _totalCatUnits += it.quantity;
      });
    });

    return Object.values(groups)
      .filter(g => g.unitsSold > 0 || g.revenue > 0)
      .map(g => ({
        ...g,
        asp: g.unitsSold > 0 ? Math.round(g.revenue / g.unitsSold) : 0,
        revenueShare: totalCatRevenue > 0 ? (g.revenue / totalCatRevenue) * 100 : 0,
        topBranchName: Object.entries(g.branchSales).sort((a, b) => b[1] - a[1])[0]?.[0] || 'All Outlets'
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [dateFilteredOrders]);

  // ============================================================================
  // ITEM & MASTER SKU-WISE SALES BREAKDOWN (Just like the Main Executive Overview page)
  // ============================================================================
  const itemWiseSales = useMemo(() => {
    const map = new Map<string, {
      masterSku: string;
      mainName: string;
      category: string;
      unitsSold: number;
      revenue: number;
      ordersCount: number;
      branches: Set<string>;
    }>();

    let totalItemRevenue = 0;

    dateFilteredOrders.forEach(order => {
      (order.lineItems || []).forEach(it => {
        const mSku = extractMasterSku(it.sku);
        const mName = cleanProductMainName(it.name);
        const cat = classifyProductCategory(it.name, it.sku) || 'Apparel & Accessories';
        const lineTotal = it.total || (it.quantity * it.price) || 0;

        if (!map.has(mSku)) {
          map.set(mSku, {
            masterSku: mSku,
            mainName: mName,
            category: cat,
            unitsSold: 0,
            revenue: 0,
            ordersCount: 0,
            branches: new Set()
          });
        }

        const entry = map.get(mSku)!;
        entry.unitsSold += it.quantity;
        entry.revenue += lineTotal;
        entry.ordersCount++;
        entry.branches.add(order.outletName);
        if (mName && mName.length > 3) {
          entry.mainName = mName;
        }
        totalItemRevenue += lineTotal;
      });
    });

    return Array.from(map.values())
      .map(it => ({
        ...it,
        asp: it.unitsSold > 0 ? Math.round(it.revenue / it.unitsSold) : 0,
        revenueShare: totalItemRevenue > 0 ? (it.revenue / totalItemRevenue) * 100 : 0,
        branchesCount: it.branches.size,
        branchesList: Array.from(it.branches).map(b => b.replace(' Branch POS', '').replace(' POS', '')).join(', ')
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [dateFilteredOrders]);

  // Filtered Items for Item-wise table
  const filteredMasterItems = useMemo(() => {
    return itemWiseSales.filter(item => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && item.category !== selectedCategoryFilter) {
        return false;
      }

      // Branch filter
      if (selectedBranchFilter !== 'ALL' && !item.branches.has(selectedBranchFilter)) {
        return false;
      }

      // Search Query filter
      if (itemSearchQuery.trim()) {
        const query = itemSearchQuery.toLowerCase();
        const matchesName = item.mainName.toLowerCase().includes(query);
        const matchesSku = item.masterSku.toLowerCase().includes(query);
        const matchesCat = item.category.toLowerCase().includes(query);
        return matchesName || matchesSku || matchesCat;
      }

      return true;
    });
  }, [itemWiseSales, selectedCategoryFilter, selectedBranchFilter, itemSearchQuery]);

  // Pagination for Item-wise table
  const totalItemPages = Math.max(1, Math.ceil(filteredMasterItems.length / itemPageSize));
  const paginatedMasterItems = useMemo(() => {
    const start = (itemCurrentPage - 1) * itemPageSize;
    return filteredMasterItems.slice(start, start + itemPageSize);
  }, [filteredMasterItems, itemCurrentPage]);

  // Search & table outlet filter for Orders Stream
  const filteredOrders = useMemo(() => {
    const list = dateFilteredOrders.filter(o => {
      if (selectedOutletFilter !== 'ALL' && o.outletName !== selectedOutletFilter) {
        return false;
      }

      if (statusFilter !== 'ALL' && o.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesId = o.orderNumber.toLowerCase().includes(term);
        const matchesCustomer = (getExportCustomerName(o) || o.customerName).toLowerCase().includes(term);
        const matchesPhone = (getExportPhoneNumber(o) || o.phone).includes(term);
        const matchesCity = o.city.toLowerCase().includes(term);
        const matchesItems = o.itemsSummary.toLowerCase().includes(term);
        return matchesId || matchesCustomer || matchesPhone || matchesCity || matchesItems;
      }

      return true;
    });

    return list.sort(compareOrdersByNumber);
  }, [dateFilteredOrders, selectedOutletFilter, statusFilter, searchTerm]);

  // Pagination for Orders Stream
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  // Export to Excel with all 4 comprehensive sheets
  const handleExportSalesExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Outlet Sales Summary
    const summaryData = outletMetrics.map((m, idx) => ({
      'SL': idx + 1,
      'Outlet / Branch': m.name,
      'Channel Type': m.channelType,
      'Orders Pulled': m.ordersCount,
      'Units Sold': m.unitsSold,
      'Gross Sales (BDT)': m.grossSales,
      'Discounts Given (BDT)': m.discounts,
      'Net Sales Revenue (BDT)': m.netSales,
      'Average Order Value (BDT)': m.aov,
      'Revenue Share (%)': m.revenueShare.toFixed(1) + '%'
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Outlet Sales Summary');

    // Sheet 2: Category Wise Sales
    const categoryData = categorySales.map((c, idx) => ({
      'SL': idx + 1,
      'Category': c.name,
      'Sub Category': c.sub,
      'Units Sold (Pcs)': c.unitsSold,
      'Net Revenue (BDT)': c.revenue,
      'Unit ASP (BDT)': c.asp,
      'Revenue Share (%)': c.revenueShare.toFixed(1) + '%',
      'Top Performing Branch': c.topBranchName
    }));
    const wsCategory = XLSX.utils.json_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, wsCategory, 'Category Wise Sales');

    // Sheet 3: Item Wise Sales
    const itemData = itemWiseSales.map((item, idx) => ({
      'SL': idx + 1,
      'Master SKU': item.masterSku,
      'Product Name': item.mainName,
      'Category': item.category,
      'Units Sold (Pcs)': item.unitsSold,
      'Net Revenue (BDT)': item.revenue,
      'Unit ASP (BDT)': item.asp,
      'Revenue Share (%)': item.revenueShare.toFixed(1) + '%',
      'Branches Active': item.branchesList
    }));
    const wsItem = XLSX.utils.json_to_sheet(itemData);
    XLSX.utils.book_append_sheet(wb, wsItem, 'Item Wise Sales');

    // Sheet 4: In-Store POS Orders Stream (Sorted by Order Number)
    const sortedOrders = [...filteredOrders].sort(compareOrdersByNumber);
    const ordersData = sortedOrders.map(o => ({
      'WooCommerce Order #': o.orderNumber,
      'Outlet Branch': o.outletName,
      'Order Date': o.dateCreated ? o.dateCreated.slice(0, 19).replace('T', ' ') : '',
      'Customer Name': getExportCustomerName(o),
      'Phone': getExportPhoneNumber(o),
      'City': o.city,
      'Items Count': o.itemsCount,
      'Items Summary': o.itemsSummary,
      'Total Amount (BDT)': o.total,
      'Status': o.status,
      'Payment Method': o.paymentMethodTitle
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'POS Orders Stream');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `DEEN_Branch_Outlet_Sales_Report_${dateScope}_${dateStamp}.xlsx`;

    try {
      XLSX.writeFile(wb, filename);
    } catch {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 60000);
    }
  };

  // Computed values for Enhanced Interactive KPI Cards
  const kpiStats = useMemo(() => {
    const grossSales = aggregateTotals.totalSales + aggregateTotals.totalDiscounts;
    const realizationRate = grossSales > 0 
      ? Math.min(100, Math.round((aggregateTotals.totalSales / grossSales) * 100)) 
      : 100;
    const avgUnitsPerOrder = aggregateTotals.totalOrders > 0 
      ? (aggregateTotals.totalUnits / aggregateTotals.totalOrders).toFixed(1) 
      : '0.0';
    const unitAsp = aggregateTotals.totalUnits > 0 
      ? Math.round(aggregateTotals.totalSales / aggregateTotals.totalUnits) 
      : 0;

    const cashEntry = paymentMethodTotals.find(p => p.method.toLowerCase().includes('cash') || p.method.toLowerCase().includes('register'));
    const cashPct = cashEntry ? Math.round(cashEntry.pct) : (paymentMethodTotals[0] ? Math.round(paymentMethodTotals[0].pct) : 80);

    const topCategoryName = categorySales[0]?.name || 'Apparel';
    const topBranchName = topBranch ? topBranch.name.replace(' Branch POS', '').replace(' POS', '') : 'N/A';
    const topBranchShare = topBranch ? topBranch.revenueShare.toFixed(1) : '0';

    return {
      grossSales,
      realizationRate,
      avgUnitsPerOrder,
      unitAsp,
      cashPct,
      topCategoryName,
      topBranchName,
      topBranchShare
    };
  }, [aggregateTotals, paymentMethodTotals, categorySales, topBranch]);

  const donutColors = ['#a855f7', '#0ea5e9', '#10b981', '#f59e0b', '#6366f1'];

  return (
    <div className="space-y-6">
      {/* Top Banner, Local Date Range Selector & WooCommerce Sync Bar */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-6 border border-slate-200 dark:border-deepBlack-border shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 font-headline">
                  Outlet Sales & POS Revenue Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                  Retail Branch POS Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                In-store POS register transactions across physical branches (Mirpur, Wari, Cumilla, and Sylhet). Online website orders are excluded.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Local Date Selector, Pull Button, View Toggle, Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Local Date Range Selector */}
          <DateRangeSelector
            activeScope={dateScope}
            customRange={customRange}
            onScopeChange={(newScope, newRange) => {
              setDateScope(newScope);
              setCustomRange(newRange);
              setCurrentPage(1);
              setItemCurrentPage(1);
            }}
            counts={dateCounts}
            subLabel={dateSubLabel}
            minDateIso={dateBounds.minDateIso}
            maxDateIso={dateBounds.maxDateIso}
            align="right"
          />

          {/* 2. Sync Depth & Live Sync Control Group */}
          <div className="flex items-center rounded-xl bg-slate-100/90 dark:bg-deepBlack-sidebar p-1 border border-slate-200/80 dark:border-deepBlack-border shadow-2xs">
            {/* Sync Depth Picker */}
            <div className="flex items-center gap-1 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300 font-semibold border-r border-slate-200 dark:border-deepBlack-border mr-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold hidden sm:inline">Depth:</span>
              <select
                value={syncDepth}
                onChange={(e) => setSyncDepth(e.target.value as SyncDepth)}
                disabled={isLoading}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-1"
                title="Select scan depth for WooCommerce order synchronization"
              >
                <option value="300" className="dark:bg-deepBlack-card dark:text-slate-100">Quick (300)</option>
                <option value="800" className="dark:bg-deepBlack-card dark:text-slate-100">Standard (800)</option>
                <option value="1500" className="dark:bg-deepBlack-card dark:text-slate-100">Deep (1,500)</option>
              </select>
            </div>

            {/* Live Pull / Sync Button */}
            <button
              onClick={() => handlePullFromWooCommerce(100, SYNC_DEPTH_CONFIG[syncDepth].pages, syncDepth)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 cursor-pointer"
              title={`Fetch latest ${SYNC_DEPTH_CONFIG[syncDepth].label} from deencommerce.com via WooCommerce REST API`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Syncing...' : 'Sync Live'}</span>
            </button>
          </div>

          {/* 3. Cache Status Pill & Clear Cache */}
          {lastCachedTimestamp && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs">
              <span className="flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Cached {formatTimeAgo(lastCachedTimestamp)}
              </span>
              <button
                onClick={handleClearCache}
                title="Clear local browser cache"
                className="ml-1 text-purple-400 hover:text-purple-900 dark:hover:text-purple-200 transition-colors cursor-pointer p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 4. Export .XLSX Button */}
          <button
            onClick={handleExportSalesExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs active:scale-95 bg-white dark:bg-deepBlack-card text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/40 hover:border-emerald-300 cursor-pointer"
            title="Export outlet sales report to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export .XLSX</span>
          </button>
        </div>
      </div>

      {/* Sync Status Feedback Banner with Instant Cache Badge */}
      {syncStatusMsg && (
        <div className={`p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs transition-all ${
          isFromCache 
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-300'
            : 'bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-purple-950 dark:text-purple-300'
        }`}>
          <div className="flex items-center gap-2">
            {isFromCache ? (
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
            )}
            <span className="font-medium">{syncStatusMsg}</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {isFromCache && (
              <button
                onClick={() => handlePullFromWooCommerce(100, SYNC_DEPTH_CONFIG[syncDepth].pages, syncDepth)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 bg-emerald-100/80 dark:bg-emerald-900/60 hover:bg-emerald-200/80 dark:hover:bg-emerald-900 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Force Fresh Pull
              </button>
            )}
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
              isFromCache ? 'bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' : 'bg-purple-100/70 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
            }`}>
              {dateFilteredOrders.length} orders in active scope
            </span>
          </div>
        </div>
      )}

      {/* 5 High-Impact Retail Outlet Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-4.5 xl:gap-5">
        {/* KPI 1: Total Physical Outlet Net Sales (Interactive -> Branch Summary) */}
        <div
          onClick={() => {
            setSelectedOutletFilter('ALL');
            setSelectedBranchFilter('ALL');
            setActiveViewMode('SUMMARY');
          }}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden active:scale-[0.99]"
          title="Click to view all branch metrics in Branch Summary"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <ShoppingBag className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">Total Net Sales</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 inline-block mt-0.5">
                  {kpiStats.realizationRate}% Realized
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-sidebar flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 transition-all shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3 space-y-1.5">
            <div className="text-2xl sm:text-[26px] xl:text-[28px] font-black text-emerald-600 dark:text-emerald-400 font-headline tracking-tight">
              ৳ {aggregateTotals.totalSales.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
              <span>Gross: <strong className="text-slate-800 dark:text-slate-200 font-semibold">৳ {kpiStats.grossSales.toLocaleString()}</strong></span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-deepBlack-sidebar px-1.5 py-0.5 rounded">0 Courier Risk</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Discounts Saved:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">৳ {aggregateTotals.totalDiscounts.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 2: Total POS Orders Pulled (Interactive -> POS Orders Stream) */}
        <div
          onClick={() => setActiveViewMode('ORDERS')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden active:scale-[0.99]"
          title="Click to view full real-time POS Orders Stream"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <PackageCheck className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">POS Orders</span>
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/40 inline-block mt-0.5">
                  Walk-in Checkouts
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-sidebar flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/40 transition-all shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3 space-y-2">
            <div className="text-2xl sm:text-[26px] xl:text-[28px] font-black text-slate-900 dark:text-slate-100 font-headline tracking-tight">
              {aggregateTotals.totalOrders.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1.5">Orders</span>
            </div>
            {/* 4 Branch Dot Distribution */}
            <div className="flex items-center gap-2.5 pt-0.5">
              {outletMetrics.map((m) => (
                <div 
                  key={m.id} 
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium"
                  title={`${m.name}: ${m.ordersCount} orders`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.dotColor }}></span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{m.ordersCount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Store Network:</span>
            <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
              <span>4 Branches Active</span>
              <span className="text-purple-400 font-normal">→</span>
            </span>
          </div>
        </div>

        {/* KPI 3: Total Garments / Items Sold (Interactive -> Item/SKU Sales) */}
        <div
          onClick={() => setActiveViewMode('ITEM')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden active:scale-[0.99]"
          title="Click to view Item & SKU Wise Sales Breakdown"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800/40 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <Shirt className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">Units Sold</span>
                <span className="text-[10px] text-sky-700 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full border border-sky-200/60 dark:border-sky-800/40 inline-block mt-0.5">
                  Physical Pcs
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-sidebar flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:bg-sky-50 dark:group-hover:bg-sky-950/40 transition-all shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3 space-y-1.5">
            <div className="text-2xl sm:text-[26px] xl:text-[28px] font-black text-sky-600 dark:text-sky-400 font-headline tracking-tight">
              {aggregateTotals.totalUnits.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1.5">Pcs</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
              <span>ASP: <strong className="text-slate-800 dark:text-slate-200 font-semibold">৳ {kpiStats.unitAsp.toLocaleString()}</strong></span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{kpiStats.avgUnitsPerOrder} pcs/ord</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Active Master SKUs:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>{itemWiseSales.length} items</span>
              <span className="text-sky-500 font-normal">→</span>
            </span>
          </div>
        </div>

        {/* KPI 4: Average Order Value (Interactive -> Category Sales) */}
        <div
          onClick={() => setActiveViewMode('CATEGORY')}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden active:scale-[0.99]"
          title="Click to view Category Sales & Product Drivers"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">Outlet AOV</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40 inline-block mt-0.5">
                  Basket Value
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-sidebar flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/40 transition-all shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3 space-y-1.5">
            <div className="text-2xl sm:text-[26px] xl:text-[28px] font-black text-amber-600 dark:text-amber-400 font-headline tracking-tight">
              ৳ {aggregateTotals.overallAov.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
              <span className="truncate max-w-[120px]">Top: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{kpiStats.topCategoryName}</strong></span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                {kpiStats.cashPct}% Cash
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Basket Quality:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <span>{parseFloat(kpiStats.avgUnitsPerOrder) >= 1.5 ? 'High Density' : 'Healthy'}</span>
              <span className="text-amber-500 font-normal">→</span>
            </span>
          </div>
        </div>

        {/* KPI 5: Top Performing Retail Outlet (Interactive -> Filter to Branch) */}
        <div
          onClick={() => {
            if (topBranch) {
              const bName = topBranch.name;
              setSelectedOutletFilter(bName);
              setSelectedBranchFilter(bName);
              setActiveViewMode('SUMMARY');
            }
          }}
          className="bg-white dark:bg-deepBlack-card rounded-2xl p-5 sm:p-5.5 xl:p-6 border border-slate-200/90 dark:border-deepBlack-border shadow-sm hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden active:scale-[0.99]"
          title={topBranch ? `Click to filter dashboard to ${topBranch.name}` : 'Awaiting data'}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                <Award className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block truncate">Top Branch</span>
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/40 inline-block mt-0.5">
                  {kpiStats.topBranchShare}% Share
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-deepBlack-sidebar flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/40 transition-all shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-3 space-y-1.5">
            <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-400 font-headline truncate" title={topBranch?.name || 'All Outlets'}>
              {kpiStats.topBranchName}
            </div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-0.5">
              <span>৳ {topBranch ? topBranch.netSales.toLocaleString() : 0}</span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{topBranch?.ordersCount || 0} orders</span>
            </div>
            {/* Visual Revenue Share Bar */}
            <div className="w-full bg-slate-100 dark:bg-deepBlack-sidebar rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="h-full bg-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, parseFloat(kpiStats.topBranchShare)))}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-deepBlack-border flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Branch Action:</span>
            <span className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1 group-hover:underline">
              <span>Filter Branch</span>
              <span className="text-purple-400 font-normal">⚡</span>
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts: Branch Revenue Breakdown & Payment Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Retail Branch POS Revenue Comparison (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-deepBlack-card rounded-2xl p-6 border border-slate-200 dark:border-deepBlack-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-headline">
                  <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Branch POS Sales Revenue Breakdown (BDT)
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                  Comparison across Mirpur, Wari, Cumilla, and Sylhet physical store registers ({dateSubLabel})
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                Sorted by Revenue
              </span>
            </div>

            {/* Visual Bar Comparison for 4 Outlets */}
            <div className="space-y-4 pt-2">
              {outletMetrics.map((m) => {
                const maxSales = Math.max(...outletMetrics.map(x => x.netSales), 1);
                const barPct = (m.netSales / maxSales) * 100;

                return (
                  <div key={m.id} className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-deepBlack-sidebar border border-slate-100 dark:border-deepBlack-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{m.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.badgeColor}`}>
                          Branch ID: {m.id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {m.ordersCount} orders • <span className="font-bold text-slate-800 dark:text-slate-200">{m.unitsSold} pcs</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex-1 bg-slate-200/80 dark:bg-deepBlack-border rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(barPct, 2)}%`,
                            backgroundColor: m.dotColor
                          }}
                        ></div>
                      </div>
                      <span className="w-24 text-right font-bold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                        ৳ {m.netSales.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>AOV: ৳{m.aov.toLocaleString()}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">Share: {m.revenueShare.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: In-Store Payment Method Mix (1 Col) */}
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl p-6 border border-slate-200 dark:border-deepBlack-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-headline">
                <CreditCard className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                In-Store Payment Mix
              </h3>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">By BDT Volume</span>
            </div>

            {/* Payment Method Progress Breakdown */}
            <div className="py-2 space-y-3.5">
              {paymentMethodTotals.slice(0, 5).map((pm, i) => (
                <div key={pm.method} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{pm.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{pm.count} orders</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded text-[11px]">
                        ৳ {pm.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-deepBlack-sidebar rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pm.pct, 2)}%`,
                        backgroundColor: donutColors[i % donutColors.length]
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* In-Store Outlet Overview Footer */}
            <div className="mt-5 p-3.5 bg-slate-50/80 dark:bg-deepBlack-sidebar rounded-xl border border-slate-100 dark:border-deepBlack-border text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Active Outlets:
                </span>
                <span className="text-purple-700 dark:text-purple-400">Mirpur, Wari, Cumilla, Sylhet</span>
              </div>
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>Total In-Store Units:</span>
                <span className="text-emerald-700 dark:text-emerald-400">{aggregateTotals.totalUnits.toLocaleString()} pcs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4-WAY PERFORMANCE MATRIX NAVIGATION TABS                                   */}
      {/* (Branch Summary | Category Sales | Item & SKU Sales | POS Orders Stream)   */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Branch Matrix */}
          <button
            onClick={() => setActiveViewMode('SUMMARY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeViewMode === 'SUMMARY'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-deepBlack-hover border border-slate-200/60 dark:border-deepBlack-border'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Branch Summary</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeViewMode === 'SUMMARY' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-deepBlack-border text-slate-700 dark:text-slate-300'
            }`}>
              4 Branches
            </span>
          </button>

          {/* 2. Category Sales (Just like main page) */}
          <button
            onClick={() => setActiveViewMode('CATEGORY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeViewMode === 'CATEGORY'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-deepBlack-hover border border-slate-200/60 dark:border-deepBlack-border'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Category Wise Sales</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeViewMode === 'CATEGORY' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-deepBlack-border text-slate-700 dark:text-slate-300'
            }`}>
              {categorySales.length}
            </span>
          </button>

          {/* 3. Item & SKU Wise Sales (Just like main page) */}
          <button
            onClick={() => setActiveViewMode('ITEM')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeViewMode === 'ITEM'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-deepBlack-hover border border-slate-200/60 dark:border-deepBlack-border'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>Item & SKU Wise Sales</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeViewMode === 'ITEM' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-deepBlack-border text-slate-700 dark:text-slate-300'
            }`}>
              {itemWiseSales.length}
            </span>
          </button>

          {/* 4. POS Orders Stream */}
          <button
            onClick={() => setActiveViewMode('ORDERS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeViewMode === 'ORDERS'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-deepBlack-sidebar text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-deepBlack-hover border border-slate-200/60 dark:border-deepBlack-border'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>POS Orders Stream</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeViewMode === 'ORDERS' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-deepBlack-border text-slate-700 dark:text-slate-300'
            }`}>
              {dateFilteredOrders.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Date Scope: <span className="font-bold text-slate-800 dark:text-slate-200">{dateSubLabel}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: OUTLET SALES SUMMARY MATRIX TABLE                                  */}
      {/* ========================================================================= */}
      {activeViewMode === 'SUMMARY' && (
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-deepBlack-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-headline">
                <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Physical Outlet Sales Matrix
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                Consolidated in-store register performance across Mirpur, Wari, Cumilla, and Sylhet ({dateSubLabel})
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {aggregateTotals.totalOrders.toLocaleString()} total POS orders analyzed
            </div>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 dark:bg-deepBlack-sidebar text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border">
                <tr>
                  <th className="py-3 px-4">Outlet / Branch</th>
                  <th className="py-3 px-3">Branch Channel</th>
                  <th className="py-3 px-3 text-right">Orders Pulled</th>
                  <th className="py-3 px-3 text-right">Units Sold</th>
                  <th className="py-3 px-3 text-right">Gross Sales (BDT)</th>
                  <th className="py-3 px-3 text-right">Discounts (BDT)</th>
                  <th className="py-3 px-3 text-right">Net Sales (BDT)</th>
                  <th className="py-3 px-3 text-right">AOV (BDT)</th>
                  <th className="py-3 px-4 text-center">Revenue Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-800 dark:text-slate-200">
                {outletMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-2xs"
                          style={{ backgroundColor: m.dotColor }}
                        >
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{m.name}</div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Branch Register ID: {m.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${m.badgeColor}`}>
                        {m.channelType}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {m.ordersCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                      {m.unitsSold.toLocaleString()} pcs
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      ৳ {m.grossSales.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right text-amber-600 dark:text-amber-400">
                      ৳ {m.discounts.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ৳ {m.netSales.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                      ৳ {m.aov.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-black text-slate-900 dark:text-slate-100">{m.revenueShare.toFixed(1)}%</span>
                        <div className="w-16 bg-slate-100 dark:bg-deepBlack-sidebar rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(m.revenueShare, 100)}%`,
                              backgroundColor: m.dotColor
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-deepBlack-sidebar font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-200 dark:border-deepBlack-border">
                <tr>
                  <td className="py-3 px-4 font-black" colSpan={2}>
                    Total Physical Outlet Sales (4 Branches)
                  </td>
                  <td className="py-3 px-3 text-right text-purple-700 dark:text-purple-400">
                    {aggregateTotals.totalOrders.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {aggregateTotals.totalUnits.toLocaleString()} pcs
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                    ৳ {(aggregateTotals.totalSales + aggregateTotals.totalDiscounts).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">
                    ৳ {aggregateTotals.totalDiscounts.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                    ৳ {aggregateTotals.totalSales.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-800 dark:text-slate-200">
                    ৳ {aggregateTotals.overallAov.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-700 dark:text-emerald-400">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CATEGORY-WISE SALES BREAKDOWN (Just like the Main Page)            */}
      {/* ========================================================================= */}
      {activeViewMode === 'CATEGORY' && (
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-deepBlack-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-headline">
                <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Category Wise Outlet POS Sales
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                Breakdown of in-store garment sales by apparel product line across physical branch outlets ({dateSubLabel})
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {categorySales.length} categories active
            </div>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 dark:bg-deepBlack-sidebar text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border">
                <tr>
                  <th className="py-3.5 px-5">Apparel Category</th>
                  <th className="py-3.5 px-4">Top Selling Branch</th>
                  <th className="py-3.5 px-4 text-right">Units Sold</th>
                  <th className="py-3.5 px-4 text-right">Avg Unit Price (ASP)</th>
                  <th className="py-3.5 px-4 text-right">Revenue Share</th>
                  <th className="py-3.5 px-5 text-right">Net POS Revenue (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-800 dark:text-slate-200">
                {categorySales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                      No category sales data recorded in the active date range.
                    </td>
                  </tr>
                ) : (
                  categorySales.map((c) => (
                    <tr key={c.name} className="hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <span className="text-xl p-1.5 bg-slate-50 dark:bg-deepBlack-sidebar rounded-lg border border-slate-200/80 dark:border-deepBlack-border shadow-2xs">
                            {c.icon}
                          </span>
                          <div>
                            <div className="font-headline font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-400 font-normal mt-0.5 max-w-xs">
                              {c.sub}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                          {c.topBranchName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-headline font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {c.unitsSold.toLocaleString()} <span className="text-slate-400 dark:text-slate-500 font-normal">pcs</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">
                        ৳ {c.asp.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {c.revenueShare.toFixed(1)}%
                          </span>
                          <div className="w-20 bg-slate-100 dark:bg-deepBlack-sidebar rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-purple-600 rounded-full"
                              style={{ width: `${Math.min(c.revenueShare, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-headline font-black text-emerald-600 dark:text-emerald-400 text-xs">
                        ৳ {c.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-deepBlack-sidebar font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-200 dark:border-deepBlack-border">
                <tr>
                  <td className="py-3 px-5 font-black" colSpan={2}>
                    Total Category Sales
                  </td>
                  <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-black">
                    {categorySales.reduce((acc, c) => acc + c.unitsSold, 0).toLocaleString()} pcs
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                    ৳ {categorySales.length > 0
                      ? Math.round(categorySales.reduce((acc, c) => acc + c.revenue, 0) / Math.max(1, categorySales.reduce((acc, c) => acc + c.unitsSold, 0))).toLocaleString()
                      : 0}
                  </td>
                  <td className="py-3 px-4 text-right text-purple-700 dark:text-purple-400 font-bold">
                    100.0%
                  </td>
                  <td className="py-3 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    ৳ {categorySales.reduce((acc, c) => acc + c.revenue, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ITEM & MASTER SKU-WISE SALES BREAKDOWN (Just like the Main Page)   */}
      {/* ========================================================================= */}
      {activeViewMode === 'ITEM' && (
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
          {/* Filter Toolbar for Master Items */}
          <div className="p-4 border-b border-slate-200 dark:border-deepBlack-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Category:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value);
                    setItemCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-deepBlack-canvas border border-slate-200 dark:border-deepBlack-border rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="ALL">All Categories ({itemWiseSales.length} items)</option>
                  {categorySales.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Branch:</span>
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => {
                    setSelectedBranchFilter(e.target.value);
                    setItemCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-deepBlack-canvas border border-slate-200 dark:border-deepBlack-border rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="ALL">All Physical Branches</option>
                  {PHYSICAL_OUTLETS.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={itemSearchQuery}
                onChange={(e) => {
                  setItemSearchQuery(e.target.value);
                  setItemCurrentPage(1);
                }}
                placeholder="Search Item Name, Master SKU, or Category..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-deepBlack-canvas border border-slate-200 dark:border-deepBlack-border rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 placeholder:dark:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 dark:bg-deepBlack-sidebar text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border">
                <tr>
                  <th className="py-3 px-4">Item Name / Master SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Branches Sold In</th>
                  <th className="py-3 px-3 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Unit ASP (BDT)</th>
                  <th className="py-3 px-4 text-right">Revenue Share</th>
                  <th className="py-3 px-4 text-right">Total Net Revenue (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-800 dark:text-slate-200">
                {paginatedMasterItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500 font-semibold">
                      No master garment items match the active search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedMasterItems.map((item, idx) => (
                    <tr key={item.masterSku || idx} className="hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors">
                      {/* Product Name with Master SKU underneath */}
                      <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                        <span className="font-headline font-bold text-slate-900 dark:text-slate-100 block truncate" title={item.mainName}>
                          {item.mainName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/50 shadow-2xs">
                            {item.masterSku}
                          </span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-deepBlack-sidebar border border-slate-200/60 dark:border-deepBlack-border">
                          {item.category}
                        </span>
                      </td>

                      {/* Branches Sold In */}
                      <td className="py-3 px-3 max-w-[160px] truncate" title={item.branchesList}>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                          {item.branchesList || 'In-Store Register'}
                        </span>
                      </td>

                      {/* Units Sold */}
                      <td className="py-3 px-3 text-right font-headline font-bold text-slate-900 dark:text-slate-100">
                        {item.unitsSold.toLocaleString()} <span className="text-slate-400 dark:text-slate-500 font-normal">pcs</span>
                      </td>

                      {/* Unit ASP */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        ৳ {item.asp.toLocaleString()}
                      </td>

                      {/* Revenue Share */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {item.revenueShare.toFixed(1)}%
                          </span>
                          <div className="w-16 bg-slate-100 dark:bg-deepBlack-sidebar rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-purple-600 rounded-full"
                              style={{ width: `${Math.min(item.revenueShare, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Total Net Revenue */}
                      <td className="py-3 px-4 text-right font-headline font-black text-emerald-600 dark:text-emerald-400">
                        ৳ {item.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Master Items */}
          <div className="p-3 border-t border-slate-200 dark:border-deepBlack-border bg-slate-50/70 dark:bg-deepBlack-sidebar flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing {filteredMasterItems.length > 0 ? (itemCurrentPage - 1) * itemPageSize + 1 : 0} to{' '}
              {Math.min(itemCurrentPage * itemPageSize, filteredMasterItems.length)} of {filteredMasterItems.length.toLocaleString()} master styles
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setItemCurrentPage(p => Math.max(1, p - 1))}
                disabled={itemCurrentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                Page {itemCurrentPage} of {totalItemPages}
              </span>
              <button
                onClick={() => setItemCurrentPage(p => Math.min(totalItemPages, p + 1))}
                disabled={itemCurrentPage === totalItemPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: LIVE IN-STORE POS ORDERS STREAM TABLE                              */}
      {/* ========================================================================= */}
      {activeViewMode === 'ORDERS' && (
        <div className="bg-white dark:bg-deepBlack-card rounded-2xl border border-slate-200 dark:border-deepBlack-border shadow-sm overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-deepBlack-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Outlet Selector Dropdown (Physical Outlets Only) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Branch:</span>
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => {
                    setSelectedOutletFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-deepBlack-canvas border border-slate-200 dark:border-deepBlack-border rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="ALL">All Branches ({dateFilteredOrders.length} orders)</option>
                  {PHYSICAL_OUTLETS.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-deepBlack-canvas border border-slate-200 dark:border-deepBlack-border rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="on-hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Order #, customer, phone, items..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-deepBlack-canvas border border-slate-200 dark:border-deepBlack-border rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 placeholder:dark:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 dark:bg-deepBlack-sidebar text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-deepBlack-border">
                <tr>
                  <th className="py-3 px-4">Order # & Timestamp</th>
                  <th className="py-3 px-3">Branch Location</th>
                  <th className="py-3 px-3">Customer Info</th>
                  <th className="py-3 px-3">Items Ordered</th>
                  <th className="py-3 px-3 text-right">Order Total</th>
                  <th className="py-3 px-3 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-deepBlack-border font-medium text-slate-800 dark:text-slate-200">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No outlet POS orders matched the active branch and date filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-deepBlack-hover transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                            #{o.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            {o.dateCreated ? o.dateCreated.slice(0, 16).replace('T', ' ') : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{o.outletName}</div>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                          In-Store POS
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{getExportCustomerName(o) || o.customerName}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">{o.city} {getExportPhoneNumber(o) || o.phone ? `• ${getExportPhoneNumber(o) || o.phone}` : ''}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs">{o.itemsSummary}</div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{o.itemsCount} total units</span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                        ৳ {o.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-deepBlack-sidebar text-slate-700 dark:text-slate-300">
                          {o.paymentMethodTitle}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          o.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                            : o.status === 'processing'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-200 dark:border-deepBlack-border bg-slate-50/70 dark:bg-deepBlack-sidebar flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length.toLocaleString()} POS orders
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-deepBlack-border bg-white dark:bg-deepBlack-card hover:bg-slate-50 dark:hover:bg-deepBlack-hover text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
