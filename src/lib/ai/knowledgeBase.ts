/**
 * Semantic Metric Catalog & Business Rules Knowledge Base for DEEN Assistant
 *
 * Implements structured, deterministic knowledge retrieval over:
 * 1. Fulfillment Branch Locations & Suffix Decoding (Cumilla, Wari, Sylhet, Mirpur, Online)
 * 2. Order Reconciliation & Accounting Invariants (Knapsack DP partials, integer rule, ৳50/৳90 delivery charge)
 * 3. Courier Policies & Dispute SLAs (Pathao Hermes, COD leakage, discrepancy tiers)
 * 4. Customer Risk Tiers & Operational SOPs (HIGH_RISK advance fee, phone verification)
 * 5. Financial Formulas (Net Realized Sales, Return Rate, Outside-to-Inside Ratio)
 */

export interface KnowledgeEntry {
  id: string;
  category: 'branch' | 'reconciliation' | 'courier' | 'risk' | 'metric' | 'policy' | 'live_ops';
  title: string;
  summary: string;
  formulaOrRule: string;
  operationalSOP?: string;
  keywords: string[];
}

export const KNOWLEDGE_BASE_ENTRIES: KnowledgeEntry[] = [
  // 1. Branch Outlets & Suffix Decoding
  {
    id: 'branch_suffix_rules',
    category: 'branch',
    title: 'Branch Outlet Codes & Suffix Decoding',
    summary: 'Branch letters attached to Order IDs indicate origin fulfillment retail store.',
    formulaOrRule:
      'Online Central Store = No suffix (e.g. 17263)\n' +
      'Cumilla Branch = Suffix "c" (e.g. 17263 c, Outlet ID: 2)\n' +
      'Wari Branch = Suffix "w" (e.g. 17263 w, Outlet ID: 9)\n' +
      'Sylhet Branch = Suffix "s" (e.g. 17263 s, Outlet IDs: 7 & 8)\n' +
      'Mirpur Outlet POS = Suffix "m" (e.g. 17263 m, Outlet ID: 1, physical store register strictly distinct from central online warehouse)',
    operationalSOP: 'Orders can split across multiple parcels/branches. Use base order ID (without suffix) to reconcile overall customer order state.',
    keywords: ['branch', 'suffix', 'cumilla', 'wari', 'sylhet', 'mirpur', 'outlet', 'location', 'pos', 'store', 'split']
  },
  {
    id: 'branch_split_multi_parcel',
    category: 'branch',
    title: 'Split Multi-Parcel Order Reconciliation',
    summary: 'When multiple parcels with different branch suffixes fulfill one order ID.',
    formulaOrRule:
      'If every branch parcel for order X is Delivered -> Overall order is Delivered.\n' +
      'If any parcel is returned with Paid Return -> Paid Return status propagates to all returned branch parcels.',
    operationalSOP: 'Never count the overall order multiple times. Deduplicate by base order ID; attribute item revenue to the fulfilling branch.',
    keywords: ['multi-parcel', 'split parcel', 'branch split', 'propagation', 'delivered', 'paid return']
  },

  // 2. Reconciliation Rules & Accounting Invariants
  {
    id: 'reconciliation_partial_knapsack',
    category: 'reconciliation',
    title: 'Partial Return Accounting & Knapsack DP Solver',
    summary: 'Solves item retention when a customer accepts part of a multi-item parcel.',
    formulaOrRule:
      'Collected COD = Price of Kept Items + (৳50 or ৳90 Delivery Charge)\n' +
      'Returned Items Value = Order Total Dispatched - Kept Items Price\n' +
      'Strict Integer Invariant: Returned item quantities MUST be whole integers (1, 2, 3...). Fractional quantities (0.5) are strictly forbidden.',
    operationalSOP: 'Use 0-1 Knapsack Dynamic Programming with ৳50/৳90 delivery charge tolerance. If ambiguous combinations exist, flag for merchant review.',
    keywords: ['partial', 'partial return', 'knapsack', 'subset sum', 'integer', 'fraction', 'delivery charge', '50 tk', '90 tk']
  },
  {
    id: 'reconciliation_paid_return_propagation',
    category: 'reconciliation',
    title: 'Paid Return Propagation Invariant',
    summary: 'Accounting rule for return courier fee recovery across split parcels.',
    formulaOrRule:
      'If at least 1 parcel in an order has Paid Return (delivery charge collected on return), ALL returned parcels for that order count as Paid Returns.',
    operationalSOP: 'Classifies order delivery status as Paid Return. Deducts courier return fee from gross loss since delivery charge was recovered.',
    keywords: ['paid return', 'non-paid return', 'courier fee recovery', 'return propagation', 'delivery collection']
  },
  {
    id: 'reconciliation_exchange_rule',
    category: 'reconciliation',
    title: 'Exchanged Order Identification & Prefixes',
    summary: 'Rules for replacement and size exchange shipments.',
    formulaOrRule:
      'Prefixes D-17263, DD-17263, or EXCH-17263 signify an exchange parcel.\n' +
      'Order Delivery Status: "Exchange", Item Delivery Status: "Exchange".',
    operationalSOP: 'Exchange orders collect standard delivery charges or difference COD; they do not count as negative sales or customer return loss.',
    keywords: ['exchange', 'd-', 'dd-', 'replacement', 'size swap', 'exchange cod']
  },

  // 3. Courier Policies & Dispute SLAs
  {
    id: 'courier_pathao_dispute_sla',
    category: 'courier',
    title: 'Pathao Hermes Courier Remittance & Dispute SLA',
    summary: 'Pathao Courier integration standards and financial dispute lodging rules.',
    formulaOrRule:
      'CRITICAL Discrepancy: Courier marked Delivered and collected cash, but manifest records zero return / store uncredited (direct cash loss).\n' +
      'WARNING Discrepancy: COD remittance variance > ৳50 or pending settlement batch.\n' +
      'Dispute Claim SLA: Formal claims must be lodged through merchant support within 7 calendar days of courier status update.',
    operationalSOP: 'Export the Discrepancy Ledger and attach consignment tracking IDs when opening remittance dispute tickets.',
    keywords: ['courier', 'pathao', 'hermes', 'dispute', 'mismatch', 'remittance', 'claim', 'cod variance', 'sla']
  },

  // 4. Customer Risk Tiers & Action SOPs
  {
    id: 'customer_risk_tiers',
    category: 'risk',
    title: 'Customer Return Risk Tiers & Fraud Prevention SOP',
    summary: 'Automated Return to Origin (RTO) risk profiling and checkout action rules.',
    formulaOrRule:
      'HIGH_RISK (> 50% Historical RTO Rate): Collect mandatory advance delivery fee (৳150) before parcel dispatch.\n' +
      'MEDIUM RISK (20% - 50% Historical RTO Rate): Mandatory outbound phone call confirmation before packaging.\n' +
      'LOW RISK (< 20% Historical RTO Rate): Fast-track automated dispatch.',
    operationalSOP: 'Orders flagged as HIGH_RISK are held in the "Pending Advance" queue in the fulfillment warehouse.',
    keywords: ['risk', 'high risk', 'customer risk', 'rto', 'fraud', 'advance shipping', 'phone confirmation', 'chronic returner']
  },

  // 5. Metric Formulas & Calculation Standards
  {
    id: 'metric_net_realized_sales',
    category: 'metric',
    title: 'Net Realized Revenue Calculation',
    summary: 'Authoritative top-line realized income excluding returns and uncollected parcels.',
    formulaOrRule:
      'Net Realized Revenue = Total Delivered Revenue + Delivered Portion of Partials - Realized Return Fees\n' +
      'Gross Dispatched Revenue = Total Dispatched Order Amounts before returns.',
    operationalSOP: 'Never use Gross Sales to evaluate marketing ROAS or branch profit. Always evaluate on Net Realized Revenue.',
    keywords: ['net revenue', 'realized sales', 'gross sales', 'revenue formula', 'topline', 'calculation']
  },
  {
    id: 'metric_return_rate_breakdown',
    category: 'metric',
    title: 'Total Return Rate vs Full Return Rate',
    summary: 'Distinction between complete parcel rejections and partial items.',
    formulaOrRule:
      'Total Return Rate (%) = ((Full Returned Orders + Partial Orders) / Gross Dispatched Orders) * 100\n' +
      'Full Return Rate (%) = (Full Returned Orders / Gross Dispatched Orders) * 100\n' +
      'Partial Rate (%) = (Partial Orders / Gross Dispatched Orders) * 100',
    operationalSOP: 'Healthy apparel target in Bangladesh: Total Return Rate <= 25%, Full Return Rate <= 18%.',
    keywords: ['return rate', 'full return', 'partial rate', 'percentage', 'target', 'benchmark']
  },
  {
    id: 'metric_territory_outside_ratio',
    category: 'metric',
    title: 'Territory Linehaul Outside-to-Inside Dhaka Ratio',
    summary: 'Measures exposure to linehaul couriers and higher outside-Dhaka return risks.',
    formulaOrRule:
      'Outside Ratio = Outside Dhaka Orders / Math.max(1, Inside Dhaka Orders)\n' +
      'Interpretation: E.g., 3:1 means 3 outside Dhaka parcels dispatched for every 1 inside Dhaka parcel.',
    operationalSOP: 'Outside Dhaka orders typically incur higher courier return fees (৳130-150) vs Inside Dhaka (৳60-70). High outside ratio requires stricter advance screening.',
    keywords: ['territory', 'outside ratio', 'dhaka', 'outside dhaka', 'inside dhaka', 'linehaul', 'division']
  },

  // 6. Live Operations, Today's Sales & Real-Time Delivery Telemetry
  {
    id: 'live_ops_today_shipped_standard',
    category: 'live_ops',
    title: 'Today\'s Shipped Orders & Sales Reporting Standard',
    summary: 'Standard for calculating today\'s dispatched parcel volume and gross shipped revenue.',
    formulaOrRule:
      'Today\'s Shipped Orders = All orders completed or shipped from processing/hold/cancelled whose status modification timestamp (Date Modified) matches the current operational date.\n' +
      'Gross Shipped Value = Sum of (Item Cost * Quantity) across all shipped items for today.\n' +
      'Strict Integer Standard: All item and order counts must strictly evaluate to integer values (floating-point decimals like 0.5 are forbidden).',
    operationalSOP: 'Check status modification time (date_modified) to determine actual dispatch date, rather than order creation date.',
    keywords: ['today', 'todays', 'today shipped', 'today sales', 'today revenue', 'status modification', 'date modified', 'daily sales', 'shipped orders', 'gross shipped']
  },
  {
    id: 'live_ops_queue_and_todays_orders_rules',
    category: 'live_ops',
    title: 'Warehouse Fulfillment Queue & Today\'s Orders Definition',
    summary: 'Standard definitions for live order fulfillment queue and today\'s incoming order intake.',
    formulaOrRule:
      'Fulfillment Queue = All active orders with status "Processing" OR "Hold" ("On-Hold") awaiting customer verification or warehouse packaging.\n' +
      'Today\'s Orders = Today\'s Shipped Orders + Active orders placed today with "Processing" status.\n' +
      'Previous Day Shipped = Dispatches matching the previous working day (skips Friday in Bangladesh).',
    operationalSOP: 'Orders in Hold status represent phone confirmation or address clarification holds. Resolve holds before shifting to the active packaging line.',
    keywords: ['queue', 'packing queue', 'hold', 'on-hold', 'processing', 'todays orders', 'today orders', 'warehouse queue', 'fulfillment queue', 'previous day shipped']
  },
  {
    id: 'real_time_courier_telemetry_and_discrepancies',
    category: 'courier',
    title: 'Real-Time Courier Telemetry & Automated Discrepancy Detection',
    summary: 'Pathao Hermes live API integration, parcel delivery status tracking, and automated discrepancy classification.',
    formulaOrRule:
      'Standard Courier Categories: Delivered, In Transit, Returned, Partial, Pending Pickup, Untracked.\n' +
      'RETURNED_BUT_SHIPPED: Store considers parcel shipped/completed, but Pathao courier returned parcel to warehouse.\n' +
      'DELIVERED_BUT_PROCESSING: Pathao successfully delivered and collected payment, but store status remains processing.\n' +
      'COD_MISMATCH: Variance > ৳150 between store invoice amount and courier collected cash.',
    operationalSOP: 'Review the Live Operations Discrepancy Ledger daily to claim courier remittance gaps and update store statuses.',
    keywords: ['courier telemetry', 'pathao', 'in transit', 'delivered', 'courier discrepancy', 'cod mismatch', 'returned but shipped', 'delivered but processing', 'handed over', 'cod collected']
  },
  {
    id: 'daily_reconciliation_seven_day_baseline',
    category: 'reconciliation',
    title: 'Daily Reconciliation & 7-Day Rolling Baseline Comparison',
    summary: 'Daily operational baseline using integer-rounded 7-day rolling averages.',
    formulaOrRule:
      '7-Day Average Baseline = Math.round(Sum(Daily Metric over last 7 operational days) / 7)\n' +
      'Evaluates average items/day, average orders/day, average gross revenue/day, and average basket size (AOV).\n' +
      'Volume & Revenue Delta (%) = Math.round(((Today - 7D Daily Avg) / 7D Daily Avg) * 100).',
    operationalSOP: 'Use the 7-day rolling average baseline to detect warehouse bottlenecks, courier handover slowdowns, and daily sales spikes.',
    keywords: ['7-day', '7 day', 'rolling average', 'baseline', 'daily reconciliation', 'reconciliation update', '7-day avg', 'daily trend', 'executive briefing']
  }
];

/**
 * Semantic Knowledge Retrieval function (RAG-like retrieval for BI).
 * Evaluates semantic relevance scores based on query terms, category weights, and active dashboard tab.
 */
export function retrieveRelevantKnowledge(query: string, activeTab?: string, maxResults: number = 3): KnowledgeEntry[] {
  if (!query || typeof query !== 'string') return [];

  const normalizedQuery = query.toLowerCase().trim();
  const queryTokens = normalizedQuery.split(/[\s,._\-?/'"()]+/).filter(t => t.length > 2);

  const scoredEntries = KNOWLEDGE_BASE_ENTRIES.map(entry => {
    let score = 0;

    // 1. Direct title and ID matching (High weight)
    if (normalizedQuery.includes(entry.title.toLowerCase())) {
      score += 25;
    }
    if (normalizedQuery.includes(entry.id.replace(/_/g, ' '))) {
      score += 20;
    }

    // 2. Keyword token matching
    for (const kw of entry.keywords) {
      if (normalizedQuery.includes(kw)) {
        score += 15;
      }
      for (const token of queryTokens) {
        if (kw === token || kw.includes(token)) {
          score += 8;
        }
      }
    }

    // 3. Tab context affinity
    if (activeTab) {
      const tab = activeTab.toLowerCase();
      if (tab.includes('outlet') && entry.category === 'branch') score += 10;
      if (tab.includes('courier') && entry.category === 'courier') score += 10;
      if (tab.includes('risk') && entry.category === 'risk') score += 10;
      if (tab.includes('territory') && entry.id.includes('territory')) score += 10;
      if (tab.includes('orders') && entry.category === 'reconciliation') score += 5;
      if ((tab.includes('live') || tab.includes('liveops')) && (entry.category === 'live_ops' || entry.category === 'courier' || entry.category === 'reconciliation')) score += 12;
    }

    // 4. Content token matching (Summary & Formula)
    const content = `${entry.summary} ${entry.formulaOrRule}`.toLowerCase();
    for (const token of queryTokens) {
      if (content.includes(token)) {
        score += 3;
      }
    }

    return { entry, score };
  });

  // Filter entries with a meaningful relevance score and sort descending
  return scoredEntries
    .filter(item => item.score >= 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => item.entry);
}
