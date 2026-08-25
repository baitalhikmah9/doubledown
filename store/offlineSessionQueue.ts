import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionSavePayload } from '@/features/shared';
import { deserializeGameSession, serializeGameSession } from '@/store/gameSessionPersistence';

const STORAGE_KEY = 'backfire-offline-session-queue-v1';

/** AsyncStorage-safe payload (`session` is serialized board state). */
export interface StorableSessionQueuePayload {
  clientSessionId: string;
  deviceId: string;
  session: unknown;
  scoreEvents: SessionSavePayload['scoreEvents'];
}

export interface PersistedOfflineQueueItem {
  id: string;
  payload: StorableSessionQueuePayload;
  createdAt: number;
  flushAttempts: number;
  lastError?: string;
}

function isOfflineQueueItem(value: unknown): value is PersistedOfflineQueueItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id.length === 0) return false;
  if (typeof row.createdAt !== 'number' || typeof row.flushAttempts !== 'number') return false;
  if (row.lastError !== undefined && typeof row.lastError !== 'string') return false;
  if (!row.payload || typeof row.payload !== 'object') return false;
  const payload = row.payload as Record<string, unknown>;
  if (typeof payload.clientSessionId !== 'string' || payload.clientSessionId.length === 0) {
    return false;
  }
  if (typeof payload.deviceId !== 'string' || payload.deviceId.length === 0) return false;
  if (!('session' in payload)) return false;
  if (!Array.isArray(payload.scoreEvents)) return false;
  return true;
}

async function readRaw(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function loadOfflineSessionQueue(): Promise<PersistedOfflineQueueItem[]> {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate rows independently so one corrupt sibling does not discard the rest.
    return parsed.filter(isOfflineQueueItem);
  } catch {
    return [];
  }
}

export async function saveOfflineSessionQueue(items: PersistedOfflineQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function enqueueOfflineSession(payload: SessionSavePayload): Promise<void> {
  const queue = await loadOfflineSessionQueue();
  const id = `q_${payload.clientSessionId}_${Date.now()}`;
  queue.push({
    id,
    payload: {
      clientSessionId: payload.clientSessionId,
      deviceId: payload.deviceId,
      session: serializeGameSession(payload.session),
      scoreEvents: payload.scoreEvents,
    },
    createdAt: Date.now(),
    flushAttempts: 0,
  });
  await saveOfflineSessionQueue(queue);
}

/**
 * Attempts each queued item once per flush. Failed items stay in the queue with incremented flushAttempts.
 */
export async function flushOfflineSessionQueue(
  send: (payload: SessionSavePayload) => Promise<boolean>
): Promise<{ remaining: number; flushed: number }> {
  const queue = await loadOfflineSessionQueue();
  if (queue.length === 0) return { remaining: 0, flushed: 0 };

  const next: PersistedOfflineQueueItem[] = [];
  let flushed = 0;

  for (const item of queue) {
    const session = deserializeGameSession(item.payload.session);
    if (!session) {
      next.push({
        ...item,
        flushAttempts: item.flushAttempts + 1,
        lastError: 'corrupt_session',
      });
      continue;
    }
    const fullPayload: SessionSavePayload = {
      clientSessionId: item.payload.clientSessionId,
      deviceId: item.payload.deviceId,
      session,
      scoreEvents: item.payload.scoreEvents,
    };
    const ok = await send(fullPayload);
    if (ok) {
      flushed += 1;
    } else {
      next.push({
        ...item,
        flushAttempts: item.flushAttempts + 1,
        lastError: 'flush_failed',
      });
    }
  }

  await saveOfflineSessionQueue(next);
  return { remaining: next.length, flushed };
}
