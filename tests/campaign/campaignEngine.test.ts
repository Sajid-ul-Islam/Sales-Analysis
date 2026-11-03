import { describe, it, expect } from 'vitest';
import {
  evaluateThresholdSustainability,
  generateBundleProposals,
  detectPromotionConflicts,
  simulateMarketingBudgetScenarios,
  analyzeProductOpportunities,
  segmentCustomersByRfm,
  aggregateCampaignPerformance,
  generateCreativeBriefsForCampaign,
} from '@/lib/campaignEngine';
import { DEFAULT_SPENDING_THRESHOLDS, INITIAL_WINTER_CAMPAIGNS } from '@/lib/campaignStore';
import { ReconciledOrderRow } from '@/types';

// Mock order fixtures for testing
const mockOrders: ReconciledOrderRow[] = [
  {
    orderId: '1001',
    lineStatus: 'Primary Item',
    deliveryStatus: 'Delivered',
    orderCategory: 'DELIVERED',
    orderDeliveryStatus: 'Delivered',
    itemDeliveryStatus: 'Delivered',
    orderDate: new Date('2026-11-01'),
    customerName: 'Tanvir Ahmed',
    phone: '01711112233',
    city: 'Dhaka',
    districtArea: 'Inside Dhaka',
    sku: 'JKT-DNM-01',
    itemName: 'TIFFOSI Denim Jacket - L',
    quantity: 1,
    itemCost: 2800,
    orderAmount: 2800,
    netRevenueImpact: 2800,
    paymentMethod: 'cod',
    hasSplitSuffix: false,
    cogsEstimate: 1150,
  },
  {
    orderId: '1002',
    lineStatus: 'Primary Item',
    deliveryStatus: 'Delivered',
    orderCategory: 'DELIVERED',
    orderDeliveryStatus: 'Delivered',
    itemDeliveryStatus: 'Delivered',
    orderDate: new Date('2026-11-02'),
    customerName: 'Rafiqul Islam',
    phone: '01822334455',
    city: 'Chittagong',
    districtArea: 'Outside Dhaka',
    sku: 'JNS-AE-02',
    itemName: 'American Eagle Slim Jeans - 32',
    quantity: 1,
    itemCost: 2200,
    orderAmount: 3600,
    netRevenueImpact: 3600,
    paymentMethod: 'cod',
    hasSplitSuffix: false,
    cogsEstimate: 950,
  },
  {
    orderId: '1002',
    lineStatus: 'Additional Item',
    deliveryStatus: 'Delivered',
    orderCategory: 'DELIVERED',
    orderDeliveryStatus: 'Delivered',
    itemDeliveryStatus: 'Delivered',
    orderDate: new Date('2026-11-02'),
    customerName: 'Rafiqul Islam',
    phone: '01822334455',
    city: 'Chittagong',
    districtArea: 'Outside Dhaka',
    sku: 'TEE-WHT-01',
    itemName: 'DEEN Heavyweight Tee - White - L',
    quantity: 1,
    itemCost: 1400,
    orderAmount: 3600,
    netRevenueImpact: 0,
    paymentMethod: 'cod',
    hasSplitSuffix: false,
    cogsEstimate: 500,
  },
  {
    orderId: '1003',
    lineStatus: 'Primary Item',
    deliveryStatus: 'Returned',
    orderCategory: 'FULL_RETURN',
    orderDeliveryStatus: 'Paid Return',
    itemDeliveryStatus: 'Returned',
    orderDate: new Date('2026-10-25'),
    customerName: 'Kamal Hossain',
    phone: '01933445566',
    city: 'Sylhet',
    districtArea: 'Outside Dhaka',
    sku: 'SWT-CRW-03',
    itemName: 'Crewneck Sweatshirt - Navy - XL',
    quantity: 1,
    itemCost: 1850,
    orderAmount: 1850,
    netRevenueImpact: 0,
    paymentMethod: 'cod',
    hasSplitSuffix: false,
    cogsEstimate: 780,
  },
  {
    orderId: '1004',
    lineStatus: 'Primary Item',
    deliveryStatus: 'Delivered',
    orderCategory: 'DELIVERED',
    orderDeliveryStatus: 'Delivered',
    itemDeliveryStatus: 'Delivered',
    orderDate: new Date('2026-11-03'),
    customerName: 'Tanvir Ahmed',
    phone: '01711112233', // Repeat customer
    city: 'Dhaka',
    districtArea: 'Inside Dhaka',
    sku: 'HOD-BLK-04',
    itemName: 'Heavy Fleece Hoodie - Black - L',
    quantity: 1,
    itemCost: 2600,
    orderAmount: 5200,
    netRevenueImpact: 5200,
    paymentMethod: 'bkash',
    hasSplitSuffix: false,
    cogsEstimate: 1100,
  },
];

describe('DEEN Campaign Intelligence Engine', () => {
  describe('1. Buy More, Save More Threshold Sustainability', () => {
    it('evaluates threshold sustainability accurately for Tier 1 (৳2,500+)', () => {
      const tier = DEFAULT_SPENDING_THRESHOLDS[0];
      const result = evaluateThresholdSustainability(tier, mockOrders, 55, 80);

      expect(result.tier.minSpend).toBe(2500);
      expect(result.eligibleOrdersCount).toBeGreaterThanOrEqual(1);
      expect(result.grossProfitBeforePromo).toBeGreaterThan(0);
      expect(typeof result.marginPercent).toBe('number');
      expect(typeof result.isSustainable).toBe('boolean');
    });

    it('flags unsustainable or thin-margin promotional rules', () => {
      // Overly aggressive promo: ৳1,500 discount on ৳2,000 cart
      const extremeTier = {
        id: 'bad-tier',
        minSpend: 2000,
        discountType: 'FIXED_DISCOUNT' as const,
        discountAmount: 1400,
        freeShipping: true,
        label: 'Loss-making test tier',
      };

      const result = evaluateThresholdSustainability(extremeTier, mockOrders, 50, 90);
      expect(result.isSustainable).toBe(false);
      expect(result.warning).toBeDefined();
    });
  });

  describe('2. Intelligent Product Bundle Generator', () => {
    it('generates grounded product bundles with positive contribution margin', () => {
      const proposals = generateBundleProposals(mockOrders, 18);
      expect(proposals.length).toBeGreaterThan(0);

      const first = proposals[0];
      expect(first.items.length).toBeGreaterThanOrEqual(2);
      expect(first.finalBundlePrice).toBeLessThan(first.totalRegularPrice);
      expect(first.bundleDiscountAmount).toBe(first.totalRegularPrice - first.finalBundlePrice);
      expect(first.grossContribution).toBe(first.finalBundlePrice - first.totalEstimatedCogs);
      expect(first.netContribution).toBe(first.grossContribution - first.deliveryAndOpsCost);
      expect(['PROFITABLE', 'BORDERLINE', 'MARGIN_DILUTING']).toContain(first.status);
    });
  });

  describe('3. Promotion Conflict & Stacking Detection', () => {
    it('detects dangerously stacked discounts', () => {
      const check = detectPromotionConflicts({
        regularPrice: 3000,
        saleDiscountPercent: 20, // ৳600 off -> ৳2,400
        couponDiscountAmount: 500, // ৳500 off -> ৳1,900
        bundleDiscountPercent: 15, // ৳360 off -> ৳1,540
        freeShippingCost: 90,
        estimatedCogs: 1300, // COGS ৳1,300 + Courier ৳135 = ৳1,435
      });

      expect(check.hasConflict).toBe(true);
      expect(check.warnings.length).toBeGreaterThan(0);
      expect(check.effectiveDiscountPercent).toBeGreaterThan(30);
    });

    it('passes clean, non-conflicting promotions', () => {
      const check = detectPromotionConflicts({
        regularPrice: 3000,
        saleDiscountPercent: 0,
        couponDiscountAmount: 0,
        bundleDiscountPercent: 15,
        freeShippingCost: 0,
        estimatedCogs: 1200,
      });

      expect(check.hasConflict).toBe(false);
      expect(check.warnings.length).toBe(0);
      expect(check.netMarginPercent).toBeGreaterThan(25);
    });
  });

  describe('4. Marketing Budget & Profitability Simulator', () => {
    it('generates Conservative, Expected, and Optimistic scenarios', () => {
      const scenarios = simulateMarketingBudgetScenarios({
        monthlyAdBudget: 150000,
        campaignDurationDays: 14,
        expectedCpc: 12,
        conversionRatePercent: 2.2,
        expectedAov: 2900,
        productGrossMarginPercent: 55,
        discountPerOrder: 150,
        deliverySubsidyPerOrder: 70,
        deliveryRetentionRatePercent: 84,
        returnPackagingCost: 25,
      });

      expect(scenarios).toHaveLength(3);
      const [cons, exp, opt] = scenarios;

      expect(cons.scenarioName).toBe('CONSERVATIVE');
      expect(exp.scenarioName).toBe('EXPECTED');
      expect(opt.scenarioName).toBe('OPTIMISTIC');

      // Optimistic should have higher delivered orders & revenue than conservative
      expect(opt.deliveredOrders).toBeGreaterThan(cons.deliveredOrders);
      expect(opt.deliveredRevenue).toBeGreaterThan(cons.deliveredRevenue);
      expect(opt.roas).toBeGreaterThan(cons.roas);

      // Verify delivered revenue != gross revenue (returns accounted for)
      expect(exp.deliveredRevenue).toBeLessThan(exp.grossRevenue);
      expect(exp.deliveredOrders).toBeLessThan(exp.orders);
    });
  });

  describe('5. Product Opportunity Finder', () => {
    it('categorizes products and returns top recommendations with reasons', () => {
      const result = analyzeProductOpportunities(mockOrders);

      expect(result.opportunities.length).toBeGreaterThan(0);
      expect(result.top10Recommendations.length).toBeLessThanOrEqual(10);

      // Verify all recommendations have actionable grounded reasoning
      for (const rec of result.top10Recommendations) {
        expect(rec.title).toBeTruthy();
        expect(rec.action).toBeTruthy();
        expect(rec.reason).toBeTruthy();
        expect(rec.recommendationScore).toBeGreaterThanOrEqual(0);
        expect(rec.recommendationScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('6. Customer RFM Segmentation & Retention', () => {
    it('segments customers into standard profiles with grounded metrics', () => {
      const { segments, totalCustomers } = segmentCustomersByRfm(mockOrders);

      expect(totalCustomers).toBeGreaterThan(0);
      expect(segments.length).toBe(8);

      const segmentTypes = segments.map((s) => s.type);
      expect(segmentTypes).toContain('NEW');
      expect(segmentTypes).toContain('REPEAT');
      expect(segmentTypes).toContain('HIGH_VALUE');
      expect(segmentTypes).toContain('HIGH_RETURN_RISK');

      for (const seg of segments) {
        expect(seg.suggestedCampaign).toBeTruthy();
        expect(seg.suggestedOffer).toBeTruthy();
      }
    });
  });

  describe('7. Campaign Creative Brief Studio', () => {
    it('generates multi-format briefs in English and Bangla for DEEN campaigns', () => {
      const campaign = INITIAL_WINTER_CAMPAIGNS[0];
      const briefs = generateCreativeBriefsForCampaign(campaign);

      expect(briefs.length).toBe(6);
      const fbFeed = briefs.find((b) => b.format === 'FACEBOOK_FEED');
      expect(fbFeed).toBeDefined();
      expect(fbFeed?.headlineEn).toContain(campaign.name);
      expect(fbFeed?.headlineBn).toBeTruthy();
      expect(fbFeed?.primaryTextEn).toBeTruthy();
      expect(fbFeed?.primaryTextBn).toBeTruthy();

      const reel = briefs.find((b) => b.format === 'INSTAGRAM_REEL');
      expect(reel?.videoScriptOutline).toBeDefined();
    });
  });

  describe('8. Multi-Channel Performance Aggregation', () => {
    it('computes delivered ROAS and strictly separates delivered from placed revenue', () => {
      const { overviewKpis, channelMetrics } = aggregateCampaignPerformance(mockOrders, 100000);

      expect(overviewKpis.totalCampaignRevenue).toBeGreaterThanOrEqual(overviewKpis.deliveredCampaignRevenue);
      expect(overviewKpis.placedOrdersCount).toBeGreaterThanOrEqual(overviewKpis.deliveredOrdersCount);
      expect(typeof overviewKpis.deliveredRoas).toBe('number');
      expect(typeof overviewKpis.customerAcquisitionCost).toBe('number');
      expect(channelMetrics.length).toBeGreaterThan(0);
    });
  });
});
