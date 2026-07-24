<script lang="ts">
  import { enhance } from "$app/forms";
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BarcodeScanner from "$lib/components/BarcodeScanner.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BarcodeIcon from "$lib/components/icons/BarcodeIcon.svelte";
  import CloseIcon from "$lib/components/icons/CloseIcon.svelte";
  import SearchIcon from "$lib/components/icons/SearchIcon.svelte";
  import { withQuery } from "$lib/navigation";
  import { mealNames } from "$lib/nutrition/constants";
  import { formatAmount, formatDate, formatKcal } from "$lib/nutrition/format";
  import { inputLimits } from "$lib/nutrition/input-limits";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { onDestroy, untrack } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { PageProps } from "./$types";

  const searchDebounceMs = 150;

  let { data, form }: PageProps = $props();
  let scannerOpen = $state(false);
  let pendingShortcutId = $state<string | null>(null);
  let pendingFoodId = $state<string | null>(null);
  let searchQuery = $state(untrack(() => data.query));
  let searchTimeout: ReturnType<typeof setTimeout> | undefined;
  const inFlightSearchCountsByQuery = new SvelteMap<string, number>();

  afterNavigate(({ type }) => {
    if (type !== "goto" || !inFlightSearchCountsByQuery.has(data.query)) {
      clearTimeout(searchTimeout);
      searchQuery = data.query;
    }
  });

  function runSearch() {
    const query = searchQuery.trim();
    if (query === data.query && inFlightSearchCountsByQuery.size === 0) {
      return;
    }

    const path = withQuery("/foods", {
      date: data.destination.date,
      mealSlot: data.destination.mealSlot,
      tab: data.tab,
      q: query || undefined,
    });
    inFlightSearchCountsByQuery.set(
      query,
      (inFlightSearchCountsByQuery.get(query) ?? 0) + 1,
    );
    void goto(resolve(path), {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    }).finally(() => {
      const pendingCount = inFlightSearchCountsByQuery.get(query);
      if (pendingCount === 1) {
        inFlightSearchCountsByQuery.delete(query);
      } else if (pendingCount !== undefined) {
        inFlightSearchCountsByQuery.set(query, pendingCount - 1);
      }
    });
  }

  function scheduleSearch(event: Event) {
    searchQuery = (event.currentTarget as HTMLInputElement).value;
    clearTimeout(searchTimeout);

    if (!(event as InputEvent).isComposing) {
      searchTimeout = setTimeout(runSearch, searchDebounceMs);
    }
  }

  onDestroy(() => clearTimeout(searchTimeout));

  function formatDiaryDate(date: string): string {
    return formatDate(date, { year: false });
  }

  function handleBarcode(barcode: string) {
    scannerOpen = false;
    void goto(
      resolve(
        withQuery("/foods", {
          date: data.destination.date,
          mealSlot: data.destination.mealSlot,
          barcode,
        }),
      ),
    );
  }

  function enhanceShortcutApply(shortcutId: string): SubmitFunction {
    return () => {
      pendingShortcutId = shortcutId;

      return async ({ update }) => {
        await update();
        pendingShortcutId = null;
      };
    };
  }

  function enhanceQuickAdd(foodId: string): SubmitFunction {
    return () => {
      pendingFoodId = foodId;

      return async ({ update }) => {
        await update();
        pendingFoodId = null;
      };
    };
  }

  function blockedShortcutMessage(count: number): string {
    return `${count} archived or unavailable ${count === 1 ? "food" : "foods"}`;
  }
</script>

<svelte:head>
  <title>Add food | Calorie Tracker</title>
</svelte:head>

<AppPageShell
  class="flex flex-col overflow-hidden px-4 pb-4 sm:px-8 sm:pb-8 lg:px-10"
  size="wide"
>
    <BackPageHeader
      href={resolve(withQuery("/", { date: data.destination.date }))}
      backLabel="Back to diary"
      title="Add food"
      description={`${mealNames[data.destination.mealSlot]} · ${data.isToday ? "Today" : formatDiaryDate(data.destination.date)}`}
      class="flex items-start gap-3 pt-4 sm:pt-7 lg:pt-8"
      linkClass="inline-flex size-11 shrink-0 items-center justify-start rounded-xl text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
      titleClass="text-[19px] leading-6 font-bold tracking-[-0.02em]"
      descriptionClass="mt-0.5 truncate text-xs leading-4 font-medium text-[var(--app-muted)]"
      contentClass="min-w-0"
    />

    {#if data.query === "" && data.tab === "foods" && data.foods.length > 0}
      <p class="sr-only" aria-live="polite">
        Showing {data.foods.length} foods
      </p>
    {:else if data.query === "" && data.tab === "shortcuts" && data.shortcuts.length > 0}
      <p class="sr-only" aria-live="polite">
        Showing {data.shortcuts.length} meal shortcuts
      </p>
    {/if}

    <div class="sm:mt-2 sm:grid sm:grid-cols-[minmax(0,1fr)_300px] sm:gap-4">
      <form
        method="GET"
        action={resolve("/foods")}
        role="search"
        class="mt-3 sm:mt-0"
      >
        <input type="hidden" name="date" value={data.destination.date} />
        <input
          type="hidden"
          name="mealSlot"
          value={data.destination.mealSlot}
        />
        <input type="hidden" name="tab" value={data.tab} />

        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <label for="catalogue-search" class="sr-only">
              {data.tab === "shortcuts" ? "Search meal shortcuts" : "Search foods"}
            </label>
            <SearchIcon class="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[var(--app-muted)]" />
            <input
              id="catalogue-search"
              name="q"
              type="search"
              value={searchQuery}
              oninput={scheduleSearch}
              oncompositionend={scheduleSearch}
              placeholder={data.tab === "shortcuts" ? "Search shortcuts" : "Search foods"}
              maxlength={inputLimits.catalogueQuery.maxLength}
              autocomplete="off"
              class="!min-h-12 !rounded-xl !border-[var(--app-border)] !bg-[var(--app-panel)] !pr-10 !pl-10 !text-sm !shadow-none placeholder:!text-[var(--app-muted)] focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            />

            {#if data.query}
              <a
                href={resolve(
                  withQuery("/foods", {
                    date: data.destination.date,
                    mealSlot: data.destination.mealSlot,
                    tab: data.tab,
                  }),
                )}
                aria-label="Clear search"
                class="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--app-muted)] transition hover:bg-[var(--app-panel-hover)] hover:text-[var(--app-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--app-accent)]"
              >
                <CloseIcon class="size-4" />
              </a>
            {/if}
          </div>

          {#if data.tab === "foods"}
            <button
              type="button"
              onclick={() => (scannerOpen = true)}
              aria-label="Scan a barcode"
              title="Scan a barcode"
              class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl
                bg-[var(--app-action)] text-white shadow-sm transition
                hover:bg-[var(--app-action-hover)] focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
            >
              <BarcodeIcon class="size-5" />
            </button>
          {/if}
        </div>

        <button type="submit" class="sr-only">Search</button>
      </form>

      <div
        class="mt-3 grid min-h-11 grid-cols-2 rounded-full bg-[var(--app-panel)] p-1 sm:mt-0 sm:min-h-12"
        role="tablist"
        aria-label="Add food type"
      >
        <a
          href={resolve(
            withQuery("/foods", {
              date: data.destination.date,
              mealSlot: data.destination.mealSlot,
              q: data.query || undefined,
              tab: "foods",
            }),
          )}
          role="tab"
          aria-selected={data.tab === "foods"}
          class={[
            "flex items-center justify-center rounded-full px-4 text-sm font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-text)]",
            data.tab === "foods"
              ? "bg-[var(--app-accent)] text-white shadow-sm"
              : "text-[var(--app-muted)]",
          ]}
        >
          Foods
        </a>
        <a
          href={resolve(
            withQuery("/foods", {
              date: data.destination.date,
              mealSlot: data.destination.mealSlot,
              q: data.query || undefined,
              tab: "shortcuts",
            }),
          )}
          role="tab"
          aria-selected={data.tab === "shortcuts"}
          class={[
            "flex items-center justify-center rounded-full px-4 text-sm font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-text)]",
            data.tab === "shortcuts"
              ? "bg-[var(--app-accent)] text-white shadow-sm"
              : "text-[var(--app-muted)]",
          ]}
        >
          Meal shortcuts
        </a>
      </div>
    </div>

    {#if form?.quickAddError}
      <FeedbackBanner class="mt-4" message={form.quickAddError} tone="danger" />
    {:else if form?.applyError}
      <FeedbackBanner class="mt-4" message={form.applyError} tone="danger" />
    {:else if data.quickAddFeedback?.kind === "added"}
      {@const quickAdded = data.quickAddFeedback}
      {#snippet undoQuickAddAction()}
        <form method="POST" action="?/undoQuickAdd">
          <input type="hidden" name="entryId" value={quickAdded.entryId} />
          <input type="hidden" name="diaryDate" value={data.destination.date} />
          <input type="hidden" name="mealSlot" value={data.destination.mealSlot} />
          <button
            type="submit"
            class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
              text-[var(--app-success-text)] underline underline-offset-2
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)]"
          >Undo</button>
        </form>
      {/snippet}
      <FeedbackBanner
        class="mt-4"
        message={`${formatAmount(quickAdded.resolvedAmount, quickAdded.amountUnit)} of ${quickAdded.foodName} added to ${mealNames[data.destination.mealSlot].toLowerCase()}.`}
        action={undoQuickAddAction}
      />
    {:else if data.quickAddFeedback?.kind === "undone"}
      <FeedbackBanner
        class="mt-4"
        message={`${data.quickAddFeedback.foodName} was removed from ${mealNames[data.destination.mealSlot].toLowerCase()}.`}
      />
    {:else if data.added}
      <FeedbackBanner
        class="mt-4"
        message={`Food added to ${mealNames[data.destination.mealSlot].toLowerCase()}.`}
      />
    {:else if data.created}
      <FeedbackBanner
        class="mt-4"
        message={`Food created and added to ${mealNames[data.destination.mealSlot].toLowerCase()}.`}
      />
    {:else if data.saved}
      <FeedbackBanner class="mt-4" message="Food changes saved." />
    {:else if data.archived}
      <FeedbackBanner class="mt-4" message="Food archived. Existing diary entries were kept." />
    {:else if data.shortcutArchived}
      <FeedbackBanner
        class="mt-4"
        message="Meal shortcut archived. Existing diary entries were kept."
      />
    {/if}

    {#if data.scannedBarcode}
      <div
        role="status"
        class="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-accent-soft)]
          px-3 py-2.5 text-sm font-medium text-[var(--app-accent)]"
      >
        Barcode {data.scannedBarcode} matched a food in your catalogue.
      </div>
    {/if}

    {#if data.tab === "shortcuts"}
      <section aria-labelledby="shortcut-results" class="mt-5 flex-1">
        <h2
          id="shortcut-results"
          class="mb-2 px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[var(--app-muted)] uppercase"
        >
          {data.query ? "Search results" : "Meal shortcuts"}
        </h2>

        {#if data.shortcuts.length === 0}
          <div
            class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-8 text-center shadow-[0_1px_2px_rgba(23,32,51,0.03)]"
          >
            <h3 class="text-sm font-bold text-[var(--app-text)]">
              {data.query ? "No matching shortcuts" : "No meal shortcuts yet"}
            </h3>
            <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
              {data.query
                ? "Try another search or create a shortcut from this meal slot."
                : "Save the foods in this meal slot as a reusable shortcut."}
            </p>
          </div>
        {:else}
          <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each data.shortcuts as shortcut (shortcut.id)}
              <li>
                <article
                  class={[
                    "flex min-h-[62px] items-center gap-3 rounded-xl border bg-[var(--app-panel)] py-2 pr-2 pl-3 shadow-[0_1px_2px_rgba(23,32,51,0.025)]",
                    shortcut.blocked
                      ? "border-[var(--app-danger-border)]"
                      : "border-[var(--app-border)] transition hover:border-[var(--app-border-strong)] hover:shadow-sm",
                  ]}
                >
                  <a
                    href={resolve(
                      withQuery(`/meal-shortcuts/${shortcut.id}/edit`, {
                        date: data.destination.date,
                        mealSlot: data.destination.mealSlot,
                        q: data.query || undefined,
                        tab: "shortcuts",
                      }),
                    )}
                    class="min-w-0 flex-1 rounded-lg py-1 text-[var(--app-text)] no-underline
                      focus-visible:outline-2 focus-visible:outline-offset-2
                      focus-visible:outline-[var(--app-accent)]"
                  >
                    <h3 class="truncate text-sm leading-5 font-bold tracking-[-0.01em]">
                      {shortcut.name}
                    </h3>
                    <p
                      class={[
                        "truncate text-[11px] leading-4 font-medium",
                        shortcut.blocked
                          ? "text-[var(--app-danger-text)]"
                          : "text-[var(--app-muted)]",
                      ]}
                    >
                      {#if shortcut.blocked}
                        Blocked: {blockedShortcutMessage(shortcut.blockedItems.length)}
                      {:else}
                        {shortcut.itemCount} {shortcut.itemCount === 1 ? "ingredient" : "ingredients"}
                        · {formatKcal(shortcut.totals?.energyMkcal ?? 0)} kcal
                      {/if}
                    </p>
                  </a>

                  {#if shortcut.blocked}
                    <span class="shrink-0 px-2 text-xs font-bold text-[var(--app-danger-text)]">
                      Fix →
                    </span>
                  {:else}
                    <form
                      method="POST"
                      action="?/applyShortcut"
                      use:enhance={enhanceShortcutApply(shortcut.id)}
                      class="shrink-0"
                    >
                      <input type="hidden" name="shortcutId" value={shortcut.id} />
                      <input type="hidden" name="clientMutationId" value={shortcut.clientMutationId} />
                      <input type="hidden" name="diaryDate" value={data.destination.date} />
                      <input type="hidden" name="mealSlot" value={data.destination.mealSlot} />
                      <button
                        type="submit"
                        disabled={pendingShortcutId !== null}
                        aria-label={`Add ${shortcut.name} to ${mealNames[data.destination.mealSlot].toLowerCase()}`}
                        aria-busy={pendingShortcutId === shortcut.id}
                        class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-accent)]
                          focus-visible:outline-2 focus-visible:outline-offset-1
                          focus-visible:outline-[var(--app-accent)] disabled:opacity-50"
                      >
                        <span
                          aria-hidden="true"
                          class="flex size-8 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xl leading-none font-medium"
                        >{pendingShortcutId === shortcut.id ? "…" : "+"}</span>
                      </button>
                    </form>
                  {/if}
                </article>
              </li>
            {/each}
          </ul>
          <p class="mt-4 px-0.5 text-[11px] leading-4 text-[var(--app-muted)]">
            Adding a shortcut creates separate diary entries in this meal slot.
          </p>
        {/if}
      </section>
    {:else}
      <section aria-labelledby="food-results" class="mt-5 flex-1">
      <h2
        id="food-results"
        class="mb-2 px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[var(--app-muted)] uppercase"
      >
        {data.query ? "Search results" : "Recent foods"}
      </h2>

      {#if data.foods.length === 0}
        <div
          class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-8 text-center shadow-[0_1px_2px_rgba(23,32,51,0.03)]"
        >
          <div
            class="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
          >
            <SearchIcon class="size-5" />
          </div>
          <h3 class="mt-3 text-sm font-bold text-[var(--app-text)]">
            {data.query ? "No matching foods" : "No foods yet"}
          </h3>
          <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
            {data.query
              ? `Try another search or create “${data.query}” as a custom food.`
              : "Create your first custom food to start building your catalogue."}
          </p>
        </div>
      {:else}
        <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {#each data.foods as food (food.id)}
            <li>
              <article
                class="flex min-h-[62px] items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] py-2 pr-2 pl-3 shadow-[0_1px_2px_rgba(23,32,51,0.025)] transition hover:border-[var(--app-border-strong)] hover:shadow-sm"
              >
                <a
                  href={resolve(
                    withQuery(`/foods/${food.id}/log`, {
                      date: data.destination.date,
                      mealSlot: data.destination.mealSlot,
                      q: data.query || undefined,
                    }),
                  )}
                  class="min-w-0 flex-1 rounded-lg py-1 text-[var(--app-text)] no-underline
                    focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-[var(--app-accent)]"
                  aria-label={`Add ${food.name} to ${mealNames[data.destination.mealSlot].toLowerCase()}`}
                >
                  <h3
                    class="truncate text-sm leading-5 font-bold tracking-[-0.01em] text-[var(--app-text)]"
                  >
                    {food.name}
                  </h3>
                  <p
                    class="truncate text-[11px] leading-4 font-medium text-[var(--app-muted)]"
                  >
                    {#if food.latestUse}
                      Last:
                      {formatAmount(
                        food.latestUse.resolvedAmount,
                        food.latestUse.amountUnit,
                      )}
                      · {formatKcal(food.latestUse.energyMkcal)} kcal
                    {:else}
                      {food.brand ? `${food.brand} · ` : ""}
                      {formatKcal(food.energyMkcalPerBasis)} kcal per
                      {formatAmount(food.basisAmount, food.amountUnit)}
                    {/if}
                  </p>
                </a>

                <div class="flex shrink-0 items-center gap-1">
                  <a
                    href={resolve(withQuery(`/foods/${food.id}/edit`, {
                      date: data.destination.date,
                      mealSlot: data.destination.mealSlot,
                      q: data.query || undefined,
                    }))}
                    aria-label={`Edit ${food.name}`}
                    class="inline-flex min-h-11 items-center justify-center rounded-lg px-2
                      text-xs font-bold text-[var(--app-muted)] transition
                      hover:bg-[var(--app-panel-hover)] hover:text-[var(--app-text)]
                      focus-visible:outline-2 focus-visible:outline-offset-1
                      focus-visible:outline-[var(--app-accent)]"
                  >Edit</a>

                  {#if food.quickAddMutationId !== null}
                    <form
                      method="POST"
                      action="?/quickAdd"
                      use:enhance={enhanceQuickAdd(food.id)}
                    >
                      <input type="hidden" name="foodId" value={food.id} />
                      <input
                        type="hidden"
                        name="clientMutationId"
                        value={food.quickAddMutationId}
                      />
                      <input type="hidden" name="diaryDate" value={data.destination.date} />
                      <input type="hidden" name="mealSlot" value={data.destination.mealSlot} />
                      <button
                        type="submit"
                        disabled={pendingFoodId !== null}
                        aria-label={`Quick add ${food.name} to ${mealNames[data.destination.mealSlot].toLowerCase()} using the last amount`}
                        aria-busy={pendingFoodId === food.id}
                        class="inline-flex size-11 shrink-0 items-center justify-center rounded-full
                          text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-1
                          focus-visible:outline-[var(--app-accent)] disabled:opacity-50"
                      >
                        <span
                          aria-hidden="true"
                          class="flex size-8 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xl leading-none font-medium"
                        >{pendingFoodId === food.id ? "…" : "+"}</span>
                      </button>
                    </form>
                  {:else}
                    <a
                      href={resolve(
                        withQuery(`/foods/${food.id}/log`, {
                          date: data.destination.date,
                          mealSlot: data.destination.mealSlot,
                          q: data.query || undefined,
                        }),
                      )}
                      aria-label={`Choose an amount for ${food.name}`}
                      class="inline-flex size-11 shrink-0 items-center justify-center rounded-full
                        text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-1
                        focus-visible:outline-[var(--app-accent)]"
                    >
                      <span
                        aria-hidden="true"
                        class="flex size-8 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xl leading-none font-medium"
                      >+</span>
                    </a>
                  {/if}
                </div>
              </article>
            </li>
          {/each}
        </ul>

        <p class="mt-4 px-0.5 text-[11px] leading-4 text-[var(--app-muted)]">
          Your most recent amount is shown below each food.
        </p>
      {/if}
    </section>
    {/if}

    <div
      class="sticky bottom-0 mt-8 bg-gradient-to-t from-[var(--app-surface)] via-[var(--app-surface)] via-80% to-transparent pt-5 sm:flex sm:justify-end"
    >
      {#if data.tab === "shortcuts" && !data.shortcutSourceAvailable}
        <div class="w-full sm:w-auto">
          <button
            type="button"
            disabled
            class="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-[var(--app-action)] px-5 text-sm font-bold text-white opacity-50 shadow-sm sm:min-w-[260px]"
          >
            <span aria-hidden="true" class="mr-1.5 text-base leading-none">+</span>
            Create meal shortcut
          </button>
          <p class="mt-2 text-center text-xs text-[var(--app-muted)]">
            Log a food in this meal first.
          </p>
        </div>
      {:else}
        <a
          href={data.tab === "shortcuts"
            ? resolve(
                withQuery("/meal-shortcuts/new", {
                  date: data.destination.date,
                  mealSlot: data.destination.mealSlot,
                  q: data.query || undefined,
                  tab: "shortcuts",
                }),
              )
            : resolve(
                withQuery("/foods/new", {
                  date: data.destination.date,
                  mealSlot: data.destination.mealSlot,
                }),
              )}
          class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--app-action)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--app-action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] sm:w-auto sm:min-w-[260px]"
        >
          <span aria-hidden="true" class="mr-1.5 text-base leading-none">+</span>
          {data.tab === "shortcuts" ? "Create meal shortcut" : "Create a custom food"}
        </a>
      {/if}
    </div>
</AppPageShell>

{#if scannerOpen}
  <BarcodeScanner
    onscan={handleBarcode}
    onclose={() => (scannerOpen = false)}
  />
{/if}
