import { browser } from '$app/environment';
import { readonly, writable } from 'svelte/store';

const needRefreshState = writable(false);
const offlineReadyState = writable(false);
const isOnlineState = writable(true);
const applyingUpdateState = writable(false);
const serviceWorkerStatusState = writable<PwaServiceWorkerStatus>('checking');

export const pwaNeedRefresh = readonly(needRefreshState);
export const pwaOfflineReady = readonly(offlineReadyState);
export const pwaIsOnline = readonly(isOnlineState);
export const pwaApplyingUpdate = readonly(applyingUpdateState);
export const pwaServiceWorkerStatus = readonly(serviceWorkerStatusState);

export type PwaServiceWorkerStatus =
  | 'checking'
  | 'installing'
  | 'reload-required'
  | 'ready'
  | 'unsupported'
  | 'error';

type UpdateFn = (reloadPage?: boolean) => Promise<void>;

let updateServiceWorkerImpl: UpdateFn = async () => { };
let initStarted = false;
let updateInProgress: Promise<void> | null = null;
const watchedWorkers = new WeakSet<ServiceWorker>();

function updateServiceWorkerStatus(registration?: ServiceWorkerRegistration): void {
  if (!('serviceWorker' in navigator)) {
    serviceWorkerStatusState.set('unsupported');
    return;
  }

  if (navigator.serviceWorker.controller !== null) {
    serviceWorkerStatusState.set('ready');
    return;
  }

  if (registration?.active || registration?.waiting) {
    serviceWorkerStatusState.set('reload-required');
    return;
  }

  serviceWorkerStatusState.set('installing');
}

function watchServiceWorker(
  worker: ServiceWorker | null,
  registration: ServiceWorkerRegistration
): void {
  if (worker === null || watchedWorkers.has(worker)) {
    return;
  }

  watchedWorkers.add(worker);
  worker.addEventListener('statechange', () => {
    updateServiceWorkerStatus(registration);
  });
}

function trackServiceWorkerRegistration(
  registration?: ServiceWorkerRegistration
): void {
  updateServiceWorkerStatus(registration);

  if (registration === undefined) {
    return;
  }

  watchServiceWorker(registration.installing, registration);
  watchServiceWorker(registration.waiting, registration);
  watchServiceWorker(registration.active, registration);
}

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

  if (!('serviceWorker' in navigator)) {
    serviceWorkerStatusState.set('unsupported');
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    updateServiceWorkerStatus();
  });

  void navigator.serviceWorker.getRegistration().then(trackServiceWorkerRegistration);

  void import('virtual:pwa-register/svelte')
    .then(({ useRegisterSW }) => {
      const {
        needRefresh,
        offlineReady,
        updateServiceWorker
      } = useRegisterSW({
        immediate: true,
        onRegisteredSW(_serviceWorkerUrl, registration) {
          trackServiceWorkerRegistration(registration);
        },
        onRegisterError(error) {
          serviceWorkerStatusState.set('error');
          console.error('PWA service worker registration failed', error);
        }
      });

      updateServiceWorkerImpl = updateServiceWorker;
      needRefresh.subscribe((value) => {
        needRefreshState.set(value);
      });

      offlineReady.subscribe((value) => {
        offlineReadyState.set(value);

        if (value) {
          void navigator.serviceWorker.getRegistration().then(trackServiceWorkerRegistration);
        }
      });
    })
    .catch((error) => {
      serviceWorkerStatusState.set('error');
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
