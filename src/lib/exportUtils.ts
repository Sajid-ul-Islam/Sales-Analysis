/**
 * Pure String, Name & Order Comparators for Export Manifests
 * Zero-dependency pure utilities safe for client-side component bundles (does not import SheetJS).
 */

import { cleanCustomerPhone } from './woocommerceClient';

/**
 * Strips trailing size indicator from product name (e.g. " - 34", " - XL", " - 2XL", " - 46")
 * returning the clean main product style name.
 */
export function cleanProductMainName(name: string): string {
  if (!name) return 'DEEN Apparel';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:(?:[2-5]?X[SL])|[SML]|(?:[2-5]?XL)|XS|XXL|XXXL|\d{2}(?:\.\d)?)\s*$/i, '');
  return cleaned.trim() || name;
}

/**
 * Extracts the base Master SKU code by stripping variation size suffixes if present.
 */
export function extractMasterSku(sku: string): string {
  if (!sku) return 'N/A';
  let s = sku.trim();
  s = s.replace(/[-_](?:(?:[2-5]?X[SL])|[SML]|(?:[2-5]?XL)|XS|XXL|XXXL|\d{2})\s*$/i, '');
  return s.trim() || sku;
}

/**
 * Natural numerical order comparator for sorting orders.
 * Orders like "17263", "17263 c", "17264", "D-17265" sort in natural numerical order.
 */
export function compareOrdersByNumber(a: unknown, b: unknown): number {
  const rowA = a as Record<string, unknown> | null;
  const rowB = b as Record<string, unknown> | null;
  const idA = String(rowA?.['Order ID'] || rowA?.orderId || rowA?.orderNumber || rowA?.['WooCommerce Order #'] || rowA?.id || '').trim();
  const idB = String(rowB?.['Order ID'] || rowB?.orderId || rowB?.orderNumber || rowB?.['WooCommerce Order #'] || rowB?.id || '').trim();

  const numA = parseInt(idA.replace(/\D/g, ''), 10);
  const numB = parseInt(idB.replace(/\D/g, ''), 10);

  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extracts the full, unmasked customer name for export manifests.
 */
export function getExportCustomerName(o: unknown): string {
  if (!o || typeof o !== 'object') return 'Customer';
  const obj = o as Record<string, unknown>;
  const billing = obj.billing as Record<string, unknown> | undefined;
  const shipping = obj.shipping as Record<string, unknown> | undefined;
  const candidates = [
    obj.rawCustomerName,
    obj['Customer Name'],
    obj.customerName,
    obj['Full Name (Shipping)'],
    obj['Billing Name'],
    obj.recipientName,
    obj['Recipient Name'],
    billing?.first_name ? `${billing.first_name} ${billing.last_name || ''}`.trim() : undefined,
    shipping?.first_name ? `${shipping.first_name} ${shipping.last_name || ''}`.trim() : undefined,
    obj.Name,
    obj.name,
  ];

  // 1. Prefer candidate without mask asterisks or redaction tokens
  for (const c of candidates) {
    if (typeof c === 'string') {
      const val = c.trim();
      if (val && !val.includes('***') && !val.includes('[REDACTED')) {
        return val;
      }
    }
  }

  // 2. Fallback to whatever is non-empty
  for (const c of candidates) {
    if (typeof c === 'string') {
      const val = c.trim();
      if (val) return val;
    }
  }

  return 'Customer';
}

/**
 * Extracts the full, unmasked 11-digit phone number for export manifests.
 */
export function getExportPhoneNumber(o: unknown): string {
  if (!o || typeof o !== 'object') return '';
  const obj = o as Record<string, unknown>;
  const billing = obj.billing as Record<string, unknown> | undefined;
  const shipping = obj.shipping as Record<string, unknown> | undefined;
  const candidates = [
    obj.rawPhone,
    obj.formattedPhone,
    obj.Phone,
    obj.phone,
    obj['Phone (Shipping)'],
    obj['Billing Phone'],
    obj.recipientPhone,
    obj['Recipient Phone'],
    billing?.phone,
    shipping?.phone,
    obj.contact,
  ];

  // 1. Prefer unmasked candidate
  for (const c of candidates) {
    if (typeof c === 'string' || typeof c === 'number') {
      const val = String(c).trim();
      if (val && !val.includes('*') && !val.includes('[PHONE REDACTED]')) {
        const { displayPhone } = cleanCustomerPhone(val);
        if (displayPhone) return displayPhone;
        return val;
      }
    }
  }

  // 2. Fallback to masked phone if no unmasked version exists
  for (const c of candidates) {
    if (typeof c === 'string' || typeof c === 'number') {
      const val = String(c).trim();
      if (val) return val;
    }
  }

  return '';
}
