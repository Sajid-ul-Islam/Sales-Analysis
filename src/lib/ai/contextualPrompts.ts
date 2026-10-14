export interface TabContextConfig {
  id: string;
  label: string;
  badge: string;
  summaryFocus: string;
  prompts: string[];
}

export const TAB_CONTEXT_REGISTRY: Record<string, TabContextConfig> = {
  tabExecutive: {
    id: 'tabExecutive',
    label: 'Executive Overview',
    badge: 'Executive KPIs',
    summaryFocus: 'High-level KPI overview, GMV vs net delivered revenue, overall return rates, and financial disposition.',
    prompts: [
      'Summarize our overall return risk, territory ratio, and net revenue',
      'What is our net realized revenue vs gross dispatched?',
      'What are the top 3 operational priorities for DEEN Commerce this week?',
      'What is our cash collected by courier vs courier fees paid?'
    ]
  },
  tabOrders: {
    id: 'tabOrders',
    label: 'Orders Ledger',
    badge: 'Master Ledger',
    summaryFocus: 'Transactional master ledger of all clean and dispatched store orders.',
    prompts: [
      'Which orders have pending COD settlement from Pathao?',
      'Show orders where collected COD was less than invoice price',
      'Explain our net delivered revenue across dispatched orders',
      'What percentage of orders have customer phones from Outside Dhaka?'
    ]
  },
  tabItemReturns: {
    id: 'tabItemReturns',
    label: 'Returned Items',
    badge: 'Returns Flow',
    summaryFocus: 'Item-level return inventory, full vs partial returns, and shipping fee deductions.',
    prompts: [
      'Which SKUs have the highest return frequency and return loss?',
      'What is the breakdown of Paid Return vs Non-Paid Return items?',
      'How much delivery charge did we lose on unpaid returns?',
      'Which apparel categories (e.g. Panjabi, Polo, Jeans) return most?'
    ]
  },
  tabCourierMismatch: {
    id: 'tabCourierMismatch',
    label: 'Courier Audit',
    badge: 'Courier Reconciliation',
    summaryFocus: 'Pathao courier delivery reconciliation, status mismatches, and uncollected COD variance.',
    prompts: [
      'What are the most critical courier status discrepancies?',
      'How much cash is trapped in uncollected courier COD variance?',
      'Which orders are marked delivered by Pathao but missing in store?',
      'What actions should operations take to claim courier disputes?'
    ]
  },
  tabOutletDispatch: {
    id: 'tabOutletDispatch',
    label: 'Outlet Dispatch',
    badge: 'Branch Dispatches',
    summaryFocus: 'Orders fulfilled and dispatched from retail branches (Mirpur POS, Cumilla, Wari, Sylhet).',
    prompts: [
      'Which retail branch dispatched the highest parcel volume?',
      'Compare branch dispatch return rates vs central warehouse',
      'Are branch-dispatched items returned more often?',
      'How do branch suffixes (c, w, s, m) map to order delivery success?'
    ]
  },
  tabOutletSales: {
    id: 'tabOutletSales',
    label: 'Outlet Sales',
    badge: 'POS Performance',
    summaryFocus: 'Branch POS retail register sales, walk-in performance, and store inventory velocity.',
    prompts: [
      'Compare revenue generated across Mirpur, Cumilla, Wari, and Sylhet',
      'What is the average transaction value per retail branch?',
      'Which outlet has the healthiest sales-to-return ratio?',
      'How does physical POS revenue complement online D2C orders?'
    ]
  },
  tabTerritory: {
    id: 'tabTerritory',
    label: 'Territory Distribution',
    badge: 'Geographic Intelligence',
    summaryFocus: 'Bangladesh 8-division geographic breakdown, linehaul logistics, and district RTO.',
    prompts: [
      'Why is the Outside Dhaka return rate higher than Dhaka Metro?',
      'Which administrative division generates our highest net revenue?',
      'What is our linehaul logistics cost for Chittagong vs Sylhet?',
      'Which districts have high return rates requiring shipping advance?'
    ]
  },
  tabExchanges: {
    id: 'tabExchanges',
    label: 'Exchanges',
    badge: 'Size Replacements',
    summaryFocus: 'Size replacement orders (D- / DD- prefixes) and COD price differential collection.',
    prompts: [
      'How many exchange orders (D- / DD-) were processed?',
      'What is the total COD collected on replacement deliveries?',
      'Which products have the highest size exchange rate?',
      'Do exchanged parcels result in net profit or break even?'
    ]
  },
  tabMarketingAnalytics: {
    id: 'tabMarketingAnalytics',
    label: 'Ad Analytics',
    badge: 'Marketing ROAS',
    summaryFocus: 'Meta and Google ad spend, customer acquisition cost (CAC), and blended return-adjusted ROAS.',
    prompts: [
      'What is our true blended ROAS after accounting for return deductions?',
      'Are marketing ad campaigns driving customers with high return risk?',
      'Compare customer acquisition cost (CAC) against net realized revenue',
      'Which ad campaigns deliver the highest verified delivered margin?'
    ]
  },
  tabSku: {
    id: 'tabSku',
    label: 'SKU Flow',
    badge: 'Catalog Velocity',
    summaryFocus: 'Product-level velocity, SKU gross vs net units, and return rates by variation.',
    prompts: [
      'Which SKUs generate 80% of our net realized revenue?',
      'Identify low-margin SKUs with high return rates to discontinue',
      'Compare size variation return rates (e.g. XL vs M)',
      'What are our top 5 hero apparel products this month?'
    ]
  },
  tabCustomerRisk: {
    id: 'tabCustomerRisk',
    label: 'Customer Risk',
    badge: 'RTO Risk Monitor',
    summaryFocus: 'Serial returners, repeat order profiles, RTO thresholds, and customer phone risk tiers.',
    prompts: [
      'Who are our top high-risk serial returners?',
      'What is the return rate for customers with more than 3 orders?',
      'Should we require advance delivery fee for HIGH_RISK customers?',
      'How many customers have a 100% return rate history?'
    ]
  },
  tabStatus: {
    id: 'tabStatus',
    label: 'Status Matrix',
    badge: 'Knapsack DP Decomposition',
    summaryFocus: 'Knapsack dynamic programming partial order decomposition and fulfillment status matrix.',
    prompts: [
      'Explain the Knapsack DP partial acceptance logic for multi-item orders',
      'How many orders had partial acceptance where customer kept 1 item?',
      'What is our full return rate vs partial delivery rate?',
      'How are partial delivery charges accounted for in net sales?'
    ]
  },
  tabUnitEconomics: {
    id: 'tabUnitEconomics',
    label: 'Unit Economics',
    badge: 'Contribution Margin',
    summaryFocus: 'True contribution margin per order, courier fees, return losses, and profit erosion.',
    prompts: [
      'What is our true contribution margin after return shipping losses?',
      'How much does each returned parcel erode our net profit?',
      'What is our courier delivery fee expense ratio to gross GMV?',
      'What average order value (AOV) do we need to break even on returns?'
    ]
  },
  tabSettings: {
    id: 'tabSettings',
    label: 'Settings & Themes',
    badge: 'System Architecture',
    summaryFocus: 'WooCommerce API credentials, Pathao API sync, BYOK keys, and system preferences.',
    prompts: [
      'How do I configure Bring Your Own Key (BYOK) for Gemini AI?',
      'Check status of live WooCommerce and Pathao API connections',
      'How does the offline spreadsheet mode compare to Cloud API mode?',
      'How do custom themes and deep black OLED mode get persisted?'
    ]
  }
};

export function getTabContext(tabId?: string): TabContextConfig {
  if (!tabId || !TAB_CONTEXT_REGISTRY[tabId]) {
    return TAB_CONTEXT_REGISTRY.tabExecutive;
  }
  return TAB_CONTEXT_REGISTRY[tabId];
}
