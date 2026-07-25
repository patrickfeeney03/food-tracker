import { clearOfflineCacheForSignOut } from './client';
import { hasActiveOfflineMutations } from './indexed-db';

export type OfflineSignOutResult = 'cancelled' | 'submitted';

/**
 * Intercept a logout form submit: warn about unsynced offline changes,
 * wipe IndexedDB, then continue with a normal form POST.
 */
export async function handleOfflineAwareSignOut(
  event: SubmitEvent
): Promise<OfflineSignOutResult> {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    return 'cancelled';
  }

  if (form.dataset.signingOut === '1') {
    return 'cancelled';
  }

  form.dataset.signingOut = '1';

  let hasUnsyncedChanges = false;

  try {
    hasUnsyncedChanges = await hasActiveOfflineMutations();
  } catch {
    // Signing out must still complete if browser storage is unavailable.
  }

  if (
    hasUnsyncedChanges &&
    !window.confirm(
      'You have unsynced changes saved only on this device. Signing out will permanently discard them. Sign out anyway?'
    )
  ) {
    delete form.dataset.signingOut;
    return 'cancelled';
  }

  try {
    await clearOfflineCacheForSignOut();
  } catch {
    // Signing out must still complete if browser storage is unavailable.
  }

  form.submit();
  return 'submitted';
}
