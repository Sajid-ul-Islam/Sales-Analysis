export type SyncSource = 'woocommerce' | 'pathao' | 'sample_data';
export type SyncStatus = 'pending' | 'completed' | 'partial' | 'failed';

export interface SyncErrorDetail {
  recordId?: string;
  errorMessage: string;
  statusCode?: number;
  timestamp: string;
}

export interface SyncBatchReport {
  syncId: string;
  source: SyncSource;
  status: SyncStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  requestedCount: number;
  successfulCount: number;
  failedCount: number;
  skippedCount: number;
  dataProvenance: 'live_api' | 'demo_anonymized' | 'baseline_fallback' | 'disk_spreadsheet';
  errors: SyncErrorDetail[];
  summaryMessage: string;
}

/**
 * Creates and initializes a sync tracker instance for an external sync job.
 */
export class SyncTracker {
  private report: SyncBatchReport;
  private startTime: number;

  constructor(
    source: SyncSource,
    requestedCount: number,
    dataProvenance: SyncBatchReport['dataProvenance'] = 'live_api'
  ) {
    this.startTime = Date.now();
    this.report = {
      syncId: `sync_${source}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source,
      status: 'pending',
      startedAt: new Date(this.startTime).toISOString(),
      requestedCount,
      successfulCount: 0,
      failedCount: 0,
      skippedCount: 0,
      dataProvenance,
      errors: [],
      summaryMessage: `Sync initiated for ${requestedCount} records from ${source}.`,
    };
  }

  recordSuccess(count: number = 1) {
    this.report.successfulCount += count;
  }

  recordFailure(recordId: string, error: any, statusCode?: number) {
    this.report.failedCount += 1;
    this.report.errors.push({
      recordId,
      errorMessage: error?.message || String(error),
      statusCode: statusCode || error?.status || 500,
      timestamp: new Date().toISOString(),
    });
  }

  recordSkipped(count: number = 1) {
    this.report.skippedCount += count;
  }

  finalize(): SyncBatchReport {
    const endTime = Date.now();
    this.report.completedAt = new Date(endTime).toISOString();
    this.report.durationMs = endTime - this.startTime;

    if (this.report.failedCount === 0 && this.report.successfulCount > 0) {
      this.report.status = 'completed';
      this.report.summaryMessage = `Successfully synced ${this.report.successfulCount} records from ${this.report.source} in ${this.report.durationMs}ms.`;
    } else if (this.report.successfulCount > 0 && this.report.failedCount > 0) {
      this.report.status = 'partial';
      this.report.summaryMessage = `Partially synced: ${this.report.successfulCount} succeeded, ${this.report.failedCount} failed, ${this.report.skippedCount} skipped.`;
    } else if (this.report.successfulCount === 0 && this.report.failedCount > 0) {
      this.report.status = 'failed';
      this.report.summaryMessage = `Sync failed completely for all ${this.report.requestedCount} records.`;
    } else {
      this.report.status = 'completed';
      this.report.summaryMessage = `Sync completed with 0 records processed.`;
    }

    return { ...this.report };
  }

  getReport(): SyncBatchReport {
    return { ...this.report };
  }
}
