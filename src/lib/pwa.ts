import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';

export const pwaNeedRefresh: Writable<boolean> = writable(false);
export const pwaOfflineReady: Writable<boolean> = writable(false);

type UpdateFn = (reloadPage?: boolean) => Promise<void>;

let updateServiceWorkerImpl: UpdateFn = async () => { };
let initStarted = false;

/**
 * Register the service worker once. Safe to call from multiple components;
 * only the first call performs registration.
 */
export function initPwa(): void {
  if (!browser || initStarted) {
    return;
  }

  initStarted = true;

  void import('virtual:pwa-register/svelte').then(({ useRegisterSW }) => {
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
      pwaNeedRefresh.set(value);
    });

    offlineReady.subscribe((value) => {
      pwaOfflineReady.set(value);
    });
  });
}

/** Activate the waiting service worker and reload onto the new shell. */
export function applyPwaUpdate(): Promise<void> {
  return updateServiceWorkerImpl(true);
}
