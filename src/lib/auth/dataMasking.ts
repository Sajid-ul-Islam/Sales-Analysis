/**
 * Masks phone numbers to protect customer privacy.
 * Example: "01783650157" -> "0178****157"
 */
export function maskPhoneNumber(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (str.length <= 4) return '****';
  if (str.length <= 7) return str.slice(0, 2) + '****' + str.slice(-1);
  return str.slice(0, 4) + '****' + str.slice(-3);
}

/**
 * Masks customer name to initials while preserving readability.
 * Example: "Tusher pual" -> "T*** P***"
 */
export function maskCustomerName(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  return parts
    .map(p => (p.length > 1 ? `${p[0]}***` : p))
    .join(' ');
}

/**
 * Masks residential address to preserve only district/thana.
 * Example: "House 747, Road 11, Flat B4, Bashundhara R/A, Dhaka" -> "[REDACTED STREET], Dhaka"
 */
export function maskAddress(raw: any, cityHint?: string): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const city = cityHint ? String(cityHint).trim() : '';
  if (city) {
    return `[REDACTED STREET], ${city}`;
  }
  // Try extracting last token if comma-separated
  const tokens = str.split(',').map(t => t.trim()).filter(Boolean);
  if (tokens.length > 1) {
    return `[REDACTED STREET], ${tokens[tokens.length - 1]}`;
  }
  return '[REDACTED ADDRESS]';
}

export type MaskLevel = 'full' | 'partial' | 'none';

/**
 * Sanitizes a single order row by masking sensitive customer PII.
 */
export function sanitizeOrderRow(row: any, maskLevel: MaskLevel = 'full'): any {
  if (!row || typeof row !== 'object' || maskLevel === 'none') {
    return row;
  }

  const clean = { ...row };

  // Detect and mask Phone
  for (const k of ['Phone', 'phone', 'Phone (Shipping)', 'Customer Phone', 'Billing Phone']) {
    if (k in clean && clean[k]) {
      clean[k] = maskPhoneNumber(clean[k]);
    }
  }

  // Detect and mask Customer Name
  for (const k of ['Customer Name', 'customerName', 'Full Name (Shipping)', 'Billing Name', 'Name']) {
    if (k in clean && clean[k]) {
      clean[k] = maskCustomerName(clean[k]);
    }
  }

  // Detect and mask Street Address
  for (const k of ['Address 1&2 (Shipping)', 'address', 'Address', 'Shipping Address', 'Billing Address']) {
    if (k in clean && clean[k]) {
      const city = clean['City (Shipping)'] || clean['City'] || clean['city'] || '';
      clean[k] = maskAddress(clean[k], city);
    }
  }

  // Sanitize customer notes if they contain sensitive personal messages or phone numbers
  for (const k of ['Customer Note', 'Order Notes', 'customer_note', 'note']) {
    if (k in clean && typeof clean[k] === 'string') {
      clean[k] = clean[k].replace(/\b01[3-9]\d{8}\b/g, '[PHONE REDACTED]');
    }
  }

  return clean;
}

/**
 * Sanitizes an array of order records.
 */
export function sanitizeOrdersResponse(orders: any[], maskLevel: MaskLevel = 'full'): any[] {
  if (!Array.isArray(orders)) return [];
  return orders.map(row => sanitizeOrderRow(row, maskLevel));
}
