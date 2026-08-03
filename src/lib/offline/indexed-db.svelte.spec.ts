import { beforeEach, describe, expect, it } from 'vitest';
import type { TrackerSnapshot } from './types';
import {
  acknowledgeOfflineDiaryLog,
  clearAllOfflineData,
  clearOfflineUser,
  enqueueOfflineDiaryLog,
  hasActiveOfflineMutations,
  listOfflineDiaryLogMutations,
  markOfflineDiaryLogFailed,
  OfflineMutationConflictError,
  OfflineStorageError,
  readActiveOfflineData,
  readActiveUserId,
  readOfflineData,
  retryOfflineDiaryLog,
  saveTrackerSnapshot
} from './indexed-db';

const mutationInput = {
  clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
  portionKind: 'hundred' as const,
  portionCount: '1',
  diaryDate: '2026-07-24',
  mealSlot: 'breakfast' as const
};

function trackerSnapshot({
  userId = 'user-1',
  userName = 'Patrick',
  date = '2026-07-24',
  savedAt = 1,
  foodName = 'Apple',
  diaryMarker = date,
  days
}: {
  userId?: string;
  userName?: string;
  date?: string;
  savedAt?: number;
  foodName?: string;
  diaryMarker?: string;
  days?: Record<string, string>;
} = {}): TrackerSnapshot {
  return {
    schemaVersion: 1,
    user: {
      id: userId,
      name: userName
    },
    savedAt,
    diaryDays: Object.fromEntries(
      Object.entries(days ?? { [date]: diaryMarker }).map(
        ([diaryDate, marker]) => [diaryDate, { date: diaryDate, marker }]
      )
    ),
    foods: [
      {
        id: `food-${foodName}`,
        name: foodName
      }
    ]
  } as unknown as TrackerSnapshot;
}

describe('offline IndexedDB repository', () => {
  beforeEach(async () => {
    await clearAllOfflineData();
  });

  it('returns no active data before a tracker snapshot is saved', async () => {
    await expect(readActiveUserId()).resolves.toBeNull();
    await expect(readActiveOfflineData()).resolves.toBeNull();
  });

  it('retains diary dates while replacing the catalogue with the latest snapshot', async () => {
    await saveTrackerSnapshot(trackerSnapshot({
      date: '2026-07-23',
      savedAt: 10,
      foodName: 'Apple'
    }));
    await saveTrackerSnapshot(trackerSnapshot({
      date: '2026-07-24',
      savedAt: 20,
      foodName: 'Banana'
    }));

    const cached = await readActiveOfflineData();

    expect(cached?.savedAt).toBe(20);
    expect(cached?.foods).toEqual([
      {
        id: 'food-Banana',
        name: 'Banana'
      }
    ]);
    expect(Object.keys(cached?.diaryDays ?? {})).toEqual([
      '2026-07-23',
      '2026-07-24'
    ]);
  });

  it('does not let an older response overwrite newer user or diary data', async () => {
    await saveTrackerSnapshot(trackerSnapshot({
      savedAt: 20,
      foodName: 'Banana',
      diaryMarker: 'new'
    }));
    await saveTrackerSnapshot(trackerSnapshot({
      savedAt: 10,
      foodName: 'Apple',
      diaryMarker: 'old'
    }));

    const cached = await readActiveOfflineData();

    expect(cached?.savedAt).toBe(20);
    expect(cached?.foods[0]?.name).toBe('Banana');
    expect(
      (cached?.diaryDays['2026-07-24'] as unknown as { marker: string }).marker
    ).toBe('new');
  });

  it('saves every diary day in a snapshot', async () => {
    await saveTrackerSnapshot(trackerSnapshot({
      savedAt: 20,
      foodName: 'Apple',
      days: {
        '2026-07-23': 'first',
        '2026-07-24': 'second'
      }
    }));

    const cached = await readActiveOfflineData();

    expect(cached?.foods[0]?.name).toBe('Apple');
    expect(Object.keys(cached?.diaryDays ?? {})).toEqual([
      '2026-07-23',
      '2026-07-24'
    ]);
    expect(
      (cached?.diaryDays['2026-07-23'] as unknown as { marker: string }).marker
    ).toBe('first');
  });

  it('isolates users and tracks the most recently saved user as active', async () => {
    await saveTrackerSnapshot(trackerSnapshot({
      userId: 'user-1',
      userName: 'Patrick',
      foodName: 'Apple'
    }));
    await saveTrackerSnapshot(trackerSnapshot({
      userId: 'user-2',
      userName: 'Other',
      foodName: 'Banana'
    }));

    expect((await readOfflineData('user-1'))?.user.name).toBe('Patrick');
    expect((await readOfflineData('user-2'))?.user.name).toBe('Other');
    expect(await readActiveUserId()).toBe('user-2');
  });

  it('clears one user without clearing another user', async () => {
    await saveTrackerSnapshot(trackerSnapshot({ userId: 'user-1' }));
    await saveTrackerSnapshot(trackerSnapshot({ userId: 'user-2' }));

    await clearOfflineUser('user-1');

    await expect(readOfflineData('user-1')).resolves.toBeNull();
    expect(await readOfflineData('user-2')).not.toBeNull();
    expect(await readActiveUserId()).toBe('user-2');
  });

  it('removes the active marker when the active user is cleared', async () => {
    await saveTrackerSnapshot(trackerSnapshot());

    await clearOfflineUser('user-1');

    await expect(readActiveUserId()).resolves.toBeNull();
    await expect(readActiveOfflineData()).resolves.toBeNull();
  });

  it('stores a structured clone instead of retaining caller-owned objects', async () => {
    const input = trackerSnapshot();
    await saveTrackerSnapshot(input);

    (input.foods[0] as { name: string }).name = 'Changed after saving';

    expect((await readActiveOfflineData())?.foods[0]?.name).toBe('Apple');
  });

  it('reports values that cannot be structured-cloned as storage errors', async () => {
    const input = trackerSnapshot() as TrackerSnapshot & {
      unsupported?: () => void;
    };
    input.unsupported = () => undefined;

    await expect(saveTrackerSnapshot(input)).rejects.toBeInstanceOf(
      OfflineStorageError
    );
  });

  it('clears all users and active-user metadata', async () => {
    await saveTrackerSnapshot(trackerSnapshot({ userId: 'user-1' }));
    await saveTrackerSnapshot(trackerSnapshot({ userId: 'user-2' }));

    await clearAllOfflineData();

    await expect(readOfflineData('user-1')).resolves.toBeNull();
    await expect(readOfflineData('user-2')).resolves.toBeNull();
    await expect(readActiveUserId()).resolves.toBeNull();
  });

  it('queues diary logs in creation order and isolates users', async () => {
    await enqueueOfflineDiaryLog(
      'user-1',
      'food-2',
      {
        ...mutationInput,
        clientMutationId: '550e8400-e29b-41d4-a716-446655440002'
      },
      20
    );
    await enqueueOfflineDiaryLog(
      'user-1',
      'food-1',
      mutationInput,
      10
    );
    await enqueueOfflineDiaryLog(
      'user-2',
      'food-3',
      {
        ...mutationInput,
        clientMutationId: '550e8400-e29b-41d4-a716-446655440003'
      },
      5
    );

    expect(
      (await listOfflineDiaryLogMutations('user-1')).map(
        (mutation) => mutation.foodId
      )
    ).toEqual(['food-1', 'food-2']);
    expect(await listOfflineDiaryLogMutations('user-2')).toHaveLength(1);
  });

  it('detects pending and failed mutations only for the active user', async () => {
    await saveTrackerSnapshot(trackerSnapshot({ userId: 'user-1' }));
    await enqueueOfflineDiaryLog(
      'user-2',
      'food-2',
      {
        ...mutationInput,
        clientMutationId: '550e8400-e29b-41d4-a716-446655440002'
      }
    );

    await expect(hasActiveOfflineMutations()).resolves.toBe(false);

    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput);
    await expect(hasActiveOfflineMutations()).resolves.toBe(true);

    await markOfflineDiaryLogFailed(
      'user-1',
      mutationInput.clientMutationId,
      {
        code: 'food_unavailable',
        message: 'Food is no longer available.'
      }
    );
    await expect(hasActiveOfflineMutations()).resolves.toBe(true);
  });

  it('deduplicates identical diary logs without replacing their queue position', async () => {
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput, 10);
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput, 99);

    expect(await listOfflineDiaryLogMutations('user-1')).toEqual([
      expect.objectContaining({
        foodId: 'food-1',
        createdAt: 10,
        state: 'pending'
      })
    ]);
  });

  it('rejects reuse of a queued mutation ID with different data', async () => {
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput, 10);

    await expect(
      enqueueOfflineDiaryLog(
        'user-1',
        'food-2',
        {
          ...mutationInput,
          portionCount: '2'
        },
        20
      )
    ).rejects.toBeInstanceOf(OfflineMutationConflictError);

    expect(await listOfflineDiaryLogMutations('user-1')).toHaveLength(1);
  });

  it('marks failed diary logs and allows them to be retried', async () => {
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput);
    await markOfflineDiaryLogFailed(
      'user-1',
      mutationInput.clientMutationId,
      {
        code: 'food_unavailable',
        message: 'Food is no longer available.'
      }
    );

    expect(await listOfflineDiaryLogMutations('user-1')).toEqual([
      expect.objectContaining({
        state: 'failed',
        failure: {
          code: 'food_unavailable',
          message: 'Food is no longer available.'
        }
      })
    ]);

    await retryOfflineDiaryLog('user-1', mutationInput.clientMutationId);

    expect(await listOfflineDiaryLogMutations('user-1')).toEqual([
      expect.objectContaining({
        state: 'pending'
      })
    ]);
    expect(
      (await listOfflineDiaryLogMutations('user-1'))[0]
    ).not.toHaveProperty('failure');
  });

  it('atomically saves an acknowledged snapshot and removes its diary log', async () => {
    await saveTrackerSnapshot(trackerSnapshot({
      userId: 'user-1',
      savedAt: 10,
      foodName: 'Apple'
    }));
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput);
    const acknowledged = trackerSnapshot({
      userId: 'user-1',
      savedAt: 20,
      foodName: 'Banana',
      days: {
        '2026-07-24': 'acknowledged',
        '2026-07-25': 'neighbor'
      }
    });

    await acknowledgeOfflineDiaryLog(
      acknowledged,
      mutationInput.clientMutationId
    );

    expect(await listOfflineDiaryLogMutations('user-1')).toEqual([]);
    expect((await readOfflineData('user-1'))?.foods[0]?.name).toBe('Banana');
    expect(
      (
        (await readOfflineData('user-1'))
          ?.diaryDays['2026-07-24'] as unknown as { marker: string }
      ).marker
    ).toBe('acknowledged');
    expect(
      (
        (await readOfflineData('user-1'))
          ?.diaryDays['2026-07-25'] as unknown as { marker: string }
      ).marker
    ).toBe('neighbor');
  });

  it('does not let an equal-time ordinary refresh overwrite an acknowledged diary', async () => {
    const secondMutationId = '550e8400-e29b-41d4-a716-446655440009';
    const stale = trackerSnapshot({
      userId: 'user-1',
      savedAt: 20,
      foodName: 'Before sync',
      diaryMarker: 'before-sync'
    });
    const acknowledged = trackerSnapshot({
      userId: 'user-1',
      savedAt: 20,
      foodName: 'After sync',
      diaryMarker: 'acknowledged'
    });
    const secondAcknowledgement = trackerSnapshot({
      userId: 'user-1',
      savedAt: 20,
      foodName: 'After second sync',
      diaryMarker: 'second-acknowledgement'
    });

    await saveTrackerSnapshot(stale);
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput);
    await enqueueOfflineDiaryLog(
      'user-1',
      'food-1',
      {
        ...mutationInput,
        clientMutationId: secondMutationId
      }
    );
    await acknowledgeOfflineDiaryLog(
      acknowledged,
      mutationInput.clientMutationId
    );
    await acknowledgeOfflineDiaryLog(
      secondAcknowledgement,
      secondMutationId
    );
    await saveTrackerSnapshot(stale);

    const cached = await readOfflineData('user-1');

    expect(cached?.foods[0]?.name).toBe('After second sync');
    expect(
      (
        cached?.diaryDays['2026-07-24'] as unknown as { marker: string }
      ).marker
    ).toBe('second-acknowledgement');
    expect(await listOfflineDiaryLogMutations('user-1')).toEqual([]);
  });

  it('clears queued diary logs only for the requested user', async () => {
    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput);
    await enqueueOfflineDiaryLog(
      'user-2',
      'food-2',
      {
        ...mutationInput,
        clientMutationId: '550e8400-e29b-41d4-a716-446655440002'
      }
    );

    await clearOfflineUser('user-1');

    expect(await listOfflineDiaryLogMutations('user-1')).toEqual([]);
    expect(await listOfflineDiaryLogMutations('user-2')).toHaveLength(1);
  });

  it('upgrades an existing version 1 cache without deleting its data', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('calorie-tracker-offline');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('calorie-tracker-offline', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore('users', { keyPath: 'userId' });
        database.createObjectStore('diary-days', {
          keyPath: ['userId', 'date']
        }).createIndex('userId', 'userId');
        database.createObjectStore('metadata', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('users', 'readwrite');
        transaction.objectStore('users').put({
          userId: 'user-1',
          schemaVersion: 1,
          user: { id: 'user-1', name: 'Patrick' },
          savedAt: 10,
          foods: []
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });

    await enqueueOfflineDiaryLog('user-1', 'food-1', mutationInput);

    expect((await readOfflineData('user-1'))?.user.name).toBe('Patrick');
    expect(await listOfflineDiaryLogMutations('user-1')).toHaveLength(1);
  });
});
