<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- requestedUrl is the current same-origin URL */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import TrackerDiaryScreen from '$lib/components/tracker/TrackerDiaryScreen.svelte';
  import AppMark from '$lib/components/icons/AppMark.svelte';
  import {
    selectCachedDates,
    selectNextDate,
    selectPreviousDate,
    selectShortcutEligibility
  } from '$lib/components/tracker/selectors';
  import { todayInDublin } from '$lib/date';
  import { withQuery } from '$lib/navigation';
  import type { MealSlot } from '$lib/nutrition/constants';
  import { OFFLINE_CAPABILITY_MESSAGE } from '$lib/tracker/tracker-service';
  import { isLocalTrackerPath } from '$lib/tracker/routes';
  import { useTrackerStore } from '$lib/tracker/tracker-store.svelte';
  import { onMount } from 'svelte';

  const tracker = useTrackerStore();
  let cachedDates = $derived(selectCachedDates(tracker.cache));
  let selectedDate = $derived(cachedDates.at(-1) ?? '');
  let diary = $derived(
    selectedDate === '' ? null : tracker.cache?.diaryDays[selectedDate] ?? null
  );
  let previousDate = $derived(
    selectPreviousDate(cachedDates, selectedDate, true, selectedDate)
  );
  let nextDate = $derived(
    selectNextDate(cachedDates, selectedDate, true, selectedDate)
  );
  let shortcutEligibility = $derived(
    selectShortcutEligibility(undefined, diary)
  );
  let dateLabel = $derived(
    selectedDate === todayInDublin() ? 'Today' : selectedDate
  );

  function diaryDateHref(date: string | null): string | null {
    return date === null ? null : resolve(withQuery('/', { date }));
  }

  function addFoodHref(slot: MealSlot): string {
    return resolve(withQuery('/foods', {
      date: selectedDate,
      mealSlot: slot
    }));
  }

  onMount(() => {
    if (
      window.location.pathname === '/offline' ||
      !isLocalTrackerPath(window.location.pathname)
    ) {
      return;
    }

    // Workbox served the public offline document for a protected core URL.
    // Hand it back to SvelteKit so the real route component renders from the
    // precached client bundle and root IndexedDB store.
    const requestedUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState(
      window.history.state,
      '',
      resolve('/offline')
    );
    const timer = setTimeout(() => {
      void goto(requestedUrl, { replaceState: true });
    });

    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>{dateLabel || 'Offline diary'} | Calorie Tracker</title>
</svelte:head>

{#if diary !== null}
  <TrackerDiaryScreen
    {diary}
    {shortcutEligibility}
    actions={{
      entryHref: () => null,
      addFoodHref,
      saveShortcutHref: () => null
    }}
    previousHref={diaryDateHref(previousDate)}
    nextHref={diaryDateHref(nextDate)}
    todayHref={resolve(withQuery('/', { date: todayInDublin() }))}
    settingsHref={resolve('/settings')}
    {dateLabel}
    isOffline={true}
    offlineCapabilityMessage={OFFLINE_CAPABILITY_MESSAGE}
    diaryLoadError={null}
    showDiaryLoadError={false}
    onRetry={() => {}}
    entryFeedback={null}
  />
{:else}
  <main
    class="flex min-h-dvh items-center justify-center bg-[var(--app-surface)] px-6
      pb-[calc(2rem+env(safe-area-inset-bottom))] text-[var(--app-text)]"
  >
    <section class="w-full max-w-sm text-center" aria-labelledby="offline-heading">
      <div
        class="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border
          border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-accent)] shadow-sm"
        aria-hidden="true"
      >
        <AppMark class="size-11" />
      </div>
      <h1 id="offline-heading" class="text-2xl font-bold">Opening tracker…</h1>
      <p class="mx-auto mt-3 max-w-xs text-sm leading-6 text-[var(--app-muted)]">
        {tracker.status === 'error'
          ? 'Saved data could not be opened on this device.'
          : 'Loading tracker data…'}
      </p>
    </section>
  </main>
{/if}
