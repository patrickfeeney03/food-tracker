import { browser } from '$app/environment';
import { readonly, writable } from 'svelte/store';

const needRefreshState = writable(false);
const offlineReadyState = writable(false);
const isOnlineState = writable(true);
const applyingUpdateState = writable(false);

export const pwaNeedRefresh = readonly(needRefreshState);
export const pwaOfflineReady = readonly(offlineReadyState);
export const pwaIsOnline = readonly(isOnlineState);
export const pwaApplyingUpdate = readonly(applyingUpdateState);

type UpdateFn = (reloadPage?: boolean) => Promise<void>;

let updateServiceWorkerImpl: UpdateFn = async () => { };
let initStarted = false;
let updateInProgress: Promise<void> | null = null;

/**
 * Register the service worker once. Safe to call from multiple components;
 * only the first call performs registration.
 */
export function initPwa(): void {
  if (!browser || initStarted) {
    return;
  }

  initStarted = true;
  const updateNetworkStatus = () => {
    isOnlineState.set(navigator.onLine);
  };

  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  void import('virtual:pwa-register/svelte')
    .then(({ useRegisterSW }) => {
      const {
        needRefresh,
        offlineReady,
        updateServiceWorker
      } = useRegisterSW({
        immediate: true,
        onRegisterError(error) {
          console.error('PWA service worker registration failed', error);
        }
      });

      updateServiceWorkerImpl = updateServiceWorker;
      needRefresh.subscribe((value) => {
        needRefreshState.set(value);
      });

      offlineReady.subscribe((value) => {
        offlineReadyState.set(value);
      });
    })
    .catch((error) => {
      console.error('Failed to load PWA registration', error);
    });
}

/** Activate the waiting service worker and reload onto the new shell. */
export function applyPwaUpdate(): Promise<void> {
  if (updateInProgress !== null) {
    return updateInProgress;
  }

  applyingUpdateState.set(true);

  updateInProgress = Promise.resolve()
    .then(() => updateServiceWorkerImpl(true))
    .catch((error) => {
      console.error('Failed to apply PWA update', error);
    })
    .finally(() => {
      applyingUpdateState.set(false);
      updateInProgress = null;
    });

  return updateInProgress;
}
