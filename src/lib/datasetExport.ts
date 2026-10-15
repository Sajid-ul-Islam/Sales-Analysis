import { DatasetSnapshot } from '@/types';

/**
 * DEEN Commerce — Client-side JSON Dataset Exporter (Method 1)
 * Exports the active working dataset as a clean, standardized JSON file
 * identical in schema to src/data/baselineSample.json.
 */
export function downloadDatasetAsJson(
  dataset: Partial<DatasetSnapshot>,
  customFilename?: string
): void {
  if (typeof window === 'undefined') return;

  const payload: DatasetSnapshot = {
    orders: dataset.orders || [],
    pathaoDelivery: dataset.pathaoDelivery || [],
    returns: dataset.returns || [],
    partials: dataset.partials || [],
    exchanges: dataset.exchanges || [],
    sourceName: dataset.sourceName || 'DEEN Commerce Working Dataset',
    syncedAt: new Date().toISOString(),
    version: '2.0.0',
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `deen_reconciliation_dataset_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Saves current dataset directly to local disk (when running in local Node environment).
 */
export async function saveDatasetToLocalDisk(
  dataset: Partial<DatasetSnapshot>
): Promise<{ success: boolean; message: string; isReadOnly?: boolean }> {
  try {
    const res = await fetch('/api/sample-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataset),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to communicate with save endpoint',
    };
  }
}
