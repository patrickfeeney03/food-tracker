<script lang="ts">
  import { onDestroy } from 'svelte';
  import { applyPwaUpdate, initPwa, pwaNeedRefresh } from '$lib/pwa';
  import FeedbackBanner from './FeedbackBanner.svelte';

  let needRefresh = $state(false);
  let applying = $state(false);

  initPwa();

  const unsubscribe = pwaNeedRefresh.subscribe((value) => {
    needRefresh = value;
  });

  onDestroy(unsubscribe);

  async function handleUpdate() {
    if (applying) {
      return;
    }

    applying = true;

    try {
      await applyPwaUpdate();
    } catch (error) {
      console.error('Failed to apply PWA update', error);
      applying = false;
    }
  }
</script>

{#if needRefresh}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
  >
    <div class="pointer-events-auto w-full max-w-[430px]">
      <FeedbackBanner message="Update available · refresh when you are free to log.">
        {#snippet action()}
          <button
            type="button"
            disabled={applying}
            onclick={handleUpdate}
            class="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--app-success-text)]
              px-3 text-sm font-semibold text-white transition hover:opacity-90
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)] disabled:cursor-not-allowed
              disabled:opacity-60"
          >
            {applying ? 'Updating…' : 'Update'}
          </button>
        {/snippet}
      </FeedbackBanner>
    </div>
  </div>
{/if}
