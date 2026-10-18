/**
 * Masks phone numbers to protect customer privacy.
 * Example: "01783650157" -> "0178****157"
 */
export function maskPhoneNumber(raw: unknown): string {
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
export function maskCustomerName(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  return parts
    .map(p => (p.length > 1 ? `${p[0]}***` : p))
    .join(' ');
}

/**
 * Masks email address to protect customer privacy.
 * Example: "sajid.islam@gmail.com" -> "s***m@g***.com"
 */
export function maskEmail(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const atIdx = str.indexOf('@');
  if (atIdx <= 0) return '****@redacted.com';
  const localPart = str.slice(0, atIdx);
  const domainPart = str.slice(atIdx + 1);

  const maskedLocal = localPart.length > 2
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : `${localPart[0]}***`;

  const dotIdx = domainPart.lastIndexOf('.');
  const maskedDomain = dotIdx > 1
    ? `${domainPart[0]}***${domainPart.slice(dotIdx)}`
    : domainPart;

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Masks residential address to preserve only district/thana.
 * Example: "House 747, Road 11, Flat B4, Bashundhara R/A, Dhaka" -> "[REDACTED STREET], Dhaka"
 */
export function maskAddress(raw: unknown, cityHint?: string): string {
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
export function sanitizeOrderRow<T extends Record<string, unknown>>(row: T, maskLevel: MaskLevel = 'full'): T {
  if (!row || typeof row !== 'object' || maskLevel === 'none') {
    return row;
  }

  const clean = { ...row } as Record<string, unknown>;

  // Detect and mask Phone
  for (const k of ['Phone', 'phone', 'Phone (Shipping)', 'Customer Phone', 'Billing Phone', 'billing_phone', 'shipping_phone']) {
    if (k in clean && clean[k]) {
      clean[k] = maskPhoneNumber(clean[k]);
    }
  }

  // Detect and mask Customer Name
  for (const k of ['Customer Name', 'customerName', 'Full Name (Shipping)', 'Billing Name', 'Name', 'name']) {
    if (k in clean && clean[k]) {
      clean[k] = maskCustomerName(clean[k]);
    }
  }

  // Detect and mask Email
  for (const k of ['Email', 'email', 'Customer Email', 'customerEmail', 'Billing Email', 'billingEmail', 'Email (Billing)', 'billing_email', 'customer_email', 'user_email']) {
    if (k in clean && clean[k]) {
      clean[k] = maskEmail(clean[k]);
    }
  }

  // Detect and mask Street Address
  for (const k of ['Address 1&2 (Shipping)', 'address', 'Address', 'Shipping Address', 'Billing Address', 'shipping_address', 'billing_address', 'shipping_address_1']) {
    if (k in clean && clean[k]) {
      const city = String(clean['City (Shipping)'] || clean['City'] || clean['city'] || '');
      clean[k] = maskAddress(clean[k], city);
    }
  }

  // Sanitize nested billing object if present (e.g. WooCommerce raw orders)
  if (clean.billing && typeof clean.billing === 'object') {
    const billing = clean.billing as Record<string, unknown>;
    clean.billing = {
      ...billing,
      first_name: maskCustomerName(billing.first_name),
      last_name: maskCustomerName(billing.last_name),
      phone: maskPhoneNumber(billing.phone),
      email: maskEmail(billing.email),
      address_1: maskAddress(billing.address_1, billing.city as string | undefined),
      address_2: billing.address_2 ? '[REDACTED]' : '',
    };
  }

  // Sanitize nested shipping object if present
  if (clean.shipping && typeof clean.shipping === 'object') {
    const shipping = clean.shipping as Record<string, unknown>;
    clean.shipping = {
      ...shipping,
      first_name: maskCustomerName(shipping.first_name),
      last_name: maskCustomerName(shipping.last_name),
      phone: maskPhoneNumber(shipping.phone),
      address_1: maskAddress(shipping.address_1, shipping.city as string | undefined),
      address_2: shipping.address_2 ? '[REDACTED]' : '',
    };
  }

  // Redact customer IP address if present
  for (const k of ['customer_ip_address', 'ip', 'ip_address']) {
    if (k in clean && clean[k]) {
      clean[k] = '[REDACTED IP]';
    }
  }

  // Sanitize customer notes if they contain sensitive personal messages, emails, or phone numbers
  for (const k of ['Customer Note', 'Order Notes', 'customer_note', 'note']) {
    if (k in clean && typeof clean[k] === 'string') {
      clean[k] = (clean[k] as string)
        .replace(/\b01[3-9]\d{8}\b/g, '[PHONE REDACTED]')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]');
    }
  }

  return clean as T;
}

/**
 * Sanitizes an array of order records.
 */
export function sanitizeOrdersResponse<T extends Record<string, unknown>>(orders: T[], maskLevel: MaskLevel = 'full'): T[] {
  if (!Array.isArray(orders)) return [];
  return orders.map(row => sanitizeOrderRow(row, maskLevel));
}
