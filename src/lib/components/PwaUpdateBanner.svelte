<script lang="ts">
  import {
    applyPwaUpdate,
    initPwa,
    pwaApplyingUpdate,
    pwaIsOnline,
    pwaNeedRefresh
  } from '$lib/pwa';
  import {
    discardFailedOfflineChanges,
    initOfflineSync,
    offlineSyncStatus,
    retryOfflineChanges
  } from '$lib/offline/sync';
  import FeedbackBanner from './FeedbackBanner.svelte';

  initPwa();
  initOfflineSync();

  let queuedLabel = $derived(
    `${$offlineSyncStatus.pendingCount} ${
      $offlineSyncStatus.pendingCount === 1 ? 'change' : 'changes'
    }`
  );

  function discardFailedChanges(): void {
    if (
      window.confirm(
        `Discard ${queuedLabel}? This removes the changes that could not be synced from this device.`
      )
    ) {
      void discardFailedOfflineChanges();
    }
  }
</script>

{#if !$pwaIsOnline}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
  >
    <div class="pointer-events-auto w-full max-w-[430px]">
      <FeedbackBanner
        message={$offlineSyncStatus.pendingCount > 0
          ? `Offline · ${queuedLabel} saved on this device.`
          : 'Offline · using saved data.'}
        tone="neutral"
      />
    </div>
  </div>
{:else if
  $offlineSyncStatus.phase === 'error' ||
  $offlineSyncStatus.phase === 'attention'}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
  >
    <div class="pointer-events-auto w-full max-w-[430px]">
      <FeedbackBanner
        message={$offlineSyncStatus.phase === 'attention'
          ? `${queuedLabel} ${$offlineSyncStatus.pendingCount === 1 ? 'needs' : 'need'} attention.`
          : `Couldn’t sync ${queuedLabel}.`}
        tone="neutral"
      >
        {#snippet action()}
          <div class="flex items-center">
            <button
              type="button"
              onclick={retryOfflineChanges}
              class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
                text-[var(--app-accent)] underline underline-offset-2
                focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-[var(--app-accent)]"
            >
              Retry
            </button>
            {#if $offlineSyncStatus.phase === 'attention'}
              <button
                type="button"
                onclick={discardFailedChanges}
                class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
                  text-[var(--app-danger-text)] underline underline-offset-2
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-[var(--app-danger-text)]"
              >
                Discard
              </button>
            {/if}
          </div>
        {/snippet}
      </FeedbackBanner>
    </div>
  </div>
{:else if $pwaNeedRefresh}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
  >
    <div class="pointer-events-auto w-full max-w-[430px]">
      <FeedbackBanner message="Update available · refresh when you are free to log.">
        {#snippet action()}
          <button
            type="button"
            disabled={$pwaApplyingUpdate}
            onclick={applyPwaUpdate}
            class="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--app-success-text)]
              px-3 text-sm font-semibold text-white transition hover:opacity-90
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)] disabled:cursor-not-allowed
              disabled:opacity-60"
          >
            {$pwaApplyingUpdate ? 'Updating…' : 'Update'}
          </button>
        {/snippet}
      </FeedbackBanner>
    </div>
  </div>
{/if}
