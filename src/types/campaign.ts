/**
 * Campaign Intelligence & Marketing Strategy Data Contracts
 * Winter 2026-2027 • DEEN Commerce
 */

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';

export type CampaignObjective =
  | 'AWARENESS'
  | 'ACQUISITION'
  | 'AOV_GROWTH'
  | 'CONVERSION'
  | 'LIQUIDATION'
  | 'RETENTION'
  | 'WEATHER_RESPONSIVE';

export type MarketingChannel =
  | 'META_ADS'
  | 'INSTAGRAM'
  | 'GOOGLE_ADS'
  | 'ORGANIC_SOCIAL'
  | 'INFLUENCER'
  | 'REFERRAL'
  | 'DIRECT'
  | 'EMAIL_SMS'
  | 'OTHER';

export type CampaignTemplateType =
  | 'WINTER_SALE'
  | 'FLASH_SALE'
  | 'BUNDLE_OFFER'
  | 'BUY_MORE_SAVE_MORE'
  | 'NEW_ARRIVALS'
  | 'CLEARANCE'
  | 'REFERRAL'
  | 'CUSTOMER_RETENTION'
  | 'REPEAT_PURCHASE'
  | 'PRODUCT_LAUNCH'
  | 'LOOKBOOK'
  | 'OUTLET_PROMO';

export interface SpendingThresholdTier {
  id: string;
  minSpend: number; // e.g. 2500
  discountType: 'FREE_SHIPPING' | 'FIXED_DISCOUNT' | 'PERCENT_DISCOUNT';
  discountAmount: number; // e.g. 150 for ৳150 off, 0 for free shipping
  freeShipping: boolean;
  label: string; // e.g. "৳2,500+ Free Shipping"
}

export interface PromotionSustainability {
  tier: SpendingThresholdTier;
  eligibleOrdersCount: number;
  estimatedIncrementalAov: number;
  discountExpenditure: number;
  deliverySubsidy: number;
  grossProfitBeforePromo: number;
  projectedContributionMargin: number;
  marginPercent: number;
  breakEvenOrders: number;
  isSustainable: boolean;
  warning?: string;
}

export interface BundleItemSpec {
  productId: string;
  title: string;
  category: string;
  regularPrice: number;
  estimatedCogs: number;
  stockAvailable: number;
  returnRate: number;
}

export interface BundleProposal {
  id: string;
  name: string;
  tagline: string;
  items: BundleItemSpec[];
  totalRegularPrice: number;
  bundleDiscountPercent: number;
  bundleDiscountAmount: number;
  finalBundlePrice: number;
  totalEstimatedCogs: number;
  deliveryAndOpsCost: number;
  grossContribution: number;
  netContribution: number;
  netMarginPercent: number;
  status: 'PROFITABLE' | 'BORDERLINE' | 'MARGIN_DILUTING';
  reasoning: string;
  coPurchaseLift?: number;
}

export type ProductOpportunityGroup =
  | 'BEST_SELLER'
  | 'HIGH_MARGIN'
  | 'SLOW_MOVING'
  | 'HIGH_RETURN'
  | 'BUNDLE_CANDIDATE'
  | 'CLEARANCE';

export interface ProductOpportunity {
  productId: string;
  title: string;
  category: string;
  group: ProductOpportunityGroup;
  avgPrice: number;
  deliveredSales: number;
  grossUnits: number;
  deliveredUnits: number;
  returnRate: number;
  marginPercent: number;
  velocity: number; // daily units
  estimatedStock: number;
  recommendationScore: number; // 0-100
  action: string;
  reason: string;
  suggestedOffer?: string;
  pairedProductId?: string;
}

export type CustomerSegmentType =
  | 'NEW'
  | 'FIRST_DELIVERED'
  | 'REPEAT'
  | 'HIGH_VALUE'
  | 'LOYAL'
  | 'INACTIVE'
  | 'DISCOUNT_SENSITIVE'
  | 'HIGH_RETURN_RISK';

export interface CustomerSegmentProfile {
  type: CustomerSegmentType;
  name: string;
  description: string;
  customerCount: number;
  totalRealizedRevenue: number;
  avgAov: number;
  avgDeliveredOrders: number;
  avgReturnRate: number;
  suggestedCampaign: string;
  suggestedOffer: string;
  topCategories: string[];
}

export interface BudgetSimulationInput {
  monthlyAdBudget: number;
  campaignDurationDays: number;
  expectedCpc: number;
  conversionRatePercent: number;
  expectedAov: number;
  productGrossMarginPercent: number;
  discountPerOrder: number;
  deliverySubsidyPerOrder: number;
  deliveryRetentionRatePercent: number;
  returnPackagingCost: number;
}

export interface BudgetScenarioResult {
  scenarioName: 'CONSERVATIVE' | 'EXPECTED' | 'OPTIMISTIC';
  multiplier: number;
  clicks: number;
  orders: number;
  deliveredOrders: number;
  grossRevenue: number;
  deliveredRevenue: number;
  grossProfit: number;
  adSpend: number;
  discountCost: number;
  courierAndPackagingCost: number;
  netContributionMargin: number;
  roas: number;
  breakEvenRoas: number;
  cac: number;
  breakEvenCac: number;
  roiPercent: number;
}

export interface CampaignCreativeBrief {
  id: string;
  campaignId: string;
  campaignName: string;
  title: string;
  format: 'FACEBOOK_FEED' | 'INSTAGRAM_REEL' | 'FACEBOOK_STORY' | 'CAROUSEL' | 'PROMO_BANNER' | 'INFLUENCER_BRIEF';
  headlineEn: string;
  headlineBn: string;
  primaryTextEn: string;
  primaryTextBn: string;
  cta: string;
  targetAudience: string;
  creativeConcept: string;
  photographySuggestion: string;
  videoScriptOutline?: string;
  offerDetails: string;
}

export interface CampaignAttributionMetric {
  channel: MarketingChannel;
  channelLabel: string;
  placedOrders: number;
  deliveredOrders: number;
  placedRevenue: number;
  realizedRevenue: number;
  adSpend: number;
  deliveredRoas: number;
  cac: number;
  contributionMargin: number;
  returnRate: number;
  source: 'VERIFIED_COUPON' | 'UTM_MATCHED' | 'MANUAL_IMPORT' | 'ESTIMATED_BENCHMARK';
}

export interface Campaign {
  id: string;
  name: string;
  tagline: string;
  objective: CampaignObjective;
  templateType: CampaignTemplateType;
  status: CampaignStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  targetAudience: string;
  targetSegments: CustomerSegmentType[];
  adBudget: number;
  expectedOrders: number;
  expectedDeliveredRevenue: number;
  expectedContributionMargin: number;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TIERED_SPEND' | 'BUNDLE';
  discountValue: number;
  spendingThresholds?: SpendingThresholdTier[];
  eligibleCategories?: string[];
  eligibleProductIds?: string[];
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
  notes?: string;
  tags?: string[];
  isWeatherTriggered?: boolean;
  weatherCondition?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignOverviewKpis {
  totalCampaignRevenue: number;
  deliveredCampaignRevenue: number;
  campaignContributionMargin: number;
  campaignAdSpend: number;
  marketingRoi: number;
  deliveredRoas: number;
  averageOrderValue: number;
  customerAcquisitionCost: number;
  deliveryRetentionRate: number;
  repeatPurchaseRate: number;
  discountCost: number;
  returnAndCancellationRate: number;
  placedOrdersCount: number;
  deliveredOrdersCount: number;
  returnedOrdersCount: number;
  netMarginPercent: number;
}
