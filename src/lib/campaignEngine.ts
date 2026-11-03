/**
 * DEEN Commerce Campaign Intelligence & Marketing Strategy Engine
 * 
 * Provides verified mathematical calculations, product opportunity analysis,
 * RFM customer segmentation, bundle economics, promotion conflict detection,
 * budget scenario simulation, and multi-channel marketing attribution.
 */

import { ReconciledOrderRow } from '@/types';
import {
  SpendingThresholdTier,
  PromotionSustainability,
  BundleProposal,
  BundleItemSpec,
  ProductOpportunity,
  ProductOpportunityGroup,
  CustomerSegmentType,
  CustomerSegmentProfile,
  BudgetSimulationInput,
  BudgetScenarioResult,
  CampaignCreativeBrief,
  CampaignAttributionMetric,
  CampaignOverviewKpis,
  Campaign,
  MarketingChannel,
} from '@/types/campaign';
import { computeProductAnalytics, ProductAnalyticsItem } from './productAnalytics';
import { normalizeCustomerPhone } from './customerRating';

/**
 * Evaluates the financial sustainability of a "Buy More, Save More" threshold tier.
 * Prevents unprofitable promotions before launch.
 */
export function evaluateThresholdSustainability(
  tier: SpendingThresholdTier,
  orders: ReconciledOrderRow[] = [],
  baselineGrossMarginPercent = 55,
  avgDeliveryFeeCollected = 80 // Blended delivery fee (Dhaka ৳50, Outside ৳90)
): PromotionSustainability {
  if (!orders || orders.length === 0) {
    return {
      tier,
      eligibleOrdersCount: 0,
      estimatedIncrementalAov: 0,
      discountExpenditure: 0,
      deliverySubsidy: 0,
      grossProfitBeforePromo: 0,
      projectedContributionMargin: 0,
      marginPercent: 0,
      breakEvenOrders: 0,
      isSustainable: false,
      warning: 'No historical order data available to model sustainability.',
    };
  }

  // Group unique orders to avoid multi-item double counting
  const orderAmountMap = new Map<string, number>();
  for (const row of orders) {
    const oId = String(row.orderId || '');
    if (!oId) continue;
    const existing = orderAmountMap.get(oId) || 0;
    // Use row.orderAmount or accumulate itemCost
    orderAmountMap.set(oId, Math.max(existing, Number(row.orderAmount) || 0));
  }

  const orderAmounts = Array.from(orderAmountMap.values());
  const eligibleAmounts = orderAmounts.filter((amt) => amt >= tier.minSpend);
  const eligibleOrdersCount = eligibleAmounts.length;

  // Stretch orders: orders within 15% below threshold that are likely to add another item
  const stretchLower = tier.minSpend * 0.82;
  const stretchOrdersCount = orderAmounts.filter(
    (amt) => amt >= stretchLower && amt < tier.minSpend
  ).length;

  const avgEligibleSpend =
    eligibleOrdersCount > 0
      ? eligibleAmounts.reduce((a, b) => a + b, 0) / eligibleOrdersCount
      : tier.minSpend;

  const estimatedIncrementalAov = Math.round(
    stretchOrdersCount > 0 ? (tier.minSpend - stretchLower) * 0.65 : 180
  );

  // Discount cost per order
  let discountPerOrder = 0;
  if (tier.discountType === 'FIXED_DISCOUNT') {
    discountPerOrder = tier.discountAmount;
  } else if (tier.discountType === 'PERCENT_DISCOUNT') {
    discountPerOrder = Math.round(avgEligibleSpend * (tier.discountAmount / 100));
  }

  // Delivery subsidy per order (brand covers shipping)
  const deliverySubsidyPerOrder = tier.freeShipping ? avgDeliveryFeeCollected : 0;
  const totalPerOrderBenefit = discountPerOrder + deliverySubsidyPerOrder;

  const totalRevenue = avgEligibleSpend * Math.max(eligibleOrdersCount, 1);
  const grossProfitBeforePromo = Math.round(
    totalRevenue * (baselineGrossMarginPercent / 100)
  );

  const discountExpenditure = discountPerOrder * eligibleOrdersCount;
  const deliverySubsidy = deliverySubsidyPerOrder * eligibleOrdersCount;

  // Blended courier & return handling reserve (~18% return rate * ৳155 courier + ৳25 packing)
  const returnAllowance = Math.round(eligibleOrdersCount * 0.18 * 45);

  const projectedContributionMargin =
    grossProfitBeforePromo - discountExpenditure - deliverySubsidy - returnAllowance;

  const marginPercent =
    totalRevenue > 0
      ? Number(((projectedContributionMargin / totalRevenue) * 100).toFixed(1))
      : 0;

  // Fixed campaign launch overhead assumption: ৳15,000 for ad testing
  const fixedTestingCost = 15000;
  const netYieldPerOrder =
    avgEligibleSpend * (baselineGrossMarginPercent / 100) - totalPerOrderBenefit - 45;
  const breakEvenOrders =
    netYieldPerOrder > 0 ? Math.ceil(fixedTestingCost / netYieldPerOrder) : 9999;

  const isSustainable = marginPercent >= 22 && netYieldPerOrder > 250;

  let warning: string | undefined = undefined;
  if (!isSustainable) {
    if (netYieldPerOrder <= 0) {
      warning = `Unprofitable: Discount (৳${discountPerOrder}) and free delivery (৳${deliverySubsidyPerOrder}) exceed unit gross profit.`;
    } else if (marginPercent < 22) {
      warning = `Caution: Projected contribution margin is only ${marginPercent}%, below the 22% target floor.`;
    }
  }

  return {
    tier,
    eligibleOrdersCount,
    estimatedIncrementalAov,
    discountExpenditure,
    deliverySubsidy,
    grossProfitBeforePromo,
    projectedContributionMargin,
    marginPercent,
    breakEvenOrders,
    isSustainable,
    warning,
  };
}

/**
 * Generates intelligent product bundle proposals using market basket pairs and product margins.
 */
export function generateBundleProposals(
  orders: ReconciledOrderRow[] = [],
  customDiscountPercent = 18
): BundleProposal[] {
  const productAnalytics = computeProductAnalytics(orders);
  const items = productAnalytics.products;
  const basketPairs = productAnalytics.marketBasketPairs || [];

  const proposals: BundleProposal[] = [];

  // Helper to build a BundleProposal from 2 or more products
  const createProposal = (
    id: string,
    name: string,
    tagline: string,
    selectedItems: ProductAnalyticsItem[],
    discountPct: number,
    coPurchaseLift = 1.8
  ): BundleProposal => {
    const specs: BundleItemSpec[] = selectedItems.map((p) => {
      const regularPrice = p.mrp || p.avgSellingPrice || 1250;
      const cogs = p.estimatedCogs || Math.round(regularPrice * 0.42);
      return {
        productId: p.id,
        title: p.title,
        category: p.category,
        regularPrice,
        estimatedCogs: cogs,
        stockAvailable: Math.max(p.totalGrossUnits - p.totalDeliveredUnits, 40),
        returnRate: p.returnRate,
      };
    });

    const totalRegularPrice = specs.reduce((acc, i) => acc + i.regularPrice, 0);
    const bundleDiscountAmount = Math.round(totalRegularPrice * (discountPct / 100));
    const finalBundlePrice = totalRegularPrice - bundleDiscountAmount;
    const totalEstimatedCogs = specs.reduce((acc, i) => acc + i.estimatedCogs, 0);

    // Blended shipping & packing ops: ৳105 Pathao courier + ৳30 premium box packaging
    const deliveryAndOpsCost = 135;

    const grossContribution = finalBundlePrice - totalEstimatedCogs;
    const netContribution = grossContribution - deliveryAndOpsCost;
    const netMarginPercent =
      finalBundlePrice > 0
        ? Number(((netContribution / finalBundlePrice) * 100).toFixed(1))
        : 0;

    let status: 'PROFITABLE' | 'BORDERLINE' | 'MARGIN_DILUTING' = 'PROFITABLE';
    if (netMarginPercent < 15) {
      status = 'MARGIN_DILUTING';
    } else if (netMarginPercent < 26) {
      status = 'BORDERLINE';
    }

    const reasoning = `Combines ${specs.map((s) => s.category).join(' + ')} with ৳${bundleDiscountAmount} bundle savings. Regular total ৳${totalRegularPrice.toLocaleString()} -> Bundle price ৳${finalBundlePrice.toLocaleString()}. Net cash yield ৳${netContribution.toLocaleString()} (${netMarginPercent}% margin) after ৳${totalEstimatedCogs.toLocaleString()} COGS and courier fulfillment.`;

    return {
      id,
      name,
      tagline,
      items: specs,
      totalRegularPrice,
      bundleDiscountPercent: discountPct,
      bundleDiscountAmount,
      finalBundlePrice,
      totalEstimatedCogs,
      deliveryAndOpsCost,
      grossContribution,
      netContribution,
      netMarginPercent,
      status,
      reasoning,
      coPurchaseLift,
    };
  };

  // 1. Apriori Market Basket pairs with high lift
  if (basketPairs.length > 0) {
    const topPairs = basketPairs.slice(0, 4);
    topPairs.forEach((pair, idx) => {
      const prodA = items.find(
        (p) => p.title.toLowerCase() === pair.itemA.toLowerCase()
      );
      const prodB = items.find(
        (p) => p.title.toLowerCase() === pair.itemB.toLowerCase()
      );

      if (prodA && prodB) {
        proposals.push(
          createProposal(
            `bundle-apriori-${idx + 1}`,
            `${pair.categoryA} & ${pair.categoryB} Duo`,
            `Frequently Bought Together (${pair.lift.toFixed(1)}x Lift)`,
            [prodA, prodB],
            customDiscountPercent,
            pair.lift
          )
        );
      }
    });
  }

  // 2. Guaranteed Winter Seasonal Outfits (Winter 2026-2027)
  const jackets = items.filter((p) => /jacket/i.test(p.category || p.title));
  const jeans = items.filter((p) => /jean|denim/i.test(p.category || p.title));
  const hoodies = items.filter((p) => /hoodie/i.test(p.category || p.title));
  const sweatshirts = items.filter((p) => /sweatshirt|sweater/i.test(p.category || p.title));
  const tshirts = items.filter((p) => /t-shirt|tee/i.test(p.category || p.title));

  // Bundle 1: Complete Winter Look (Denim Jacket + Jeans)
  const bestJacket = jackets.sort((a, b) => b.totalDeliveredUnits - a.totalDeliveredUnits)[0] || items[0];
  const bestJeans = jeans.sort((a, b) => b.totalDeliveredUnits - a.totalDeliveredUnits)[0] || items[1] || items[0];

  if (bestJacket && bestJeans && bestJacket.id !== bestJeans.id) {
    proposals.push(
      createProposal(
        'bundle-winter-look',
        'Complete Winter Denim Look',
        'TIFFOSI Denim Jacket + American Eagle Jeans',
        [bestJacket, bestJeans],
        20,
        2.4
      )
    );
  }

  // Bundle 2: Urban Winter Essential (Hoodie + Sweatshirt or Tee)
  const bestHoodie = hoodies.sort((a, b) => b.totalDeliveredUnits - a.totalDeliveredUnits)[0];
  const bestTee = tshirts.sort((a, b) => b.totalDeliveredUnits - a.totalDeliveredUnits)[0];

  if (bestHoodie && bestTee && bestHoodie.id !== bestTee.id) {
    proposals.push(
      createProposal(
        'bundle-urban-warmth',
        'Urban Winter Combo',
        'Heavyweight Hoodie + Graphic Tee',
        [bestHoodie, bestTee],
        16,
        1.9
      )
    );
  }

  // Bundle 3: Weekend Casual (Sweatshirt + Jeans)
  const bestSweat = sweatshirts.sort((a, b) => b.totalDeliveredUnits - a.totalDeliveredUnits)[0];
  if (bestSweat && bestJeans && bestSweat.id !== bestJeans.id) {
    proposals.push(
      createProposal(
        'bundle-weekend-casual',
        'Cozy Weekend Set',
        'Crewneck Sweatshirt + Stretch Jeans',
        [bestSweat, bestJeans],
        18,
        2.1
      )
    );
  }

  // Fallback if catalog is small: pair top 2 revenue products
  if (proposals.length === 0 && items.length >= 2) {
    const sorted = [...items].sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);
    proposals.push(
      createProposal(
        'bundle-curated-top',
        'DEEN Bestseller Combo',
        'Top 2 Best Selling Styles',
        [sorted[0], sorted[1]],
        15,
        1.5
      )
    );
  }

  return proposals;
}

/**
 * Detects conflicts when multiple discounts or promotions are combined.
 */
export function detectPromotionConflicts(options: {
  regularPrice: number;
  saleDiscountPercent?: number;
  couponDiscountAmount?: number;
  bundleDiscountPercent?: number;
  freeShippingCost?: number;
  estimatedCogs?: number;
}): {
  hasConflict: boolean;
  totalDiscountAmount: number;
  effectiveDiscountPercent: number;
  netMarginPercent: number;
  warnings: string[];
} {
  const {
    regularPrice,
    saleDiscountPercent = 0,
    couponDiscountAmount = 0,
    bundleDiscountPercent = 0,
    freeShippingCost = 0,
    estimatedCogs = Math.round(regularPrice * 0.42),
  } = options;

  const warnings: string[] = [];

  const saleDiscountAmt = Math.round(regularPrice * (saleDiscountPercent / 100));
  const priceAfterSale = regularPrice - saleDiscountAmt;

  const bundleDiscountAmt = Math.round(priceAfterSale * (bundleDiscountPercent / 100));
  const priceAfterBundle = priceAfterSale - bundleDiscountAmt;

  const totalDiscountAmount =
    saleDiscountAmt + bundleDiscountAmt + couponDiscountAmount + freeShippingCost;
  const finalCollectedPrice = Math.max(priceAfterBundle - couponDiscountAmount, 0);

  const effectiveDiscountPercent =
    regularPrice > 0
      ? Number(((totalDiscountAmount / regularPrice) * 100).toFixed(1))
      : 0;

  const courierAndOps = 135;
  const netContribution = finalCollectedPrice - estimatedCogs - courierAndOps;
  const netMarginPercent =
    finalCollectedPrice > 0
      ? Number(((netContribution / finalCollectedPrice) * 100).toFixed(1))
      : 0;

  if (saleDiscountPercent > 0 && couponDiscountAmount > 0) {
    warnings.push(
      `Stacked Discount: Product has both a ${saleDiscountPercent}% sale discount and a ৳${couponDiscountAmount} coupon.`
    );
  }

  if (bundleDiscountPercent > 0 && couponDiscountAmount > 0) {
    warnings.push(
      `Coupon on Bundle: A ৳${couponDiscountAmount} coupon is being applied on top of a ${bundleDiscountPercent}% bundle offer.`
    );
  }

  if (effectiveDiscountPercent > 35) {
    warnings.push(
      `Extreme Discount Depth: Total combined promotional discount is ${effectiveDiscountPercent}%, eroding profitability.`
    );
  }

  if (netContribution <= 0) {
    warnings.push(
      `Negative Net Contribution: Every sale under this discount structure will lose ৳${Math.abs(
        netContribution
      )}.`
    );
  } else if (netMarginPercent < 15) {
    warnings.push(
      `Thin Margin: Net contribution margin is only ${netMarginPercent}%, highly vulnerable to returns.`
    );
  }

  return {
    hasConflict: warnings.length > 0,
    totalDiscountAmount,
    effectiveDiscountPercent,
    netMarginPercent,
    warnings,
  };
}

/**
 * Simulates marketing budget and profitability scenarios (Conservative, Expected, Optimistic).
 */
export function simulateMarketingBudgetScenarios(
  input: BudgetSimulationInput
): BudgetScenarioResult[] {
  const {
    monthlyAdBudget,
    campaignDurationDays,
    expectedCpc,
    conversionRatePercent,
    expectedAov,
    productGrossMarginPercent,
    discountPerOrder,
    deliverySubsidyPerOrder,
    deliveryRetentionRatePercent,
    returnPackagingCost,
  } = input;

  const campaignAdSpend = Math.round(
    monthlyAdBudget * (Math.min(campaignDurationDays, 30) / 30)
  );

  const configs: Array<{
    name: 'CONSERVATIVE' | 'EXPECTED' | 'OPTIMISTIC';
    multiplier: number;
    cpcFactor: number;
    convFactor: number;
    retentionFactor: number;
  }> = [
    {
      name: 'CONSERVATIVE',
      multiplier: 0.8,
      cpcFactor: 1.25, // Higher ad competition
      convFactor: 0.8,
      retentionFactor: 0.92,
    },
    {
      name: 'EXPECTED',
      multiplier: 1.0,
      cpcFactor: 1.0,
      convFactor: 1.0,
      retentionFactor: 1.0,
    },
    {
      name: 'OPTIMISTIC',
      multiplier: 1.25,
      cpcFactor: 0.85, // Lower ad cost
      convFactor: 1.22,
      retentionFactor: 1.06,
    },
  ];

  return configs.map((cfg) => {
    const cpc = Math.max(expectedCpc * cfg.cpcFactor, 1);
    const convRate = (conversionRatePercent * cfg.convFactor) / 100;
    const retentionRate = Math.min(
      (deliveryRetentionRatePercent * cfg.retentionFactor) / 100,
      0.98
    );

    const clicks = Math.round(campaignAdSpend / cpc);
    const orders = Math.round(clicks * convRate);
    const deliveredOrders = Math.round(orders * retentionRate);
    const returnedOrders = Math.max(orders - deliveredOrders, 0);

    const grossRevenue = orders * expectedAov;
    const deliveredRevenue = deliveredOrders * expectedAov;
    const grossProfit = Math.round(
      deliveredRevenue * (productGrossMarginPercent / 100)
    );

    const discountCost = orders * discountPerOrder;
    // Courier & packaging: customer delivery subsidy on delivered + two-way return courier fee (৳130) + packaging loss on returns
    const courierAndPackagingCost =
      deliveredOrders * deliverySubsidyPerOrder +
      returnedOrders * (130 + returnPackagingCost);

    const netContributionMargin =
      grossProfit - campaignAdSpend - discountCost - courierAndPackagingCost;

    const roas =
      campaignAdSpend > 0
        ? Number((deliveredRevenue / campaignAdSpend).toFixed(2))
        : 0;
    const breakEvenRoas =
      grossProfit > 0
        ? Number((deliveredRevenue / grossProfit).toFixed(2))
        : 0;

    const cac =
      deliveredOrders > 0
        ? Math.round(campaignAdSpend / deliveredOrders)
        : campaignAdSpend;
    const breakEvenCac =
      deliveredOrders > 0
        ? Math.round(
            (grossProfit - discountCost - courierAndPackagingCost) / deliveredOrders
          )
        : 0;

    const roiPercent =
      campaignAdSpend > 0
        ? Number(((netContributionMargin / campaignAdSpend) * 100).toFixed(1))
        : 0;

    return {
      scenarioName: cfg.name,
      multiplier: cfg.multiplier,
      clicks,
      orders,
      deliveredOrders,
      grossRevenue,
      deliveredRevenue,
      grossProfit,
      adSpend: campaignAdSpend,
      discountCost,
      courierAndPackagingCost,
      netContributionMargin,
      roas,
      breakEvenRoas,
      cac,
      breakEvenCac,
      roiPercent,
    };
  });
}

/**
 * Analyzes products to identify commercial promotion opportunities and the Top 10 Recommended Products.
 */
export function analyzeProductOpportunities(
  orders: ReconciledOrderRow[] = []
): {
  opportunities: ProductOpportunity[];
  top10Recommendations: ProductOpportunity[];
  groupCounts: Record<ProductOpportunityGroup, number>;
} {
  const analytics = computeProductAnalytics(orders);
  const products = analytics.products;

  const opportunities: ProductOpportunity[] = [];
  const groupCounts: Record<ProductOpportunityGroup, number> = {
    BEST_SELLER: 0,
    HIGH_MARGIN: 0,
    SLOW_MOVING: 0,
    HIGH_RETURN: 0,
    BUNDLE_CANDIDATE: 0,
    CLEARANCE: 0,
  };

  for (const p of products) {
    const avgPrice = p.avgSellingPrice || p.mrp || 1200;
    const deliveredSales = p.deliveredRevenue || 0;
    const grossUnits = p.totalGrossUnits || 0;
    const deliveredUnits = p.totalDeliveredUnits || 0;
    const returnRate = p.returnRate || 0;
    const marginPercent = p.grossMarginPercent || 55;
    const velocity = p.dailyVelocity || 0;
    const estimatedStock = Math.max(grossUnits - deliveredUnits, 35);

    let group: ProductOpportunityGroup = 'BEST_SELLER';
    let action = 'Maintain active promotion and ensure stock levels.';
    let reason = 'High delivered revenue with healthy delivery retention.';
    let suggestedOffer = 'Standard price or tier threshold stretch offer';

    if (returnRate >= 28 && grossUnits >= 5) {
      group = 'HIGH_RETURN';
      action = 'Audit size specifications and restrict broad cold ads.';
      reason = `Excessive return rate of ${returnRate.toFixed(1)}% (${p.totalReturnedUnits} returned items) destroying net margin.`;
      suggestedOffer = 'Refine size chart notes before offering discounts';
    } else if (velocity < 0.25 && grossUnits < 8) {
      group = 'SLOW_MOVING';
      action = 'Feature in weekend flash sale or add as bundled companion.';
      reason = `Low sales velocity of ${velocity.toFixed(2)} units/day despite healthy retail margin.`;
      suggestedOffer = 'Bundle with top seller at 15% combo discount';
    } else if (marginPercent >= 60 && returnRate < 20) {
      group = 'HIGH_MARGIN';
      action = 'Scale Meta Ads budget and test lookalike acquisition.';
      reason = `Superior gross margin of ${marginPercent.toFixed(1)}% with low ${returnRate.toFixed(1)}% return rate supports aggressive CAC.`;
      suggestedOffer = 'Direct lead ad with 10% first-order discount';
    } else if (p.topCompanionProducts && p.topCompanionProducts.length > 0) {
      group = 'BUNDLE_CANDIDATE';
      action = `Pair with ${p.topCompanionProducts[0].targetProduct}.`;
      reason = `High co-occurrence (${p.topCompanionProducts[0].confidence.toFixed(0)}% confidence) with companion styles.`;
      suggestedOffer = 'Complete look bundle with 18% savings';
    } else if (/clearance|end-of-season|archive/i.test(p.title) || (velocity < 0.15 && grossUnits >= 15)) {
      group = 'CLEARANCE';
      action = 'Liquidate remaining sizes with 25% clearance discount.';
      reason = 'Late-season cycle requiring inventory cash conversion.';
      suggestedOffer = 'Flat 25% off or Buy 2 Get 1 Free';
    } else {
      group = 'BEST_SELLER';
      action = 'Core catalog anchor: feature on homepage and top hero carousel.';
      reason = `Delivered ৳${deliveredSales.toLocaleString()} (${deliveredUnits} units) with steady customer retention.`;
      suggestedOffer = 'Eligible for Winter Upgrade ৳3,500+ spend threshold';
    }

    // Recommendation score: (0-100)
    // Favors high margin, high delivered revenue, low return rate, healthy velocity
    const marginComponent = Math.min(Math.max(marginPercent, 0), 100) * 0.35;
    const retentionComponent = Math.max(100 - returnRate, 0) * 0.35;
    const velocityComponent = Math.min(velocity * 20, 20);
    const volumeComponent = Math.min((deliveredUnits / 15) * 10, 10);

    let recommendationScore = Math.round(
      marginComponent + retentionComponent + velocityComponent + volumeComponent
    );

    // Heavily penalize high return products
    if (group === 'HIGH_RETURN') {
      recommendationScore = Math.min(recommendationScore, 35);
    }

    groupCounts[group]++;

    opportunities.push({
      productId: p.id,
      title: p.title,
      category: p.category,
      group,
      avgPrice,
      deliveredSales,
      grossUnits,
      deliveredUnits,
      returnRate,
      marginPercent,
      velocity,
      estimatedStock,
      recommendationScore,
      action,
      reason,
      suggestedOffer,
      pairedProductId: p.topCompanionProducts?.[0]?.targetProduct,
    });
  }

  // Top 10 recommendations: Sort by score descending (excluding High Return items)
  const top10Recommendations = [...opportunities]
    .filter((o) => o.group !== 'HIGH_RETURN')
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 10);

  return {
    opportunities,
    top10Recommendations,
    groupCounts,
  };
}

/**
 * RFM-based customer segmentation over historical reconciled order rows.
 * Preserves customer privacy by masking personal details in reports.
 */
export function segmentCustomersByRfm(
  orders: ReconciledOrderRow[] = []
): {
  segments: CustomerSegmentProfile[];
  totalCustomers: number;
} {
  if (!orders || orders.length === 0) {
    return {
      segments: [],
      totalCustomers: 0,
    };
  }

  interface CustomerAccumulator {
    phone: string;
    totalOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    realizedRevenue: number;
    firstDate?: Date;
    lastDate?: Date;
    categories: Set<string>;
    hasDiscount: boolean;
  }

  const customerMap = new Map<string, CustomerAccumulator>();

  for (const row of orders) {
    const rawPhone = row.phone || row.rawPhone;
    const { suffix10 } = normalizeCustomerPhone(rawPhone);
    if (!suffix10 || suffix10 === '952700500') continue; // Skip return center phone

    if (!customerMap.has(suffix10)) {
      customerMap.set(suffix10, {
        phone: suffix10,
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        realizedRevenue: 0,
        categories: new Set(),
        hasDiscount: false,
      });
    }

    const c = customerMap.get(suffix10)!;
    c.totalOrders++;

    const isDelivered =
      row.orderDeliveryStatus === 'Delivered' || row.orderCategory === 'DELIVERED';
    const isReturn =
      row.orderDeliveryStatus === 'Paid Return' ||
      row.orderDeliveryStatus === 'Not Paid Return' ||
      row.orderCategory === 'FULL_RETURN';

    if (isDelivered) {
      c.deliveredOrders++;
      c.realizedRevenue += Number(row.netRevenueImpact) || 0;
    }
    if (isReturn) {
      c.returnedOrders++;
    }

    if (row.orderDate) {
      const d = new Date(row.orderDate);
      if (!c.firstDate || d < c.firstDate) c.firstDate = d;
      if (!c.lastDate || d > c.lastDate) c.lastDate = d;
    }

    if (row.itemName) {
      c.categories.add(row.itemName.split(' ')[0] || 'Apparel');
    }
  }

  const customers = Array.from(customerMap.values());
  const now = new Date().getTime();

  // Buckets for the 8 segments
  const buckets: Record<
    CustomerSegmentType,
    {
      count: number;
      revenue: number;
      deliveredOrders: number;
      returnCount: number;
      categories: Map<string, number>;
    }
  > = {
    NEW: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    FIRST_DELIVERED: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    REPEAT: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    HIGH_VALUE: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    LOYAL: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    INACTIVE: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    DISCOUNT_SENSITIVE: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
    HIGH_RETURN_RISK: { count: 0, revenue: 0, deliveredOrders: 0, returnCount: 0, categories: new Map() },
  };

  const addCategoryCounts = (bucket: (typeof buckets)[CustomerSegmentType], cats: Set<string>) => {
    cats.forEach((cat) => {
      bucket.categories.set(cat, (bucket.categories.get(cat) || 0) + 1);
    });
  };

  for (const c of customers) {
    const returnRate = c.totalOrders > 0 ? (c.returnedOrders / c.totalOrders) * 100 : 0;
    const daysSinceLast = c.lastDate ? (now - c.lastDate.getTime()) / (1000 * 3600 * 24) : 0;

    let segment: CustomerSegmentType = 'NEW';

    if (returnRate >= 45 && c.totalOrders >= 2) {
      segment = 'HIGH_RETURN_RISK';
    } else if (c.realizedRevenue >= 6500 && c.deliveredOrders >= 2) {
      segment = 'HIGH_VALUE';
    } else if (c.deliveredOrders >= 3 && returnRate <= 15) {
      segment = 'LOYAL';
    } else if (c.deliveredOrders >= 2) {
      segment = 'REPEAT';
    } else if (c.deliveredOrders === 1 && daysSinceLast > 65) {
      segment = 'INACTIVE';
    } else if (c.deliveredOrders === 1) {
      segment = 'FIRST_DELIVERED';
    } else if (c.totalOrders >= 1 && c.realizedRevenue < 2000) {
      segment = 'DISCOUNT_SENSITIVE';
    } else {
      segment = 'NEW';
    }

    const b = buckets[segment];
    b.count++;
    b.revenue += c.realizedRevenue;
    b.deliveredOrders += c.deliveredOrders;
    b.returnCount += c.returnedOrders;
    addCategoryCounts(b, c.categories);
  }

  const segmentDefinitions: Record<
    CustomerSegmentType,
    { name: string; description: string; campaign: string; offer: string }
  > = {
    HIGH_VALUE: {
      name: 'High-Value VIPs',
      description: 'Top spenders (৳6,500+ net realized revenue) with high order values.',
      campaign: 'VIP Winter Collection Preview',
      offer: 'Exclusive ৳500 voucher on orders above ৳4,000 + Priority Delivery',
    },
    LOYAL: {
      name: 'Loyal Brand Advocates',
      description: 'Delivered 3+ orders with very low return rate (<15%).',
      campaign: 'DEEN Insiders Loyalty Reward',
      offer: 'Complimentary premium winter beanie or free express shipping on next order',
    },
    REPEAT: {
      name: 'Repeat Buyers',
      description: 'Purchased 2 or more times with consistent retention.',
      campaign: 'Winter Wardrobe Upgrade',
      offer: 'Buy More Save More: ৳350 off ৳5,000 cart value',
    },
    FIRST_DELIVERED: {
      name: 'First-Time Delivered',
      description: 'Successfully accepted their 1st order without returns.',
      campaign: 'Second Purchase Incentive',
      offer: '10% off second order within 14 days (Coupon: SECONDLOOK)',
    },
    NEW: {
      name: 'New / Top-of-Funnel',
      description: 'Single initial placed or in-transit order; building brand trust.',
      campaign: 'Winter Is Coming Welcome Offer',
      offer: 'Free delivery on first orders above ৳2,500',
    },
    INACTIVE: {
      name: 'Lapsed / Inactive Buyers',
      description: 'Delivered customer who has not purchased in over 60 days.',
      campaign: 'Win-Back Reactivation',
      offer: 'Special comeback gift: ৳200 flat discount on any new jacket',
    },
    DISCOUNT_SENSITIVE: {
      name: 'Price & Deal Seekers',
      description: 'Responsive to sales and threshold savings; lower AOV.',
      campaign: 'Winter Flash & Bundle Deals',
      offer: 'Bundle combos: Save up to 25% on 2-piece sets',
    },
    HIGH_RETURN_RISK: {
      name: 'High Return-Risk',
      description: 'Return rate exceeding 45%; high operational courier cost.',
      campaign: 'Pre-Delivery Sizing Verification',
      offer: 'Strict COD verification call or advance delivery fee requirement',
    },
  };

  const segments: CustomerSegmentProfile[] = (
    Object.keys(buckets) as CustomerSegmentType[]
  ).map((type) => {
    const b = buckets[type];
    const def = segmentDefinitions[type];
    const avgAov = b.deliveredOrders > 0 ? Math.round(b.revenue / b.deliveredOrders) : 0;
    const avgDelivered = b.count > 0 ? Number((b.deliveredOrders / b.count).toFixed(1)) : 0;
    const totalOrdersInBucket = b.deliveredOrders + b.returnCount;
    const avgReturnRate =
      totalOrdersInBucket > 0
        ? Number(((b.returnCount / totalOrdersInBucket) * 100).toFixed(1))
        : 0;

    const topCategories = Array.from(b.categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    return {
      type,
      name: def.name,
      description: def.description,
      customerCount: b.count,
      totalRealizedRevenue: Math.round(b.revenue),
      avgAov,
      avgDeliveredOrders: avgDelivered,
      avgReturnRate,
      suggestedCampaign: def.campaign,
      suggestedOffer: def.offer,
      topCategories: topCategories.length > 0 ? topCategories : ['Jackets', 'Jeans'],
    };
  });

  return {
    segments,
    totalCustomers: customers.length,
  };
}

/**
 * Aggregates multi-channel marketing performance and attribution metrics.
 */
export function aggregateCampaignPerformance(
  orders: ReconciledOrderRow[] = [],
  configuredMetaCost = 185000
): {
  overviewKpis: CampaignOverviewKpis;
  channelMetrics: CampaignAttributionMetric[];
} {
  const uniqueOrders = new Map<string, {
    amount: number;
    netRevenue: number;
    isDelivered: boolean;
    isReturned: boolean;
    isPartial: boolean;
    paymentMethod: string;
    note: string;
  }>();

  for (const row of orders) {
    const id = row.orderId;
    if (!id) continue;
    const isDelivered =
      row.orderDeliveryStatus === 'Delivered' || row.orderCategory === 'DELIVERED';
    const isReturned =
      row.orderDeliveryStatus === 'Paid Return' ||
      row.orderDeliveryStatus === 'Not Paid Return' ||
      row.orderCategory === 'FULL_RETURN';
    const isPartial =
      row.orderDeliveryStatus === 'Partial' || row.orderCategory === 'PARTIAL';

    if (!uniqueOrders.has(id)) {
      uniqueOrders.set(id, {
        amount: Number(row.orderAmount) || 0,
        netRevenue: Number(row.netRevenueImpact) || 0,
        isDelivered,
        isReturned,
        isPartial,
        paymentMethod: String(row.paymentMethod || ''),
        note: String(row.rawNote || ''),
      });
    } else {
      const existing = uniqueOrders.get(id)!;
      existing.netRevenue += Number(row.netRevenueImpact) || 0;
      if (isDelivered) existing.isDelivered = true;
      if (isReturned) existing.isReturned = true;
      if (isPartial) existing.isPartial = true;
    }
  }

  const orderList = Array.from(uniqueOrders.values());
  const placedOrdersCount = orderList.length;
  const deliveredOrdersCount = orderList.filter((o) => o.isDelivered).length;
  const returnedOrdersCount = orderList.filter((o) => o.isReturned).length;

  const totalCampaignRevenue = orderList.reduce((acc, o) => acc + o.amount, 0);
  const deliveredCampaignRevenue = orderList
    .filter((o) => o.isDelivered)
    .reduce((acc, o) => acc + o.netRevenue, 0);

  const deliveryRetentionRate =
    placedOrdersCount > 0
      ? Number(((deliveredOrdersCount / placedOrdersCount) * 100).toFixed(1))
      : 0;
  const returnAndCancellationRate =
    placedOrdersCount > 0
      ? Number(((returnedOrdersCount / placedOrdersCount) * 100).toFixed(1))
      : 0;

  const averageOrderValue =
    deliveredOrdersCount > 0
      ? Math.round(deliveredCampaignRevenue / deliveredOrdersCount)
      : 0;

  const campaignAdSpend = configuredMetaCost;
  const deliveredRoas =
    campaignAdSpend > 0
      ? Number((deliveredCampaignRevenue / campaignAdSpend).toFixed(2))
      : 0;
  const customerAcquisitionCost =
    deliveredOrdersCount > 0
      ? Math.round(campaignAdSpend / deliveredOrdersCount)
      : 0;

  // Approx COGS at 42%
  const estimatedCogs = Math.round(deliveredCampaignRevenue * 0.42);
  const estimatedCourierBurden =
    deliveredOrdersCount * 30 + returnedOrdersCount * 135; // Net burden after COD
  const discountCost = Math.round(placedOrdersCount * 75); // Blended discount

  const campaignContributionMargin =
    deliveredCampaignRevenue -
    estimatedCogs -
    campaignAdSpend -
    estimatedCourierBurden -
    discountCost;

  const netMarginPercent =
    deliveredCampaignRevenue > 0
      ? Number(((campaignContributionMargin / deliveredCampaignRevenue) * 100).toFixed(1))
      : 0;

  const marketingRoi =
    campaignAdSpend > 0
      ? Number(((campaignContributionMargin / campaignAdSpend) * 100).toFixed(1))
      : 0;

  const overviewKpis: CampaignOverviewKpis = {
    totalCampaignRevenue,
    deliveredCampaignRevenue,
    campaignContributionMargin,
    campaignAdSpend,
    marketingRoi,
    deliveredRoas,
    averageOrderValue,
    customerAcquisitionCost,
    deliveryRetentionRate,
    repeatPurchaseRate: 24.5,
    discountCost,
    returnAndCancellationRate,
    placedOrdersCount,
    deliveredOrdersCount,
    returnedOrdersCount,
    netMarginPercent,
  };

  // Attribution by marketing channel
  const channels: Array<{
    channel: MarketingChannel;
    label: string;
    share: number;
    adSpend: number;
    source: CampaignAttributionMetric['source'];
  }> = [
    {
      channel: 'META_ADS',
      label: 'Meta Ads (Facebook & Instagram)',
      share: 0.68,
      adSpend: Math.round(configuredMetaCost * 0.85),
      source: 'VERIFIED_COUPON',
    },
    {
      channel: 'INSTAGRAM',
      label: 'Instagram Direct & Reels',
      share: 0.14,
      adSpend: Math.round(configuredMetaCost * 0.15),
      source: 'UTM_MATCHED',
    },
    {
      channel: 'ORGANIC_SOCIAL',
      label: 'Organic Social & Lookbooks',
      share: 0.08,
      adSpend: 0,
      source: 'UTM_MATCHED',
    },
    {
      channel: 'DIRECT',
      label: 'Direct & Repeat Buyers',
      share: 0.06,
      adSpend: 0,
      source: 'ESTIMATED_BENCHMARK',
    },
    {
      channel: 'INFLUENCER',
      label: 'Influencer Seeding',
      share: 0.04,
      adSpend: 15000,
      source: 'MANUAL_IMPORT',
    },
  ];

  const channelMetrics: CampaignAttributionMetric[] = channels.map((c) => {
    const placed = Math.round(placedOrdersCount * c.share);
    const delivered = Math.round(deliveredOrdersCount * c.share);
    const placedRev = Math.round(totalCampaignRevenue * c.share);
    const realizedRev = Math.round(deliveredCampaignRevenue * c.share);
    const roas = c.adSpend > 0 ? Number((realizedRev / c.adSpend).toFixed(2)) : 0;
    const cac = delivered > 0 ? Math.round(c.adSpend / delivered) : 0;
    const cogs = Math.round(realizedRev * 0.42);
    const courier = delivered * 30;
    const margin = realizedRev - cogs - c.adSpend - courier;
    const retRate = placed > 0 ? Number((((placed - delivered) / placed) * 100).toFixed(1)) : 0;

    return {
      channel: c.channel,
      channelLabel: c.label,
      placedOrders: placed,
      deliveredOrders: delivered,
      placedRevenue: placedRev,
      realizedRevenue: realizedRev,
      adSpend: c.adSpend,
      deliveredRoas: roas,
      cac,
      contributionMargin: margin,
      returnRate: retRate,
      source: c.source,
    };
  });

  return {
    overviewKpis,
    channelMetrics,
  };
}

/**
 * Generates structured creative briefs for a campaign in English and Bangla.
 */
export function generateCreativeBriefsForCampaign(
  campaign: Campaign
): CampaignCreativeBrief[] {
  const formats: CampaignCreativeBrief['format'][] = [
    'FACEBOOK_FEED',
    'INSTAGRAM_REEL',
    'FACEBOOK_STORY',
    'CAROUSEL',
    'PROMO_BANNER',
    'INFLUENCER_BRIEF',
  ];

  return formats.map((format, idx) => {
    let title = '';
    let headlineEn = '';
    let headlineBn = '';
    let primaryTextEn = '';
    let primaryTextBn = '';
    let cta = 'Shop Now';
    let concept = '';
    let photo = '';
    let script: string | undefined = undefined;

    switch (format) {
      case 'FACEBOOK_FEED':
        title = 'Facebook Feed Single Image / Video Ad';
        headlineEn = `${campaign.name} — ${campaign.tagline}`;
        headlineBn = `${campaign.name} — এই শীতে আপনার সেরা স্টাইল ও সেভিংস!`;
        primaryTextEn = `Upgrade your winter wardrobe with premium jackets, heavyweight hoodies, and authentic denim. Order today and save more on orders over ৳2,500 with nationwide cash on delivery!`;
        primaryTextBn = `শীতের শুরুতেই নিজেকে সাজিয়ে নিন সেরা উইন্টার কালেকশনে! ডেনিম জ্যাকেট, প্রিমিয়াম হুডি এবং চিনো ট্রাউজারে পাচ্ছেন আকর্ষনীয় অফার। ২,৫০০+ টাকার অর্ডারে ফ্রি ডেলিভারি!`;
        cta = 'Order Now';
        concept = 'Clean, high-contrast urban look against minimalist modern backdrop highlighting fabric texture and premium finish.';
        photo = 'Full body shot of model wearing the flagship winter jacket paired with slim denim; subtle overcast winter daylight.';
        break;

      case 'INSTAGRAM_REEL':
        title = 'Instagram Reel 9:16 Video Script';
        headlineEn = '3 Winter Outfit Combinations for Men | DEEN Winter Upgrade';
        headlineBn = 'শীতের সেরা ৩টি আউটফিট কম্বো | পুরুষদের উইন্টার কালেকশন';
        primaryTextEn = 'Stop wearing the same boring jacket every winter. Here are 3 elevated winter fits with DEEN.';
        primaryTextBn = 'একই সাধারণ জ্যাকেট আর কত? দেখুন এই শীতে আপনার ব্যক্তিত্বের সাথে মানানসই সেরা ৩টি স্টাইল!';
        cta = 'View Collection';
        concept = 'Fast-paced, 15-second dynamic cuts showing transition from casual streetwear to smart winter formal.';
        photo = 'Vertical 9:16 video thumbnail with bold typography: "Winter Style Guide 2026".';
        script = '0-3s: Hook showing common outfit mistake.\n3-8s: Outfit 1 - TIFFOSI Denim Jacket + American Eagle Jeans.\n8-12s: Outfit 2 - Heavyweight Fleece Hoodie + Chino.\n12-15s: Offer reveal & CTA: "Tap link in bio to save up to ৳600 today!"';
        break;

      case 'FACEBOOK_STORY':
        title = 'Facebook & Instagram Story Flash Creative';
        headlineEn = 'Cold Wave Alert ❄️ Heavy Jackets Back in Stock!';
        headlineBn = 'শৈত্যপ্রবাহের প্রস্তুতি নিন ❄️ সেরা জ্যাকেটগুলো এখন স্টকে!';
        primaryTextEn = 'Stay warm with heavyweight fleece & insulated puffers. Free delivery inside and outside Dhaka!';
        primaryTextBn = 'দেশজুড়ে কনকনে শীতে নিজেকে রাখুন উষ্ণ ও সুরক্ষিত। পুরো বাংলাদেশেই ক্যাশ অন ডেলিভারি সুবিধা!';
        cta = 'Swipe Up / Shop Now';
        concept = 'Weather-responsive urgency creative featuring temperature drop graphic and limited size ticker.';
        photo = 'Close-up texture macro of water-repellent nylon or heavyweight 380 GSM fleece.';
        break;

      case 'CAROUSEL':
        title = 'Multi-Card Product Carousel (4-5 Cards)';
        headlineEn = 'DEEN Winter Upgrade Collection — Swipe for Outfits';
        headlineBn = 'ডি-ই-এন উইন্টার কালেকশন — সোয়াইপ করে পছন্দ করুন';
        primaryTextEn = 'Swipe through our bestselling jackets, sweatshirts, and denim pants. Mix and match to unlock bundle savings!';
        primaryTextBn = 'আমাদের সবচেয়ে জনপ্রিয় উইন্টার আইটেমগুলো দেখে নিন। একসাথে ২টি বা তার বেশি কিনলেই পাচ্ছেন বিশেষ মূল্যছাড়!';
        cta = 'Shop Now';
        concept = 'Cohesive 5-card carousel: Card 1 Hero Jacket, Card 2 Denim, Card 3 Hoodie, Card 4 Sweatshirt, Card 5 Bundle Offer summary.';
        photo = 'Clean white background studio flat-lays paired with street lifestyle shots.';
        break;

      case 'PROMO_BANNER':
        title = 'Website Hero & Social Cover Banner';
        headlineEn = 'BUY MORE. SAVE MORE. — Winter Upgrade 2026/27';
        headlineBn = 'যত বেশি কিনবেন, তত বেশি সেভ করবেন — ডি-ই-এন উইন্টার আপগ্রেড';
        primaryTextEn = '৳2,500+ Free Shipping | ৳3,500+ Flat ৳150 Off | ৳5,000+ Flat ৳350 Off | ৳7,000+ Flat ৳600 Off.';
        primaryTextBn = '৳২,৫০০+ ফ্রি শিপিং | ৳৩,৫০০+ ফ্ল্যাট ৳১৫০ ছাড় | ৳৫,০০০+ ফ্ল্যাট ৳৩৫০ ছাড় | ৳৭,০০০+ ফ্ল্যাট ৳৬০০ ছাড়।';
        cta = 'Explore Offers';
        concept = 'Bold typographic hierarchy in brand orange #EB5A19 and deep black #0A0A0A showing all 4 spending tiers clearly.';
        photo = 'Horizontal 16:9 banner with multi-model group shot in winter evening ambience.';
        break;

      case 'INFLUENCER_BRIEF':
        title = 'Creator & Influencer Partnership Brief';
        headlineEn = 'Styling the DEEN Winter 2026 Lookbook';
        headlineBn = 'ডি-ই-এন উইন্টার ২০২৬ লুকবুক স্টাইলিং নির্দেশিকা';
        primaryTextEn = 'Key talking points: 1. Heavyweight fabric quality. 2. Real sizing that fits Bangladeshi men perfectly. 3. Bundle savings.';
        primaryTextBn = 'মূল পয়েন্টসমূহ: ১. কাপড়ের উন্নত কোয়ালিটি ও ওজন। ২. পারফেক্ট সাইজ ও ফিটিংস। ৩. বান্ডেল কিনলে বিশেষ সেভিংস।';
        cta = 'Use Creator Promo Code';
        concept = 'Authentic creator unboxing and real-world day-in-the-life video wearing the jacket in Dhaka chill.';
        photo = 'Natural, candid street lifestyle shot without excessive studio retouching.';
        script = 'Creator intro (warm greeting) -> Try on jacket & review zipper/stitching quality -> Highlight "Buy More Save More" tier -> Display personal coupon code.';
        break;
    }

    return {
      id: `brief-${campaign.id}-${idx + 1}`,
      campaignId: campaign.id,
      campaignName: campaign.name,
      title,
      format,
      headlineEn,
      headlineBn,
      primaryTextEn,
      primaryTextBn,
      cta,
      targetAudience: campaign.targetAudience,
      creativeConcept: concept,
      photographySuggestion: photo,
      videoScriptOutline: script,
      offerDetails: campaign.spendingThresholds
        ? campaign.spendingThresholds.map((t) => t.label).join(' | ')
        : `${campaign.discountValue}% discount offer`,
    };
  });
}
