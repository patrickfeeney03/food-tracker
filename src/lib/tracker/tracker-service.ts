import {
  clearStaleOfflineUserIfNeeded,
  discardStaleOfflineUser
} from '$lib/offline/active-user-guard';
import { refreshOfflineCache } from '$lib/offline/client';
import {
  listOfflineDiaryLogMutations,
  readActiveOfflineData,
  saveTrackerSnapshot
} from '$lib/offline/indexed-db';
import { applyPendingDiaryLogs } from '$lib/offline/optimistic-diary';
import { initOfflineSync } from '$lib/offline/sync';
import type { TrackerStore } from './tracker-store.svelte';

export const OFFLINE_CAPABILITY_MESSAGE =
  'You can add saved foods offline. Editing diary entries, foods and meal shortcuts is available when online.';

async function applyPendingMutations(
  cache: NonNullable<TrackerStore['cache']>
) {
  const mutations = await listOfflineDiaryLogMutations(cache.user.id);
  return applyPendingDiaryLogs(cache, mutations);
}

export async function hydrateTrackerStore(store: TrackerStore): Promise<void> {
  initOfflineSync();

  const sessionUserId = store.sessionUserId;
  await clearStaleOfflineUserIfNeeded(sessionUserId);

  if (store.initialSnapshot !== null) {
    await saveTrackerSnapshot(store.initialSnapshot);
  }

  let saved = await readActiveOfflineData();
  if (
    saved !== null &&
    (await discardStaleOfflineUser(sessionUserId, saved.user.id))
  ) {
    saved = null;
  }

  if (saved === null) {
    store.status = store.cache === null ? 'empty' : 'ready';
    return;
  }

  store.cache = await applyPendingMutations(saved);
  store.status = 'ready';
}

export async function reloadTrackerStore(store: TrackerStore): Promise<void> {
  const saved = await readActiveOfflineData();
  if (saved === null) {
    return;
  }

  store.cache = await applyPendingMutations(saved);
  store.status = 'ready';
}

async function refreshTrackerDate(
  store: TrackerStore,
  date: string,
  options?: { silent?: boolean }
): Promise<void> {
  const fresh = await refreshOfflineCache(date, options);
  store.cache = await applyPendingMutations(fresh);
}

export async function refreshTrackerSnapshot(
  store: TrackerStore,
  date: string
): Promise<void> {
  await refreshTrackerDate(store, date);
  store.loadErrors.delete(date);
}

/** Refresh once when the requested diary day is not already cached. */
export function refreshTrackerWindow(
  store: TrackerStore,
  centerDate: string,
  options?: { forceSnapshot?: boolean }
): void {
  if (
    typeof window === 'undefined' ||
    !navigator.onLine ||
    centerDate === ''
  ) {
    return;
  }

  void (async () => {
    try {
      if (
        options?.forceSnapshot === true ||
        store.cache?.diaryDays[centerDate] === undefined
      ) {
        await refreshTrackerDate(store, centerDate, {
          silent: store.cache !== null
        });
      }
      store.loadErrors.delete(centerDate);
    } catch {
      if (store.cache?.diaryDays[centerDate] === undefined) {
        store.loadErrors.set(
          centerDate,
          'Couldn’t load this day. Check your connection and try again.'
        );
      } else {
        store.loadErrors.delete(centerDate);
      }
    }
  })();
}
