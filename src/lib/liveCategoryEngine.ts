/**
 * Live Operational Category & Sub-Category Classification Engine
 * Replicates DEEN-OPS Unified Category Rules.
 */

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  'Jeans': '#f43f5e',
  'Twill Five Pockets': '#f97316',
  'Twill': '#f97316',
  'T-Shirt': '#e11d48',
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
  'Drop Shoulder': '#84cc16',
  'Tank Top': '#10b981',
  'Turtle-Neck': '#64748b',
  'Mug': '#78716c',
  'Bundles': '#6366f1',
  'Others': '#94a3b8',
};

export function getShortCategoryLabel(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const lower = name.trim().toLowerCase();

  if (lower.includes('denim jacket')) return 'Denim Jacket';
  if (lower.includes('denim shirt')) return 'Denim Shirt';
  if (lower.includes('denim')) return 'Denim';
  if (lower.includes('flannel')) return 'Flannel';
  if (lower.includes('five pocket') || lower.includes('5 pocket') || lower.includes('5-pocket') || lower.includes('twill')) return 'Twill';
  if (lower.includes('casual')) return 'Casual';
  if (lower.includes('corduroy')) return 'Corduroy';
  if (lower.includes('cuban')) return 'Cuban';
  if (lower.includes('panjabi') || lower.includes('punjabi')) return 'Panjabi';
  if (lower.includes('formal') || lower.includes('executive')) return 'Formal';
  if (lower.includes('sweatshirt')) return 'Sweatshirt';
  if (lower.includes('hoodie')) return 'Hoodie';
  if (lower.includes('jacket')) return 'Jacket';
  if (lower.includes('mug')) return 'Mug';
  if (lower.includes('jeans')) return 'Jeans';
  if (lower.includes('pajama') || lower.includes('payjama')) return 'Pajama';
  if (lower.includes('polo')) return 'Polo';
  if (lower.includes('cargo')) return 'Cargo';
  if (lower.includes('t-shirt') || lower.includes('t shirt')) return 'T-Shirt';
  if (lower.includes('trouser') || lower.includes('jogger')) return 'Trousers';
  if (lower.includes('full sleeve') || lower === 'fs shirt') return 'FS Shirt';
  if (lower.includes('half sleeve') || lower === 'hs shirt') return 'HS Shirt';

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
  if (!name || typeof name !== 'string') return 'Others';
  const nameStr = name.toLowerCase().trim();

  // 1. High-priority special categories
  if (hasAny(['panjabi', 'punjabi'], nameStr)) return 'Panjabi';
  if (hasAny(['sweatshirt', 'pullover'], nameStr)) return 'Sweatshirt';
  if (nameStr.includes('hoodie')) return 'Hoodie';
  if (hasAny(['jacket', 'outerwear', 'coat'], nameStr)) return 'Jacket';
  if (nameStr.includes('mug')) return 'Mug';
  if (nameStr.includes('polo')) return 'Polo';
  if (hasAny(['turtleneck', 'turtle-neck', 'mock neck'], nameStr)) return 'Turtle-Neck';
  if (nameStr.includes('bundle')) return 'Bundles';
  if (nameStr.includes('cuban')) return 'HS Shirt';

  // 2. Main clusters
  if (nameStr.includes('jeans')) return 'Jeans';
  if (hasAny(['drop shoulder', 'oversized'], nameStr)) return 'Drop Shoulder';
  if (nameStr.includes('tank top')) return 'Tank Top';

  const hasTshirt =
    hasAny(['t-shirt', 't shirt', 'active wear', 'activewear', 'jersy', 'jersey'], nameStr) ||
    /\btee\b/.test(nameStr);
  if (hasTshirt) return 'T-Shirt';

  const fsKeywords = ['full sleeve', 'long sleeve', 'fs', 'l/s', 'fullsleeve', 'full-sleeve'];
  const isShirt =
    (nameStr.includes('shirt') || hasAny(['executive', 'formal'], nameStr)) &&
    !hasAny(['pant', 'trouser', 'panjabi', 'punjabi'], nameStr);

  if (isShirt) {
    if (hasAny(fsKeywords, nameStr) || hasAny(['denim', 'flannel', 'oxford', 'kaftan', 'executive', 'formal'], nameStr)) {
      return 'FS Shirt';
    }
    return 'HS Shirt';
  }

  if (hasAny(['five pocket', '5 pocket', '5-pocket', 'twill', 'chino'], nameStr)) return 'Twill';
  if (nameStr.includes('cargo')) return 'Cargo';
  if (hasAny(['trousers', 'trouser', 'jogger', 'pants', 'gabardine'], nameStr)) return 'Trousers';
  if (nameStr.includes('boxer')) return 'Boxer';
  if (hasAny(['wallet', 'card holder', 'passport holder'], nameStr)) return 'Wallet';
  if (hasAny(['bag', 'backpack', 'tote'], nameStr)) return 'Leather Bag';
  if (nameStr.includes('bottle')) return 'Water Bottle';

  return 'Others';
}

export function getSubCategoryForSales(name?: string | null, parentCategory?: string): string {
  if (!name || typeof name !== 'string') return parentCategory || 'Others';
  const nameStr = name.toLowerCase().trim();
  const category = parentCategory || getCategoryForSales(name);

  if (category === 'Jeans') {
    if (nameStr.includes('regular')) return 'Regular Fit Jeans';
    if (nameStr.includes('slim')) return 'Slim Fit Jeans';
    if (nameStr.includes('straight')) return 'Straight Fit Jeans';
    return 'Jeans';
  }

  if (category === 'T-Shirt') {
    if (hasAny(['active wear', 'activewear'], nameStr)) return 'Active Wear T-Shirt';
    if (hasAny(['jersy', 'jersey'], nameStr)) return 'Jersy';
    if (hasAny(['full sleeve', 'long sleeve', 'fs'], nameStr)) return 'FS-T-Shirt';
    return 'HS T-Shirt';
  }

  if (category === 'FS Shirt') {
    if (nameStr.includes('flannel')) return 'Flannel Shirt';
    if (nameStr.includes('denim')) return 'Denim Shirt';
    if (nameStr.includes('oxford')) return 'Oxford Shirt';
    if (nameStr.includes('kaftan')) return 'Kaftan Shirt';
    if (nameStr.includes('casual')) return 'Casual Shirt - Full Sleeve';
    if (hasAny(['executive', 'formal'], nameStr)) return 'Formal Shirt';
    return 'FS Shirt';
  }

  if (category === 'HS Shirt') {
    if (nameStr.includes('contrast')) return 'Contrast Shirt';
    if (nameStr.includes('casual')) return 'Casual Shirt - Half Sleeve';
    if (nameStr.includes('cuban')) return 'Cuban Shirt';
    return 'HS Shirt';
  }

  if (category === 'Twill' || category === 'Twill Five Pockets') {
    if (nameStr.includes('joggers')) return 'Twill Joggers';
    if (hasAny(['five pocket', '5 pocket', '5-pocket'], nameStr)) return 'Twill Five Pockets';
    return 'Twill Pant';
  }

  if (category === 'Trousers') {
    if (nameStr.includes('joggers')) return 'Joggers';
    if (nameStr.includes('regular fit')) return 'Regular Fit Trousers';
    return 'Trousers';
  }

  if (category === 'Jacket') {
    if (nameStr.includes('denim')) return 'Denim Jacket';
    return 'Jacket';
  }

  if (category === 'Sweatshirt') {
    if (nameStr.includes('cotton terry')) return 'Cotton Terry Sweatshirt';
    if (nameStr.includes('french terry')) return 'French Terry Sweatshirt';
    return 'Sweatshirt';
  }

  return category;
}
