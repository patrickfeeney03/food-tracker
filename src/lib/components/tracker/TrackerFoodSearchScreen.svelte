<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- coordinator supplies resolved hrefs */
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import BackPageHeader from '$lib/components/BackPageHeader.svelte';
  import FeedbackBanner from '$lib/components/FeedbackBanner.svelte';
  import FoodResultList, {
    type FoodResultListActions,
    type FoodResultView
  } from '$lib/components/foods/FoodResultList.svelte';
  import MealShortcutResultList from '$lib/components/meal-shortcuts/MealShortcutResultList.svelte';
  import type { MealShortcutResult } from '$lib/components/meal-shortcuts/types';
  import BarcodeIcon from '$lib/components/icons/BarcodeIcon.svelte';
  import CloseIcon from '$lib/components/icons/CloseIcon.svelte';
  import SearchIcon from '$lib/components/icons/SearchIcon.svelte';
  import { todayInDublin } from '$lib/date';
  import { mealNames, type MealSlot } from '$lib/nutrition/constants';
  import { formatDate } from '$lib/nutrition/format';
  import type { ResolvedPathname } from '$app/types';

  type CatalogueTab = 'foods' | 'shortcuts';

  let {
    selectedDate,
    destinationMealSlot,
    isOffline,
    foodQuery,
    queueError,
    created,
    shortcutArchived,
    activeTab,
    foodsTabHref,
    shortcutsTabHref,
    foodsCatalogueReady,
    foodResults,
    shortcutsReady,
    shortcutResults,
    offlineCapabilityMessage,
    backHref,
    clearHref,
    createFoodHref,
    onSearchInput,
    onOpenScanner,
    onBack,
    actions,
    editShortcutHref,
    applyShortcutHref
  }: {
    selectedDate: string;
    destinationMealSlot: MealSlot;
    isOffline: boolean;
    foodQuery: string;
    queueError: string | null;
    created: boolean;
    shortcutArchived: boolean;
    activeTab: CatalogueTab;
    foodsTabHref: string;
    shortcutsTabHref: string;
    foodsCatalogueReady: boolean;
    foodResults: FoodResultView[];
    shortcutsReady: boolean;
    shortcutResults: MealShortcutResult[];
    offlineCapabilityMessage: string;
    backHref: ResolvedPathname;
    clearHref: string;
    createFoodHref: string;
    onSearchInput: (value: string) => void;
    onOpenScanner: () => void;
    onBack?: (event: MouseEvent) => void;
    actions: FoodResultListActions;
    editShortcutHref: (shortcutId: string) => string | null;
    applyShortcutHref: (shortcutId: string) => string | null;
  } = $props();

  let searchLabel = $derived(
    activeTab === 'shortcuts' ? 'Search meal shortcuts' : 'Search foods'
  );
  const selectedTabClass =
    'flex w-full items-center justify-center rounded-full bg-[var(--app-accent)] px-4 text-sm font-semibold text-white shadow-sm';
  const idleTabClass =
    'flex w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--app-muted)] no-underline transition hover:text-[var(--app-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]';
  const disabledTabClass =
    'flex w-full cursor-not-allowed items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--app-muted)] opacity-50';

  let isComposingSearch = $state(false);

  function handleSearchInput(event: Event): void {
    if (isComposingSearch) {
      return;
    }

    onSearchInput((event.currentTarget as HTMLInputElement).value);
  }

  function finishSearchComposition(event: CompositionEvent): void {
    isComposingSearch = false;
    onSearchInput((event.currentTarget as HTMLInputElement).value);
  }
</script>

<AppPageShell
  class="flex flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-8 sm:pb-8 sm:pt-0 lg:px-10"
  size="wide"
>
  <BackPageHeader
    href={backHref}
    onclick={onBack}
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

  {#if created && activeTab === 'foods'}
    <FeedbackBanner
      class="mt-4"
      message={`Food created and added to ${mealNames[destinationMealSlot].toLowerCase()}.`}
    />
  {/if}

  {#if shortcutArchived && activeTab === 'shortcuts'}
    <FeedbackBanner class="mt-4" message="Meal shortcut archived." />
  {/if}

  <div class="sm:mt-2 sm:grid sm:grid-cols-[minmax(0,1fr)_300px] sm:gap-4">
    <div role="search" class="mt-3 sm:mt-0">
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <label for="catalogue-search" class="sr-only">{searchLabel}</label>
          <SearchIcon
            class="pointer-events-none absolute top-1/2 left-3.5 size-[18px]
              -translate-y-1/2 text-[var(--app-muted)]"
          />
          <input
            id="catalogue-search"
            type="search"
            value={foodQuery}
            oninput={handleSearchInput}
            oncompositionstart={() => (isComposingSearch = true)}
            oncompositionend={finishSearchComposition}
            placeholder={searchLabel}
            autocomplete="off"
            class="w-full !min-h-12 !rounded-xl !border-[var(--app-border)] !bg-[var(--app-panel)]
              !pr-10 !pl-10 !text-sm !shadow-none placeholder:!text-[var(--app-muted)]
              focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15
              [&::-webkit-search-cancel-button]:hidden"
          />
          {#if foodQuery}
            <a
              href={clearHref}
              aria-label="Clear search"
              class="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2
                items-center justify-center rounded-lg text-[var(--app-muted)]
                transition hover:bg-[var(--app-panel-hover)]"
            >
              <CloseIcon class="size-4" />
            </a>
          {/if}
        </div>
        {#if activeTab === 'foods'}
          <button
            type="button"
            disabled={isOffline}
            onclick={onOpenScanner}
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
        {/if}
      </div>
    </div>

    <div
      class="mt-3 grid min-h-11 grid-cols-2 rounded-full bg-[var(--app-panel)] p-1
        sm:mt-0 sm:min-h-12"
      role="group"
      aria-label="Add food type"
    >
      {#if activeTab === 'foods'}
        <span class={selectedTabClass}>Foods</span>
      {:else}
        <a href={foodsTabHref} class={idleTabClass}>Foods</a>
      {/if}
      {#if isOffline && activeTab !== 'shortcuts'}
        <span
          aria-disabled="true"
          title="Available when online"
          class={disabledTabClass}
        >
          Meal shortcuts
        </span>
      {:else if activeTab === 'shortcuts'}
        <span class={selectedTabClass}>Meal shortcuts</span>
      {:else}
        <a href={shortcutsTabHref} class={idleTabClass}>Meal shortcuts</a>
      {/if}
    </div>
  </div>

  {#if activeTab === 'shortcuts'}
    {#if isOffline}
      <p
        role="status"
        class="mt-8 text-center text-sm font-semibold text-[var(--app-muted)]"
      >
        Meal shortcuts are available when online.
      </p>
    {:else if !shortcutsReady}
      <p
        role="status"
        class="mt-8 text-center text-sm font-semibold text-[var(--app-muted)]"
      >
        Loading meal shortcuts…
      </p>
    {:else}
      <MealShortcutResultList
        shortcuts={shortcutResults}
        activeQuery={foodQuery.trim()}
        {selectedDate}
        mealSlot={destinationMealSlot}
        editHref={editShortcutHref}
        applyHref={applyShortcutHref}
      />
    {/if}
  {:else if !foodsCatalogueReady}
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
      actions={actions}
    />
  {/if}

  {#if activeTab === 'foods'}
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
          href={createFoodHref}
          data-sveltekit-replacestate
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
  {/if}
</AppPageShell>
