import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllOfflineData,
  enqueueOfflineDiaryLog,
  listOfflineDiaryLogMutations,
  markOfflineDiaryLogFailed,
  saveOfflineBootstrap
} from './indexed-db';
import {
  discardFailedOfflineChanges,
  queueOfflineDiaryLog,
  resetOfflineSyncStatus,
  syncOfflineChanges
} from './sync';
import type { OfflineBootstrap } from './types';

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

function bootstrap(savedAt: number): OfflineBootstrap {
  return {
    schemaVersion: 1,
    user: {
      id: userId,
      name: 'Patrick'
    },
    savedAt,
    diary: {
      date: '2026-07-24',
      meals: {
        breakfast: { slot: 'breakfast', entries: [], totals: {} },
        lunch: { slot: 'lunch', entries: [], totals: {} },
        dinner: { slot: 'dinner', entries: [], totals: {} },
        snacks: { slot: 'snacks', entries: [], totals: {} }
      }
    },
    foods: []
  } as unknown as OfflineBootstrap;
}

beforeEach(async () => {
  await clearAllOfflineData();
  resetOfflineSyncStatus();
  await saveOfflineBootstrap(bootstrap(1));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline sync scheduling', () => {
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
          bootstrap: bootstrap(callCount + 1)
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
    await queueOfflineDiaryLog(userId, foodId, input(secondId));
    releaseFirst?.();
    await activeSync;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await listOfflineDiaryLogMutations(userId)).toEqual([]);
  });

  it('discards failed changes without removing pending changes', async () => {
    const failedId = '550e8400-e29b-41d4-a716-446655440013';
    const pendingId = '550e8400-e29b-41d4-a716-446655440014';
    await enqueueOfflineDiaryLog(userId, foodId, input(failedId));
    await enqueueOfflineDiaryLog(userId, foodId, input(pendingId));
    await markOfflineDiaryLogFailed(userId, failedId, {
      code: '404',
      message: 'Food not found'
    });

    await discardFailedOfflineChanges();

    expect(await listOfflineDiaryLogMutations(userId)).toEqual([
      expect.objectContaining({
        clientMutationId: pendingId,
        state: 'pending'
      })
    ]);
  });
});
