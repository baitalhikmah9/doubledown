import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { __resetAsyncStorageDouble, setItem, getItem } from '../doubles/asyncStorage';
import type { GameSessionState, ScoreEvent } from '@/features/shared';

import {
  enqueueOfflineSession,
  flushOfflineSessionQueue,
  loadOfflineSessionQueue,
} from '@/store/offlineSessionQueue';

function minimalSession(): GameSessionState {
  return {
    id: 's1',
    mode: 'classic',
    config: {
      mode: 'classic',
      teams: [{ id: 't1', name: 'A' }],
      categories: [],
      contentLocaleChain: ['en'],
      hotSeatEnabled: false,
      wagerEnabled: true,
    },
    contentLocaleChain: ['en'],
    step: 'end',
    phase: 'completed',
    availableCategories: [],
    selectedCategoryIds: [],
    board: [],
    teams: [{ id: 't1', name: 'A', score: 0, wagersUsed: 0 }],
    scores: { t1: 0 },
    usedQuestionIds: new Set(),
    seed: 'seed',
    wagersPerTeam: 3,
    wager: null,
    bonus: { active: false, played: false, multiplier: 2 },
    scoreEvents: [],
  };
}

describe('offlineSessionQueue', () => {
  beforeEach(() => {
    __resetAsyncStorageDouble();
  });

  it('queues completed sessions offline', async () => {
    const scoreEvents: ScoreEvent[] = [
      { teamId: 't1', points: 100, reason: 'standard', turnIndex: 0, createdAt: 1 },
    ];
    await enqueueOfflineSession({
      clientSessionId: 'c1',
      deviceId: 'd1',
      session: minimalSession(),
      scoreEvents,
    });

    const q = await loadOfflineSessionQueue();
    expect(q).toHaveLength(1);
    expect(q[0]?.payload.clientSessionId).toBe('c1');
  });

  it('flushes once when send succeeds and preserves failed items', async () => {
    await enqueueOfflineSession({
      clientSessionId: 'c_ok',
      deviceId: 'd1',
      session: minimalSession(),
      scoreEvents: [],
    });
    await enqueueOfflineSession({
      clientSessionId: 'c_fail',
      deviceId: 'd1',
      session: minimalSession(),
      scoreEvents: [],
    });

    const send = jest.fn(async (p: { clientSessionId: string }) => p.clientSessionId === 'c_ok');

    const result = await flushOfflineSessionQueue(send);
    expect(result.flushed).toBe(1);
    expect(result.remaining).toBe(1);

    const remaining = await loadOfflineSessionQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.payload.clientSessionId).toBe('c_fail');
    expect(remaining[0]?.flushAttempts).toBe(1);
  });

  it('preserves valid siblings when one queued row is corrupt', async () => {
    await enqueueOfflineSession({
      clientSessionId: 'c_valid',
      deviceId: 'd1',
      session: minimalSession(),
      scoreEvents: [],
    });

    const key = 'backfire-offline-session-queue-v1';
    const existingRaw = await getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const mixed = [
      { not: 'a-queue-item' },
      ...existing,
      null,
      {
        id: 'q_broken',
        createdAt: 1,
        flushAttempts: 0,
        payload: { clientSessionId: 'x' },
      },
    ];
    await setItem(key, JSON.stringify(mixed));

    const q = await loadOfflineSessionQueue();
    expect(q).toHaveLength(1);
    expect(q[0]?.payload.clientSessionId).toBe('c_valid');
  });
});
