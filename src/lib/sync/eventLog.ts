import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

export type SyncEventSource = 'woocommerce' | 'pathao' | 'pos' | 'system';

export interface SyncEvent {
  id: string;
  type: string;
  source: SyncEventSource;
  timestamp: string;
  summary: string;
  orderId?: string;
  consignmentId?: string;
  payload: Record<string, unknown>;
}

// Global in-process event emitter for sub-millisecond SSE broadcasting
class SyncEventEmitter extends EventEmitter {}
const globalEventEmitter = new SyncEventEmitter();
globalEventEmitter.setMaxListeners(200);

const MAX_EVENTS_BEFORE_ROTATION = 1000;
const MAX_ROTATED_FILES_TO_KEEP = 2;

/**
 * Resolves the writable directory for sync events.
 * Prefers src/data/ inside project root, with graceful fallback to os.tmpdir().
 */
function resolveLogDir(): string {
  const primaryDir = path.join(process.cwd(), 'src', 'data');
  try {
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(primaryDir, '.write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return primaryDir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'deen-sales-growth');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

function getActiveLogPath(): string {
  return path.join(resolveLogDir(), 'sync-events.jsonl');
}

/**
 * Rotates the event log file when line count exceeds MAX_EVENTS_BEFORE_ROTATION.
 * Retains the 2 most recent rotated files and prunes older ones.
 */
function rotateLogIfNeeded(activePath: string): void {
  try {
    if (!fs.existsSync(activePath)) return;

    const fileContent = fs.readFileSync(activePath, 'utf8');
    const lineCount = fileContent.split('\n').filter((l) => l.trim().length > 0).length;

    if (lineCount < MAX_EVENTS_BEFORE_ROTATION) return;

    const dir = path.dirname(activePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = path.join(dir, `sync-events-${timestamp}.jsonl`);

    fs.renameSync(activePath, rotatedPath);

    // Prune rotated files older than MAX_ROTATED_FILES_TO_KEEP
    const files = fs.readdirSync(dir);
    const rotatedFiles = files
      .filter((f) => f.startsWith('sync-events-') && f.endsWith('.jsonl'))
      .sort()
      .reverse();

    if (rotatedFiles.length > MAX_ROTATED_FILES_TO_KEEP) {
      const filesToRemove = rotatedFiles.slice(MAX_ROTATED_FILES_TO_KEEP);
      for (const fileToRemove of filesToRemove) {
        try {
          fs.unlinkSync(path.join(dir, fileToRemove));
        } catch {
          // Ignore deletion error
        }
      }
    }
  } catch (err) {
    console.warn('[eventLog] Log rotation warning:', err);
  }
}

/**
 * Appends a new synchronization event to the persistent JSONL log and notifies active SSE clients.
 */
export async function appendSyncEvent(
  eventInput: Omit<SyncEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<SyncEvent> {
  const activePath = getActiveLogPath();
  const timestamp = eventInput.timestamp || new Date().toISOString();
  const id = eventInput.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const event: SyncEvent = {
    ...eventInput,
    id,
    timestamp,
  };

  const line = JSON.stringify(event) + '\n';

  try {
    fs.appendFileSync(activePath, line, 'utf8');
    rotateLogIfNeeded(activePath);
  } catch (err) {
    console.error('[eventLog] Failed to append event to file:', err);
  }

  // Broadcast instantly to active in-process SSE listeners
  globalEventEmitter.emit('sync_event', event);

  return event;
}

/**
 * Reads synchronization events from the log.
 * Supports starting after a specific event ID for catch-up upon client reconnection.
 */
export async function readSyncEvents(options?: {
  lastEventId?: string;
  limit?: number;
}): Promise<SyncEvent[]> {
  const activePath = getActiveLogPath();
  const limit = options?.limit || 100;
  const events: SyncEvent[] = [];

  if (!fs.existsSync(activePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(activePath, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    let foundLast = !options?.lastEventId;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as SyncEvent;
        if (!foundLast) {
          if (parsed.id === options?.lastEventId) {
            foundLast = true;
          }
          continue;
        }
        events.push(parsed);
      } catch {
        // Skip malformed line
      }
    }

    // If client asked for events after an ID that was already rotated out, return latest up to limit
    if (!foundLast && options?.lastEventId) {
      for (const line of lines.slice(-limit)) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // Skip
        }
      }
    }

    return events.slice(-limit);
  } catch (err) {
    console.error('[eventLog] Failed to read sync events:', err);
    return [];
  }
}

/**
 * Subscribes an active SSE connection to real-time events.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToSyncEvents(listener: (event: SyncEvent) => void): () => void {
  globalEventEmitter.on('sync_event', listener);
  return () => {
    globalEventEmitter.off('sync_event', listener);
  };
}
