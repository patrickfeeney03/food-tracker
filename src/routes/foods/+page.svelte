<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { ResolvedPathname } from '$app/types';
  import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
  import type { FoodResultView } from '$lib/components/foods/FoodResultList.svelte';
  import TrackerFoodSearchScreen from '$lib/components/tracker/TrackerFoodSearchScreen.svelte';
  import {
    filterCatalogueFoods,
    mapFoodResults
  } from '$lib/components/tracker/selectors';
  import { todayInDublin } from '$lib/date';
  import { withQuery } from '$lib/navigation';
  import type { MealSlot } from '$lib/nutrition/constants';
  import { consumePendingFoodLogReturn } from '$lib/nutrition/food-log-navigation';
  import { replayLatestFoodPortion } from '$lib/nutrition/latest-food-portion';
  import { destinationSchema } from '$lib/nutrition/navigation-context';
  import { logFoodInputSchema } from '$lib/nutrition/portion-input';
  import { queueDiaryLog } from '$lib/offline/sync';
  import {
    OFFLINE_CAPABILITY_MESSAGE,
    refreshTrackerSnapshot,
    reloadTrackerStore
  } from '$lib/tracker/tracker-service';
  import { useTrackerStore } from '$lib/tracker/tracker-store.svelte';
  import { onDestroy } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  const tracker = useTrackerStore();
  const searchDrafts = new SvelteMap<string, string>();
  let scannerOpen = $state(false);
  let foodQueryDraft = $state(
    page.url.searchParams.get('q') ?? page.url.searchParams.get('barcode') ?? ''
  );
  let queueError = $state<string | null>(null);
  let pendingFoodId = $state<string | null>(null);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchRevision = 0;

  let destination = $derived.by(() => {
    const result = destinationSchema.safeParse({
      date: page.url.searchParams.get('date'),
      mealSlot: page.url.searchParams.get('mealSlot')
    });
    return result.success
      ? result.data
      : { date: todayInDublin(), mealSlot: 'breakfast' as MealSlot };
  });
  let selectedDate = $derived(destination.date);
  let destinationMealSlot = $derived(destination.mealSlot);
  let activeTab = $derived(
    page.url.searchParams.get('tab') === 'shortcuts' ? 'shortcuts' : 'foods'
  );
  let foodQuery = $derived(foodQueryDraft);
  let catalogueFoods = $derived(tracker.cache?.foods ?? []);
  let foodResults = $derived(
    mapFoodResults(filterCatalogueFoods(catalogueFoods, foodQuery))
  );

  function clearFoodSearchHref(): ResolvedPathname {
    return resolve(withQuery('/foods', {
      date: selectedDate,
      mealSlot: destinationMealSlot,
      tab: activeTab
    }));
  }

  async function clearFoodSearch(): Promise<void> {
    foodQueryDraft = '';
    searchRevision += 1;
    clearTimeout(searchTimer);
    await goto(clearFoodSearchHref(), {
      replaceState: true,
      noScroll: true
    });
  }

  function foodHref(foodId: string): string {
    return resolve(withQuery(`/foods/${foodId}/log`, {
      date: selectedDate,
      mealSlot: destinationMealSlot,
      q: foodQuery.trim() || undefined
    }));
  }

  function editFoodHref(foodId: string): string | null {
    return tracker.isOffline
      ? null
      : resolve(withQuery(`/foods/${foodId}/edit`, {
          date: selectedDate,
          mealSlot: destinationMealSlot,
          q: foodQuery.trim() || undefined
        }));
  }

  async function quickAdd(foodResult: FoodResultView): Promise<void> {
    if (pendingFoodId !== null) {
      return;
    }

    const food = tracker.cache?.foods.find((item) => item.id === foodResult.id);
    const replay = food?.latestUse == null
      ? null
      : replayLatestFoodPortion(food, food.latestUse);

    if (food === undefined || replay === null) {
      queueError = 'Choose an amount for this food before using Quick Add.';
      return;
    }

    const userId = tracker.cache?.user.id;
    if (userId === undefined) {
      queueError = 'This change could not be saved on this device.';
      return;
    }

    pendingFoodId = food.id;
    queueError = null;

    try {
      const clientMutationId = crypto.randomUUID();
      await queueDiaryLog(
        userId,
        food.id,
        logFoodInputSchema.parse({
          clientMutationId,
          portionKind: replay.portionKind,
          portionCount: replay.portionCount,
          diaryDate: selectedDate,
          mealSlot: destinationMealSlot
        })
      );
      await clearFoodSearch();
      await reloadTrackerStore(tracker);
    } catch {
      queueError = 'This change could not be saved on this device.';
    } finally {
      pendingFoodId = null;
    }
  }

  function updateFoodSearch(value: string): void {
    foodQueryDraft = value;
    const revision = ++searchRevision;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (revision !== searchRevision) return;

      const target = resolve(withQuery('/foods', {
        date: selectedDate,
        mealSlot: destinationMealSlot,
        tab: activeTab,
        q: value.trim() || undefined
      }));
      const targetUrl = new URL(target, window.location.origin);
      searchDrafts.set(targetUrl.href, value);
      void goto(target, {
        replaceState: true,
        keepFocus: true,
        noScroll: true
      });
    }, 150);
  }

  function handleBarcode(barcode: string): void {
    scannerOpen = false;
    const matchingFood = catalogueFoods.find((food) => food.barcode === barcode);
    const target = matchingFood === undefined
      ? resolve(withQuery('/foods/new', {
          date: selectedDate,
          mealSlot: destinationMealSlot,
          barcode
        }))
      : resolve(withQuery('/foods', {
          date: selectedDate,
          mealSlot: destinationMealSlot,
          q: barcode
        }));
    void goto(target, { replaceState: true });
  }

  afterNavigate(({ from, to }) => {
    if (to === null) return;

    const pendingReturn = to.url.pathname === '/foods' &&
      from !== null &&
      from.url.pathname.match(/^\/foods\/[^/]+\/log\/?$/) !== null
      ? consumePendingFoodLogReturn()
      : null;

    const savedDraft = searchDrafts.get(to.url.href);
    foodQueryDraft = savedDraft ??
      to.url.searchParams.get('q') ??
      to.url.searchParams.get('barcode') ??
      '';

    if (pendingReturn !== null) {
      foodQueryDraft = '';
      searchRevision += 1;
      clearTimeout(searchTimer);
      // The return target was resolved before it was stored by the local log flow.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      void goto(pendingReturn, {
        replaceState: true,
        noScroll: true
      }).catch(() => {});
    }
  });

  $effect(() => {
    const shouldRefresh = ['added', 'created', 'saved', 'archived']
      .some((parameter) => page.url.searchParams.has(parameter));

    if (shouldRefresh && !tracker.isOffline) {
      void refreshTrackerSnapshot(tracker, selectedDate).catch(() => {});
    }
  });

  onDestroy(() => clearTimeout(searchTimer));
</script>

<svelte:head>
  <title>Add food | Calorie Tracker</title>
</svelte:head>

<TrackerFoodSearchScreen
  {selectedDate}
  {destinationMealSlot}
  isOffline={tracker.isOffline}
  {foodQuery}
  {queueError}
  created={page.url.searchParams.get('created') === '1'}
  foodsCatalogueReady={tracker.cache !== null}
  {foodResults}
  offlineCapabilityMessage={OFFLINE_CAPABILITY_MESSAGE}
  backHref={resolve(withQuery('/', { date: selectedDate })) as ResolvedPathname}
  clearHref={clearFoodSearchHref()}
  createFoodHref={resolve(withQuery('/foods/new', {
    date: selectedDate,
    mealSlot: destinationMealSlot
  }))}
  onSearchInput={updateFoodSearch}
  onOpenScanner={() => (scannerOpen = true)}
  actions={{ foodHref, editHref: editFoodHref, quickAdd, pendingFoodId }}
/>

{#if scannerOpen}
  <BarcodeScanner onscan={handleBarcode} onclose={() => (scannerOpen = false)} />
{/if}
