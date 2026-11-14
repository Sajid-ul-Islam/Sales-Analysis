import fs from 'fs';
import path from 'path';
import { DatasetSnapshot } from '@/types';

let memoryBaseline: DatasetSnapshot | null = null;

/**
 * High-Efficiency Lazy Loader for Baseline Dataset
 *
 * Avoids inlining the 19.3 MB baselineSample.json directly into Webpack serverless bundles.
 * Loads the dataset on-demand from disk only when explicitly requested as a fallback.
 */
export function getBaselineDataset(): DatasetSnapshot {
  if (memoryBaseline) return memoryBaseline;

  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      memoryBaseline = JSON.parse(raw) as DatasetSnapshot;
      return memoryBaseline;
    }
  } catch (err) {
    console.warn('[baselineLoader] Notice: Could not read baselineSample.json from disk:', err);
  }

  return { orders: [], returns: [], partials: [], exchanges: [], pathaoDelivery: [] };
}
