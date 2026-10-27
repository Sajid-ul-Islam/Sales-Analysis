/**
 * Product Analytics & Merchandising Intelligence Engine
 * 
 * Provides comprehensive product-level analytics:
 * - Price Elasticity & Discount Sensitivity (MRP vs Sold Price vs Units at each tier)
 * - Sales Velocity, Best Performers vs Low Movers (Dead Stock candidates)
 * - Market Basket Analysis (Apriori co-occurrence, Support, Confidence, Lift, Bundle Recommender)
 * - Size Fit & Return Propensity Matrix (Pinpointing size-specific return anomalies)
 * - ABC Pareto Inventory Classification (Class A: 80%, Class B: 15%, Class C: 5%)
 * - SIP Inventory Origin & Geographic Fulfillment Affinity
 * - Extensible COGS & Gross Margin computation (ready for WooCommerce REST API injection)
 */

import { ReconciledOrderRow } from '@/types';
import { classifyProductCategory } from './reconciliationEngine';

export interface ProductPricePoint {
  price: number;
  mrp: number;
  discountPercent: number;
  grossUnits: number;
  deliveredUnits: number;
  returnedUnits: number;
  returnRate: number;
  grossRevenue: number;
  netRevenue: number;
  ordersCount: number;
  isSweetSpot: boolean;
}

export interface ProductSizeDistribution {
  size: string;
  grossUnits: number;
  deliveredUnits: number;
  returnedUnits: number;
  returnRate: number;
  sharePercent: number;
}

export interface MarketBasketAffinity {
  targetProduct: string;
  targetCategory: string;
  pairCount: number;
  support: number; // Percentage of total orders
  confidence: number; // Given targetProduct, likelihood of co-purchase %
  lift: number; // Ratio of observed co-occurrence vs random chance
  avgCombinedOrderValue: number;
}

export interface MarketBasketPair {
  itemA: string;
  itemB: string;
  categoryA: string;
  categoryB: string;
  pairOrders: number;
  support: number; // %
  confidenceAtoB: number; // %
  confidenceBtoA: number; // %
  lift: number;
  avgOrderTotal: number;
}

export type PerformanceTier = 'TOP_PERFORMER' | 'CORE_STABLE' | 'LOW_PERFORMER' | 'HIGH_RETURN_RISK';
export type AbcClassification = 'A' | 'B' | 'C';

export interface ProductAnalyticsItem {
  id: string;
  title: string;
  category: string;
  mrp: number;
  minPrice: number;
  maxPrice: number;
  avgSellingPrice: number;
  avgDiscountPercent: number;
  hasDiscount: boolean;
  totalGrossUnits: number;
  totalDeliveredUnits: number;
  totalReturnedUnits: number;
  totalPartialUnits: number;
  returnRate: number;
  deliveredRevenue: number;
  totalGrossRevenue: number;
  totalReturnLoss: number;
  estimatedCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  pricePoints: ProductPricePoint[];
  sizes: ProductSizeDistribution[];
  variationsCount: number;
  skus: string[];
  dailyVelocity: number;
  performanceTier: PerformanceTier;
  abcCategory: AbcClassification;
  cumulativeRevenuePercent?: number;
  channelBreakdown: {
    warehouseUnits: number;
    outletUnits: number;
    outletDispatches: Record<string, number>;
  };
  geoBreakdown: {
    insideDhakaUnits: number;
    outsideDhakaUnits: number;
  };
  topCompanionProducts: MarketBasketAffinity[];
  optimalPricePoint: ProductPricePoint | null;
}

export interface ProductAnalysisSummary {
  totalProducts: number;
  totalUnitsSold: number;
  totalDeliveredUnits: number;
  totalDeliveredRevenue: number;
  avgProductSellingPrice: number;
  avgDiscountDepth: number;
  discountedProductsCount: number;
  multiItemOrdersCount: number;
  totalOrdersCount: number;
  multiItemOrderRate: number;
  topRevenueProduct: ProductAnalyticsItem | null;
  topVolumeProduct: ProductAnalyticsItem | null;
  lowestVolumeProduct: ProductAnalyticsItem | null;
  highestReturnProduct: ProductAnalyticsItem | null;
  basketSizeDistribution: {
    singleItemOrders: number;
    twoItemOrders: number;
    threeItemOrders: number;
    fourPlusItemOrders: number;
  };
  topBasketPairs: MarketBasketPair[];
  abcSummary: {
    classACount: number;
    classBCount: number;
    classCCount: number;
    classARevenue: number;
    classBRevenue: number;
    classCRevenue: number;
  };
  sizeReturnAnomalies: {
    size: string;
    grossUnits: number;
    returnedUnits: number;
    returnRate: number;
  }[];
}

export interface ProductAnalysisResult {
  products: ProductAnalyticsItem[];
  summary: ProductAnalysisSummary;
  marketBasketPairs: MarketBasketPair[];
}

/**
 * Normalizes item names to separate the parent product title from the size/variation.
 * E.g.: "DEEN High-End Vintage Wash Jeans - Slim Fit - 34" -> { parentTitle: "DEEN High-End Vintage Wash Jeans - Slim Fit", size: "34" }
 */
export function extractProductAndSize(itemName: string): { parentTitle: string; size: string } {
  if (!itemName || typeof itemName !== 'string') {
    return { parentTitle: 'General Apparel Item', size: '' };
  }

  // Normalize Unicode dashes and consecutive spaces
  const clean = itemName
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .trim();

  const parts = clean.split(/\s+-\s+/);
  if (parts.length > 1) {
    const candidateSize = parts[parts.length - 1].trim();
    // Match common garment sizes: numbers (28, 30, 32, 34, 36, 38, 40), letter sizes (XS, S, M, L, XL, 2XL, 3XL, 4XL, XXL), Free Size
    const isSize = /^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|free size|\d{2}(\/\d{2})?|\d{1,2})$/i.test(candidateSize);
    if (isSize) {
      const parent = parts.slice(0, -1).join(' - ').trim();
      return {
        parentTitle: parent || candidateSize,
        size: candidateSize.toUpperCase(),
      };
    }
  }

  // Fallback regex matching trailing size like "Product Name (L)" or "Product Name 34"
  const bracketMatch = clean.match(/^(.*?)\s*[\(\[]([A-Z0-9]{1,4}|Free Size)[\)\]]$/i);
  if (bracketMatch && bracketMatch[1] && bracketMatch[2]) {
    return {
      parentTitle: bracketMatch[1].trim(),
      size: bracketMatch[2].toUpperCase().trim(),
    };
  }

  return { parentTitle: clean, size: '' };
}

/**
 * Core Product Analytics Calculation Engine
 */
export function computeProductAnalytics(
  orders: ReconciledOrderRow[],
  options: {
    cogsPercent?: number;
    dateScopeDays?: number;
  } = {}
): ProductAnalysisResult {
  const cogsRate = (options.cogsPercent !== undefined ? options.cogsPercent : 42) / 100;
  const daysInScope = Math.max(1, options.dateScopeDays || 30);

  if (!orders || orders.length === 0) {
    return {
      products: [],
      summary: {
        totalProducts: 0,
        totalUnitsSold: 0,
        totalDeliveredUnits: 0,
        totalDeliveredRevenue: 0,
        avgProductSellingPrice: 0,
        avgDiscountDepth: 0,
        discountedProductsCount: 0,
        multiItemOrdersCount: 0,
        totalOrdersCount: 0,
        multiItemOrderRate: 0,
        topRevenueProduct: null,
        topVolumeProduct: null,
        lowestVolumeProduct: null,
        highestReturnProduct: null,
        basketSizeDistribution: {
          singleItemOrders: 0,
          twoItemOrders: 0,
          threeItemOrders: 0,
          fourPlusItemOrders: 0,
        },
        topBasketPairs: [],
        abcSummary: {
          classACount: 0,
          classBCount: 0,
          classCCount: 0,
          classARevenue: 0,
          classBRevenue: 0,
          classCRevenue: 0,
        },
        sizeReturnAnomalies: [],
      },
      marketBasketPairs: [],
    };
  }

  // 1. First Pass: Aggregate Product Units, Variations, and Price Points
  interface RawProductAgg {
    id: string;
    title: string;
    category: string;
    skus: Set<string>;
    pricePointMap: Map<number, {
      grossUnits: number;
      deliveredUnits: number;
      returnedUnits: number;
      grossRevenue: number;
      netRevenue: number;
      orders: Set<string>;
    }>;
    sizeMap: Map<string, {
      grossUnits: number;
      deliveredUnits: number;
      returnedUnits: number;
    }>;
    channelMap: {
      warehouseUnits: number;
      outletUnits: number;
      outlets: Record<string, number>;
    };
    geoMap: {
      insideDhakaUnits: number;
      outsideDhakaUnits: number;
    };
    totalGrossUnits: number;
    totalDeliveredUnits: number;
    totalReturnedUnits: number;
    totalPartialUnits: number;
    deliveredRevenue: number;
    totalGrossRevenue: number;
    totalReturnLoss: number;
    orderIds: Set<string>;
  }

  const productAggMap = new Map<string, RawProductAgg>();

  // Market basket tracking: orderId -> Set of parent product titles
  const orderBaskets = new Map<string, {
    products: Set<string>;
    orderTotal: number;
  }>();

  // Global size anomaly tracking
  const globalSizeMap = new Map<string, { gross: number; returned: number }>();

  for (const r of orders) {
    const rawName = r.itemName || 'Apparel Item';
    const { parentTitle, size } = extractProductAndSize(rawName);
    const prodId = parentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const category = classifyProductCategory(parentTitle, r.sku || '');
    const price = Math.max(0, Math.round(Number(r.itemCost) || 0));
    const qty = Math.max(1, Math.round(Number(r.quantity) || 1));
    const orderId = r.orderId || 'UNKNOWN';

    // Market basket tracking
    if (!orderBaskets.has(orderId)) {
      orderBaskets.set(orderId, {
        products: new Set<string>(),
        orderTotal: Number(r.orderAmount) || 0,
      });
    }
    const basket = orderBaskets.get(orderId)!;
    basket.products.add(parentTitle);
    if ((Number(r.orderAmount) || 0) > basket.orderTotal) {
      basket.orderTotal = Number(r.orderAmount) || 0;
    }

    // Global size stats
    if (size) {
      if (!globalSizeMap.has(size)) {
        globalSizeMap.set(size, { gross: 0, returned: 0 });
      }
      const sEntry = globalSizeMap.get(size)!;
      sEntry.gross += qty;
      if (r.orderCategory === 'FULL_RETURN' || (r.deliveryStatus && r.deliveryStatus.includes('Returned'))) {
        sEntry.returned += qty;
      }
    }

    if (!productAggMap.has(parentTitle)) {
      productAggMap.set(parentTitle, {
        id: prodId,
        title: parentTitle,
        category,
        skus: new Set<string>(),
        pricePointMap: new Map(),
        sizeMap: new Map(),
        channelMap: {
          warehouseUnits: 0,
          outletUnits: 0,
          outlets: {},
        },
        geoMap: {
          insideDhakaUnits: 0,
          outsideDhakaUnits: 0,
        },
        totalGrossUnits: 0,
        totalDeliveredUnits: 0,
        totalReturnedUnits: 0,
        totalPartialUnits: 0,
        deliveredRevenue: 0,
        totalGrossRevenue: 0,
        totalReturnLoss: 0,
        orderIds: new Set<string>(),
      });
    }

    const p = productAggMap.get(parentTitle)!;
    p.orderIds.add(orderId);
    if (r.sku) p.skus.add(r.sku);

    // Channel allocation
    const sipOrigin = r.sipInventory || r.fulfillmentLocation || '';
    const isOutlet = sipOrigin.includes('Outlet') || sipOrigin.includes('Branch') || Boolean(r.branchSuffix);
    if (isOutlet) {
      p.channelMap.outletUnits += qty;
      const outletName = r.fulfillmentLocation || (r.branchSuffix ? `Branch ${r.branchSuffix.toUpperCase()}` : 'Outlet POS');
      p.channelMap.outlets[outletName] = (p.channelMap.outlets[outletName] || 0) + qty;
    } else {
      p.channelMap.warehouseUnits += qty;
    }

    // Geographic distribution
    if (r.districtArea === 'Inside Dhaka') {
      p.geoMap.insideDhakaUnits += qty;
    } else {
      p.geoMap.outsideDhakaUnits += qty;
    }

    // Units & Revenue Accounting
    p.totalGrossUnits += qty;
    p.totalGrossRevenue += qty * price;

    const isDelivered = r.orderCategory === 'DELIVERED' || r.orderCategory === 'EXCHANGE';
    const isReturned = r.orderCategory === 'FULL_RETURN' || (r.deliveryStatus && r.deliveryStatus.includes('Returned in Partial'));
    const isPartial = r.orderCategory === 'PARTIAL';

    let netRev = 0;
    let delUnits = 0;
    let retUnits = 0;

    if (isDelivered) {
      delUnits = qty;
      netRev = r.netRevenueImpact > 0 ? r.netRevenueImpact : qty * price;
      p.totalDeliveredUnits += qty;
      p.deliveredRevenue += netRev;
    } else if (isReturned) {
      retUnits = qty;
      p.totalReturnedUnits += qty;
      p.totalReturnLoss += qty * price;
    } else if (isPartial) {
      p.totalPartialUnits += qty;
      // In partial delivery, net revenue impact represents kept item cash collected
      netRev = r.netRevenueImpact > 0 ? r.netRevenueImpact : 0;
      p.deliveredRevenue += netRev;
      const keptProportion = price > 0 ? Math.round(netRev / price) : 0;
      delUnits = Math.min(qty, Math.max(0, keptProportion));
      retUnits = Math.max(0, qty - delUnits);
      p.totalDeliveredUnits += delUnits;
      p.totalReturnedUnits += retUnits;
      p.totalReturnLoss += retUnits * price;
    } else {
      retUnits = qty;
      p.totalReturnedUnits += qty;
      p.totalReturnLoss += qty * price;
    }

    // Price point indexing
    if (!p.pricePointMap.has(price)) {
      p.pricePointMap.set(price, {
        grossUnits: 0,
        deliveredUnits: 0,
        returnedUnits: 0,
        grossRevenue: 0,
        netRevenue: 0,
        orders: new Set<string>(),
      });
    }
    const pp = p.pricePointMap.get(price)!;
    pp.grossUnits += qty;
    pp.deliveredUnits += delUnits;
    pp.returnedUnits += retUnits;
    pp.grossRevenue += qty * price;
    pp.netRevenue += netRev;
    pp.orders.add(orderId);

    // Size indexing
    const sizeKey = size || 'Standard';
    if (!p.sizeMap.has(sizeKey)) {
      p.sizeMap.set(sizeKey, {
        grossUnits: 0,
        deliveredUnits: 0,
        returnedUnits: 0,
      });
    }
    const sz = p.sizeMap.get(sizeKey)!;
    sz.grossUnits += qty;
    sz.deliveredUnits += delUnits;
    sz.returnedUnits += retUnits;
  }

  // 2. Market Basket Co-Occurrence & Association Rules (Apriori Algorithm)
  const totalOrders = orderBaskets.size;
  let multiItemOrdersCount = 0;
  const basketSizeDistribution = {
    singleItemOrders: 0,
    twoItemOrders: 0,
    threeItemOrders: 0,
    fourPlusItemOrders: 0,
  };

  const productOrderFreq = new Map<string, number>();
  const pairFreq = new Map<string, { count: number; totalRev: number; itemA: string; itemB: string }>();

  for (const [, basket] of orderBaskets) {
    const items = Array.from(basket.products);
    const sz = items.length;

    if (sz === 1) {
      basketSizeDistribution.singleItemOrders++;
    } else if (sz === 2) {
      basketSizeDistribution.twoItemOrders++;
      multiItemOrdersCount++;
    } else if (sz === 3) {
      basketSizeDistribution.threeItemOrders++;
      multiItemOrdersCount++;
    } else if (sz >= 4) {
      basketSizeDistribution.fourPlusItemOrders++;
      multiItemOrdersCount++;
    }

    // Individual item frequency for support/confidence denominators
    for (const it of items) {
      productOrderFreq.set(it, (productOrderFreq.get(it) || 0) + 1);
    }

    // Multi-item pairs
    if (sz > 1) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const pairKey = a < b ? `${a}|||${b}` : `${b}|||${a}`;
          const existing = pairFreq.get(pairKey) || {
            count: 0,
            totalRev: 0,
            itemA: a < b ? a : b,
            itemB: a < b ? b : a,
          };
          existing.count++;
          existing.totalRev += basket.orderTotal;
          pairFreq.set(pairKey, existing);
        }
      }
    }
  }

  // Build global top basket pairs
  const marketBasketPairs: MarketBasketPair[] = Array.from(pairFreq.values())
    .map((pf) => {
      const ordersA = productOrderFreq.get(pf.itemA) || 1;
      const ordersB = productOrderFreq.get(pf.itemB) || 1;
      const support = totalOrders > 0 ? (pf.count / totalOrders) * 100 : 0;
      const confAtoB = ordersA > 0 ? (pf.count / ordersA) * 100 : 0;
      const confBtoA = ordersB > 0 ? (pf.count / ordersB) * 100 : 0;

      // Lift = P(A & B) / (P(A) * P(B))
      const pAB = pf.count / (totalOrders || 1);
      const pA = ordersA / (totalOrders || 1);
      const pB = ordersB / (totalOrders || 1);
      const lift = pA > 0 && pB > 0 ? Number((pAB / (pA * pB)).toFixed(2)) : 1;

      return {
        itemA: pf.itemA,
        itemB: pf.itemB,
        categoryA: classifyProductCategory(pf.itemA, ''),
        categoryB: classifyProductCategory(pf.itemB, ''),
        pairOrders: pf.count,
        support: Number(support.toFixed(2)),
        confidenceAtoB: Number(confAtoB.toFixed(1)),
        confidenceBtoA: Number(confBtoA.toFixed(1)),
        lift,
        avgOrderTotal: Math.round(pf.totalRev / pf.count),
      };
    })
    .sort((a, b) => b.pairOrders - a.pairOrders);

  // Map companion affinities per product
  const productAffinitiesMap = new Map<string, MarketBasketAffinity[]>();
  for (const pair of marketBasketPairs) {
    // Affinity from A to B
    if (!productAffinitiesMap.has(pair.itemA)) productAffinitiesMap.set(pair.itemA, []);
    productAffinitiesMap.get(pair.itemA)!.push({
      targetProduct: pair.itemB,
      targetCategory: pair.categoryB,
      pairCount: pair.pairOrders,
      support: pair.support,
      confidence: pair.confidenceAtoB,
      lift: pair.lift,
      avgCombinedOrderValue: pair.avgOrderTotal,
    });

    // Affinity from B to A
    if (!productAffinitiesMap.has(pair.itemB)) productAffinitiesMap.set(pair.itemB, []);
    productAffinitiesMap.get(pair.itemB)!.push({
      targetProduct: pair.itemA,
      targetCategory: pair.categoryA,
      pairCount: pair.pairOrders,
      support: pair.support,
      confidence: pair.confidenceBtoA,
      lift: pair.lift,
      avgCombinedOrderValue: pair.avgOrderTotal,
    });
  }

  // 3. Assemble and Enrich Product Analytics Items
  const intermediateProducts: ProductAnalyticsItem[] = [];

  for (const [title, p] of productAggMap) {
    const pricePointsRaw = Array.from(p.pricePointMap.entries()).map(([price, pp]) => ({
      price,
      grossUnits: pp.grossUnits,
      deliveredUnits: pp.deliveredUnits,
      returnedUnits: pp.returnedUnits,
      grossRevenue: pp.grossRevenue,
      netRevenue: pp.netRevenue,
      ordersCount: pp.orders.size,
      returnRate: pp.grossUnits > 0 ? Number(((pp.returnedUnits / pp.grossUnits) * 100).toFixed(1)) : 0,
    }));

    // Find MRP: maximum observed price for this product
    const allPrices = pricePointsRaw.map((pp) => pp.price).filter((pr) => pr > 0);
    const mrp = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = mrp;

    // Sweet Spot Detection: Price tier generating the highest net delivered revenue
    let sweetSpotPrice = mrp;
    let maxSweetRevenue = -1;
    for (const pp of pricePointsRaw) {
      if (pp.netRevenue > maxSweetRevenue) {
        maxSweetRevenue = pp.netRevenue;
        sweetSpotPrice = pp.price;
      }
    }

    // Format price points with discount % and sweet spot flag
    const pricePoints: ProductPricePoint[] = pricePointsRaw
      .map((pp) => {
        const discountPercent = mrp > 0 ? Math.max(0, Math.round(((mrp - pp.price) / mrp) * 100)) : 0;
        return {
          price: pp.price,
          mrp,
          discountPercent,
          grossUnits: pp.grossUnits,
          deliveredUnits: pp.deliveredUnits,
          returnedUnits: pp.returnedUnits,
          returnRate: pp.returnRate,
          grossRevenue: pp.grossRevenue,
          netRevenue: pp.netRevenue,
          ordersCount: pp.ordersCount,
          isSweetSpot: pp.price === sweetSpotPrice,
        };
      })
      .sort((a, b) => b.grossUnits - a.grossUnits);

    const optimalPricePoint = pricePoints.find((pp) => pp.isSweetSpot) || pricePoints[0] || null;

    // Size distribution
    const sizes: ProductSizeDistribution[] = Array.from(p.sizeMap.entries())
      .map(([sz, stats]) => ({
        size: sz,
        grossUnits: stats.grossUnits,
        deliveredUnits: stats.deliveredUnits,
        returnedUnits: stats.returnedUnits,
        returnRate: stats.grossUnits > 0 ? Number(((stats.returnedUnits / stats.grossUnits) * 100).toFixed(1)) : 0,
        sharePercent: p.totalGrossUnits > 0 ? Number(((stats.grossUnits / p.totalGrossUnits) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.grossUnits - a.grossUnits);

    const avgSellingPrice = p.totalGrossUnits > 0 ? Math.round(p.totalGrossRevenue / p.totalGrossUnits) : mrp;
    const avgDiscountPercent = mrp > 0 ? Math.max(0, Number((((mrp - avgSellingPrice) / mrp) * 100).toFixed(1))) : 0;
    const returnRate = p.totalGrossUnits > 0 ? Number(((p.totalReturnedUnits / p.totalGrossUnits) * 100).toFixed(1)) : 0;

    // COGS & Gross Profit
    const estimatedCogs = Math.round(p.deliveredRevenue * cogsRate);
    const grossProfit = p.deliveredRevenue - estimatedCogs;
    const grossMarginPercent = p.deliveredRevenue > 0 ? Number(((grossProfit / p.deliveredRevenue) * 100).toFixed(1)) : 0;

    // Sales Velocity
    const dailyVelocity = Number((p.totalGrossUnits / daysInScope).toFixed(2));

    intermediateProducts.push({
      id: p.id,
      title,
      category: p.category,
      mrp,
      minPrice,
      maxPrice,
      avgSellingPrice,
      avgDiscountPercent,
      hasDiscount: avgDiscountPercent >= 2,
      totalGrossUnits: p.totalGrossUnits,
      totalDeliveredUnits: p.totalDeliveredUnits,
      totalReturnedUnits: p.totalReturnedUnits,
      totalPartialUnits: p.totalPartialUnits,
      returnRate,
      deliveredRevenue: Math.round(p.deliveredRevenue),
      totalGrossRevenue: Math.round(p.totalGrossRevenue),
      totalReturnLoss: Math.round(p.totalReturnLoss),
      estimatedCogs,
      grossProfit,
      grossMarginPercent,
      pricePoints,
      sizes,
      variationsCount: sizes.length,
      skus: Array.from(p.skus),
      dailyVelocity,
      performanceTier: 'CORE_STABLE', // Calculated in ranking pass below
      abcCategory: 'B', // Calculated in Pareto pass below
      channelBreakdown: {
        warehouseUnits: p.channelMap.warehouseUnits,
        outletUnits: p.channelMap.outletUnits,
        outletDispatches: p.channelMap.outlets,
      },
      geoBreakdown: p.geoMap,
      topCompanionProducts: (productAffinitiesMap.get(title) || []).slice(0, 5),
      optimalPricePoint,
    });
  }

  // 4. Pareto ABC Classification & Performance Tier Assignment
  // Sort products descending by delivered net revenue
  intermediateProducts.sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);

  const totalDeliveredRevenue = intermediateProducts.reduce((sum, p) => sum + p.deliveredRevenue, 0);
  let runningRevenueSum = 0;

  let classACount = 0;
  let classBCount = 0;
  let classCCount = 0;
  let classARevenue = 0;
  let classBRevenue = 0;
  let classCRevenue = 0;

  const top15PercentCount = Math.max(1, Math.ceil(intermediateProducts.length * 0.15));

  for (let idx = 0; idx < intermediateProducts.length; idx++) {
    const prod = intermediateProducts[idx];
    runningRevenueSum += prod.deliveredRevenue;
    const cumulativePercent = totalDeliveredRevenue > 0 ? (runningRevenueSum / totalDeliveredRevenue) * 100 : 0;
    prod.cumulativeRevenuePercent = Number(cumulativePercent.toFixed(1));

    // ABC Pareto Logic:
    // A: Top cumulative 80%
    // B: Next cumulative 15% (80% - 95%)
    // C: Bottom cumulative 5% (95% - 100%)
    if (cumulativePercent <= 80 || idx === 0) {
      prod.abcCategory = 'A';
      classACount++;
      classARevenue += prod.deliveredRevenue;
    } else if (cumulativePercent <= 95) {
      prod.abcCategory = 'B';
      classBCount++;
      classBRevenue += prod.deliveredRevenue;
    } else {
      prod.abcCategory = 'C';
      classCCount++;
      classCRevenue += prod.deliveredRevenue;
    }

    // Performance Tier Assignment
    if (prod.returnRate >= 25 && prod.totalGrossUnits >= 4) {
      prod.performanceTier = 'HIGH_RETURN_RISK';
    } else if (idx < top15PercentCount && prod.returnRate < 20) {
      prod.performanceTier = 'TOP_PERFORMER';
    } else if (prod.abcCategory === 'C' && prod.totalGrossUnits <= 3) {
      prod.performanceTier = 'LOW_PERFORMER';
    } else {
      prod.performanceTier = 'CORE_STABLE';
    }
  }

  // 5. Global Summary Analytics
  const totalUnitsSold = intermediateProducts.reduce((sum, p) => sum + p.totalGrossUnits, 0);
  const totalDeliveredUnits = intermediateProducts.reduce((sum, p) => sum + p.totalDeliveredUnits, 0);
  const totalGrossRev = intermediateProducts.reduce((sum, p) => sum + p.totalGrossRevenue, 0);
  const avgProductSellingPrice = totalUnitsSold > 0 ? Math.round(totalGrossRev / totalUnitsSold) : 0;

  const discountedProds = intermediateProducts.filter((p) => p.hasDiscount);
  const avgDiscountDepth =
    discountedProds.length > 0
      ? Number(
          (
            discountedProds.reduce((sum, p) => sum + p.avgDiscountPercent, 0) /
            discountedProds.length
          ).toFixed(1)
        )
      : 0;

  const topRevenueProduct = intermediateProducts.length > 0 ? intermediateProducts[0] : null;
  const topVolumeProduct = [...intermediateProducts].sort((a, b) => b.totalGrossUnits - a.totalGrossUnits)[0] || null;
  const lowestVolumeProduct = [...intermediateProducts].sort((a, b) => a.totalGrossUnits - b.totalGrossUnits)[0] || null;
  const highestReturnProduct =
    [...intermediateProducts]
      .filter((p) => p.totalGrossUnits >= 5)
      .sort((a, b) => b.returnRate - a.returnRate)[0] || null;

  // Size anomalies: find sizes with return rate significantly above global average
  const globalAvgReturnRate =
    totalUnitsSold > 0
      ? ((totalUnitsSold - totalDeliveredUnits) / totalUnitsSold) * 100
      : 0;

  const sizeReturnAnomalies = Array.from(globalSizeMap.entries())
    .map(([sz, s]) => ({
      size: sz,
      grossUnits: s.gross,
      returnedUnits: s.returned,
      returnRate: s.gross > 0 ? Number(((s.returned / s.gross) * 100).toFixed(1)) : 0,
    }))
    .filter((s) => s.grossUnits >= 10 && s.returnRate > globalAvgReturnRate * 1.25)
    .sort((a, b) => b.returnRate - a.returnRate);

  const multiItemRate = totalOrders > 0 ? Number(((multiItemOrdersCount / totalOrders) * 100).toFixed(1)) : 0;

  return {
    products: intermediateProducts,
    summary: {
      totalProducts: intermediateProducts.length,
      totalUnitsSold,
      totalDeliveredUnits,
      totalDeliveredRevenue,
      avgProductSellingPrice,
      avgDiscountDepth,
      discountedProductsCount: discountedProds.length,
      multiItemOrdersCount,
      totalOrdersCount: totalOrders,
      multiItemOrderRate: multiItemRate,
      topRevenueProduct,
      topVolumeProduct,
      lowestVolumeProduct,
      highestReturnProduct,
      basketSizeDistribution,
      topBasketPairs: marketBasketPairs.slice(0, 20),
      abcSummary: {
        classACount,
        classBCount,
        classCCount,
        classARevenue,
        classBRevenue,
        classCRevenue,
      },
      sizeReturnAnomalies,
    },
    marketBasketPairs,
  };
}
