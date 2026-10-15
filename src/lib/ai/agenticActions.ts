import { ReconciledOrderRow, AgenticActionProposal, AgenticPreviewOrder } from '@/types';
import { ReconciliationResult } from '@/lib/reconciliationEngine';

/**
 * Extracts custom tag from query string if user supplied one in quotes or after "as"
 * e.g. "tag orders as 'Pathao Claim Needed'" -> "Pathao Claim Needed"
 * e.g. "mark as [High Risk Customer]" -> "High Risk Customer"
 */
function extractCustomTag(query: string, defaultTag: string): string {
  const quoteMatch = query.match(/(?:as|tag|with)\s+["'“]([^"'”]+)["'”]/i);
  if (quoteMatch && quoteMatch[1]?.trim()) {
    return quoteMatch[1].trim();
  }
  const bracketMatch = query.match(/\[([^[\]]+)\]/);
  if (bracketMatch && bracketMatch[1]?.trim()) {
    return bracketMatch[1].trim();
  }
  const asWordMatch = query.match(/\bas\s+([A-Za-z0-9\-_\s]{3,30})(?:\s+orders|\s+in|\.|\?|$)/i);
  if (asWordMatch && asWordMatch[1]?.trim()) {
    return asWordMatch[1].trim();
  }
  return defaultTag;
}

/**
 * Extracts a numeric threshold from the query string (e.g. "> 100", "over 150", "more than 50")
 */
function extractThreshold(query: string, defaultVal: number): number {
  const m = query.match(/(?:>|over|greater\s*than|more\s*than|above|exceeding)\s*(?:৳|bdt|tk)?\s*(\d+)/i);
  if (m && m[1]) {
    const val = parseInt(m[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return defaultVal;
}

/**
 * Detects whether the merchant query is requesting an agentic action on the dataset
 * (tagging, marking, flagging, selecting, clearing).
 * Pure deterministic logic - zero hallucination, works 100% offline.
 */
export function detectAgenticIntent(
  query: string,
  result: ReconciliationResult
): AgenticActionProposal | null {
  if (!query || !result) return null;
  const q = query.toLowerCase().trim();

  // 1. CLEAR TAGS INTENT
  if (/(?:clear|remove|reset|delete|wipe)\s+(?:all\s+)?(?:ai\s+)?tags?/i.test(q)) {
    const taggedOrders = (result.reconciledOrders || []).filter((o) => Boolean(o.aiAuditTag));
    const uniqueIds = Array.from(new Set(taggedOrders.map((o) => o.orderId)));

    return {
      id: `clear-${Date.now()}`,
      type: 'CLEAR_TAGS',
      title: 'Clear All AI Dataset Tags',
      description: `Remove active AI audit tags from all ${uniqueIds.length} tagged orders.`,
      matchCriteria: { target: 'all' },
      matchedOrderIds: uniqueIds,
      affectedCount: uniqueIds.length,
      previewOrders: taggedOrders.slice(0, 4).map((o) => ({
        orderId: o.orderId,
        customerName: o.customerName,
        phone: o.phone,
        amount: o.orderAmount,
        status: o.orderDeliveryStatus || o.orderCategory,
        reason: `Active tag: "${o.aiAuditTag}" will be cleared`,
      })),
    };
  }

  // Check if query contains an action verb like tag, mark, flag, label, select, highlight
  const hasActionVerb = /\b(tag|mark|flag|label|highlight|select|annotate|stamp)\b/i.test(q);
  if (!hasActionVerb) return null;

  // 2. PATHAO COURIER COD VARIANCE / MISMATCH INTENT
  if (
    /(variance|mismatch|discrepanc|pathao.*claim|cod.*diff|remittance.*diff)/i.test(q) ||
    (/(courier|pathao)/i.test(q) && /(claim|dispute|issue|difference)/i.test(q))
  ) {
    const threshold = extractThreshold(q, 100);
    const tag = extractCustomTag(query, 'Pathao Discrepancy');
    const mismatches = result.courierMismatches || [];

    // Find mismatched orders where variance > threshold or severity is CRITICAL/WARNING
    const affectedMismatches = mismatches.filter(
      (m) => Math.abs(m.codDifference || 0) >= threshold || m.severity === 'CRITICAL' || m.severity === 'WARNING'
    );
    const targetOrderIds = new Set(affectedMismatches.map((m) => m.orderId));

    // Match with reconciled orders
    const matchedOrders = (result.reconciledOrders || []).filter((o) => targetOrderIds.has(o.orderId));
    const uniqueIds = Array.from(new Set(matchedOrders.map((o) => o.orderId)));

    if (uniqueIds.length === 0) return null;

    const previewOrders: AgenticPreviewOrder[] = affectedMismatches.slice(0, 5).map((m) => ({
      orderId: m.orderId,
      customerName: m.customerName,
      phone: m.phone,
      amount: m.expectedCod,
      status: m.pathaoStatus,
      reason: `COD variance: ৳${Math.abs(m.codDifference).toLocaleString()} (${m.severity})`,
    }));

    return {
      id: `tag-variance-${Date.now()}`,
      type: 'TAG_ORDERS',
      title: `Tag ${uniqueIds.length} Orders with "${tag}"`,
      description: `Flags all orders where courier remittance discrepancy is ৳${threshold}+ for courier audit and dispute claim.`,
      tag,
      note: `Flagged for Pathao dispute: COD variance ৳${threshold}+ detected during reconciliation.`,
      matchCriteria: {
        target: 'variance',
        threshold,
      },
      matchedOrderIds: uniqueIds,
      affectedCount: uniqueIds.length,
      previewOrders,
    };
  }

  // 3. HIGH RISK CUSTOMERS (RTO > 50%) INTENT
  if (/(high\s*risk|risky|rto\s*risk|hold\s*for\s*advance|advance\s*required|chronic\s*return)/i.test(q)) {
    const tag = extractCustomTag(query, 'Hold for Advance');
    const highRiskPhones = new Set(
      (result.customerRiskProfiles || [])
        .filter((c) => c.riskTier === 'HIGH_RISK')
        .map((c) => c.phone)
    );

    const matchedOrders = (result.reconciledOrders || []).filter((o) => highRiskPhones.has(o.phone));
    const uniqueIds = Array.from(new Set(matchedOrders.map((o) => o.orderId)));

    if (uniqueIds.length === 0) return null;

    const previewOrders: AgenticPreviewOrder[] = matchedOrders.slice(0, 5).map((o) => {
      const profile = result.customerRiskProfiles?.find((c) => c.phone === o.phone);
      return {
        orderId: o.orderId,
        customerName: o.customerName,
        phone: o.phone,
        amount: o.orderAmount,
        status: o.orderDeliveryStatus || o.orderCategory,
        reason: `Customer RTO Rate: ${profile?.returnRate?.toFixed(1) || '50+'}% (${profile?.returnedOrders || 1} returns)`,
      };
    });

    return {
      id: `tag-risk-${Date.now()}`,
      type: 'TAG_ORDERS',
      title: `Tag ${uniqueIds.length} Orders with "${tag}"`,
      description: `Tags orders placed by repeat high-risk customers (>50% historical return rate) requiring advance shipping verification.`,
      tag,
      note: `Customer risk tier HIGH_RISK: RTO rate > 50%. Advance courier fee collection mandatory.`,
      matchCriteria: {
        target: 'high_risk',
      },
      matchedOrderIds: uniqueIds,
      affectedCount: uniqueIds.length,
      previewOrders,
    };
  }

  // 4. OUTSIDE DHAKA RETURN / RTO INTENT
  if (/(outside\s*dhaka|outside\s*return|outside\s*rto|logistic\s*review)/i.test(q)) {
    const tag = extractCustomTag(query, 'Outside Logistics Review');
    const matchedOrders = (result.reconciledOrders || []).filter(
      (o) => o.districtArea === 'Outside Dhaka' && (o.orderCategory === 'FULL_RETURN' || o.orderCategory === 'PARTIAL')
    );
    const uniqueIds = Array.from(new Set(matchedOrders.map((o) => o.orderId)));

    if (uniqueIds.length === 0) return null;

    const previewOrders: AgenticPreviewOrder[] = matchedOrders.slice(0, 5).map((o) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      phone: o.phone,
      amount: o.orderAmount,
      status: o.orderDeliveryStatus || o.orderCategory,
      reason: `Outside Dhaka ${o.orderCategory} (${o.city || 'Regional'})`,
    }));

    return {
      id: `tag-outside-${Date.now()}`,
      type: 'TAG_ORDERS',
      title: `Tag ${uniqueIds.length} Orders with "${tag}"`,
      description: `Flags Outside Dhaka failed or partial deliveries to analyze regional linehaul delays and packaging integrity.`,
      tag,
      note: `Outside Dhaka transit review: Regional delivery failure flagged for linehaul audit.`,
      matchCriteria: {
        target: 'outside_dhaka',
      },
      matchedOrderIds: uniqueIds,
      affectedCount: uniqueIds.length,
      previewOrders,
    };
  }

  // 5. BRANCH / OUTLET INTENT (Cumilla, Wari, Sylhet, Mirpur)
  if (/(cumilla|wari|sylhet|mirpur)/i.test(q)) {
    let suffix = 'c';
    let branchName = 'Cumilla Branch';
    if (/wari/i.test(q)) {
      suffix = 'w';
      branchName = 'Wari Branch';
    } else if (/sylhet/i.test(q)) {
      suffix = 's';
      branchName = 'Sylhet Branch';
    } else if (/mirpur/i.test(q)) {
      suffix = 'm';
      branchName = 'Mirpur Outlet POS';
    }

    const tag = extractCustomTag(query, `${branchName} Audit`);
    const matchedOrders = (result.reconciledOrders || []).filter(
      (o) => o.branchSuffix === suffix || (o.fulfillmentLocation && o.fulfillmentLocation.includes(branchName.split(' ')[0]))
    );
    const uniqueIds = Array.from(new Set(matchedOrders.map((o) => o.orderId)));

    if (uniqueIds.length === 0) return null;

    const previewOrders: AgenticPreviewOrder[] = matchedOrders.slice(0, 5).map((o) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      phone: o.phone,
      amount: o.orderAmount,
      status: o.orderDeliveryStatus || o.orderCategory,
      reason: `Sourced from ${branchName} (Suffix: ${suffix})`,
    }));

    return {
      id: `tag-branch-${Date.now()}`,
      type: 'TAG_ORDERS',
      title: `Tag ${uniqueIds.length} Orders with "${tag}"`,
      description: `Identifies all orders fulfilled or dispatched by ${branchName} for inventory sync and branch reconciliation.`,
      tag,
      note: `Dispatched from ${branchName}. Verified against retail POS registry.`,
      matchCriteria: {
        target: 'branch',
        branchSuffix: suffix,
        branchName,
      },
      matchedOrderIds: uniqueIds,
      affectedCount: uniqueIds.length,
      previewOrders,
    };
  }

  // 6. SPECIFIC ORDER IDS INTENT (e.g. "tag order 17263 as VIP")
  const idMatches = query.match(/\b\d{4,6}[a-z]?\b/gi);
  if (idMatches && idMatches.length > 0) {
    const rawIds = new Set(idMatches.map((id) => id.trim().toLowerCase()));
    const matchedOrders = (result.reconciledOrders || []).filter((o) => {
      const base = o.orderId.toLowerCase().trim();
      return rawIds.has(base) || Array.from(rawIds).some((target) => base.includes(target));
    });
    const uniqueIds = Array.from(new Set(matchedOrders.map((o) => o.orderId)));

    if (uniqueIds.length > 0) {
      const tag = extractCustomTag(query, 'Priority Review');
      const previewOrders: AgenticPreviewOrder[] = matchedOrders.slice(0, 5).map((o) => ({
        orderId: o.orderId,
        customerName: o.customerName,
        phone: o.phone,
        amount: o.orderAmount,
        status: o.orderDeliveryStatus || o.orderCategory,
        reason: 'Specified in user query',
      }));

      return {
        id: `tag-specific-${Date.now()}`,
        type: 'TAG_ORDERS',
        title: `Tag ${uniqueIds.length} Specified Orders with "${tag}"`,
        description: `Tags explicitly requested orders (${uniqueIds.join(', ')}) with custom operational audit tag.`,
        tag,
        note: `Manual priority tag applied via DEEN Assistant natural language instruction.`,
        matchCriteria: {
          target: 'order_ids',
          orderIds: uniqueIds,
        },
        matchedOrderIds: uniqueIds,
        affectedCount: uniqueIds.length,
        previewOrders,
      };
    }
  }

  return null;
}

/**
 * Pure and immutable function to apply an agentic action proposal onto reconciled orders.
 */
export function applyAgenticAction(
  orders: ReconciledOrderRow[],
  proposal: AgenticActionProposal
): ReconciledOrderRow[] {
  if (!orders || orders.length === 0) return [];
  if (!proposal) return orders;

  if (proposal.type === 'CLEAR_TAGS') {
    return orders.map((o) => ({
      ...o,
      aiAuditTag: undefined,
      aiAuditNote: undefined,
    }));
  }

  if (proposal.type === 'TAG_ORDERS' && proposal.tag) {
    const targetSet = new Set(proposal.matchedOrderIds.map((id) => id.trim().toLowerCase()));
    const newTag = proposal.tag;
    const newNote = proposal.note || `Tagged by DEEN Assistant: ${proposal.title}`;

    return orders.map((o) => {
      if (targetSet.has(o.orderId.trim().toLowerCase())) {
        return {
          ...o,
          aiAuditTag: newTag,
          aiAuditNote: newNote,
        };
      }
      return o;
    });
  }

  return orders;
}

/**
 * Pure function to completely clear all AI audit tags.
 */
export function clearAgenticTags(orders: ReconciledOrderRow[]): ReconciledOrderRow[] {
  return orders.map((o) => ({
    ...o,
    aiAuditTag: undefined,
    aiAuditNote: undefined,
  }));
}

/**
 * Generates 1-click preset proposals for quick merchant triggers in the UI
 */
export function getAvailableAgenticPresets(result: ReconciliationResult): AgenticActionProposal[] {
  if (!result || !result.reconciledOrders) return [];
  const presets: AgenticActionProposal[] = [];

  // Preset 1: Pathao Courier COD Discrepancies
  const criticalMismatches = (result.courierMismatches || []).filter(
    (m) => Math.abs(m.codDifference || 0) >= 50 || m.severity === 'CRITICAL' || m.severity === 'WARNING'
  );
  if (criticalMismatches.length > 0) {
    const ids = Array.from(new Set(criticalMismatches.map((m) => m.orderId)));
    presets.push({
      id: 'preset-pathao-claim',
      type: 'TAG_ORDERS',
      title: `Tag ${ids.length} Pathao Courier Discrepancies`,
      description: `Flags orders with COD variance (৳50+) or delivery status mismatches for Pathao claim processing.`,
      tag: 'Pathao Discrepancy',
      note: 'Remittance discrepancy with Pathao Hermes: COD difference flagged for 7-day courier claim window.',
      matchCriteria: { target: 'variance', threshold: 50 },
      matchedOrderIds: ids,
      affectedCount: ids.length,
      previewOrders: criticalMismatches.slice(0, 4).map((m) => ({
        orderId: m.orderId,
        customerName: m.customerName,
        phone: m.phone,
        amount: m.expectedCod,
        status: m.pathaoStatus,
        reason: `Discrepancy: ৳${Math.abs(m.codDifference)} (${m.severity})`,
      })),
    });
  }

  // Preset 2: High Risk Return Customers (>50% RTO)
  const highRiskCustomers = (result.customerRiskProfiles || []).filter((c) => c.riskTier === 'HIGH_RISK');
  if (highRiskCustomers.length > 0) {
    const riskPhones = new Set(highRiskCustomers.map((c) => c.phone));
    const matched = result.reconciledOrders.filter((o) => riskPhones.has(o.phone));
    const ids = Array.from(new Set(matched.map((o) => o.orderId)));
    if (ids.length > 0) {
      presets.push({
        id: 'preset-high-risk-hold',
        type: 'TAG_ORDERS',
        title: `Tag ${ids.length} Orders from High-Risk Customers`,
        description: `Flags orders from chronic returners (>50% RTO) to enforce mandatory advance delivery fee payment.`,
        tag: 'Hold for Advance',
        note: 'Customer risk profile: RTO rate > 50%. Enforce advance courier fee collection before fulfillment.',
        matchCriteria: { target: 'high_risk' },
        matchedOrderIds: ids,
        affectedCount: ids.length,
        previewOrders: matched.slice(0, 4).map((o) => ({
          orderId: o.orderId,
          customerName: o.customerName,
          phone: o.phone,
          amount: o.orderAmount,
          status: o.orderDeliveryStatus || o.orderCategory,
          reason: 'Customer historical return rate > 50%',
        })),
      });
    }
  }

  // Preset 3: Outside Dhaka Failed Returns
  const outsideReturns = result.reconciledOrders.filter(
    (o) => o.districtArea === 'Outside Dhaka' && o.orderCategory === 'FULL_RETURN'
  );
  if (outsideReturns.length > 0) {
    const ids = Array.from(new Set(outsideReturns.map((o) => o.orderId)));
    presets.push({
      id: 'preset-outside-rto',
      type: 'TAG_ORDERS',
      title: `Tag ${ids.length} Outside Dhaka RTO Orders`,
      description: `Tags regional returns where transit delays and unreachability cause packaging & courier loss.`,
      tag: 'Outside Logistics Review',
      note: 'Outside Dhaka return: Review packaging integrity and courier linehaul performance.',
      matchCriteria: { target: 'outside_dhaka' },
      matchedOrderIds: ids,
      affectedCount: ids.length,
      previewOrders: outsideReturns.slice(0, 4).map((o) => ({
        orderId: o.orderId,
        customerName: o.customerName,
        phone: o.phone,
        amount: o.orderAmount,
        status: 'Returned',
        reason: `Outside Dhaka transit loss (${o.city || 'Regional'})`,
      })),
    });
  }

  return presets;
}
