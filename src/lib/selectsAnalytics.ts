/**
 * DEEN Selects vs DEEN Regular Collection Analytics
 * 
 * Domain Invariant:
 * - In-house core products have the brand tag 'DEEN' in their product name
 *   (e.g., 'DEEN High-End Jeans', 'DEEN Teal Trousers') -> 'DEEN Regular'.
 * - Products that do NOT contain the tag 'DEEN' in their name (e.g., curated third-party/imported
 *   brands like '4F T-shirt', 'ZARA Quilted Jacket', 'Sorbino Denim Jacket', 'Calvin Klein Jeans')
 *   belong to 'DEEN Selects'.
 * - Any item explicitly marked with 'Selects' / 'DEEN Selects' in name/category or SKU prefix
 *   ('DS-', 'SEL-') belongs to 'DEEN Selects'.
 */

export const SELECTS_LABEL = 'DEEN Selects';
export const REGULAR_LABEL = 'DEEN Regular';

const SELECTS_PATTERN = /\b(selects?|deen\s*selects?)\b/i;
const SELECTS_SKU_PREFIX = /^(DS|SEL)[-_0-9]/i;
const DEEN_PATTERN = /\bdeen\b/i;

const SELECTS_BRANDS = [
  'pull & bear',
  'pull and bear',
  'springfield',
  'calvin klein',
  "levi's",
  'levis',
  'lee workwear',
  'lee carpenter',
  'allen solly',
  'sorbino',
  'lefties',
  'dragon ball z',
  'zara',
  'tiffosi',
  'petrol',
  '4f',
];

export function classifyProductLine(
  name?: string | null,
  sku?: string | null,
  category?: string | null
): 'DEEN Selects' | 'DEEN Regular' {
  const sName = (name || '').trim().toLowerCase();
  const sSku = (sku || '').trim().toLowerCase();
  const sCat = (category || '').trim().toLowerCase();

  // 1. Explicit selects keyword or category match (e.g. "DEEN Selects Silk Panjabi")
  if (SELECTS_PATTERN.test(sName) || SELECTS_PATTERN.test(sCat)) {
    return SELECTS_LABEL;
  }

  // 2. SKU prefix match (e.g. DS-104-..., SEL-...)
  if (SELECTS_PATTERN.test(sSku) || SELECTS_SKU_PREFIX.test(sSku)) {
    return SELECTS_LABEL;
  }

  // 3. Known multi-brand Selects line match
  if (SELECTS_BRANDS.some((b) => sName.includes(b))) {
    return SELECTS_LABEL;
  }

  // 4. Primary Rule: Check for 'DEEN' brand tag in product name
  if (sName) {
    if (DEEN_PATTERN.test(sName)) {
      return REGULAR_LABEL;
    }
    return SELECTS_LABEL;
  }

  // 5. Fallback when name is absent: check category and SKU
  if (sCat && DEEN_PATTERN.test(sCat)) return REGULAR_LABEL;
  if (sSku && DEEN_PATTERN.test(sSku)) return REGULAR_LABEL;

  return REGULAR_LABEL;
}

export interface SelectsStats {
  selectsRevenue: number;
  regularRevenue: number;
  totalRevenue: number;
  selectsRevShare: number;
  regularRevShare: number;
  selectsQty: number;
  regularQty: number;
  totalQty: number;
  selectsQtyShare: number;
  regularQtyShare: number;
}

export function computeSelectsStats(
  items: Array<{ itemName?: string; sku?: string; category?: string; itemCost?: number; quantity?: number; amount?: number }>
): SelectsStats {
  let selectsRevenue = 0;
  let regularRevenue = 0;
  let selectsQty = 0;
  let regularQty = 0;

  for (const it of items) {
    const line = classifyProductLine(it.itemName, it.sku, it.category);
    const qty = it.quantity || 1;
    const rev = it.amount !== undefined ? it.amount : (it.itemCost || 0) * qty;

    if (line === SELECTS_LABEL) {
      selectsRevenue += rev;
      selectsQty += qty;
    } else {
      regularRevenue += rev;
      regularQty += qty;
    }
  }

  const totalRevenue = selectsRevenue + regularRevenue;
  const totalQty = selectsQty + regularQty;

  const selectsRevShare = totalRevenue > 0 ? (selectsRevenue / totalRevenue) * 100 : 0;
  const regularRevShare = totalRevenue > 0 ? (regularRevenue / totalRevenue) * 100 : 0;

  const selectsQtyShare = totalQty > 0 ? (selectsQty / totalQty) * 100 : 0;
  const regularQtyShare = totalQty > 0 ? (regularQty / totalQty) * 100 : 0;

  return {
    selectsRevenue: Math.round(selectsRevenue),
    regularRevenue: Math.round(regularRevenue),
    totalRevenue: Math.round(totalRevenue),
    selectsRevShare: Math.round(selectsRevShare * 10) / 10,
    regularRevShare: Math.round(regularRevShare * 10) / 10,
    selectsQty,
    regularQty,
    totalQty,
    selectsQtyShare: Math.round(selectsQtyShare * 10) / 10,
    regularQtyShare: Math.round(regularQtyShare * 10) / 10,
  };
}
