<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- local href helpers return base-resolved app URLs */
  import { resolve } from '$app/paths';
  import { pushState, replaceState } from '$app/navigation';
  import AmountAdjuster, {
    type AmountAdjusterFieldErrors,
    type AmountAdjusterValues
  } from '$lib/components/amount-adjuster/AmountAdjuster.svelte';
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import BackPageHeader from '$lib/components/BackPageHeader.svelte';
  import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
  import DiaryDayView, {
    type DiaryDayViewData
  } from '$lib/components/diary/DiaryDayView.svelte';
  import FeedbackBanner from '$lib/components/FeedbackBanner.svelte';
  import FoodResultList, {
    type FoodResultView
  } from '$lib/components/foods/FoodResultList.svelte';
  import BarcodeIcon from '$lib/components/icons/BarcodeIcon.svelte';
  import ChevronLeftIcon from '$lib/components/icons/ChevronLeftIcon.svelte';
  import ChevronRightIcon from '$lib/components/icons/ChevronRightIcon.svelte';
  import CloseIcon from '$lib/components/icons/CloseIcon.svelte';
  import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
  import SettingsIcon from '$lib/components/icons/SettingsIcon.svelte';
  import AppMark from '$lib/components/icons/AppMark.svelte';
  import { shiftDate, todayInDublin } from '$lib/date';
  import { withQuery } from '$lib/navigation';
  import {
    mealNames,
    mealSlots,
    type MealSlot
  } from '$lib/nutrition/constants';
  import { formatDate } from '$lib/nutrition/format';
  import { replayLatestFoodPortion } from '$lib/nutrition/latest-food-portion';
  import {
    calendarDateString,
    logFoodInputSchema
  } from '$lib/nutrition/portion-input';
  import { portionOptionsForFood } from '$lib/nutrition/portion-options';
  import {
    listOfflineDiaryLogMutations,
    readActiveOfflineData,
    type CachedOfflineData
  } from '$lib/offline/indexed-db';
  import {
    applyPendingDiaryLogs,
    emptyDiaryDay
  } from '$lib/offline/optimistic-diary';
  import {
    initOfflineSync,
    offlineSyncStatus,
    queueOfflineDiaryLog
  } from '$lib/offline/sync';
  import { refreshOfflineCache } from '$lib/offline/client';
  import type { OfflineFood } from '$lib/offline/types';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { onMount, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { z } from 'zod';

  type ViewMode = 'diary' | 'foods' | 'amount';
  type LoadStatus = 'loading' | 'ready' | 'empty' | 'error';

  interface InitialData {
    diary?: unknown;
    foods?: unknown[];
    shortcuts?: unknown[];
    food?: unknown;
    user?: { id?: string; name: string };
    today?: string;
    feedback?: unknown;
    destination?: { date: string; mealSlot: MealSlot };
    context?: unknown;
    portionOptions?: unknown[];
    values?: AmountAdjusterValues;
    tab?: 'foods' | 'shortcuts';
    query?: string;
    shortcutEligibility?: Record<MealSlot, boolean>;
    entryFeedback?: unknown;
    shortcutFeedback?: unknown;
    quickAddFeedback?: unknown;
  }

  let {
    initialData,
    isOfflinePage = false
  }: {
    initialData?: InitialData;
    isOfflinePage?: boolean;
  } = $props();

  const offlineCapabilityMessage =
    'You can add saved foods offline. Editing diary entries, foods and meal shortcuts is available when online.';

  function parseRouteFromUrl(): {
    view: ViewMode;
    requestedDate: string | null;
    mealSlot: MealSlot;
    foodId: string | null;
    query: string;
    tab: 'foods' | 'shortcuts';
  } {
    if (typeof window === 'undefined') {
      const initialDiary = initialData?.diary as { date?: string } | undefined;
      const initialFood = initialData?.food as { id?: string } | undefined;
      const context = initialData?.context as {
        date?: string;
        mealSlot?: MealSlot;
        q?: string;
      } | undefined;
      const destination = initialData?.destination;

      let view: ViewMode = 'diary';
      if (initialFood !== undefined) {
        view = 'amount';
      } else if (
        initialData?.foods !== undefined ||
        initialData?.shortcuts !== undefined ||
        destination !== undefined
      ) {
        view = 'foods';
      }

      return {
        view,
        requestedDate:
          initialDiary?.date ??
          destination?.date ??
          context?.date ??
          null,
        mealSlot:
          destination?.mealSlot ??
          context?.mealSlot ??
          'breakfast',
        foodId: initialFood?.id ?? null,
        query: initialData?.query ?? context?.q ?? '',
        tab: initialData?.tab ?? 'foods'
      };
    }

    const url = new URL(window.location.href);
    const dateResult = calendarDateString.safeParse(url.searchParams.get('date'));
    const mealSlotParam = url.searchParams.get('mealSlot');
    const foodMatch = /^\/foods\/([^/]+)\/log\/?$/.exec(url.pathname);
    const tabParam = url.searchParams.get('tab');

    const mealSlot = mealSlots.includes(mealSlotParam as MealSlot)
      ? (mealSlotParam as MealSlot)
      : 'breakfast';
    const query = url.searchParams.get('q') ?? '';
    const tab = tabParam === 'shortcuts' ? 'shortcuts' : 'foods';

    if (foodMatch !== null) {
      return {
        view: 'amount',
        requestedDate: dateResult.success ? dateResult.data : null,
        mealSlot,
        foodId: foodMatch[1],
        query,
        tab
      };
    }

    if (url.pathname === '/foods' || url.pathname.startsWith('/foods/')) {
      return {
        view: 'foods',
        requestedDate: dateResult.success ? dateResult.data : null,
        mealSlot,
        foodId: null,
        query,
        tab
      };
    }

    return {
      view: 'diary',
      requestedDate: dateResult.success ? dateResult.data : null,
      mealSlot,
      foodId: null,
      query,
      tab
    };
  }

  function canRenderFromInitial(view: ViewMode): boolean {
    if (initialData === undefined) {
      return false;
    }

    if (view === 'diary') {
      return initialData.diary !== undefined;
    }

    if (view === 'amount') {
      return initialData.food !== undefined && initialData.values !== undefined;
    }

    // Foods catalogue: SSR payload is enough even when the list is empty.
    return true;
  }

  const boot = untrack(() => {
    const route = parseRouteFromUrl();
    const initialDiary = initialData?.diary as { date?: string } | undefined;
    const context = initialData?.context as { date?: string } | undefined;

    return {
      route,
      selectedDate:
        route.requestedDate ??
        initialDiary?.date ??
        initialData?.destination?.date ??
        context?.date ??
        '',
      canRender: canRenderFromInitial(route.view),
      amountValues:
        route.view === 'amount' && initialData?.values
          ? initialData.values
          : null,
      initialFoods: Array.isArray(initialData?.foods)
        ? (initialData.foods as OfflineFood[])
        : null
    };
  });

  let isOffline = $state(untrack(() => isOfflinePage));
  let status = $state<LoadStatus>(boot.canRender ? 'ready' : 'loading');
  let cache = $state<CachedOfflineData | null>(null);
  let activeView = $state<ViewMode>(boot.route.view);
  let selectedDate = $state(boot.selectedDate);
  let destinationMealSlot = $state<MealSlot>(boot.route.mealSlot);
  let amountFoodId = $state<string | null>(boot.route.foodId);
  let amountValues = $state<AmountAdjusterValues | null>(boot.amountValues);
  let amountErrors = $state<AmountAdjusterFieldErrors>({});
  let foodQuery = $state(boot.route.query);
  let activeTab = $state<'foods' | 'shortcuts'>(boot.route.tab);
  let pendingFoodId = $state<string | null>(null);
  let queueError = $state<string | null>(null);
  let scannerOpen = $state(false);
  let lastSyncPhase = $state($offlineSyncStatus.phase);
  const quickAddMutationIds = new SvelteMap<string, string>();

  function seedQuickAddMutationIds(foods: OfflineFood[]): void {
    quickAddMutationIds.clear();

    for (const food of foods) {
      if (
        food.latestUse !== null &&
        replayLatestFoodPortion(food, food.latestUse) !== null
      ) {
        quickAddMutationIds.set(food.id, crypto.randomUUID());
      }
    }
  }

  // Paint SSR foods with working quick-add ids before IndexedDB hydrates.
  if (boot.initialFoods !== null) {
    seedQuickAddMutationIds(boot.initialFoods);
  }

  function initialAmountValues(food: OfflineFood): AmountAdjusterValues {
    const replay = food.latestUse === null || food.latestUse === undefined
      ? null
      : replayLatestFoodPortion(food, food.latestUse);

    return {
      clientMutationId: crypto.randomUUID(),
      portionKind: replay?.portionKind ?? 'hundred',
      portionCount: replay?.portionCount ?? '',
      diaryDate: selectedDate,
      mealSlot: destinationMealSlot
    };
  }

  async function applyRefreshedCache(
    date: string,
    options?: { silent?: boolean }
  ): Promise<void> {
    const fresh = await refreshOfflineCache(date, options);
    const mutations = await listOfflineDiaryLogMutations(fresh.user.id);
    cache = applyPendingDiaryLogs(fresh, mutations);
  }

  /** Refresh center day, then quietly prefetch ±5 so nearby days stay local. */
  function refreshCacheWindow(centerDate: string): void {
    if (typeof window === 'undefined' || !navigator.onLine || centerDate === '') {
      return;
    }

    void applyRefreshedCache(centerDate)
      .catch(() => {})
      .finally(() => {
        for (let offset = -5; offset <= 5; offset += 1) {
          if (offset === 0) {
            continue;
          }

          void applyRefreshedCache(shiftDate(centerDate, offset), {
            silent: true
          }).catch(() => {});
        }
      });
  }

  async function loadSavedData(preserveMutationIds = false): Promise<void> {
    initOfflineSync();
    const route = parseRouteFromUrl();

    activeView = route.view;
    destinationMealSlot = route.mealSlot;
    amountFoodId = route.foodId;
    foodQuery = route.query;
    activeTab = route.tab;

    const saved = await readActiveOfflineData();

    if (saved === null) {
      if (initialData) {
        status = 'ready';
        const initialDiary = initialData.diary as { date?: string } | undefined;
        selectedDate = route.requestedDate ?? initialDiary?.date ?? initialData.destination?.date ?? todayInDublin();
        refreshCacheWindow(selectedDate);
        return;
      }
      status = 'empty';
      return;
    }

    const mutations = await listOfflineDiaryLogMutations(saved.user.id);
    const optimistic = applyPendingDiaryLogs(saved, mutations);
    const dates = Object.keys(optimistic.diaryDays).sort();

    cache = optimistic;
    selectedDate =
      route.requestedDate !== null &&
      optimistic.diaryDays[route.requestedDate] !== undefined
        ? route.requestedDate
        : selectedDate !== '' &&
            optimistic.diaryDays[selectedDate] !== undefined
          ? selectedDate
          : route.requestedDate ?? dates.at(-1) ?? todayInDublin();

    if (!preserveMutationIds) {
      seedQuickAddMutationIds(optimistic.foods);
    }

    if (activeView === 'amount') {
      const food = optimistic.foods.find((item) => item.id === amountFoodId);
      if (food === undefined) {
        activeView = 'foods';
      } else if (amountValues === null) {
        amountValues = initialAmountValues(food);
      }
    }

    status = 'ready';
    refreshCacheWindow(selectedDate);
  }

  function updateFromCurrentUrl() {
    const route = parseRouteFromUrl();
    activeView = route.view;
    destinationMealSlot = route.mealSlot;
    amountFoodId = route.foodId;
    foodQuery = route.query;
    activeTab = route.tab;

    if (route.requestedDate !== null) {
      selectedDate = route.requestedDate;
    } else if (route.view === 'diary') {
      // Bare `/` means today (same as the server diary load).
      selectedDate = todayInDublin();
    }

    if (activeView === 'amount' && cache !== null) {
      const food = cache.foods.find((item) => item.id === amountFoodId);
      if (food) {
        amountValues = initialAmountValues(food);
      }
    }

    // Navigation stays local; network only tops up cache in the background.
    refreshCacheWindow(selectedDate);
  }

  function handleTrackerLinkClick(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) {
      return;
    }

    const rawHref = anchor.getAttribute('href');
    if (!rawHref) return;

    const targetUrl = new URL(anchor.href, window.location.origin);
    if (targetUrl.origin !== window.location.origin) {
      return;
    }

    const path = targetUrl.pathname;
    const isTrackerRoute =
      path === '/' ||
      path === '/offline' ||
      path === '/foods' ||
      /^\/foods\/[^/]+\/log\/?$/.test(path);

    if (isTrackerRoute) {
      event.preventDefault();
      pushState(anchor.href, {});
      updateFromCurrentUrl();
    }
  }

  let diary = $derived.by(() => {
    if (selectedDate === '') {
      return null;
    }

    if (cache !== null) {
      const cachedDay = cache.diaryDays[selectedDate];
      if (cachedDay !== undefined) {
        return cachedDay as unknown as DiaryDayViewData;
      }
    }

    if (initialData?.diary) {
      const initialDiary = initialData.diary as DiaryDayViewData & { date?: string };
      if (initialDiary.date === selectedDate) {
        return initialDiary as DiaryDayViewData;
      }
    }

    // Keep the diary shell visible while a missing day is fetched.
    if (!isOffline) {
      return emptyDiaryDay(selectedDate) as unknown as DiaryDayViewData;
    }

    return null;
  });

  let cachedDates = $derived(
    cache === null
      ? []
      : Object.keys(cache.diaryDays).sort()
  );

  let previousDate = $derived.by(() => {
    if (isOffline && cachedDates.length > 0) {
      return cachedDates.filter((date) => date < selectedDate).at(-1) ?? null;
    }
    const initialDiary = initialData?.diary as { date?: string } | undefined;
    return shiftDate(selectedDate || initialDiary?.date || (initialData?.destination?.date ?? todayInDublin()), -1);
  });

  let nextDate = $derived.by(() => {
    if (isOffline && cachedDates.length > 0) {
      return cachedDates.find((date) => date > selectedDate) ?? null;
    }
    const initialDiary = initialData?.diary as { date?: string } | undefined;
    return shiftDate(selectedDate || initialDiary?.date || (initialData?.destination?.date ?? todayInDublin()), 1);
  });

  let dateLabel = $derived(
    selectedDate === todayInDublin() ? 'Today' : selectedDate
  );

  let amountFood = $derived.by(() => {
    if (cache !== null) {
      const found = cache.foods.find((food) => food.id === amountFoodId);
      if (found) return found;
    }
    const initialFoods = initialData?.foods as OfflineFood[] | undefined;
    if (initialFoods !== undefined) {
      const found = initialFoods.find((food) => food.id === amountFoodId);
      if (found) return found;
    }
    const initialFood = initialData?.food as OfflineFood | undefined;
    if (initialFood !== undefined && initialFood.id === amountFoodId) {
      return initialFood;
    }
    return null;
  });

  let foodsCatalogueReady = $derived(
    cache !== null || Array.isArray(initialData?.foods)
  );

  let filteredFoods = $derived.by(() => {
    const list = (cache?.foods ?? initialData?.foods ?? (initialData?.food ? [initialData.food] : [])) as OfflineFood[];
    const query = foodQuery.trim().toLocaleLowerCase();
    const matches = query === ''
      ? list
      : list.filter((food) =>
          food.name.toLocaleLowerCase().includes(query) ||
          food.brand?.toLocaleLowerCase().includes(query) ||
          food.barcode === foodQuery.trim()
        );

    return (query === ''
      ? matches
      : [...matches].sort((left, right) => left.name.localeCompare(right.name))
    ).slice(0, 50);
  });

  let foodResults = $derived<FoodResultView[]>(
    filteredFoods.map((food) => ({
      id: food.id,
      name: food.name,
      brand: food.brand,
      amountUnit: food.amountUnit,
      basisAmount: food.basisAmount,
      energyMkcalPerBasis: food.energyMkcalPerBasis,
      latestUse: food.latestUse,
      quickAddMutationId: quickAddMutationIds.get(food.id) ?? null
    }))
  );

  let shortcutEligibility = $derived.by(() => {
    if (initialData?.shortcutEligibility) {
      return initialData.shortcutEligibility;
    }
    return Object.fromEntries(
      mealSlots.map((slot) => [
        slot,
        ((diary as DiaryDayViewData | null)?.meals?.[slot]?.entries?.length ?? 0) > 0
      ])
    ) as Record<MealSlot, boolean>;
  });

  function diaryDateHref(date: string | null): string | null {
    return date === null
      ? null
      : resolve(withQuery('/', { date }));
  }

  function addFoodHref(slot: MealSlot): string {
    return resolve(
      withQuery('/foods', {
        date: selectedDate,
        mealSlot: slot
      })
    );
  }

  function foodHref(foodId: string): string {
    return resolve(
      withQuery(`/foods/${foodId}/log`, {
        date: selectedDate,
        mealSlot: destinationMealSlot,
        q: foodQuery.trim() || undefined
      })
    );
  }

  function editFoodHref(foodId: string): string | null {
    return isOffline
      ? null
      : resolve(
          withQuery(`/foods/${foodId}/edit`, {
            date: selectedDate,
            mealSlot: destinationMealSlot,
            q: foodQuery.trim() || undefined
          })
        );
  }

  function entryHref(entryId: string): string | null {
    return isOffline
      ? null
      : resolve('/diary/[entryId]/edit', { entryId });
  }

  function saveShortcutHref(slot: MealSlot): string | null {
    return isOffline
      ? null
      : resolve(
          withQuery('/meal-shortcuts/new', {
            date: selectedDate,
            mealSlot: slot
          })
        );
  }

  async function quickAdd(foodResult: FoodResultView): Promise<void> {
    const foodList = (cache?.foods ?? initialData?.foods ?? (initialData?.food ? [initialData.food] : [])) as OfflineFood[];
    const food = foodList.find((item) => item.id === foodResult.id);
    const clientMutationId = quickAddMutationIds.get(foodResult.id) ?? crypto.randomUUID();
    const replay =
      food?.latestUse === null || food?.latestUse === undefined
        ? null
        : replayLatestFoodPortion(food, food.latestUse);

    if (food === undefined || replay === null) {
      queueError = 'Choose an amount for this food before using Quick Add.';
      return;
    }

    const userId = cache?.user.id ?? initialData?.user?.id;

    if (userId === undefined) {
      queueError = 'This change could not be saved on this device.';
      return;
    }

    pendingFoodId = food.id;
    queueError = null;

    try {
      await queueOfflineDiaryLog(
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
    } catch {
      queueError = 'This change could not be saved on this device.';
      pendingFoodId = null;
      return;
    }

    quickAddMutationIds.set(food.id, crypto.randomUUID());
    await loadSavedData(true);
    pendingFoodId = null;
  }

  const enhanceOfflineLog: SubmitFunction = async ({
    cancel,
    formData
  }) => {
    cancel();
    amountErrors = {};

    const values = {
      clientMutationId: String(formData.get('clientMutationId') ?? ''),
      portionKind: String(formData.get('portionKind') ?? ''),
      portionCount: String(formData.get('portionCount') ?? ''),
      diaryDate: String(formData.get('diaryDate') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? '')
    };
    const result = logFoodInputSchema.safeParse(values);

    if (!result.success) {
      amountErrors = z.flattenError(result.error).fieldErrors;
      return;
    }

    const userId = cache?.user?.id ?? initialData?.user?.id;

    if (userId === undefined || amountFood === null) {
      amountErrors = {
        form: ['This food is not saved on this device.']
      };
      return;
    }

    try {
      await queueOfflineDiaryLog(
        userId,
        amountFood.id,
        result.data
      );
      const targetUrl = resolve(
        withQuery('/foods', {
          date: result.data.diaryDate,
          mealSlot: result.data.mealSlot,
          q: foodQuery.trim() || undefined
        })
      );
      pushState(targetUrl, {});
      await loadSavedData(true);
    } catch {
      amountErrors = {
        form: ['This change could not be saved on this device.']
      };
    }
  };

  function handleSearchInput(event: Event) {
    foodQuery = (event.currentTarget as HTMLInputElement).value;
    const targetUrl = resolve(
      withQuery('/foods', {
        date: selectedDate,
        mealSlot: destinationMealSlot,
        tab: activeTab,
        q: foodQuery.trim() || undefined
      })
    );
    replaceState(targetUrl, {});
  }

  function clearFoodSearch(event: MouseEvent) {
    event.preventDefault();
    foodQuery = '';
    const targetUrl = resolve(
      withQuery('/foods', {
        date: selectedDate,
        mealSlot: destinationMealSlot,
        tab: activeTab
      })
    );
    pushState(targetUrl, {});
  }

  $effect(() => {
    const phase = $offlineSyncStatus.phase;

    if (
      (phase === 'synced' || phase === 'attention') &&
      lastSyncPhase !== phase
    ) {
      void loadSavedData();
    }

    lastSyncPhase = phase;
  });

  onMount(() => {
    function updateOnlineStatus() {
      isOffline = isOfflinePage || !navigator.onLine;
    }

    updateOnlineStatus();
    void loadSavedData().catch(() => {
      if (!initialData?.diary) {
        status = 'error';
      }
    });

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('click', handleTrackerLinkClick, { capture: true });

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('click', handleTrackerLinkClick, { capture: true });
    };
  });
</script>

<svelte:window onpopstate={updateFromCurrentUrl} />

<svelte:head>
  <title>
    {activeView === 'amount'
      ? `Add ${amountFood?.name ?? 'food'}`
      : activeView === 'foods'
        ? 'Add food'
        : `${dateLabel || 'Diary'}`} | Calorie Tracker
  </title>
  <meta
    name="description"
    content="Personal calorie and macro tracker for fast food logging."
  />
</svelte:head>

<div
  data-sveltekit-preload-data="off"
  data-sveltekit-preload-code="off"
  class="contents"
>
  {#if status === 'loading' && !boot.canRender}
    <main
      class="flex min-h-dvh items-center justify-center bg-[var(--app-canvas)] px-6
        text-[var(--app-text)]"
    >
      <p role="status" class="text-sm font-semibold text-[var(--app-muted)]">
        Opening tracker…
      </p>
    </main>
  {:else if (status === 'ready' || boot.canRender) && (diary !== null || activeView === 'foods' || activeView === 'amount')}
    {#if activeView === 'diary' && diary !== null}
      {@const previousHref = diaryDateHref(previousDate)}
      {@const nextHref = diaryDateHref(nextDate)}
      <main class="min-h-dvh bg-[var(--app-canvas)] text-[var(--app-text)] sm:py-5 lg:p-7">
        <div
          class="mx-auto min-h-dvh w-full max-w-[430px] bg-[var(--app-diary-surface)] px-4 pb-12
            pt-[calc(1.125rem+env(safe-area-inset-top))] sm:min-h-[calc(100dvh-40px)]
            sm:rounded-[26px] sm:shadow-[0_18px_55px_rgba(24,33,47,0.1)]
            lg:min-h-[calc(100dvh-56px)] lg:max-w-[1180px] lg:rounded-[28px]
            lg:px-[30px] lg:pb-[38px] xl:max-w-[1260px] xl:px-10"
        >
          <nav
            aria-label="Diary date"
            class="mb-[22px] grid grid-cols-[44px_1fr_44px_44px] items-center gap-1.5
              lg:mb-[30px] lg:grid-cols-[44px_minmax(180px,1fr)_44px_44px]"
          >
            {#if previousHref !== null}
              <a
                href={previousHref}
                aria-label={isOffline ? 'Previous saved day' : 'Previous day'}
                class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-text)]
                  transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
              >
                <ChevronLeftIcon class="size-[21px]" />
              </a>
            {:else}
              <span
                aria-label="No earlier diary is saved offline"
                aria-disabled="true"
                class="inline-flex size-11 items-center justify-center text-[var(--app-muted)] opacity-35"
              >
                <ChevronLeftIcon class="size-[21px]" />
              </span>
            {/if}

            <a
              href={resolve(withQuery('/', { date: todayInDublin() }))}
              aria-label="Go to today"
              class="min-w-[116px] justify-self-center rounded-full bg-[var(--app-panel)] px-6 py-[9px]
                text-center text-[14px] font-bold leading-none text-[var(--app-text)] no-underline
                focus-visible:outline-3 focus-visible:outline-offset-2
                focus-visible:outline-[var(--app-accent)]/30 lg:min-w-[150px]"
            >
              {dateLabel}
            </a>

            {#if isOffline}
              <span
                aria-label="Settings are available when online"
                aria-disabled="true"
                title="Available when online"
                class="inline-flex size-11 cursor-not-allowed items-center justify-center rounded-full
                  text-[var(--app-muted)] opacity-45"
              >
                <SettingsIcon class="size-[21px]" />
              </span>
            {:else}
              <a
                href={resolve('/settings')}
                class="inline-flex size-11 items-center justify-center rounded-full
                  text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
                aria-label="Open settings"
                title="Settings"
              >
                <SettingsIcon class="size-[21px]" />
              </a>
            {/if}

            {#if nextHref !== null}
              <a
                href={nextHref}
                aria-label={isOffline ? 'Next saved day' : 'Next day'}
                class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-text)]
                  transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
              >
                <ChevronRightIcon class="size-[21px]" />
              </a>
            {:else}
              <span
                aria-label="No later diary is saved offline"
                aria-disabled="true"
                class="inline-flex size-11 items-center justify-center text-[var(--app-muted)] opacity-35"
              >
                <ChevronRightIcon class="size-[21px]" />
              </span>
            {/if}
          </nav>

          {#if isOffline}
            <FeedbackBanner
              class="mb-5"
              message={offlineCapabilityMessage}
              tone="neutral"
            />
          {/if}

          <DiaryDayView
            {diary}
            {shortcutEligibility}
            actions={{
              entryHref,
              addFoodHref,
              saveShortcutHref
            }}
          />
        </div>
      </main>
    {:else if activeView === 'foods'}
      <AppPageShell
        class="flex flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-8 sm:pb-8 sm:pt-0 lg:px-10"
        size="wide"
      >
        <BackPageHeader
          href={resolve(withQuery('/', { date: selectedDate }))}
          backLabel="Back to diary"
          title="Add food"
          description={`${mealNames[destinationMealSlot]} · ${selectedDate === todayInDublin() ? 'Today' : formatDate(selectedDate, { year: false })}`}
          class="flex items-start gap-3 pt-4 sm:pt-7 lg:pt-8"
          linkClass="inline-flex size-11 shrink-0 items-center justify-start rounded-xl text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          titleClass="text-[19px] leading-6 font-bold tracking-[-0.02em]"
          descriptionClass="mt-0.5 truncate text-xs leading-4 font-medium text-[var(--app-muted)]"
          contentClass="min-w-0"
        />

        {#if isOffline}
          <FeedbackBanner
            class="mt-4"
            message={offlineCapabilityMessage}
            tone="neutral"
          />
        {/if}

        {#if queueError !== null}
          <FeedbackBanner class="mt-4" message={queueError} tone="danger" />
        {/if}

        <div class="sm:mt-2 sm:grid sm:grid-cols-[minmax(0,1fr)_300px] sm:gap-4">
          <div role="search" class="mt-3 sm:mt-0">
            <div class="flex items-center gap-2">
              <div class="relative min-w-0 flex-1">
                <label for="catalogue-search" class="sr-only">Search foods</label>
                <SearchIcon
                  class="pointer-events-none absolute top-1/2 left-3.5 size-[18px]
                    -translate-y-1/2 text-[var(--app-muted)]"
                />
                <input
                  id="catalogue-search"
                  type="search"
                  value={foodQuery}
                  oninput={handleSearchInput}
                  placeholder="Search foods"
                  autocomplete="off"
                  class="!min-h-12 !rounded-xl !border-[var(--app-border)] !bg-[var(--app-panel)]
                    !pr-10 !pl-10 !text-sm !shadow-none placeholder:!text-[var(--app-muted)]
                    focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
                />
                {#if foodQuery}
                  <button
                    type="button"
                    aria-label="Clear search"
                    onclick={clearFoodSearch}
                    class="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2
                      items-center justify-center rounded-lg text-[var(--app-muted)]
                      transition hover:bg-[var(--app-panel-hover)]"
                  >
                    <CloseIcon class="size-4" />
                  </button>
                {/if}
              </div>
              <button
                type="button"
                disabled={isOffline}
                onclick={() => (scannerOpen = true)}
                aria-label={isOffline ? 'Barcode scanner is available when online' : 'Scan a barcode'}
                title={isOffline ? 'Available when online' : 'Scan a barcode'}
                class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl
                  bg-[var(--app-action)] text-white shadow-sm transition
                  hover:bg-[var(--app-action-hover)] focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]
                  disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BarcodeIcon class="size-5" />
              </button>
            </div>
          </div>

          <div
            class="mt-3 grid min-h-11 grid-cols-2 rounded-full bg-[var(--app-panel)] p-1
              sm:mt-0 sm:min-h-12"
            role="group"
            aria-label="Add food type"
          >
            <span
              class="flex items-center justify-center rounded-full bg-[var(--app-accent)]
                px-4 text-sm font-semibold text-white shadow-sm"
            >
              Foods
            </span>
            <span
              aria-disabled="true"
              title="Available when online"
              class="flex cursor-not-allowed items-center justify-center rounded-full px-4
                text-sm font-semibold text-[var(--app-muted)] opacity-50"
            >
              Meal shortcuts
            </span>
          </div>
        </div>

        {#if !foodsCatalogueReady}
          <p
            role="status"
            class="mt-8 text-center text-sm font-semibold text-[var(--app-muted)]"
          >
            Loading foods…
          </p>
        {:else}
          <FoodResultList
            foods={foodResults}
            activeQuery={foodQuery.trim()}
            mealSlot={destinationMealSlot}
            emptyQueryMessage="No saved foods match this search."
            emptyCatalogueMessage="No foods are saved on this device yet."
            actions={{
              foodHref,
              editHref: editFoodHref,
              quickAdd,
              pendingFoodId
            }}
          />
        {/if}

        <div
          class="sticky bottom-0 mt-8 bg-gradient-to-t from-[var(--app-surface)]
            via-[var(--app-surface)] via-80% to-transparent pt-5 sm:flex sm:justify-end"
        >
          {#if isOffline}
            <button
              type="button"
              disabled
              title="Available when online"
              class="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center
                rounded-xl bg-[var(--app-action)] px-5 text-sm font-bold text-white opacity-40
                sm:w-auto sm:min-w-[260px]"
            >
              <span aria-hidden="true" class="mr-1.5 text-base leading-none">+</span>
              Create a custom food
            </button>
          {:else}
            <a
              href={resolve(
                withQuery('/foods/new', {
                  date: selectedDate,
                  mealSlot: destinationMealSlot
                })
              )}
              class="inline-flex min-h-12 w-full items-center justify-center rounded-xl
                bg-[var(--app-action)] px-5 text-sm font-bold text-white shadow-sm transition
                hover:bg-[var(--app-action-hover)] focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]
                sm:w-auto sm:min-w-[260px]"
            >
              <span aria-hidden="true" class="mr-1.5 text-base leading-none">+</span>
              Create a custom food
            </a>
          {/if}
        </div>
      </AppPageShell>
    {:else if activeView === 'amount' && amountFood !== null && amountValues !== null}
      {#key amountFoodId}
        <AmountAdjuster
          food={amountFood}
          context={{
            date: selectedDate,
            mealSlot: destinationMealSlot,
            q: foodQuery
          }}
          portionOptions={portionOptionsForFood(amountFood)}
          initialValues={amountValues}
          errors={amountErrors}
          enhanceSubmit={enhanceOfflineLog}
          editFoodHref={editFoodHref(amountFood.id)}
        />
      {/key}
    {:else}
      <main
        class="flex min-h-dvh items-center justify-center bg-[var(--app-canvas)] px-6
          text-[var(--app-text)]"
      >
        <section class="w-full max-w-sm text-center">
          <h1 class="text-xl font-bold">Saved view unavailable</h1>
          <p class="mt-2 text-sm text-[var(--app-muted)]">
            Return to a diary date saved on this device.
          </p>
          <a
            href={resolve('/')}
            class="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[var(--app-accent)]
              px-5 text-sm font-bold text-white no-underline"
          >Open diary</a>
        </section>
      </main>
    {/if}
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
          {status === 'error'
            ? 'Saved data could not be opened on this device.'
            : 'Loading tracker data…'}
        </p>
      </section>
    </main>
  {/if}
</div>

{#if scannerOpen}
  <BarcodeScanner
    onscan={(barcode) => {
      scannerOpen = false;
      foodQuery = barcode;
      replaceState(resolve(withQuery('/foods', { date: selectedDate, mealSlot: destinationMealSlot, barcode })), {});
    }}
    onclose={() => (scannerOpen = false)}
  />
{/if}
