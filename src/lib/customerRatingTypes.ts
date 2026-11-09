export type CustomerRatingTier = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'RISKY' | 'NEW';

export interface CustomerRatingData {
  phone: string;
  normalizedPhone: string;
  ratingTier: CustomerRatingTier;
  ratingLabel: string;
  successRate: number; // 0 - 100 percentage
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  source: 'PATHAO' | 'STORE_HISTORY' | 'COMBINED';
  rawPathaoRating?: string;
  courierNotes?: string;
}

export interface PhoneStats {
  delivered: number;
  returned: number;
  total: number;
}

/**
 * Normalizes phone numbers to standard 11-digit Bangladesh phone (e.g., 01712345678)
 * and extracts 10-digit suffix for fuzzy matching against legacy records.
 */
export function normalizeCustomerPhone(raw: unknown): { full: string; suffix10: string } {
  if (!raw) return { full: '', suffix10: '' };
  const s = String(raw).trim();
  if (!s || s === 'nan' || s === 'none' || s === 'null' || s === 'N/A' || s === '-' || s === '0') {
    return { full: '', suffix10: '' };
  }
  const digits = s.replace(/\D/g, '');
  if (!digits || digits.length < 9) {
    return { full: '', suffix10: '' };
  }

  let full = digits;
  if (digits.startsWith('880')) {
    full = '0' + digits.slice(3);
  } else if (digits.startsWith('88')) {
    full = '0' + digits.slice(2);
  } else if (!digits.startsWith('0') && digits.length === 10) {
    full = '0' + digits;
  }

  const suffix10 = full.length >= 10 ? full.slice(-10) : full;
  return { full, suffix10 };
}

/**
 * Derives a structured CustomerRatingData object from empirical delivery statistics.
 */
export function deriveRatingFromStats(
  phone: string,
  stats: PhoneStats | null,
  source: 'STORE_HISTORY' | 'PATHAO' | 'COMBINED' = 'STORE_HISTORY',
  rawPathaoRating?: string
): CustomerRatingData {
  const norm = normalizeCustomerPhone(phone);

  if (!stats || stats.total === 0) {
    return {
      phone,
      normalizedPhone: norm.full || phone,
      ratingTier: 'NEW',
      ratingLabel: 'New Customer',
      successRate: 100,
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      riskLevel: 'LOW',
      source,
      rawPathaoRating,
      courierNotes: 'First-time buyer. Standard order verification recommended.',
    };
  }

  const successRate = stats.total > 0
    ? Math.round((stats.delivered / stats.total) * 100)
    : 100;

  let ratingTier: CustomerRatingTier = 'GOOD';
  let ratingLabel = `${successRate}% (Good)`;
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let courierNotes = 'Reliable buyer. Standard dispatch.';

  // Map Pathao's official rating tags or calculate empirical thresholds
  const pathaoTag = String(rawPathaoRating || '').toLowerCase();

  if (pathaoTag.includes('excellent') || successRate >= 90) {
    ratingTier = 'EXCELLENT';
    ratingLabel = `${successRate}% (Excellent)`;
    riskLevel = 'LOW';
    courierNotes = 'Very high delivery success rate across courier network. Fast-track dispatch eligible.';
  } else if (pathaoTag.includes('good') || (successRate >= 80 && successRate < 90)) {
    ratingTier = 'GOOD';
    ratingLabel = `${successRate}% (Good)`;
    riskLevel = 'LOW';
    courierNotes = 'Consistent delivery history with minimal courier returns.';
  } else if (pathaoTag.includes('moderate') || (successRate >= 60 && successRate < 80)) {
    ratingTier = 'MODERATE';
    ratingLabel = `${successRate}% (Moderate)`;
    riskLevel = 'MEDIUM';
    courierNotes = 'Occasional return history. Confirm recipient availability prior to dispatch.';
  } else if (pathaoTag.includes('risky') || (stats.total >= 1 && successRate < 60)) {
    ratingTier = 'RISKY';
    ratingLabel = `${successRate}% (High Risk)`;
    riskLevel = 'HIGH';
    courierNotes = 'High return/cancellation risk (>40% RTO). Advance courier fee collection advised.';
  } else if (pathaoTag.includes('new') || stats.total === 0) {
    ratingTier = 'NEW';
    ratingLabel = 'New Customer';
    riskLevel = 'LOW';
    courierNotes = 'First-time buyer profile.';
  }

  return {
    phone,
    normalizedPhone: norm.full || phone,
    ratingTier,
    ratingLabel,
    successRate,
    totalOrders: stats.total,
    deliveredOrders: stats.delivered,
    returnedOrders: stats.returned,
    riskLevel,
    source,
    rawPathaoRating,
    courierNotes,
  };
}
