import { SyncBatchReport } from './syncTracker';

const MAX_HISTORY = 50;
const syncHistory: SyncBatchReport[] = [];

/**
 * Appends a finalized sync report to the in-memory circular history buffer.
 */
export function logSyncReport(report: SyncBatchReport): void {
  syncHistory.unshift(report);
  if (syncHistory.length > MAX_HISTORY) {
    syncHistory.pop();
  }
}

/**
 * Retrieves sync execution history for dashboard status and observability.
 */
export function getSyncHistory(limit: number = 10): SyncBatchReport[] {
  return syncHistory.slice(0, Math.min(limit, MAX_HISTORY));
}

/**
 * Gets the most recent sync report for a given source.
 */
export function getLatestSync(source?: SyncBatchReport['source']): SyncBatchReport | null {
  if (!source) return syncHistory[0] || null;
  return syncHistory.find(r => r.source === source) || null;
}

/**
 * Clears sync history (useful for test resets).
 */
export function clearSyncHistory(): void {
  syncHistory.length = 0;
}
