import { RawOrderRow, DatasetSnapshot } from '@/types';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows, testWooCommerceConnection, WcCredentials, cleanCustomerPhone, isEcomPaymentMethod } from '@/lib/woocommerceClient';
import { batchFetchPathaoOrders, batchFetchPathaoOrdersByOrderIds, fetchRecentPathaoOrders, getPathaoToken, PathaoCredentials, PathaoOrderDetail } from '@/lib/pathaoClient';
import { getSecretsWithOverrides } from '@/lib/secrets';
import { createDataProvenance, DataProvenanceInfo } from '@/lib/dataAudit';
import { buildTimelineIndex, extractCustomerBilling, classifyCustomer } from '@/lib/customerRegistry';
import { fetchDatasetFromBlob, isBlobConfigured } from '@/lib/blobStorage';
import { getLiveWebhookUpdates, PathaoWebhookRecord } from '@/lib/pathaoWebhookEngine';
import baselineData from '@/data/baselineSample.json';

export {
  type StandardCourierStatus,
  type CourierDiscrepancyType,
  type BranchFulfillmentCode,
  type FulfillmentBranchInfo,
  type CourierTrackingInfo,
  type LiveTerminalStats,
  type DiscrepancyAlert,
  type LiveTerminalSyncResult,
  normalizeCourierStatus,
  cleanOrderId,
  extractBaseOrderId,
  detectFulfillmentBranch,
  detectCourierDiscrepancy,
  parseDateToEpoch,
} from '@/lib/fulfillmentUtils';

import {
  StandardCourierStatus,
  CourierDiscrepancyType,
  BranchFulfillmentCode,
  FulfillmentBranchInfo,
  CourierTrackingInfo,
  LiveTerminalStats,
  DiscrepancyAlert,
  LiveTerminalSyncResult,
  normalizeCourierStatus,
  cleanOrderId,
  extractBaseOrderId,
  detectFulfillmentBranch,
  detectCourierDiscrepancy,
  parseDateToEpoch,
} from '@/lib/fulfillmentUtils';

export function indexTrackingRecord(
  po: PathaoOrderDetail | Record<string, unknown>,
  courierTrackingMap: Record<string, CourierTrackingInfo>,
  phoneTrackingMap: Map<string, CourierTrackingInfo[]>
) {
  const consId = String(
    po['Order consignment id'] ||
    po.order_consignment_id ||
    po['Consignment ID'] ||
    po.consignment_id ||
    po.order_id ||
    ''
  ).trim();

  const rawOid = cleanOrderId(
    po['Merchant order id'] ||
    po.merchant_order_id ||
    po['Order ID'] ||
    po.order_id
  );
  const baseOid = extractBaseOrderId(rawOid);

  const rawPhone = String(
    po['Recipient phone'] ||
    po.recipient_phone ||
    po.phone ||
    ''
  );
  const cleanPhone = cleanCustomerPhone(rawPhone).displayPhone;

  if (!consId && !rawOid && !cleanPhone) return;

  const branchInfo = detectFulfillmentBranch(po['Merchant order id'] || po.merchant_order_id || rawOid);
  const rawStatus = String(po['Order status'] || po.order_status || '');
  const status = normalizeCourierStatus(rawStatus);
  const collected = parseFloat(String(po['Collected amount'] || po.collected_amount || po.order_amount || 0)) || 0;
  const fee = parseFloat(String(po['Total fee'] || po.total_fee || po.delivery_fee || 0)) || 0;
  const codFee = parseFloat(String(po['Cod fee'] || po.cod_fee || 0)) || 0;

  const dateVal =
    po['Order status updated at'] ||
    po.order_status_updated_at ||
    po['Order created at'] ||
    po.order_created_at ||
    po.created_at ||
    '';
  const updatedAt = dateVal ? String(dateVal) : undefined;

  const tracking: CourierTrackingInfo = {
    consignmentId: consId,
    orderId: rawOid,
    baseOrderId: baseOid,
    courierStatus: status,
    rawStatus,
    collectedAmount: collected,
    deliveryFee: fee,
    codFee,
    recipientName: String(po['Recipient name'] || po.recipient_name || ''),
    recipientPhone: rawPhone,
    recipientCity: String(po.City || po.city_name || po.recipient_city || ''),
    updatedAt,
    hasDiscrepancy: false,
    discrepancyType: 'NONE',
    fulfillmentBranch: branchInfo.branchName,
    isBranchFulfillment: branchInfo.isBranchFulfillment,
  };

  // 1. Index by Consignment ID
  if (consId) {
    const k = consId.toLowerCase();
    if (!courierTrackingMap[k]) courierTrackingMap[k] = tracking;
  }

  // 2. Index by Exact Merchant Order ID
  if (rawOid) {
    const k = `oid_${rawOid}`;
    if (!courierTrackingMap[k]) courierTrackingMap[k] = tracking;
  }

  // 3. Index by Base Order ID
  if (baseOid && baseOid !== rawOid) {
    const k = `oid_${baseOid}`;
    if (!courierTrackingMap[k]) courierTrackingMap[k] = tracking;
  }

  // 4. Index by Customer Phone (sorted with newest order first)
  if (cleanPhone) {
    if (!phoneTrackingMap.has(cleanPhone)) {
      phoneTrackingMap.set(cleanPhone, []);
    }
    const list = phoneTrackingMap.get(cleanPhone)!;
    if (!list.some((existing) => existing.consignmentId && existing.consignmentId === tracking.consignmentId)) {
      list.push(tracking);
      list.sort((a, b) => parseDateToEpoch(b.updatedAt) - parseDateToEpoch(a.updatedAt));
    }
  }
}

/**
 * Indexes real-time Pathao Webhook telemetry updates into the courier tracking cache.
 */
export function indexWebhookRecord(
  webhook: PathaoWebhookRecord,
  courierTrackingMap: Record<string, CourierTrackingInfo>,
  _phoneTrackingMap?: Map<string, CourierTrackingInfo[]>
): void {
  const consId = (webhook.consignmentId || '').trim();
  const rawOid = cleanOrderId(webhook.merchantOrderId);
  const baseOid = extractBaseOrderId(rawOid) || rawOid;
  const branchInfo = detectFulfillmentBranch(webhook.merchantOrderId || rawOid);

  let status: StandardCourierStatus = 'In Transit';
  if (webhook.normalizedStatus === 'Delivered') status = 'Delivered';
  else if (webhook.normalizedStatus === 'Returned') status = 'Returned';
  else if (webhook.normalizedStatus === 'Partial') status = 'Partial';
  else if (webhook.normalizedStatus === 'Untracked') status = 'Untracked';

  const tracking: CourierTrackingInfo = {
    consignmentId: consId,
    orderId: rawOid,
    baseOrderId: baseOid,
    courierStatus: status,
    rawStatus: webhook.rawStatus,
    collectedAmount: webhook.collectedAmount,
    deliveryFee: 0,
    codFee: 0,
    recipientName: '',
    recipientPhone: '',
    recipientCity: '',
    updatedAt: webhook.updatedAt,
    hasDiscrepancy: false,
    discrepancyType: 'NONE',
    fulfillmentBranch: branchInfo.branchName,
    isBranchFulfillment: branchInfo.isBranchFulfillment,
  };

  if (consId) {
    courierTrackingMap[consId.toLowerCase()] = tracking;
  }
  if (rawOid) {
    courierTrackingMap[`oid_${rawOid}`] = tracking;
  }
  if (baseOid && baseOid !== rawOid) {
    courierTrackingMap[`oid_${baseOid}`] = tracking;
  }
}

/**
 * Primary synchronization orchestrator for the Live Operations Terminal.
 * Combines WooCommerce order data and Pathao courier consignment telemetry.
 */
export async function syncLiveTerminalData(options: {
  wcCredentials?: WcCredentials;
  pathaoCredentials?: PathaoCredentials;
  activeOrders?: RawOrderRow[];
  limitConsignments?: number;
  fetchLiveWc?: boolean;
  skipNetwork?: boolean;
  maxPages?: number;
  after?: string;
  isDelta?: boolean;
}): Promise<LiveTerminalSyncResult> {
  let wcConnected = false;
  let pathaoConnected = false;
  let rawOrders: RawOrderRow[] = [];

  const shouldFetchWc = options.fetchLiveWc || (!options.activeOrders && !options.skipNetwork);

  // ── Step 1: Fetch or load WooCommerce Orders ──
  if (shouldFetchWc && !options.skipNetwork) {
    try {
      const wcTest = await testWooCommerceConnection(options.wcCredentials);
      if (wcTest.success) {
        wcConnected = true;
        const maxPagesToFetch = options.maxPages || 6; // Default to 6-8 pages or 4 pages on delta
        const deltaAfter = options.after || (options.isDelta ? new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() : undefined);

        // Multi-stream WooCommerce Synchronization:
        // 1. Fetch newly created orders (ordered by date_created desc)
        // 2. Fetch recently modified/completed orders (ordered by date_modified desc)
        //    CRITICAL: Old orders from last month or 7+ days ago shipped/completed today
        //    have date_modified = today! Fetching by modified ensures they appear on Page 1.
        // 3. Fetch active processing/hold queue orders awaiting fulfillment
        const [recentByDate, recentByModified, queueOrders] = await Promise.all([
          fetchWooCommerceOrders({
            perPage: 50,
            fetchAllPages: maxPagesToFetch > 1,
            maxPages: maxPagesToFetch,
            orderBy: 'date',
            order: 'desc',
            timeoutMs: 25000,
            credentials: options.wcCredentials,
            after: deltaAfter,
          }).catch((err) => {
            console.warn('[liveTerminalSync] WooCommerce fetch by date notice:', err);
            return [];
          }),
          fetchWooCommerceOrders({
            perPage: 50,
            fetchAllPages: true,
            maxPages: Math.min(maxPagesToFetch, 4),
            orderBy: 'modified',
            order: 'desc',
            timeoutMs: 25000,
            credentials: options.wcCredentials,
            modifiedAfter: deltaAfter,
          }).catch((err) => {
            console.warn('[liveTerminalSync] WooCommerce fetch by modified notice:', err);
            return [];
          }),
          fetchWooCommerceOrders({
            perPage: 50,
            fetchAllPages: false,
            maxPages: 2,
            status: ['processing', 'on-hold'],
            orderBy: 'date',
            order: 'desc',
            timeoutMs: 15000,
            credentials: options.wcCredentials,
          }).catch(() => []),
        ]);

        const mergedWcMap = new Map<string, typeof recentByDate[0]>();
        // 1. Base queue orders
        for (const ord of queueOrders) {
          const id = String(ord.id || ord.number || '').trim();
          if (id) mergedWcMap.set(id, ord);
        }
        // 2. Overlay recently created orders
        for (const ord of recentByDate) {
          const id = String(ord.id || ord.number || '').trim();
          if (id) mergedWcMap.set(id, ord);
        }
        // 3. Overlay recently modified/completed orders (highest priority for fresh fulfillment status)
        for (const ord of recentByModified) {
          const id = String(ord.id || ord.number || '').trim();
          if (id) mergedWcMap.set(id, ord);
        }

        const fetched = Array.from(mergedWcMap.values());
        if (fetched.length > 0) {
          const liveRows = formatWooCommerceToOrderRows(fetched);
          if (Array.isArray(options.activeOrders) && options.activeOrders.length > 0) {
            const liveOrderIds = new Set(liveRows.map((r) => cleanOrderId(r['Order ID'] || r.orderId)));
            const nonOverlapping = options.activeOrders.filter((r) => !liveOrderIds.has(cleanOrderId(r['Order ID'] || r.orderId)));
            rawOrders = [...liveRows, ...nonOverlapping];
          } else {
            rawOrders = liveRows;
          }
        }
      }
    } catch (err) {
      console.warn('WooCommerce live fetch failed or unconfigured, checking fallback:', err);
    }
  }

  let blobDataset: DatasetSnapshot | null = null;

  // Fallback to active orders passed from client, Vercel Blob cloud snapshot, or bundled baseline dataset
  if (rawOrders.length === 0) {
    if (Array.isArray(options.activeOrders) && options.activeOrders.length > 0) {
      rawOrders = options.activeOrders;
    } else if (isBlobConfigured()) {
      try {
        const blobRes = await fetchDatasetFromBlob();
        if (blobRes.success && blobRes.dataset && Array.isArray(blobRes.dataset.orders) && blobRes.dataset.orders.length > 0) {
          rawOrders = blobRes.dataset.orders;
          blobDataset = blobRes.dataset;
        }
      } catch (blobErr) {
        console.warn('[liveTerminalSync] Notice: Vercel Blob fallback fetch skipped:', blobErr);
      }
    }

    if (rawOrders.length === 0 && baselineData && Array.isArray((baselineData as { orders?: RawOrderRow[] }).orders)) {
      rawOrders = (baselineData as { orders: RawOrderRow[] }).orders;
    }
  }

  // ── Step 1B: Classify Customers (DEEN-OPS Customer Mix Grounding) ──
  try {
    const customerTimeline = buildTimelineIndex(rawOrders);
    for (const row of rawOrders) {
      const billing = extractCustomerBilling(row);
      const orderDateIso = String(row['Order Date'] || row.orderDate || row['Date Modified'] || '');
      const cls = classifyCustomer(billing, orderDateIso, customerTimeline);
      const rowRec = row as Record<string, unknown>;
      rowRec.isReturningCustomer = cls === 'returning';
      rowRec.customerType = cls;
    }
  } catch (err) {
    console.warn('Customer classification in live terminal sync caught warning:', err);
  }

  // ── Step 2: Harvest Consignment & Merchant IDs ──
  const consignmentIdSet = new Set<string>();
  const orderIdMap = new Map<string, RawOrderRow[]>();
  const unconsignedOrderIds = new Set<string>();
  const unconsignedPhones = new Set<string>();

  for (const row of rawOrders) {
    const cid =
      row['Consignment ID'] ||
      row.consignmentId ||
      row.consignment_id ||
      row.tracking_number ||
      row['Tracking ID'];
    if (cid && typeof cid === 'string' && cid.trim().length > 3) {
      consignmentIdSet.add(cid.trim());
    } else {
      const oid = cleanOrderId(row['Order ID'] || row.orderId);
      if (oid) unconsignedOrderIds.add(oid);
      const rawPhone = row.Phone || row.phone || (row as Record<string, unknown>)['Billing Phone'] || (row as Record<string, unknown>)['Shipping Phone'] || '';
      const cleanPhone = cleanCustomerPhone(rawPhone).displayPhone;
      if (cleanPhone) unconsignedPhones.add(cleanPhone);
    }

    const oid = cleanOrderId(row['Order ID'] || row.orderId);
    if (oid) {
      if (!orderIdMap.has(oid)) orderIdMap.set(oid, []);
      orderIdMap.get(oid)!.push(row);
    }
  }

  // ── Step 3: Query Pathao Courier Aladdin API ──
  const courierTrackingMap: Record<string, CourierTrackingInfo> = {};
  const phoneTrackingMap = new Map<string, CourierTrackingInfo[]>();

  // Filter harvested consignment IDs and skip purely numeric order IDs that trigger 404 rate-limiting on Pathao
  const harvestedConsignments = Array.from(consignmentIdSet)
    .filter((cid) => cid && cid.length >= 6 && cid !== '-' && cid !== 'null')
    .slice(0, options.limitConsignments || 20);
  const harvestedOrderIds = Array.from(unconsignedOrderIds)
    .filter((id) => !/^\d{1,7}$/.test(id)) // Skip numeric short store IDs to prevent 404 rate-limit pressure
    .slice(0, 10);

  if (!options.skipNetwork) {
    try {
      const { pathao } = getSecretsWithOverrides({ pathao: options.pathaoCredentials });
      if (pathao.client_id && pathao.client_secret) {
        const token = await getPathaoToken(options.pathaoCredentials);
        if (token) {
          pathaoConnected = true;
          const liveOrdersToProcess: PathaoOrderDetail[] = [];

          // 3A: Explicit Consignment ID lookups
          if (harvestedConsignments.length > 0) {
            const byCons = await batchFetchPathaoOrders(harvestedConsignments, 4, options.pathaoCredentials);
            liveOrdersToProcess.push(...byCons);
          }

          // 3B: If orders lack consignment IDs, query Pathao by order ID
          if (harvestedOrderIds.length > 0) {
            const byOid = await batchFetchPathaoOrdersByOrderIds(harvestedOrderIds, 3, options.pathaoCredentials);
            liveOrdersToProcess.push(...byOid);
          }

          // 3C: Fetch recent dispatches from Pathao to match active dispatches
          if (harvestedOrderIds.length > 0 || unconsignedPhones.size > 0) {
            try {
              const recent = await fetchRecentPathaoOrders(1, options.pathaoCredentials);
              if (Array.isArray(recent) && recent.length > 0) {
                liveOrdersToProcess.push(...recent);
              }
            } catch {
              // ignore
            }
          }

          for (const po of liveOrdersToProcess) {
            indexTrackingRecord(po, courierTrackingMap, phoneTrackingMap);
          }
        }
      }
    } catch (err) {
      console.warn('Pathao live API connection skipped or unconfigured:', err);
    }
  }

  // Fallback: Populate courier data from Vercel Blob or bundled baseline data (pathaoDelivery) if unmapped
  const fallbackDelivery = (blobDataset?.pathaoDelivery && blobDataset.pathaoDelivery.length > 0)
    ? (blobDataset.pathaoDelivery as Record<string, unknown>[])
    : (baselineData && Array.isArray((baselineData as { pathaoDelivery?: Record<string, unknown>[] }).pathaoDelivery))
      ? (baselineData as { pathaoDelivery: Record<string, unknown>[] }).pathaoDelivery
      : [];

  if (fallbackDelivery.length > 0) {
    for (const po of fallbackDelivery) {
      indexTrackingRecord(po, courierTrackingMap, phoneTrackingMap);
    }
  }

  // ── Step 3D: Ingest Real-Time Pathao Webhook Updates (Top Priority Live State) ──
  try {
    const liveWebhooks = getLiveWebhookUpdates();
    if (liveWebhooks && liveWebhooks.size > 0) {
      for (const webhookRecord of liveWebhooks.values()) {
        indexWebhookRecord(webhookRecord, courierTrackingMap, phoneTrackingMap);
      }
    }
  } catch (err) {
    console.warn('[liveTerminalSync] Notice: Webhook updates ingestion skipped:', err);
  }

  // ── Step 4: Enrich Orders & Compute Discrepancies ──
  const discrepancies: DiscrepancyAlert[] = [];
  let handedOverCount = 0;
  let inTransitCount = 0;
  let deliveredCount = 0;
  let returnedCount = 0;
  let pendingPickupCount = 0;
  let untrackedCount = 0;
  let totalCodCollected = 0;
  let branchOrderCount = 0;
  let exchangeOrderCount = 0;

  const seenOrders = new Set<string>();

  const enrichedOrders: RawOrderRow[] = rawOrders.map((row) => {
    const branchInfo = detectFulfillmentBranch(row);
    const rawOid = cleanOrderId(row['Order ID'] || row.orderId);
    const baseOid = branchInfo.baseOrderId || extractBaseOrderId(rawOid) || rawOid;
    const consId = String(
      row['Consignment ID'] ||
        row.consignmentId ||
        row.consignment_id ||
        row.tracking_number ||
        ''
    ).trim();
    const rawPhone = row.Phone || row.phone || (row as Record<string, unknown>)['Billing Phone'] || (row as Record<string, unknown>)['Shipping Phone'] || '';
    const _cleanPhone = cleanCustomerPhone(rawPhone).displayPhone;

    // Multi-tier Resolution Hierarchy:
    // Tier 1: Match by explicit Consignment ID
    let tracking = consId ? courierTrackingMap[consId.toLowerCase()] : undefined;

    // Tier 2: Match by exact Merchant Order ID
    if (!tracking && rawOid) {
      tracking = courierTrackingMap[`oid_${rawOid}`];
    }

    // Tier 3: Match by base Order ID (e.g. without branch suffix or exchange prefix)
    if (!tracking && baseOid) {
      tracking = courierTrackingMap[`oid_${baseOid}`];
    }

    // STRICT INVARIANT: Consignment tracking and parcel delivery status MUST NEVER be matched
    // by customer phone number! A customer's phone number represents their personal identity across
    // lifetime orders, NOT a specific parcel shipment. New or repeat orders (e.g., in 'processing')
    // must remain 'Untracked' until dispatched, and must NEVER inherit a previous order's consignment
    // or trigger false 'DELIVERED_BUT_PROCESSING' discrepancies.

    // Tier 4: Fallback to Pathao status and fee stored in WooCommerce order metadata
    const rawPathaoStatus = String(row.pathaoStatus || (row as Record<string, unknown>)['Pathao Status'] || '');
    const rawPathaoFee = parseFloat(String(row.pathaoDeliveryFee || (row as Record<string, unknown>)['Pathao Delivery Fee'] || 0)) || 0;
    if (!tracking && rawPathaoStatus && rawPathaoStatus !== '-' && rawPathaoStatus !== 'null') {
      const normalizedMetaStatus = normalizeCourierStatus(rawPathaoStatus);
      tracking = {
        consignmentId: consId,
        orderId: rawOid,
        baseOrderId: baseOid,
        courierStatus: normalizedMetaStatus,
        rawStatus: rawPathaoStatus,
        collectedAmount: 0,
        deliveryFee: rawPathaoFee,
        codFee: 0,
        recipientName: String(row['Customer Name'] || row.customerName || ''),
        recipientPhone: String(rawPhone || ''),
        recipientCity: String(row.City || row.city || ''),
        hasDiscrepancy: false,
        discrepancyType: 'NONE',
        fulfillmentBranch: branchInfo.branchName,
        isBranchFulfillment: branchInfo.isBranchFulfillment,
      };
    }

    const rowRec = row as Record<string, unknown>;
    const isWpReturn = Boolean(
      row.isReturnFromWp ||
      rowRec.isPaidReturnFromWp ||
      rowRec.wpDeliveryStatus === 'Paid Return' ||
      rowRec.wpDeliveryStatus === 'Not Paid Return' ||
      String(row['Delivery Status'] || rowRec.status || '').toLowerCase().includes('return')
    );

    let courierStatus: StandardCourierStatus = tracking ? tracking.courierStatus : 'Untracked';
    if (courierStatus === 'Untracked' && isWpReturn) {
      courierStatus = 'Returned';
    }
    const effectiveConsId = tracking?.consignmentId || consId || '';
    const collectedAmount = tracking?.collectedAmount || 0;
    const fee = tracking?.deliveryFee || 0;

    // Ensure resolved consignment ID is reflected on the order record
    if (effectiveConsId && !row['Consignment ID']) {
      (row as Record<string, unknown>)['Consignment ID'] = effectiveConsId;
      (row as Record<string, unknown>).consignmentId = effectiveConsId;
      (row as Record<string, unknown>).tracking_number = effectiveConsId;
    }

    const wcStatus = String(row['Delivery Status'] || row.status || 'shipped');
    const orderAmount = Number(row['Order Amount'] || row['Item Cost'] || 0);
    const paymentMethod = String(
      row['Payment Method'] ||
      rowRec.payment_method ||
      rowRec.paymentMethod ||
      rowRec['Cash on delivery'] ||
      ''
    );

    const discCheck = detectCourierDiscrepancy(wcStatus, courierStatus, orderAmount, collectedAmount, {
      paymentMethod,
      isReturnFromWp: Boolean(row.isReturnFromWp || (row as Record<string, unknown>).wpDeliveryStatus === 'Paid Return' || (row as Record<string, unknown>).wpDeliveryStatus === 'Not Paid Return'),
      isPartialFromWp: Boolean(row.isPartialFromWp || (row as Record<string, unknown>).wpDeliveryStatus === 'Partial'),
    });

    if (discCheck.hasDiscrepancy && !seenOrders.has(rawOid)) {
      discrepancies.push({
        orderId: String(row['Order ID'] || row.orderId || ''),
        wcStatus,
        courierStatus,
        type: discCheck.type,
        message: discCheck.message || '',
        consignmentId: effectiveConsId,
        fulfillmentBranch: branchInfo.branchName,
      });
    }

    if (!seenOrders.has(rawOid)) {
      seenOrders.add(rawOid);

      if (branchInfo.isBranchFulfillment) {
        branchOrderCount++;
      }
      if (branchInfo.branchCode === 'EXCHANGE') {
        exchangeOrderCount++;
      }

      if (courierStatus !== 'Untracked') {
        handedOverCount++;
      } else {
        untrackedCount++;
      }

      if (courierStatus === 'In Transit') inTransitCount++;
      else if (courierStatus === 'Delivered') {
        deliveredCount++;
        totalCodCollected += collectedAmount || orderAmount;
      } else if (courierStatus === 'Returned') {
        returnedCount++;
      } else if (courierStatus === 'Pending Pickup') {
        pendingPickupCount++;
      }
    }

    return {
      ...row,
      'Consignment ID': effectiveConsId,
      consignmentId: effectiveConsId,
      'Courier Status': courierStatus,
      courierStatus: courierStatus,
      pathaoStatus: courierStatus,
      hasDiscrepancy: discCheck.hasDiscrepancy,
      discrepancyType: discCheck.type,
      discrepancyMessage: discCheck.message,
      collectedAmount,
      courierDeliveryFee: fee,
      courierUpdatedAt: tracking?.updatedAt,
      'Courier Updated At': tracking?.updatedAt,
      fulfillmentBranch: branchInfo.branchName,
      branchCode: branchInfo.branchCode,
      isBranchFulfillment: branchInfo.branchCode !== 'ONLINE' && !Boolean(
        row.isPos === true &&
        !isEcomPaymentMethod(paymentMethod, (row as Record<string, unknown>).payment_method_title) &&
        !effectiveConsId &&
        String(row['Created Via'] || (row as Record<string, unknown>).created_via || '').toLowerCase().trim() !== 'checkout'
      ),
      isPos: Boolean(
        row.isPos === true &&
        !isEcomPaymentMethod(paymentMethod, (row as Record<string, unknown>).payment_method_title) &&
        !effectiveConsId &&
        String(row['Created Via'] || (row as Record<string, unknown>).created_via || '').toLowerCase().trim() !== 'checkout'
      ),
      baseOrderId: baseOid,
    };
  });

  const totalDistinctOrders = seenOrders.size;
  const handedOverRate =
    totalDistinctOrders > 0 ? Math.round((handedOverCount / totalDistinctOrders) * 1000) / 10 : 0;

  const stats: LiveTerminalStats = {
    totalOrders: totalDistinctOrders,
    totalLineItems: enrichedOrders.length,
    handedOverCount,
    handedOverRate,
    inTransitCount,
    deliveredCount,
    returnedCount,
    pendingPickupCount,
    untrackedCount,
    discrepancyCount: discrepancies.length,
    totalCodCollected,
    branchOrderCount,
    exchangeOrderCount,
  };

  const provenanceSource = wcConnected || pathaoConnected
    ? 'live_api'
    : blobDataset
      ? 'vercel_blob'
      : 'baseline_bundled';

  const provenance = createDataProvenance(
    provenanceSource,
    enrichedOrders.length,
    false
  );

  const message = wcConnected
    ? `Successfully synchronized ${totalDistinctOrders} live orders (${enrichedOrders.length} line items) from WooCommerce REST API with Pathao courier telemetry.`
    : `Synchronized ${totalDistinctOrders} orders (${enrichedOrders.length} line items) with local snapshot / Pathao courier telemetry.`;

  return {
    success: true,
    message,
    orders: enrichedOrders,
    courierTrackingMap,
    stats,
    discrepancies,
    wcConnected,
    pathaoConnected,
    syncTimestamp: new Date().toISOString(),
    provenance,
  };
}
