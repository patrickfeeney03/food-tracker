import { resolve } from '$app/paths';
import { readonly, writable } from 'svelte/store';
import {
  clearAllOfflineData,
  readOfflineData,
  saveOfflineBootstrap,
  type CachedOfflineData
} from './indexed-db';
import {
  cancelOfflineSync,
  resetOfflineSyncStatus
} from './sync';
import { isOfflineBootstrap } from './validators';

export type OfflineCacheStatus =
  | 'idle'
  | 'refreshing'
  | 'ready'
  | 'error';

const cacheStatusState = writable<OfflineCacheStatus>('idle');
const lastSavedAtState = writable<number | null>(null);
const refreshesByDate = new Map<string, {
  controller: AbortController;
  promise: Promise<CachedOfflineData>;
}>();

export const offlineCacheStatus = readonly(cacheStatusState);
export const offlineCacheLastSavedAt = readonly(lastSavedAtState);

async function performRefresh(
  date: string,
  signal: AbortSignal
): Promise<CachedOfflineData> {
  cacheStatusState.set('refreshing');

  const url = new URL(
    resolve('/api/offline/bootstrap'),
    window.location.origin
  );
  url.searchParams.set('date', date);

  const response = await fetch(url, {
    headers: {
      accept: 'application/json'
    },
    signal
  });

  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    throw new Error(`Offline bootstrap failed with status ${response.status}.`);
  }

  const bootstrap: unknown = await response.json();

  if (!isOfflineBootstrap(bootstrap)) {
    throw new Error('Offline bootstrap returned an unsupported response.');
  }

  await saveOfflineBootstrap(bootstrap);
  const cached = await readOfflineData(bootstrap.user.id);

  if (cached === null) {
    throw new Error('Offline bootstrap was not available after saving.');
  }

  lastSavedAtState.set(cached.savedAt);
  cacheStatusState.set('ready');

  return cached;
}

export function refreshOfflineCache(date: string): Promise<CachedOfflineData> {
  const existing = refreshesByDate.get(date);

  if (existing !== undefined) {
    return existing.promise;
  }

  const controller = new AbortController();
  const refresh = performRefresh(date, controller.signal)
    .catch((error) => {
      cacheStatusState.set('error');
      throw error;
    })
    .finally(() => {
      refreshesByDate.delete(date);
    });

  refreshesByDate.set(date, {
    controller,
    promise: refresh
  });

  return refresh;
}

export async function clearOfflineCacheForSignOut(): Promise<void> {
  await cancelOfflineSync();
  const pendingRefreshes = [...refreshesByDate.values()];

  for (const { controller } of pendingRefreshes) {
    controller.abort();
  }

  await Promise.allSettled(
    pendingRefreshes.map(({ promise }) => promise)
  );
  await clearAllOfflineData();
  cacheStatusState.set('idle');
  lastSavedAtState.set(null);
  resetOfflineSyncStatus();
}
