/**
 * Deterministic Order Sampling Engine
 * Samples exactly the specified ratio (e.g. 15%) of unique orders in a dataset,
 * preserving multi-item order coherence, knapsack returns, partials, and courier telemetry.
 */

import { DatasetSnapshot, RawOrderRow } from '@/types';
import { extractBaseOrderId } from './reconciliationEngine';

/**
 * Extracts raw order ID or consignment string from any order/delivery row.
 */
export function getRowOrderId(row: Record<string, unknown>): string {
  if (!row || typeof row !== 'object') return '';
  return String(
    row['Order ID'] ||
    row['order_id'] ||
    row['orderId'] ||
    row['id'] ||
    row['Merchant Order ID'] ||
    row['merchant_order_id'] ||
    row['Consignment ID'] ||
    row['orderconsignmentid'] ||
    row['consignment_id'] ||
    row['trackingcode'] ||
    ''
  ).trim();
}

/**
 * Deterministic 32-bit FNV-1a hash algorithm.
 * Guarantees that order selection is completely stable across all re-renders and components.
 */
export function deterministicHash(str: string, seed: number = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/**
 * Derives a deterministic Set of unique base order IDs representing exactly the requested ratio (e.g. 0.15 = 15%).
 */
export function getSampledBaseOrderIds(
  orders: RawOrderRow[],
  ratio: number = 0.15
): Set<string> {
  if (!orders || orders.length === 0 || ratio >= 1 || ratio <= 0) {
    return new Set();
  }

  // Collect unique non-empty base order IDs
  const uniqueBaseIds = new Set<string>();
  for (const r of orders) {
    const raw = getRowOrderId(r);
    const base = extractBaseOrderId(raw);
    if (base) {
      uniqueBaseIds.add(base);
    }
  }

  const idsArray = Array.from(uniqueBaseIds);
  if (idsArray.length === 0) return new Set();

  const targetCount = Math.max(1, Math.round(idsArray.length * ratio));

  // Sort deterministically by FNV-1a hash value with tie-breaker
  idsArray.sort((a, b) => {
    const ha = deterministicHash(a);
    const hb = deterministicHash(b);
    if (ha !== hb) return ha - hb;
    return a.localeCompare(b);
  });

  const selected = idsArray.slice(0, targetCount);
  return new Set(selected);
}

/**
 * Filters a raw row array keeping only rows that match one of the sampled base order IDs.
 */
export function filterRowsBySampledIds(
  rows: RawOrderRow[] | undefined,
  sampledIds: Set<string>
): RawOrderRow[] {
  if (!rows || rows.length === 0 || sampledIds.size === 0) return [];
  return rows.filter((r) => {
    const raw = getRowOrderId(r);
    const base = extractBaseOrderId(raw);
    return base ? sampledIds.has(base) : false;
  });
}

/**
 * Samples an entire DatasetSnapshot down to the specified ratio (default 15%),
 * keeping all order line items, returns, partials, exchanges, and Pathao delivery rows synchronized.
 */
export function sampleDatasetSnapshot(
  dataset: DatasetSnapshot,
  ratio: number = 0.15
): DatasetSnapshot {
  if (!dataset || !dataset.orders || ratio >= 1 || ratio <= 0) {
    return dataset;
  }

  const sampledIds = getSampledBaseOrderIds(dataset.orders, ratio);
  if (sampledIds.size === 0) {
    return dataset;
  }

  return {
    ...dataset,
    orders: filterRowsBySampledIds(dataset.orders, sampledIds),
    returns: filterRowsBySampledIds(dataset.returns, sampledIds),
    partials: filterRowsBySampledIds(dataset.partials, sampledIds),
    exchanges: filterRowsBySampledIds(dataset.exchanges, sampledIds),
    pathaoDelivery: filterRowsBySampledIds(dataset.pathaoDelivery, sampledIds),
    sourceName: dataset.sourceName,
  };
}
