import type { CachedOfflineData } from '$lib/offline/indexed-db';
import type { TrackerSnapshot } from '$lib/offline/types';
import type { OfflineSyncPhase } from '$lib/offline/sync';
import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export type TrackerLoadStatus = 'loading' | 'ready' | 'empty' | 'error';

export class TrackerStore {
  readonly initialSnapshot: TrackerSnapshot | null;
  readonly sessionUserId: string | undefined;
  cache: CachedOfflineData | null;
  status: TrackerLoadStatus;
  isOffline: boolean;
  lastSyncPhase: OfflineSyncPhase;
  navigationMessage: string | null;
  readonly loadErrors = new SvelteMap<string, string>();

  constructor(
    snapshot: TrackerSnapshot | null,
    sessionUserId: string | undefined
  ) {
    this.initialSnapshot = snapshot;
    this.sessionUserId = sessionUserId;
    this.cache = $state(snapshot);
    this.status = $state(snapshot === null ? 'loading' : 'ready');
    this.isOffline = $state(false);
    this.lastSyncPhase = $state('idle');
    this.navigationMessage = $state(null);
  }
}

const TRACKER_STORE = Symbol('tracker-store');

export function provideTrackerStore(
  snapshot: TrackerSnapshot | null,
  sessionUserId: string | undefined
): TrackerStore {
  const store = new TrackerStore(snapshot, sessionUserId);
  setContext(TRACKER_STORE, store);
  return store;
}

export function useTrackerStore(): TrackerStore {
  const store = getContext<TrackerStore>(TRACKER_STORE);

  if (store === undefined) {
    throw new Error('Tracker store is only available below the root layout.');
  }

  return store;
}
