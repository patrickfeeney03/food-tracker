import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import type { LogFoodInput } from '$lib/nutrition/portion-input';
import { readonly, writable } from 'svelte/store';
import {
  acknowledgeOfflineDiaryLog,
  discardOfflineDiaryLog,
  enqueueOfflineDiaryLog,
  listOfflineDiaryLogMutations,
  markOfflineDiaryLogFailed,
  readActiveUserId,
  retryOfflineDiaryLog
} from './indexed-db';
import type {
  OfflineLogExistingFoodMutation,
  TrackerSnapshot
} from './types';
import { isTrackerSnapshot } from './validators';

export type OfflineSyncPhase =
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'attention';

export interface OfflineSyncStatus {
  phase: OfflineSyncPhase;
  pendingCount: number;
  failedCount: number;
}

const initialStatus: OfflineSyncStatus = {
  phase: 'idle',
  pendingCount: 0,
  failedCount: 0
};
const statusState = writable<OfflineSyncStatus>(initialStatus);

export const offlineSyncStatus = readonly(statusState);

let initialized = false;
let syncPromise: Promise<void> | null = null;
let syncRequested = false;
let syncController: AbortController | null = null;
let syncedTimer: ReturnType<typeof setTimeout> | undefined;

function clearSyncedTimer(): void {
  clearTimeout(syncedTimer);
  syncedTimer = undefined;
}

function isSyncResponse(value: unknown): value is {
  schemaVersion: 1;
  acknowledgedMutationId: string;
  snapshot: TrackerSnapshot;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    schemaVersion?: unknown;
    acknowledgedMutationId?: unknown;
    snapshot?: unknown;
  };

  return candidate.schemaVersion === 1 &&
    typeof candidate.acknowledgedMutationId === 'string' &&
    isTrackerSnapshot(candidate.snapshot);
}

function counts(mutations: OfflineLogExistingFoodMutation[]): {
  pendingCount: number;
  failedCount: number;
} {
  return {
    pendingCount: mutations.length,
    failedCount: mutations.filter((mutation) => mutation.state === 'failed').length
  };
}

async function currentMutations(): Promise<OfflineLogExistingFoodMutation[]> {
  const userId = await readActiveUserId();

  return userId === null
    ? []
    : listOfflineDiaryLogMutations(userId);
}

async function setStatusFromQueue(
  preferredPhase?: OfflineSyncPhase
): Promise<OfflineLogExistingFoodMutation[]> {
  const mutations = await currentMutations();
  const queueCounts = counts(mutations);
  const phase = preferredPhase ??
    (queueCounts.failedCount > 0
      ? 'attention'
      : queueCounts.pendingCount > 0
        ? 'pending'
        : 'idle');

  statusState.set({
    phase,
    ...queueCounts
  });

  return mutations;
}

async function postMutation(
  mutation: OfflineLogExistingFoodMutation,
  signal: AbortSignal
): Promise<'acknowledged' | 'failed' | 'retry-later'> {
  let response: Response;

  try {
    response = await fetch(resolve('/api/offline/diary-logs'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        schemaVersion: 1,
        kind: mutation.kind,
        userId: mutation.userId,
        foodId: mutation.foodId,
        input: mutation.input
      }),
      cache: 'no-store',
      redirect: 'manual',
      signal
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    return 'retry-later';
  }

  if (response.ok) {
    const body: unknown = await response.json().catch(() => null);

    if (
      !isSyncResponse(body) ||
      body.acknowledgedMutationId !== mutation.clientMutationId
    ) {
      return 'retry-later';
    }

    await acknowledgeOfflineDiaryLog(
      body.snapshot,
      mutation.clientMutationId
    );
    return 'acknowledged';
  }

  if ([400, 403, 404, 409].includes(response.status)) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'This saved change could not be applied.';

    await markOfflineDiaryLogFailed(
      mutation.userId,
      mutation.clientMutationId,
      {
        code: String(response.status),
        message
      }
    );
    return 'failed';
  }

  return 'retry-later';
}

async function performSync(): Promise<void> {
  clearSyncedTimer();
  const mutations = await currentMutations();
  const pending = mutations.filter((mutation) => mutation.state === 'pending');

  if (pending.length === 0) {
    await setStatusFromQueue();
    return;
  }

  statusState.set({
    phase: 'syncing',
    ...counts(mutations)
  });
  const controller = new AbortController();
  syncController = controller;
  let retryLater = false;

  try {
    for (const mutation of pending) {
      const result = await postMutation(mutation, controller.signal);

      if (result === 'retry-later') {
        retryLater = true;
        break;
      }
    }
  } finally {
    if (syncController === controller) {
      syncController = null;
    }
  }

  const remaining = await currentMutations();
  const queueCounts = counts(remaining);

  if (queueCounts.failedCount > 0) {
    statusState.set({
      phase: 'attention',
      ...queueCounts
    });
  } else if (retryLater || queueCounts.pendingCount > 0) {
    statusState.set({
      phase: navigator.onLine ? 'error' : 'pending',
      ...queueCounts
    });
  } else {
    statusState.set({
      phase: 'synced',
      pendingCount: 0,
      failedCount: 0
    });
    syncedTimer = setTimeout(() => {
      statusState.set(initialStatus);
    }, 3_000);
  }
}

export function syncOfflineChanges(): Promise<void> {
  if (!browser) {
    return Promise.resolve();
  }

  if (syncPromise !== null) {
    syncRequested = true;
    return syncPromise;
  }

  syncRequested = false;
  syncPromise = (async () => {
    do {
      syncRequested = false;
      await performSync();
    } while (syncRequested);
  })()
    .catch(async () => {
      if (syncController?.signal.aborted !== true) {
        await setStatusFromQueue('error').catch(() => {
          statusState.set({
            phase: 'error',
            pendingCount: 0,
            failedCount: 0
          });
        });
      }
    })
    .finally(() => {
      syncPromise = null;

      if (syncRequested) {
        void syncOfflineChanges();
      }
    });

  return syncPromise;
}

export async function queueDiaryLog(
  userId: string,
  foodId: string,
  input: LogFoodInput
): Promise<void> {
  clearSyncedTimer();
  await enqueueOfflineDiaryLog(userId, foodId, input);
  try {
    await setStatusFromQueue('pending');
  } catch {
    // The user intent is already durable in the outbox. A secondary status
    // read must not make the caller retry it with a different mutation ID.
  }

  // `navigator.onLine` is only a hint and can be stale on installed PWAs.
  // Attempt immediately; a real offline failure leaves the mutation queued.
  void syncOfflineChanges();
}

export async function retryOfflineChanges(): Promise<void> {
  clearSyncedTimer();
  const mutations = await currentMutations();

  await Promise.all(
    mutations
      .filter((mutation) => mutation.state === 'failed')
      .map((mutation) =>
        retryOfflineDiaryLog(
          mutation.userId,
          mutation.clientMutationId
        )
      )
  );
  await syncOfflineChanges();
}

export async function discardFailedOfflineChanges(): Promise<void> {
  clearSyncedTimer();
  const mutations = await currentMutations();

  await Promise.all(
    mutations
      .filter((mutation) => mutation.state === 'failed')
      .map((mutation) =>
        discardOfflineDiaryLog(
          mutation.userId,
          mutation.clientMutationId
        )
      )
  );
  await setStatusFromQueue();
}

export function initOfflineSync(): void {
  if (!browser || initialized) {
    return;
  }

  initialized = true;

  window.addEventListener('online', () => {
    void syncOfflineChanges();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void syncOfflineChanges();
    }
  });

  void setStatusFromQueue().then(() => {
    if (navigator.onLine) {
      void syncOfflineChanges();
    }
  });
}

export async function cancelOfflineSync(): Promise<void> {
  syncController?.abort();
  await syncPromise;
}

export function resetOfflineSyncStatus(): void {
  clearSyncedTimer();
  statusState.set(initialStatus);
}
