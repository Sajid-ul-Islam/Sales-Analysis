import parquet from 'parquetjs-lite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { RawOrderRow } from '@/types';
import { DEEN_ORDER_PARQUET_FIELDS, orderRowToParquetRecord } from '@/lib/parquet/parquetSchema';

export interface ParquetWriterOptions {
  compression?: 'SNAPPY' | 'GZIP' | 'UNCOMPRESSED';
  rowGroupSize?: number;
}

export interface PartitionWriteResult {
  filePath: string;
  byteSize: number;
  orderCount: number;
  etag: string;
}

export interface PartitionStatsResult {
  exists: boolean;
  byteSize: number;
  mtimeMs: number;
  etag: string;
}

/**
 * Returns the absolute directory where monthly Parquet partitions are stored on the server.
 */
export function getLakehousePartitionsDir(): string {
  const dir = path.join(process.cwd(), 'data', 'lakehouse', 'partitions');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolves the absolute path for a specific month's partition file.
 */
export function getPartitionFilePath(yearMonth: string): string {
  const safeYm = yearMonth.replace(/[^0-9_-]/g, '_');
  return path.join(getLakehousePartitionsDir(), `orders_${safeYm}.parquet`);
}

/**
 * Converts an array of RawOrderRow into a compressed Parquet Buffer in memory.
 */
export async function ordersToParquetBuffer(
  orders: RawOrderRow[],
  options?: ParquetWriterOptions
): Promise<Buffer> {
  const schema = new parquet.ParquetSchema(DEEN_ORDER_PARQUET_FIELDS);
  const tmpFile = path.join(
    os.tmpdir(),
    `deen_mem_${Date.now()}_${Math.random().toString(36).slice(2)}.parquet`
  );

  try {
    const writer = await parquet.ParquetWriter.openFile(schema, tmpFile, {
      compression: options?.compression || 'SNAPPY',
      rowGroupSize: options?.rowGroupSize || 5000,
    });

    for (const order of orders) {
      const record = orderRowToParquetRecord(order);
      await writer.appendRow(record);
    }

    await writer.close();
    const buffer = fs.readFileSync(tmpFile);
    return buffer;
  } finally {
    if (fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }
}

/**
 * Writes an array of order rows to a server-side monthly partition file atomically.
 * Uses a temp file + atomic rename to prevent half-written/corrupt files during server restarts.
 */
export async function writeParquetPartitionFile(
  yearMonth: string,
  orders: RawOrderRow[],
  options?: ParquetWriterOptions
): Promise<PartitionWriteResult> {
  const schema = new parquet.ParquetSchema(DEEN_ORDER_PARQUET_FIELDS);
  const targetFile = getPartitionFilePath(yearMonth);
  const tmpTarget = `${targetFile}.tmp.${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    const writer = await parquet.ParquetWriter.openFile(schema, tmpTarget, {
      compression: options?.compression || 'SNAPPY',
      rowGroupSize: options?.rowGroupSize || 5000,
    });

    for (const order of orders) {
      const record = orderRowToParquetRecord(order);
      await writer.appendRow(record);
    }

    await writer.close();

    // Atomic move to final destination
    fs.renameSync(tmpTarget, targetFile);
    const stat = fs.statSync(targetFile);
    const etag = `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`;

    return {
      filePath: targetFile,
      byteSize: stat.size,
      orderCount: orders.length,
      etag,
    };
  } finally {
    if (fs.existsSync(tmpTarget)) {
      try {
        fs.unlinkSync(tmpTarget);
      } catch {}
    }
  }
}

/**
 * Reads a server-side monthly partition file from disk into a Buffer.
 * Returns null if the partition does not exist.
 */
export async function readParquetPartitionFile(yearMonth: string): Promise<Buffer | null> {
  const targetFile = getPartitionFilePath(yearMonth);
  if (!fs.existsSync(targetFile)) {
    return null;
  }
  return fs.readFileSync(targetFile);
}

/**
 * Inspects server-side metadata for a partition (existence, file size, modification timestamp, and ETag).
 */
export async function getParquetPartitionStats(yearMonth: string): Promise<PartitionStatsResult> {
  const targetFile = getPartitionFilePath(yearMonth);
  if (!fs.existsSync(targetFile)) {
    return {
      exists: false,
      byteSize: 0,
      mtimeMs: 0,
      etag: '',
    };
  }
  const stat = fs.statSync(targetFile);
  return {
    exists: true,
    byteSize: stat.size,
    mtimeMs: stat.mtimeMs,
    etag: `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`,
  };
}
