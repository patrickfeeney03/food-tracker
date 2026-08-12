<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import TrackerDiaryScreen from '$lib/components/tracker/TrackerDiaryScreen.svelte';
  import TrackerLoadingScreen from '$lib/components/tracker/TrackerLoadingScreen.svelte';
  import {
    selectCachedDates,
    selectNextDate,
    selectPreviousDate,
    selectShortcutEligibility
  } from '$lib/components/tracker/selectors';
  import { todayInDublin } from '$lib/date';
  import { withQuery } from '$lib/navigation';
  import { mealSlots, type MealSlot } from '$lib/nutrition/constants';
  import {
    consumeDiaryScroll,
    rememberDiaryScroll
  } from '$lib/nutrition/food-log-navigation';
  import { calendarDateString } from '$lib/nutrition/portion-input';
  import {
    OFFLINE_CAPABILITY_MESSAGE,
    refreshTrackerWindow
  } from '$lib/tracker/tracker-service';
  import { useTrackerStore } from '$lib/tracker/tracker-store.svelte';
  import type { DiaryEntryFeedback } from '$lib/tracker/types';
  import { tick, untrack } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const tracker = useTrackerStore();
  let entryFeedback = $state<DiaryEntryFeedback | null>(
    untrack(() => data.trackerEntryFeedback)
  );
  let feedbackRequest = 0;

  let selectedDate = $derived.by(() => {
    const result = calendarDateString.safeParse(page.url.searchParams.get('date'));
    return result.success ? result.data : todayInDublin();
  });
  let diary = $derived(tracker.cache?.diaryDays[selectedDate] ?? null);
  let cachedDates = $derived(selectCachedDates(tracker.cache));
  let previousDate = $derived(
    selectPreviousDate(cachedDates, selectedDate, tracker.isOffline, selectedDate)
  );
  let nextDate = $derived(
    selectNextDate(cachedDates, selectedDate, tracker.isOffline, selectedDate)
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
    return resolve(withQuery('/foods', { date: selectedDate, mealSlot: slot }));
  }

  function entryHref(entryId: string): string | null {
    return tracker.isOffline
      ? null
      : resolve('/diary/[entryId]/edit', { entryId });
  }

  function saveShortcutHref(slot: MealSlot): string | null {
    return tracker.isOffline
      ? null
      : resolve(withQuery('/meal-shortcuts/new', {
          date: selectedDate,
          mealSlot: slot
        }));
  }

  const actionReturnParams = [
    'updated',
    'entryDeleted',
    'entryRestored',
    'shortcutSaved'
  ] as const;
  let pendingScrollRestore = $state(true);

  function mealSlotFromHash(hash: string): MealSlot | null {
    const slot = hash.replace(/^#/, '');
    return (mealSlots as readonly string[]).includes(slot)
      ? slot as MealSlot
      : null;
  }

  beforeNavigate(({ from, to }) => {
    if (from?.url.pathname !== '/' || to === null || to.url.pathname === '/') {
      return;
    }

    const dateResult = calendarDateString.safeParse(from.url.searchParams.get('date'));
    rememberDiaryScroll(
      dateResult.success ? dateResult.data : todayInDublin(),
      window.scrollY
    );
  });

  afterNavigate(({ to }) => {
    if (to?.url.pathname === '/') {
      pendingScrollRestore = true;
    }
  });

  $effect(() => {
    if (diary === null || !pendingScrollRestore) {
      return;
    }

    const date = selectedDate;
    const hash = mealSlotFromHash(page.url.hash);
    const preferMealHash = hash !== null &&
      actionReturnParams.some((parameter) => page.url.searchParams.has(parameter));

    pendingScrollRestore = false;

    void tick().then(() => {
      if (preferMealHash && hash !== null) {
        document.getElementById(hash)?.scrollIntoView();
        return;
      }

      const scrollY = consumeDiaryScroll(date);
      if (scrollY !== null) {
        window.scrollTo(0, scrollY);
        return;
      }

      if (hash !== null) {
        document.getElementById(hash)?.scrollIntoView();
      }
    });
  });

  $effect(() => {
    const date = selectedDate;
    const forceSnapshot =
      page.url.searchParams.has('updated') ||
      page.url.searchParams.has('entryDeleted') ||
      page.url.searchParams.has('entryRestored');

    untrack(() => {
      refreshTrackerWindow(tracker, date, { forceSnapshot });
    });
  });

  $effect(() => {
    const entryDeleted = page.url.searchParams.get('entryDeleted');
    const entryRestored = page.url.searchParams.get('entryRestored');
    const date = selectedDate;

    if (entryDeleted === null && entryRestored === null) {
      entryFeedback = null;
      return;
    }

    const requestId = ++feedbackRequest;
    const url = new URL(resolve('/api/tracker/entry-feedback'), window.location.origin);
    url.searchParams.set('date', date);
    if (entryDeleted !== null) url.searchParams.set('entryDeleted', entryDeleted);
    if (entryRestored !== null) url.searchParams.set('entryRestored', entryRestored);

    void fetch(url, { headers: { accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : null)
      .then((feedback: DiaryEntryFeedback | null) => {
        if (requestId === feedbackRequest) {
          entryFeedback = feedback;
        }
      })
      .catch(() => {});
  });
</script>

<svelte:head>
  <title>{dateLabel} | Calorie Tracker</title>
</svelte:head>

{#if diary !== null}
  <TrackerDiaryScreen
    {diary}
    {shortcutEligibility}
    actions={{ entryHref, addFoodHref, saveShortcutHref }}
    previousHref={diaryDateHref(previousDate)}
    nextHref={diaryDateHref(nextDate)}
    todayHref={resolve(withQuery('/', { date: todayInDublin() }))}
    settingsHref={resolve('/settings')}
    {dateLabel}
    isOffline={tracker.isOffline}
    offlineCapabilityMessage={OFFLINE_CAPABILITY_MESSAGE}
    diaryLoadError={tracker.loadErrors.get(selectedDate) ?? null}
    showDiaryLoadError={tracker.cache?.diaryDays[selectedDate] === undefined}
    onRetry={() => refreshTrackerWindow(tracker, selectedDate)}
    {entryFeedback}
  />
{:else}
  <TrackerLoadingScreen message="Opening diary…" />
{/if}
