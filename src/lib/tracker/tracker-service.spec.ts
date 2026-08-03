import { shiftDate } from '$lib/date';
import type { CachedOfflineData } from '$lib/offline/indexed-db';
import type { OfflineDiaryDay } from '$lib/offline/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackerStore } from './tracker-store.svelte';

const client = vi.hoisted(() => ({ refreshOfflineCache: vi.fn() }));

vi.mock('$lib/offline/client', () => client);
vi.mock('$lib/offline/active-user-guard', () => ({
  clearStaleOfflineUserIfNeeded: vi.fn(),
  discardStaleOfflineUser: vi.fn()
}));
vi.mock('$lib/offline/indexed-db', () => ({
  listOfflineDiaryLogMutations: vi.fn().mockResolvedValue([]),
  readActiveOfflineData: vi.fn().mockResolvedValue(null),
  saveTrackerSnapshot: vi.fn()
}));
vi.mock('$lib/offline/sync', () => ({ initOfflineSync: vi.fn() }));

import { refreshTrackerWindow } from './tracker-service';

function emptyDiaryDay(date: string): OfflineDiaryDay {
  const totals = { energyMkcal: 0, proteinMg: 0, carbsMg: 0, fatMg: 0 };
  return {
    date,
    goal: null,
    meals: {
      breakfast: { slot: 'breakfast', entries: [], totals },
      lunch: { slot: 'lunch', entries: [], totals },
      dinner: { slot: 'dinner', entries: [], totals },
      snacks: { slot: 'snacks', entries: [], totals }
    },
    totals,
    balances: null
  };
}

function cachedWindows(...centers: string[]): CachedOfflineData {
  const dates = centers.flatMap((center) =>
    Array.from({ length: 11 }, (_, index) => shiftDate(center, index - 5))
  );
  return {
    schemaVersion: 1,
    user: { id: 'user-1', name: 'Patrick' },
    savedAt: 1,
    diaryDays: Object.fromEntries(
      dates.map((date) => [date, emptyDiaryDay(date)])
    ),
    foods: []
  };
}

function trackerStore(cache: CachedOfflineData | null): TrackerStore {
  return {
    initialSnapshot: null,
    sessionUserId: 'user-1',
    cache,
    status: cache === null ? 'empty' : 'ready',
    isOffline: false,
    lastSyncPhase: 'idle',
    navigationMessage: null,
    loadErrors: new Map()
  } as unknown as TrackerStore;
}

describe('refreshTrackerWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reuses cached days and fetches one snapshot at the first uncached boundary', async () => {
    const center = '2026-07-24';
    const boundary = shiftDate(center, 6);
    const store = trackerStore(cachedWindows(center));
    client.refreshOfflineCache.mockResolvedValue(cachedWindows(center, boundary));

    refreshTrackerWindow(store, center);
    refreshTrackerWindow(store, shiftDate(center, 1));
    expect(client.refreshOfflineCache).not.toHaveBeenCalled();

    refreshTrackerWindow(store, boundary);
    await vi.waitFor(() => {
      expect(client.refreshOfflineCache).toHaveBeenCalledOnce();
    });
    expect(client.refreshOfflineCache).toHaveBeenCalledWith(boundary, {
      silent: true
    });

    refreshTrackerWindow(store, center);
    expect(client.refreshOfflineCache).toHaveBeenCalledOnce();
  });

  it('fetches one snapshot when the cache is empty', async () => {
    const center = '2026-07-24';
    const store = trackerStore(null);
    client.refreshOfflineCache.mockResolvedValue(cachedWindows(center));

    refreshTrackerWindow(store, center);
    await vi.waitFor(() => expect(store.cache).not.toBeNull());

    expect(client.refreshOfflineCache).toHaveBeenCalledOnce();
    expect(client.refreshOfflineCache).toHaveBeenCalledWith(center, {
      silent: false
    });
  });
});
