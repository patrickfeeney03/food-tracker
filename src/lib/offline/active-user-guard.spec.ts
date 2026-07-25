import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStaleOfflineUserIfNeeded,
  isStaleOfflineUser
} from './active-user-guard';
import {
  clearAllOfflineData,
  enqueueOfflineDiaryLog,
  listOfflineDiaryLogMutations,
  readActiveOfflineData,
  readActiveUserId,
  readOfflineData,
  saveOfflineBootstrap
} from './indexed-db';
import type { OfflineBootstrap } from './types';

const staleUserId = 'user-a';
const offline = vi.hoisted(() => ({
  activeUserId: null as string | null,
  data: new Map<string, {
    schemaVersion: number;
    user: { id: string; name: string };
    savedAt: number;
    diaryDays: Record<string, unknown>;
    foods: unknown[];
  }>(),
  outbox: new Map<string, { clientMutationId: string }[]>()
}));

vi.mock('./indexed-db', () => ({
  clearAllOfflineData: async () => {
    offline.activeUserId = null;
    offline.data.clear();
    offline.outbox.clear();
  },
  clearOfflineUser: async (userId: string) => {
    offline.data.delete(userId);
    offline.outbox.delete(userId);
    if (offline.activeUserId === userId) {
      offline.activeUserId = null;
    }
  },
  enqueueOfflineDiaryLog: async (
    userId: string,
    _foodId: string,
    input: { clientMutationId: string }
  ) => {
    offline.outbox.set(userId, [
      ...(offline.outbox.get(userId) ?? []),
      { clientMutationId: input.clientMutationId }
    ]);
  },
  listOfflineDiaryLogMutations: async (userId: string) =>
    offline.outbox.get(userId) ?? [],
  readActiveOfflineData: async () =>
    offline.activeUserId === null
      ? null
      : offline.data.get(offline.activeUserId) ?? null,
  readActiveUserId: async () => offline.activeUserId,
  readOfflineData: async (userId: string) => offline.data.get(userId) ?? null,
  saveOfflineBootstrap: async (bootstrap: OfflineBootstrap) => {
    const existing = offline.data.get(bootstrap.user.id);
    offline.data.set(bootstrap.user.id, {
      schemaVersion: bootstrap.schemaVersion,
      user: bootstrap.user,
      savedAt: bootstrap.savedAt,
      diaryDays: {
        ...existing?.diaryDays,
        [bootstrap.diary.date]: bootstrap.diary
      },
      foods: bootstrap.foods
    });
    offline.activeUserId = bootstrap.user.id;
  }
}));

function bootstrap(date: string): OfflineBootstrap {
  return {
    schemaVersion: 1,
    user: { id: staleUserId, name: 'User A' },
    savedAt: 1,
    diary: { date },
    foods: []
  } as unknown as OfflineBootstrap;
}

beforeEach(async () => {
  await clearAllOfflineData();
});

describe('isStaleOfflineUser', () => {
  it('is false when session user is unknown', () => {
    expect(isStaleOfflineUser(undefined, 'user-1')).toBe(false);
    expect(isStaleOfflineUser('', 'user-1')).toBe(false);
  });

  it('is false when there is no offline user', () => {
    expect(isStaleOfflineUser('user-1', null)).toBe(false);
    expect(isStaleOfflineUser('user-1', undefined)).toBe(false);
    expect(isStaleOfflineUser('user-1', '')).toBe(false);
  });

  it('is false when session and offline user match', () => {
    expect(isStaleOfflineUser('user-1', 'user-1')).toBe(false);
  });

  it('is true when session and offline user differ', () => {
    expect(isStaleOfflineUser('user-2', 'user-1')).toBe(true);
  });

  it('clears the stale active cache, diary days, and outbox', async () => {
    await saveOfflineBootstrap(bootstrap('2026-07-23'));
    await saveOfflineBootstrap(bootstrap('2026-07-24'));
    await enqueueOfflineDiaryLog(staleUserId, 'food-1', {
      clientMutationId: '550e8400-e29b-41d4-a716-446655440016',
      portionKind: 'hundred',
      portionCount: '1',
      diaryDate: '2026-07-24',
      mealSlot: 'breakfast'
    });

    expect(Object.keys((await readActiveOfflineData())?.diaryDays ?? {})).toEqual([
      '2026-07-23',
      '2026-07-24'
    ]);
    await expect(clearStaleOfflineUserIfNeeded('user-b')).resolves.toBe('cleared');

    await expect(readActiveUserId()).resolves.toBeNull();
    await expect(readActiveOfflineData()).resolves.toBeNull();
    await expect(readOfflineData(staleUserId)).resolves.toBeNull();
    await expect(listOfflineDiaryLogMutations(staleUserId)).resolves.toEqual([]);
  });
});
