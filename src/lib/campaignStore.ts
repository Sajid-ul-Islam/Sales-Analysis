import { Campaign, SpendingThresholdTier } from '@/types/campaign';

export const DEFAULT_SPENDING_THRESHOLDS: SpendingThresholdTier[] = [
  {
    id: 'tier-1',
    minSpend: 2500,
    discountType: 'FREE_SHIPPING',
    discountAmount: 90, // Covers ৳90 outside Dhaka or ৳50 inside Dhaka delivery
    freeShipping: true,
    label: '৳2,500+ Free Shipping',
  },
  {
    id: 'tier-2',
    minSpend: 3500,
    discountType: 'FIXED_DISCOUNT',
    discountAmount: 150,
    freeShipping: true,
    label: '৳3,500+ Additional ৳150 Off + Free Delivery',
  },
  {
    id: 'tier-3',
    minSpend: 5000,
    discountType: 'FIXED_DISCOUNT',
    discountAmount: 350,
    freeShipping: true,
    label: '৳5,000+ Additional ৳350 Off + Free Delivery',
  },
  {
    id: 'tier-4',
    minSpend: 7000,
    discountType: 'FIXED_DISCOUNT',
    discountAmount: 600,
    freeShipping: true,
    label: '৳7,000+ Additional ৳600 Off + Free Delivery',
  },
];

export const INITIAL_WINTER_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-winter-upgrade-flagship',
    name: 'DEEN Winter Upgrade 2026–2027',
    tagline: 'Buy More. Save More.',
    objective: 'AOV_GROWTH',
    templateType: 'BUY_MORE_SAVE_MORE',
    status: 'ACTIVE',
    startDate: '2026-11-03',
    endDate: '2027-02-15',
    targetAudience: 'Fashion-forward young men, working professionals, and university students across Bangladesh',
    targetSegments: ['REPEAT', 'HIGH_VALUE', 'FIRST_DELIVERED'],
    adBudget: 350000,
    expectedOrders: 2800,
    expectedDeliveredRevenue: 8400000,
    expectedContributionMargin: 3200000,
    discountType: 'TIERED_SPEND',
    discountValue: 15,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS,
    eligibleCategories: ['Jackets', 'Hoodies', 'Sweatshirts', 'Jeans', 'T-Shirts'],
    utmCampaign: 'winter_upgrade_2026',
    utmSource: 'meta_ads',
    utmMedium: 'cpc',
    notes: 'Flagship winter seasonal campaign focusing on wardrobe upgrades with jackets, hoodies, sweatshirts, and denim.',
    tags: ['Winter 26/27', 'Tiered Promo', 'High Margin'],
    isWeatherTriggered: false,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    id: 'camp-winter-is-coming',
    name: 'Winter Is Coming',
    tagline: 'First Chill, First Style',
    objective: 'AWARENESS',
    templateType: 'NEW_ARRIVALS',
    status: 'ACTIVE',
    startDate: '2026-11-03',
    endDate: '2026-11-15',
    targetAudience: 'Top-of-funnel men seeking new winter arrivals and premium jackets in Dhaka & Chittagong',
    targetSegments: ['NEW', 'REPEAT'],
    adBudget: 90000,
    expectedOrders: 750,
    expectedDeliveredRevenue: 2200000,
    expectedContributionMargin: 850000,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS.slice(0, 2),
    eligibleCategories: ['Jackets', 'Hoodies'],
    utmCampaign: 'winter_is_coming_nov',
    utmSource: 'meta_ads',
    utmMedium: 'video_feed',
    notes: 'Early season awareness and customer acquisition before nationwide cold wave.',
    tags: ['Awareness', 'Early Bird', 'Drop 1'],
    isWeatherTriggered: false,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    id: 'camp-winter-upgrade-sale',
    name: 'Winter Upgrade Sale',
    tagline: 'Complete Your Cold-Weather Look',
    objective: 'CONVERSION',
    templateType: 'BUNDLE_OFFER',
    status: 'SCHEDULED',
    startDate: '2026-11-16',
    endDate: '2026-11-30',
    targetAudience: 'Cart abandoners and prior buyers with denim & knitwear interest',
    targetSegments: ['FIRST_DELIVERED', 'REPEAT', 'LOYAL'],
    adBudget: 120000,
    expectedOrders: 1100,
    expectedDeliveredRevenue: 3600000,
    expectedContributionMargin: 1450000,
    discountType: 'BUNDLE',
    discountValue: 18,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS,
    eligibleCategories: ['Jackets', 'Jeans', 'Sweatshirts'],
    utmCampaign: 'winter_upgrade_sale_nov',
    utmSource: 'meta_ads',
    utmMedium: 'carousel',
    notes: 'Conversion acceleration with bundled Denim Jacket + Jeans and Hoodie + Tee combos.',
    tags: ['Bundle Sale', 'High AOV', 'Conversion'],
    isWeatherTriggered: false,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    id: 'camp-winter-drop',
    name: 'The Winter Drop',
    tagline: 'Heavyweight Fleece & Quilted Warmth',
    objective: 'CONVERSION',
    templateType: 'PRODUCT_LAUNCH',
    status: 'SCHEDULED',
    startDate: '2026-12-01',
    endDate: '2026-12-15',
    targetAudience: 'Premium apparel seekers looking for heavy winter fleece, puffers, and overshirts',
    targetSegments: ['HIGH_VALUE', 'LOYAL', 'REPEAT'],
    adBudget: 150000,
    expectedOrders: 1350,
    expectedDeliveredRevenue: 4400000,
    expectedContributionMargin: 1750000,
    discountType: 'TIERED_SPEND',
    discountValue: 12,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS,
    eligibleCategories: ['Jackets', 'Hoodies'],
    utmCampaign: 'winter_drop_dec',
    utmSource: 'meta_ads',
    utmMedium: 'reels',
    notes: 'Peak December mid-winter drop with premium photography and lookbook showcase.',
    tags: ['Heavy Fleece', 'Premium', 'Drop 2'],
    isWeatherTriggered: false,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    id: 'camp-yearend-deals',
    name: 'Year-End Winter Deals',
    tagline: 'Celebrate Victory & Year-End in Style',
    objective: 'CONVERSION',
    templateType: 'WINTER_SALE',
    status: 'SCHEDULED',
    startDate: '2026-12-16',
    endDate: '2026-12-31',
    targetAudience: 'Holiday gift shoppers and year-end wardrobe refresh buyers across major divisional cities',
    targetSegments: ['NEW', 'REPEAT', 'DISCOUNT_SENSITIVE'],
    adBudget: 160000,
    expectedOrders: 1600,
    expectedDeliveredRevenue: 5100000,
    expectedContributionMargin: 1900000,
    discountType: 'TIERED_SPEND',
    discountValue: 20,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS,
    eligibleCategories: ['Jackets', 'Hoodies', 'Sweatshirts', 'Jeans'],
    utmCampaign: 'yearend_deals_2026',
    utmSource: 'meta_ads',
    utmMedium: 'cpc',
    notes: 'Victory Day (Dec 16) through New Year holiday rush with festive offers.',
    tags: ['Victory Day', 'Year-End', 'Holiday Sale'],
    isWeatherTriggered: false,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    id: 'camp-cold-wave-flash',
    name: 'Cold Wave Flash Sale',
    tagline: 'When Temperature Drops, Warmth Rises',
    objective: 'WEATHER_RESPONSIVE',
    templateType: 'FLASH_SALE',
    status: 'SCHEDULED',
    startDate: '2027-01-01',
    endDate: '2027-01-20',
    targetAudience: 'Northern and regional districts (Rajshahi, Rangpur, Sylhet) experiencing northern cold snaps',
    targetSegments: ['NEW', 'REPEAT', 'HIGH_VALUE'],
    adBudget: 110000,
    expectedOrders: 1200,
    expectedDeliveredRevenue: 3800000,
    expectedContributionMargin: 1500000,
    discountType: 'FIXED_AMOUNT',
    discountValue: 250,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS,
    eligibleCategories: ['Jackets', 'Hoodies'],
    utmCampaign: 'cold_wave_flash_jan',
    utmSource: 'meta_ads',
    utmMedium: 'stories',
    notes: 'Weather-triggered flash sale activating when minimum temperature falls below 14°C.',
    tags: ['Weather-Triggered', 'Flash Sale', 'Northern Cold Wave'],
    isWeatherTriggered: true,
    weatherCondition: 'Temperature below 14°C in North/Central Bangladesh',
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
  {
    id: 'camp-winter-clearance',
    name: 'Winter Clearance',
    tagline: 'Final Call: Last Sizes & Big Savings',
    objective: 'LIQUIDATION',
    templateType: 'CLEARANCE',
    status: 'SCHEDULED',
    startDate: '2027-01-21',
    endDate: '2027-02-15',
    targetAudience: 'Bargain hunters and price-conscious shoppers looking for late-winter deals',
    targetSegments: ['DISCOUNT_SENSITIVE', 'INACTIVE', 'NEW'],
    adBudget: 80000,
    expectedOrders: 950,
    expectedDeliveredRevenue: 2400000,
    expectedContributionMargin: 720000,
    discountType: 'PERCENTAGE',
    discountValue: 25,
    spendingThresholds: DEFAULT_SPENDING_THRESHOLDS.slice(0, 2),
    eligibleCategories: ['Jackets', 'Hoodies', 'Sweatshirts'],
    utmCampaign: 'winter_clearance_feb',
    utmSource: 'meta_ads',
    utmMedium: 'carousel',
    notes: 'Controlled inventory liquidation for remaining winter stock before Spring/Summer 2027 transition.',
    tags: ['Clearance', 'Liquidation', 'Late Season'],
    isWeatherTriggered: false,
    createdAt: '2026-11-03T00:00:00.000Z',
    updatedAt: '2026-11-03T00:00:00.000Z',
  },
];

const LOCAL_STORAGE_KEY = 'deen_marketing_campaigns_v1';

export function getStoredCampaigns(): Campaign[] {
  if (typeof window === 'undefined') {
    return INITIAL_WINTER_CAMPAIGNS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_WINTER_CAMPAIGNS));
      return INITIAL_WINTER_CAMPAIGNS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_WINTER_CAMPAIGNS;
  } catch (err) {
    console.warn('Failed to parse stored campaigns, using defaults:', err);
    return INITIAL_WINTER_CAMPAIGNS;
  }
}

export function saveCampaignsToStore(campaigns: Campaign[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(campaigns));
  } catch (err) {
    console.error('Failed to save campaigns to localStorage:', err);
  }
}

export function saveSingleCampaign(campaign: Campaign): Campaign[] {
  const existing = getStoredCampaigns();
  const idx = existing.findIndex((c) => c.id === campaign.id);
  const updatedCampaign = {
    ...campaign,
    updatedAt: new Date().toISOString(),
  };

  let next: Campaign[];
  if (idx >= 0) {
    next = [...existing];
    next[idx] = updatedCampaign;
  } else {
    next = [updatedCampaign, ...existing];
  }

  saveCampaignsToStore(next);
  return next;
}

export function deleteStoredCampaign(campaignId: string): Campaign[] {
  const existing = getStoredCampaigns();
  const next = existing.filter((c) => c.id !== campaignId);
  saveCampaignsToStore(next);
  return next;
}

export function resetCampaignsToDefault(): Campaign[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  return INITIAL_WINTER_CAMPAIGNS;
}
