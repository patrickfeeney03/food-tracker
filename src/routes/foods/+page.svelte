<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import BarcodeScanner from "$lib/components/BarcodeScanner.svelte";
  import { withQuery } from "$lib/navigation";
  import type { MealSlot } from "$lib/nutrition/constants";
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  let scannerOpen = $state(false);

  const mealNames: Record<MealSlot, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snacks: "Snacks",
  };

  function formatKcal(value: number): string {
    return formatStoredValue(BigInt(value), 0);
  }

  function formatAmount(value: number, unit: "mg" | "ul"): string {
    const displayUnit = unit === "mg" ? "g" : "ml";

    return `${formatStoredValue(BigInt(value), 3)} ${displayUnit}`;
  }

  function formatDiaryDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);

    return new Intl.DateTimeFormat("en-IE", {
      day: "numeric",
      month: "short",
    }).format(new Date(Date.UTC(year, month - 1, day)));
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
</script>

<svelte:head>
  <title>Add food | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-[var(--app-surface)] px-4 pb-4 text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-[26px] sm:border sm:border-[var(--app-border)]/70 sm:px-8 sm:pb-8 sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)] lg:max-w-5xl lg:px-10"
  >
    <header
      class="grid grid-cols-[44px_1fr_44px] items-start pt-4 sm:pt-7 lg:pt-8"
    >
      <a
        href={resolve(withQuery("/", { date: data.destination.date }))}
        aria-label="Back to diary"
        class="inline-flex size-11 items-center justify-start rounded-xl text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </a>

      <div class="min-w-0 pt-1">
        <h1 class="text-[19px] leading-6 font-bold tracking-[-0.02em]">
          Add food
        </h1>
        <p class="truncate text-xs leading-4 font-medium text-[var(--app-muted)]">
          {mealNames[data.destination.mealSlot]} ·
          {data.isToday ? "Today" : formatDiaryDate(data.destination.date)}
        </p>
      </div>

      <span aria-hidden="true" class="size-11"></span>
    </header>

    {#if data.query === "" && data.foods.length > 0}
      <p class="sr-only" aria-live="polite">
        Showing {data.foods.length} foods
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

        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <label for="food-search" class="sr-only">Search foods</label>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[var(--app-muted)]"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-3.5-3.5"></path>
            </svg>
            <input
              id="food-search"
              name="q"
              type="search"
              value={data.query}
              placeholder="Search foods"
              maxlength="200"
              autocomplete="off"
              class="!min-h-12 !rounded-xl !border-[var(--app-border)] !bg-[var(--app-panel)] !pr-10 !pl-10 !text-sm !shadow-none placeholder:!text-[var(--app-muted)] focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            />

            {#if data.query}
              <a
                href={resolve(
                  withQuery("/foods", {
                    date: data.destination.date,
                    mealSlot: data.destination.mealSlot,
                  }),
                )}
                aria-label="Clear search"
                class="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--app-muted)] transition hover:bg-[var(--app-panel-hover)] hover:text-[var(--app-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--app-accent)]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <path d="m7 7 10 10M17 7 7 17"></path>
                </svg>
              </a>
            {/if}
          </div>

          <button
            type="button"
            onclick={() => (scannerOpen = true)}
            aria-label="Scan a barcode"
            title="Scan a barcode"
            class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#172033] text-white shadow-sm transition hover:bg-[#222d42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2867eb]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            >
              <path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14"></path>
            </svg>
          </button>
        </div>

        <button type="submit" class="sr-only">Search</button>
      </form>

      <div
        class="mt-3 grid min-h-11 grid-cols-2 rounded-full bg-[var(--app-panel)] p-1 sm:mt-0 sm:min-h-12"
        role="tablist"
        aria-label="Add food type"
      >
        <button
          type="button"
          role="tab"
          aria-selected="true"
          class="rounded-full bg-[var(--app-accent)] px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-text)]"
        >
          Foods
        </button>
        <button
          type="button"
          disabled
          role="tab"
          aria-selected="false"
          title="Meal shortcuts are not available yet"
          class="rounded-full px-4 text-sm font-semibold text-[var(--app-muted)]"
        >
          Meal shortcuts
        </button>
      </div>
    </div>

    {#if data.created}
      <div
        role="status"
        class="mt-4 rounded-xl border border-[var(--app-success-border)] bg-[var(--app-success-bg)] px-3 py-2.5 text-sm font-medium text-[var(--app-success-text)]"
      >
        Food created and added to {mealNames[
          data.destination.mealSlot
        ].toLowerCase()}.
      </div>
    {/if}

    {#if data.scannedBarcode}
      <div
        role="status"
        class="mt-4 rounded-xl border border-[#cddafb] bg-[#edf3ff] px-3 py-2.5 text-sm font-medium text-[#1f58cf]"
      >
        Barcode {data.scannedBarcode} matched a food in your catalogue.
      </div>
    {/if}

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
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-3.5-3.5"></path>
            </svg>
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
                <div class="min-w-0 flex-1">
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
                </div>

                <div class="flex shrink-0 items-center gap-1">
                  <a
                    href={resolve(withQuery(`/foods/${food.id}/edit`, {
                      date: data.destination.date,
                      mealSlot: data.destination.mealSlot,
                      q: data.query || undefined,
                    }))}
                    aria-label={`Edit ${food.name}`}
                    class="inline-flex min-h-11 items-center justify-center rounded-lg px-2
                      text-xs font-bold text-[#536176] transition hover:bg-[#f2f4f7]
                      hover:text-[#172033] focus-visible:outline-2 focus-visible:outline-offset-1
                      focus-visible:outline-[#2867eb]"
                  >Edit</a>

                  <button
                    type="button"
                    disabled
                    aria-label={`Add ${food.name}`}
                    title="Quick add is not available yet"
                    class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[#2867eb]"
                  >
                    <span
                      aria-hidden="true"
                      class="flex size-8 items-center justify-center rounded-full bg-[#edf3ff] text-xl leading-none font-medium"
                      >+</span
                    >
                  </button>
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

    <div
      class="sticky bottom-0 mt-8 bg-gradient-to-t from-[var(--app-surface)] via-[var(--app-surface)] via-80% to-transparent pt-5 sm:flex sm:justify-end"
    >
      <a
        href={resolve(
          withQuery("/foods/new", {
            date: data.destination.date,
            mealSlot: data.destination.mealSlot,
          }),
        )}
        class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--app-action)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--app-action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] sm:w-auto sm:min-w-[260px]"
      >
        <span aria-hidden="true" class="mr-1.5 text-base leading-none">+</span>
        Create a custom food
      </a>
    </div>
  </main>
</div>

{#if scannerOpen}
  <BarcodeScanner
    onscan={handleBarcode}
    onclose={() => (scannerOpen = false)}
  />
{/if}
