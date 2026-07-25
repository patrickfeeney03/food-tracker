import {
  clearAllOfflineData,
  clearOfflineUser,
  readActiveUserId
} from './indexed-db';

/** True when session user is known and differs from the IndexedDB active/cached user. */
export function isStaleOfflineUser(
  sessionUserId: string | undefined,
  offlineUserId: string | null | undefined
): offlineUserId is string {
  return (
    typeof sessionUserId === 'string' &&
    sessionUserId.length > 0 &&
    typeof offlineUserId === 'string' &&
    offlineUserId.length > 0 &&
    sessionUserId !== offlineUserId
  );
}

async function clearStaleUser(staleUserId: string): Promise<void> {
  try {
    await clearOfflineUser(staleUserId);
  } catch {
    await clearAllOfflineData();
  }
}

/**
 * If the session user is known and `offlineUserId` belongs to another account,
 * clear that prior user's offline data. Returns whether data was discarded.
 */
export async function discardStaleOfflineUser(
  sessionUserId: string | undefined,
  offlineUserId: string | null | undefined
): Promise<boolean> {
  if (!isStaleOfflineUser(sessionUserId, offlineUserId)) {
    return false;
  }

  await clearStaleUser(offlineUserId);
  return true;
}

/**
 * If the session user is known and IndexedDB still points at another account,
 * clear that prior user's offline data so it is never painted.
 */
export async function clearStaleOfflineUserIfNeeded(
  sessionUserId: string | undefined
): Promise<'cleared' | 'kept' | 'skipped'> {
  if (sessionUserId === undefined || sessionUserId.length === 0) {
    return 'skipped';
  }

  const activeUserId = await readActiveUserId();

  if (activeUserId === null) {
    return 'skipped';
  }

  if (await discardStaleOfflineUser(sessionUserId, activeUserId)) {
    return 'cleared';
  }

  return 'kept';
}
