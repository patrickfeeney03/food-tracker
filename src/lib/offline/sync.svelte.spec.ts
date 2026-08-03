import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftDate } from '$lib/date';
import {
  clearAllOfflineData,
  enqueueOfflineDiaryLog,
  listOfflineDiaryLogMutations,
  saveTrackerSnapshot
} from './indexed-db';
import {
  discardFailedOfflineChanges,
  offlineSyncStatus,
  queueDiaryLog,
  resetOfflineSyncStatus,
  retryOfflineChanges,
  syncOfflineChanges
} from './sync';
import type { TrackerSnapshot } from './types';
import { get } from 'svelte/store';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const foodId = '550e8400-e29b-41d4-a716-446655440001';

function input(clientMutationId: string) {
  return {
    clientMutationId,
    portionKind: 'hundred' as const,
    portionCount: '1',
    diaryDate: '2026-07-24',
    mealSlot: 'breakfast' as const
  };
}

function trackerSnapshot(savedAt: number): TrackerSnapshot {
  const centerDate = '2026-07-24';
  const diaryDays = Object.fromEntries(
    Array.from({ length: 11 }, (_, index) => {
      const date = shiftDate(centerDate, index - 5);
      return [date, {
        date,
        meals: {
          breakfast: { slot: 'breakfast', entries: [], totals: {} },
          lunch: { slot: 'lunch', entries: [], totals: {} },
          dinner: { slot: 'dinner', entries: [], totals: {} },
          snacks: { slot: 'snacks', entries: [], totals: {} }
        },
        totals: {}
      }];
    })
  );

  return {
    schemaVersion: 1,
    user: {
      id: userId,
      name: 'Patrick'
    },
    savedAt,
    diaryDays,
    foods: []
  } as unknown as TrackerSnapshot;
}

beforeEach(async () => {
  await clearAllOfflineData();
  resetOfflineSyncStatus();
  await saveTrackerSnapshot(trackerSnapshot(1));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline sync scheduling', () => {
  it('keeps a successfully queued intent when the status refresh fails', async () => {
    const clientMutationId = '550e8400-e29b-41d4-a716-446655440009';
    const transaction = IDBDatabase.prototype.transaction;
    let statusReadFailed = false;
    const statusRead = vi.spyOn(IDBDatabase.prototype, 'transaction')
      .mockImplementation(function (this: IDBDatabase, storeNames, mode, options) {
        const names = typeof storeNames === 'string'
          ? [storeNames]
          : Array.from(storeNames);

        if (
          !statusReadFailed &&
          mode === 'readonly' &&
          names.includes('metadata')
        ) {
          statusReadFailed = true;
          throw new Error('Status unavailable');
        }

        return transaction.call(this, storeNames, mode, options);
      });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Network unavailable');
    }));

    await expect(
      queueDiaryLog(userId, foodId, input(clientMutationId))
    ).resolves.toBeUndefined();
    statusRead.mockRestore();
    await syncOfflineChanges();

    expect(await listOfflineDiaryLogMutations(userId)).toEqual([
      expect.objectContaining({
        clientMutationId,
        state: 'pending'
      })
    ]);
  });

  it('sends the queued user and marks an identity mismatch failed', async () => {
    const clientMutationId = '550e8400-e29b-41d4-a716-446655440010';
    let postedBody: unknown;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      postedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          message: 'Queued change belongs to a different user.'
        }),
        {
          status: 403,
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    }));
    await enqueueOfflineDiaryLog(
      userId,
      foodId,
      input(clientMutationId)
    );

    await syncOfflineChanges();

    expect(postedBody).toMatchObject({
      userId,
      foodId,
      input: {
        clientMutationId
      }
    });
    expect(await listOfflineDiaryLogMutations(userId)).toEqual([
      expect.objectContaining({
        clientMutationId,
        state: 'failed',
        failure: {
          code: '403',
          message: 'Queued change belongs to a different user.'
        }
      })
    ]);
  });

  it('runs another pass for a diary log queued during an active sync', async () => {
    const firstId = '550e8400-e29b-41d4-a716-446655440011';
    const secondId = '550e8400-e29b-41d4-a716-446655440012';
    let releaseFirst: (() => void) | undefined;
    const firstResponse = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let callCount = 0;
    const fetchMock = vi.fn(async (_url, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body)) as {
        input: { clientMutationId: string };
      };

      if (callCount === 1) {
        await firstResponse;
      }

      return new Response(
        JSON.stringify({
          schemaVersion: 1,
          acknowledgedMutationId: body.input.clientMutationId,
          snapshot: trackerSnapshot(callCount + 1)
        }),
        {
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    await enqueueOfflineDiaryLog(userId, foodId, input(firstId));

    const activeSync = syncOfflineChanges();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await queueDiaryLog(userId, foodId, input(secondId));
    releaseFirst?.();
    await activeSync;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await listOfflineDiaryLogMutations(userId)).toEqual([]);
  });

  it('discards failed changes without removing pending changes', async () => {
    const failedId = '550e8400-e29b-41d4-a716-446655440013';
    const pendingId = '550e8400-e29b-41d4-a716-446655440014';
    let requestCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      requestCount += 1;

      if (requestCount === 1) {
        return new Response(JSON.stringify({ message: 'Already logged.' }), {
          status: 409,
          headers: {
            'content-type': 'application/json'
          }
        });
      }

      throw new TypeError('Network unavailable');
    }));
    await enqueueOfflineDiaryLog(userId, foodId, input(failedId));
    await enqueueOfflineDiaryLog(userId, foodId, input(pendingId));
    await syncOfflineChanges();

    expect(get(offlineSyncStatus)).toMatchObject({
      phase: 'attention',
      failedCount: 1
    });

    await discardFailedOfflineChanges();

    expect(await listOfflineDiaryLogMutations(userId)).toEqual([
      expect.objectContaining({
        clientMutationId: pendingId,
        state: 'pending'
      })
    ]);
  });

  it('retries a failed change and drains the outbox after acknowledgement', async () => {
    const clientMutationId = '550e8400-e29b-41d4-a716-446655440015';
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        input: { clientMutationId: string };
      };

      if (fetchMock.mock.calls.length === 1) {
        return new Response(JSON.stringify({ message: 'Already logged.' }), {
          status: 409,
          headers: {
            'content-type': 'application/json'
          }
        });
      }

      return new Response(
        JSON.stringify({
          schemaVersion: 1,
          acknowledgedMutationId: body.input.clientMutationId,
          snapshot: trackerSnapshot(2)
        }),
        {
          headers: {
            'content-type': 'application/json'
          }
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    await enqueueOfflineDiaryLog(userId, foodId, input(clientMutationId));

    await syncOfflineChanges();
    await retryOfflineChanges();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(get(offlineSyncStatus)).toMatchObject({
      phase: 'synced',
      pendingCount: 0,
      failedCount: 0
    });
    expect(await listOfflineDiaryLogMutations(userId)).toEqual([]);
  });
});
