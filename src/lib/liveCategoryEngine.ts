/**
 * Live Operational Category & Sub-Category Classification Engine
 * Replicates DEEN-OPS Unified Category Rules.
 */

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  'Jeans': '#f43f5e',
  'Twill Chino': '#f97316',
  'Twill Five Pockets': '#f97316',
  '5-Pocket Twill': '#f97316',
  'Twill': '#f97316',
  'T-Shirt': '#e11d48',
  'Shirt': '#3b82f6',
  'Casual': '#a855f7',
  'Casual Shirt': '#a855f7',
  'Polo': '#6366f1',
  'Polo Shirt': '#6366f1',
  'Cargo': '#14b8a6',
  'Cargo Trouser': '#14b8a6',
  'Hoodie': '#ea580c',
  'Trousers': '#f59e0b',
  'Jacket': '#f43f5e',
  'Denim Jacket': '#e11d48',
  'Sweatshirt': '#8b5cf6',
  'FS Shirt': '#3b82f6',
  'HS Shirt': '#06b6d4',
  'Panjabi': '#0ea5e9',
  'Boxer': '#ec4899',
  'Wallet': '#d97706',
  'Card Holder': '#0d9488',
  'Passport Holder': '#0d9488',
  'Drop Shoulder': '#84cc16',
  'Tank Top': '#10b981',
  'Turtle-Neck': '#64748b',
  'Mug': '#78716c',
  'Bundles': '#6366f1',
  'Accessories': '#0d9488',
  'Mask': '#14b8a6',
  'Belt': '#b45309',
  'Water Bottle': '#06b6d4',
  'General Apparel': '#94a3b8',
  'Others': '#94a3b8',

  // Jeans Sub-Categories (Differentiated shades of rose/crimson/coral)
  'Regular Fit': '#f43f5e',
  'Regular Fit Jeans': '#f43f5e',
  'Slim Fit': '#e11d48',
  'Slim Fit Jeans': '#e11d48',
  'Straight Fit': '#fb7185',
  'Straight Fit Jeans': '#fb7185',

  // Twill Sub-Categories (Differentiated shades of amber/orange)
  'Twill Joggers': '#ea580c',
  'Twill Pant': '#fb923c',

  // T-Shirt Sub-Categories
  'Active Wear': '#be123c',
  'Active Wear T-Shirt': '#be123c',
  'Jersey': '#9f1239',
  'Jersy': '#9f1239',
  'FS T-Shirt': '#f43f5e',
  'FS-T-Shirt': '#f43f5e',
  'HS T-Shirt': '#fb7185',

  // FS Shirt Sub-Categories
  'Flannel': '#2563eb',
  'Flannel Shirt': '#2563eb',
  'Oxford': '#3b82f6',
  'Oxford Shirt': '#3b82f6',
  'Denim Shirt': '#60a5fa',
  'Formal': '#1d4ed8',
  'Formal Shirt': '#1d4ed8',
  'Kaftan': '#0284c7',
  'Kaftan Shirt': '#0284c7',
  'Casual (FS)': '#818cf8',
  'Casual Shirt - Full Sleeve': '#818cf8',

  // HS Shirt Sub-Categories
  'Cuban': '#0891b2',
  'Cuban Shirt': '#0891b2',
  'Casual (HS)': '#06b6d4',
  'Casual Shirt - Half Sleeve': '#06b6d4',
  'Contrast': '#22d3ee',
  'Contrast Shirt': '#22d3ee',

  // Sweatshirt Sub-Categories
  'Cotton Terry': '#7c3aed',
  'Cotton Terry Sweatshirt': '#7c3aed',
  'French Terry': '#8b5cf6',
  'French Terry Sweatshirt': '#8b5cf6',

  // Trousers Sub-Categories
  'Joggers': '#d97706',
  'Regular Trousers': '#f59e0b',
  'Regular Fit Trousers': '#f59e0b',
  'Formal Trousers': '#2563eb',
  'Formal Trouser': '#2563eb',
};

export function getShortCategoryLabel(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const lower = name.trim().toLowerCase();

  if (lower.includes('denim jacket')) return 'Denim Jacket';
  if (lower.includes('denim shirt')) return 'Denim Shirt';
  if (lower.includes('denim')) return 'Denim';
  if (lower.includes('flannel')) return 'Flannel';
  if (lower.includes('five pocket') || lower.includes('5 pocket') || lower.includes('5-pocket') || lower.includes('twill') || lower.includes('chino')) return 'Twill Chino';
  if (lower.includes('casual')) return 'Casual';
  if (lower.includes('corduroy')) return 'Corduroy';
  if (lower.includes('cuban')) return 'Cuban';
  if (lower.includes('panjabi') || lower.includes('punjabi')) return 'Panjabi';
  if (lower.includes('formal') || lower.includes('executive')) return 'Formal';
  if (lower.includes('sweatshirt')) return 'Sweatshirt';
  if (lower.includes('hoodie')) return 'Hoodie';
  if (lower.includes('jacket')) return 'Jacket';
  if (lower.includes('jeans')) return 'Jeans';
  if (lower.includes('pajama') || lower.includes('payjama')) return 'Pajama';
  if (lower.includes('polo')) return 'Polo';
  if (lower.includes('cargo')) return 'Cargo';
  if (lower.includes('tank top')) return 'T-Shirt';
  if (lower.includes('drop shoulder')) return 'T-Shirt';
  if (lower.includes('t-shirt') || lower.includes('t shirt')) return 'T-Shirt';
  if (lower.includes('trouser') || lower.includes('jogger')) return 'Trousers';
  if (lower.includes('full sleeve') || lower === 'fs shirt') return 'FS Shirt';
  if (lower.includes('half sleeve') || lower === 'hs shirt') return 'HS Shirt';
  if (lower.includes('mask') || lower.includes('accessor') || lower.includes('belt') || lower.includes('bottle') || lower.includes('mug') || lower.includes('boxer') || lower.includes('card holder') || lower.includes('passport') || lower.includes('wallet')) return 'Accessories';
  if (lower.includes('other')) return 'General Apparel';

  const prefixes = ['FS Shirt - ', 'HS Shirt - ', 'FS T-Shirt - ', 'HS T-Shirt - ', 'FS Shirt ', 'HS Shirt ', 'FS ', 'HS '];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      const shortVer = name.slice(prefix.length).trim();
      if (shortVer) return shortVer;
    }
  }

  return name.trim();
}

function hasAny(keywords: string[], text: string): boolean {
  return keywords.some((kw) => text.includes(kw));
}

export function getCategoryForSales(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'General Apparel';
  const nameStr = name.toLowerCase().trim();

  // 1. High-priority special categories
  if (hasAny(['panjabi', 'punjabi'], nameStr)) return 'Panjabi';
  if (hasAny(['sweatshirt', 'pullover'], nameStr) || nameStr.includes('hoodie')) return 'Sweatshirt';
  if (hasAny(['jacket', 'outerwear', 'coat'], nameStr)) return 'Jacket';
  if (nameStr.includes('polo')) return 'Polo';
  if (hasAny(['turtleneck', 'turtle-neck', 'mock neck'], nameStr)) return 'Turtle-Neck';
  if (nameStr.includes('bundle')) return 'Bundles';

  // 2. Main clusters
  if (nameStr.includes('jeans') && !nameStr.includes('jacket') && !nameStr.includes('shirt')) return 'Jeans';

  // T-Shirt (including Tank Top and Drop Shoulder)
  const hasTshirt =
    hasAny(['t-shirt', 't shirt', 'active wear', 'activewear', 'jersy', 'jersey', 'tank top', 'drop shoulder', 'oversized'], nameStr) ||
    /\btee\b/.test(nameStr);
  if (hasTshirt) return 'T-Shirt';

  // Twill Chino (both sub and main cat should be twill chino)
  if (hasAny(['five pocket', '5 pocket', '5-pocket', 'twill', 'chino'], nameStr)) return 'Twill Chino';

  // Shirt
  const isShirt =
    (nameStr.includes('shirt') || hasAny(['executive', 'formal'], nameStr)) &&
    !hasAny(['pant', 'trouser', 'panjabi', 'punjabi'], nameStr);
  if (isShirt) return 'Shirt';

  // Cargo (If cargo trousers, main cat should be cargo)
  if (nameStr.includes('cargo')) return 'Cargo';

  // Accessories (Card Holder, Passport Holder, Wallet, Boxer, Mask, Belt, Bottle, Mug)
  if (hasAny(['card holder', 'passport', 'wallet', 'bifold', 'coin pocket long wallet', 'mask', 'face mask', 'accessor', 'belt', 'bottle', 'water bottle', 'mug', 'boxer'], nameStr)) return 'Accessories';
  if ((hasAny(['backpack', 'tote', 'leather bag'], nameStr) || /\bbag(s)?\b/.test(nameStr)) && !nameStr.includes('baggy')) return 'Leather Bag';

  // Trousers
  if (hasAny(['trousers', 'trouser', 'jogger', 'pants', 'gabardine'], nameStr)) return 'Trousers';

  return 'General Apparel';
}

export function getSubCategoryForSales(name?: string | null, parentCategory?: string): string {
  if (!name || typeof name !== 'string') return parentCategory || 'General Apparel';
  const nameStr = name.toLowerCase().trim();
  const category = parentCategory || getCategoryForSales(name);

  if (category === 'Jeans') {
    if (nameStr.includes('regular')) return 'Regular Fit Jeans';
    if (nameStr.includes('slim')) return 'Slim Fit Jeans';
    if (nameStr.includes('straight')) return 'Straight Fit Jeans';
    return 'Jeans';
  }

  if (category === 'T-Shirt') {
    if (nameStr.includes('tank top')) return 'Tank Top';
    if (hasAny(['drop shoulder', 'oversized'], nameStr)) return 'Drop Shoulder';
    if (hasAny(['active wear', 'activewear'], nameStr)) return 'Active Wear T-Shirt';
    if (hasAny(['jersy', 'jersey'], nameStr)) return 'Jersey';
    if (hasAny(['full sleeve', 'long sleeve', 'fs'], nameStr)) return 'Full Sleeve';
    return 'Half Sleeve';
  }

  if (category === 'Polo') {
    return 'Polo';
  }

  if (category === 'Twill Chino' || category === 'Twill' || category === 'Twill Five Pockets') {
    return 'Twill Chino';
  }

  if (category === 'Shirt' || category === 'FS Shirt' || category === 'HS Shirt') {
    if (nameStr.includes('denim')) return 'Denim Shirt';
    if (nameStr.includes('flannel')) return 'Flannel Shirt';
    if (nameStr.includes('cuban')) return 'Cuban Shirt';
    if (nameStr.includes('kaftan')) return 'Kaftan Shirt';
    if (nameStr.includes('oxford')) return 'Oxford Shirt';
    if (hasAny(['executive', 'formal'], nameStr)) return 'Formal Shirt';
    if (hasAny(['full sleeve', 'long sleeve', 'fs'], nameStr)) return 'Full Sleeve Shirt';
    if (hasAny(['half shirt', 'half sleeve', 'hs'], nameStr)) return 'Half Shirt';
    return 'Casual Shirt';
  }

  if (category === 'Sweatshirt' || category === 'Hoodie') {
    if (hasAny(['cotton terry', 'cotton-terry', 'cotton'], nameStr)) return 'Cotton Terry';
    if (hasAny(['french terry', 'french-terry', 'french'], nameStr)) return 'French Terry';
    if (nameStr.includes('hoodie')) return 'Hoodie';
    return 'Cotton Terry';
  }

  if (category === 'Cargo') {
    return 'Cargo Trouser';
  }

  if (category === 'Trousers' || category === 'Trouser') {
    if (nameStr.includes('cargo')) return 'Cargo Trouser';
    if (nameStr.includes('joggers')) return 'Joggers';
    if (nameStr.includes('regular fit')) return 'Regular Fit Trousers';
    return 'Formal Trousers';
  }

  if (category === 'Jacket') {
    if (nameStr.includes('denim')) return 'Denim Jacket';
    return 'Jacket';
  }

  if (category === 'Accessories' || hasAny(['mask', 'belt', 'bottle', 'mug', 'boxer', 'card', 'passport', 'wallet'], nameStr)) {
    if (nameStr.includes('card')) return 'Card Holder';
    if (nameStr.includes('passport')) return 'Passport Holder';
    if (hasAny(['wallet', 'bifold'], nameStr)) return 'Wallet';
    if (nameStr.includes('boxer')) return 'Boxer';
    if (nameStr.includes('mask')) return 'Mask';
    if (nameStr.includes('belt')) return 'Belt';
    if (nameStr.includes('bottle')) return 'Water Bottle';
    if (nameStr.includes('mug')) return 'Mug';
    return 'Accessories';
  }

  if (category === 'Panjabi') {
    if (nameStr.includes('semi')) return 'Semi Formal';
    return 'Regular Panjabi';
  }

  return category === 'Others' ? 'General Apparel' : category;
}

export function getShortSubCategoryLabel(subCategory?: string | null): string {
  if (!subCategory || typeof subCategory !== 'string') return '';
  const trimmed = subCategory.trim();
  const lower = trimmed.toLowerCase();

  // 1. Jeans sub-categories -> Distinct fit labels (Regular Fit, Slim Fit, Straight Fit)
  if (lower === 'regular fit jeans' || lower === 'regular fit') return 'Regular Fit';
  if (lower === 'slim fit jeans' || lower === 'slim fit') return 'Slim Fit';
  if (lower === 'straight fit jeans' || lower === 'straight fit') return 'Straight Fit';
  if (lower === 'jeans') return 'Jeans';

  // 1.5 Trousers & Cargo sub-categories (HIGH PRIORITY: Ensure Formal Trousers is never abbreviated to just "Formal")
  if (lower.includes('formal') && (lower.includes('trouser') || lower.includes('pant'))) return 'Formal Trousers';
  if (lower === 'formal trouser' || lower === 'formal trousers') return 'Formal Trousers';
  if (lower.includes('cargo')) return 'Cargo Trouser';
  if (lower === 'regular fit trousers' || lower === 'regular fit trouser') return 'Regular Trousers';
  if (hasAny(['five pocket', '5 pocket', '5-pocket'], lower)) return '5-Pocket Twill';
  if (lower.includes('jogger')) return 'Twill Joggers';
  if (lower.includes('pant')) return 'Twill Pant';

  // 3. T-Shirt sub-categories
  if (hasAny(['active wear', 'activewear'], lower)) return 'Active Wear';
  if (hasAny(['jersy', 'jersey'], lower)) return 'Jersey';
  if (hasAny(['full sleeve', 'long sleeve', 'fs'], lower)) return 'FS T-Shirt';
  if (hasAny(['half sleeve', 'hs'], lower)) return 'HS T-Shirt';

  // 4. FS Shirt sub-categories
  if (lower.includes('flannel')) return 'Flannel';
  if (lower.includes('oxford')) return 'Oxford';
  if (lower.includes('denim shirt')) return 'Denim Shirt';
  if (lower.includes('formal') || lower.includes('executive')) return 'Formal';
  if (lower.includes('kaftan')) return 'Kaftan';
  if (lower.includes('casual')) return 'Casual (FS)';

  // 5. HS Shirt sub-categories
  if (lower.includes('cuban')) return 'Cuban';
  if (lower.includes('contrast')) return 'Contrast';
  if (lower.includes('casual')) return 'Casual (HS)';

  // 6. Jacket sub-categories
  if (lower.includes('denim jacket')) return 'Denim Jacket';

  // 7. Sweatshirt sub-categories
  if (lower.includes('cotton terry')) return 'Cotton Terry';
  if (lower.includes('french terry')) return 'French Terry';

  // 8. Cargo & Trousers sub-categories
  if (lower.includes('cargo')) return 'Cargo Trouser';
  if (lower === 'regular fit trousers' || lower === 'regular fit trouser') return 'Regular Trousers';
  if (lower.includes('jogger')) return 'Joggers';

  // 9. Accessories sub-categories
  if (lower === 'boxer' || lower.includes('boxer')) return 'Boxer';
  if (lower.includes('card holder') || lower === 'card holder') return 'Card Holder';
  if (lower.includes('passport') || lower === 'passport holder') return 'Passport Holder';
  if (lower === 'mask' || lower.includes('face mask') || lower.includes('breathable face mask')) return 'Mask';
  if (lower === 'belt' || lower.includes('leather belt') || lower.includes('belt')) return 'Belt';
  if (lower === 'water bottle' || lower.includes('bottle')) return 'Water Bottle';
  if (lower === 'mug' || lower.includes('mug')) return 'Mug';

  // 10. Twill Chino & Tank Top / Drop Shoulder
  if (lower.includes('twill') || lower.includes('chino')) return 'Twill Chino';
  if (lower.includes('tank top')) return 'Tank Top';
  if (lower.includes('drop shoulder')) return 'Drop Shoulder';

  // 11. Additional Shirt sub-categories
  if (lower.includes('full sleeve shirt')) return 'Full Sleeve Shirt';
  if (lower.includes('half shirt')) return 'Half Shirt';
  if (lower === 'polo') return 'Polo';
  if (lower === 'general apparel') return 'General Apparel';

  return trimmed;
}
