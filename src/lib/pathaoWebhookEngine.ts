/**
 * Pathao Webhook Processing & Telemetry Engine
 * Normalizes Pathao webhook payload events, verifies security tokens,
 * and maintains real-time consignment status state for the Live Orders Terminal.
 */

import { getSecrets } from './secrets';

export interface PathaoWebhookPayload {
  event?: string;
  consignment_id?: string;
  order_consignment_id?: string;
  merchant_order_id?: string;
  order_id?: string;
  order_status?: string;
  order_status_slug?: string;
  status?: string;
  updated_at?: string;
  reason?: string;
  collected_amount?: number | string;
}

export interface PathaoWebhookRecord {
  consignmentId: string;
  merchantOrderId: string;
  normalizedStatus: 'Delivered' | 'Returned' | 'In-Transit' | 'Partial' | 'Untracked';
  rawStatus: string;
  collectedAmount: number;
  reason: string;
  updatedAt: string;
  receivedAt: string;
}

// In-Memory store of recent live webhook updates for zero-lag terminal sync
const liveWebhookUpdates = new Map<string, PathaoWebhookRecord>();

/**
 * Normalizes any Pathao status slug or string into canonical DEEN operational statuses.
 */
export function normalizePathaoStatus(rawStatus?: string): 'Delivered' | 'Returned' | 'In-Transit' | 'Partial' | 'Untracked' {
  if (!rawStatus) return 'Untracked';
  const s = String(rawStatus).toLowerCase().replace(/[\s\-_]/g, '');

  if (s.includes('return') || s.includes('failed') || s.includes('rto') || s.includes('cancelled')) {
    return 'Returned';
  }
  if (s.includes('partial')) {
    return 'Partial';
  }
  if (s.includes('delivered') || s.includes('paymentcollected') || s.includes('completed') || s.includes('received')) {
    return 'Delivered';
  }
  if (s.includes('intransit') || s.includes('pickedup') || s.includes('ontheway') || s.includes('assigned') || s.includes('hub')) {
    return 'In-Transit';
  }

  return 'In-Transit';
}

/**
 * Verifies authenticity of incoming webhook headers against configured secret.
 */
export function verifyPathaoWebhookSecret(providedSecret?: string | null): boolean {
  const secrets = getSecrets();
  const configuredSecret = secrets.pathao.webhook_secret || process.env.PATHAO_WEBHOOK_SECRET;

  // If no secret configured in environment, allow in development/testing mode
  if (!configuredSecret) {
    return true;
  }

  if (!providedSecret) {
    return false;
  }

  const cleanProvided = providedSecret.replace(/^Bearer\s+/i, '').trim();
  const cleanConfigured = configuredSecret.replace(/^Bearer\s+/i, '').trim();

  return cleanProvided === cleanConfigured;
}

/**
 * Ingests a raw webhook event and records it in the live telemetry cache.
 */
export function processPathaoWebhookEvent(payload: PathaoWebhookPayload): PathaoWebhookRecord | null {
  const consignmentId = String(
    payload.consignment_id || payload.order_consignment_id || ''
  ).trim();

  const merchantOrderId = String(
    payload.merchant_order_id || payload.order_id || ''
  ).trim();

  if (!consignmentId && !merchantOrderId) {
    return null;
  }

  const rawStatus = String(
    payload.order_status_slug || payload.order_status || payload.status || 'In-Transit'
  );

  const normalizedStatus = normalizePathaoStatus(rawStatus);
  const collectedAmount = Number(payload.collected_amount) || 0;
  const reason = String(payload.reason || '');
  const updatedAt = String(payload.updated_at || new Date().toISOString());
  const receivedAt = new Date().toISOString();

  const record: PathaoWebhookRecord = {
    consignmentId,
    merchantOrderId,
    normalizedStatus,
    rawStatus,
    collectedAmount,
    reason,
    updatedAt,
    receivedAt,
  };

  if (consignmentId) {
    liveWebhookUpdates.set(consignmentId, record);
  }
  if (merchantOrderId) {
    liveWebhookUpdates.set(`order_${merchantOrderId}`, record);
  }

  return record;
}

/**
 * Retrieves the current live map of consignment updates received via webhooks.
 */
export function getLiveWebhookUpdates(): Map<string, PathaoWebhookRecord> {
  return liveWebhookUpdates;
}

/**
 * Resets the in-memory updates store (primarily for unit testing).
 */
export function clearLiveWebhookUpdates(): void {
  liveWebhookUpdates.clear();
}
