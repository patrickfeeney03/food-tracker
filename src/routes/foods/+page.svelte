<script lang="ts">
  import { resolve } from "$app/paths";
  import { withQuery } from "$lib/navigation";
  import type { MealSlot } from "$lib/nutrition/constants";
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

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
</script>

<svelte:head>
  <title>Add food | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[#e7e7e7] sm:px-4 sm:py-6">
  <main
    class="mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-[#f6f7f9] px-4 pb-4 text-[#172033] sm:min-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-[26px] sm:border sm:border-white/70 sm:px-8 sm:pb-8 sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)] lg:max-w-5xl lg:px-10"
  >
    <header
      class="grid grid-cols-[44px_1fr_44px] items-start pt-4 sm:pt-7 lg:pt-8"
    >
      <a
        href={resolve(withQuery("/", { date: data.destination.date }))}
        aria-label="Back to diary"
        class="inline-flex size-11 items-center justify-start rounded-xl text-[#172033] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2867eb]"
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
        <p class="truncate text-xs leading-4 font-medium text-[#748096]">
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
              class="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#748096]"
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
              class="!min-h-12 !rounded-xl !border-[#dce1e8] !bg-white !pr-10 !pl-10 !text-sm !shadow-none placeholder:!text-[#748096] focus:!border-[#2867eb] focus:!ring-[#2867eb]/15"
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
                class="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#748096] transition hover:bg-[#f2f4f7] hover:text-[#172033] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2867eb]"
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
            disabled
            aria-label="Scan a barcode"
            title="Barcode scanning is not available yet"
            class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#172033] text-white shadow-sm"
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
        class="mt-3 grid min-h-11 grid-cols-2 rounded-full bg-white p-1 sm:mt-0 sm:min-h-12"
        role="tablist"
        aria-label="Add food type"
      >
        <button
          type="button"
          role="tab"
          aria-selected="true"
          class="rounded-full bg-[#2867eb] px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172033]"
        >
          Foods
        </button>
        <button
          type="button"
          disabled
          role="tab"
          aria-selected="false"
          title="Meal shortcuts are not available yet"
          class="rounded-full px-4 text-sm font-semibold text-[#748096]"
        >
          Meal shortcuts
        </button>
      </div>
    </div>

    {#if data.created}
      <div
        role="status"
        class="mt-4 rounded-xl border border-[#bfe8d7] bg-[#ecfaf4] px-3 py-2.5 text-sm font-medium text-[#087651]"
      >
        Food created and added to {mealNames[
          data.destination.mealSlot
        ].toLowerCase()}.
      </div>
    {/if}

    <section aria-labelledby="food-results" class="mt-5 flex-1">
      <h2
        id="food-results"
        class="mb-2 px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[#748096] uppercase"
      >
        {data.query ? "Search results" : "Recent foods"}
      </h2>

      {#if data.foods.length === 0}
        <div
          class="rounded-2xl border border-[#dce1e8] bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(23,32,51,0.03)]"
        >
          <div
            class="mx-auto flex size-11 items-center justify-center rounded-full bg-[#edf3ff] text-[#2867eb]"
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
          <h3 class="mt-3 text-sm font-bold text-[#172033]">
            {data.query ? "No matching foods" : "No foods yet"}
          </h3>
          <p class="mt-1 text-xs leading-5 text-[#748096]">
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
                class="flex min-h-[62px] items-center gap-3 rounded-xl border border-[#dce1e8] bg-white py-2 pr-2 pl-3 shadow-[0_1px_2px_rgba(23,32,51,0.025)] transition hover:border-[#c9d1dc] hover:shadow-sm"
              >
                <div class="min-w-0 flex-1">
                  <h3
                    class="truncate text-sm leading-5 font-bold tracking-[-0.01em] text-[#263044]"
                  >
                    {food.name}
                  </h3>
                  <p
                    class="truncate text-[11px] leading-4 font-medium text-[#8a94a7]"
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
              </article>
            </li>
          {/each}
        </ul>

        <p class="mt-4 px-0.5 text-[11px] leading-4 text-[#8a94a7]">
          Your most recent amount is shown below each food.
        </p>
      {/if}
    </section>

    <div
      class="sticky bottom-0 mt-8 bg-gradient-to-t from-[#f6f7f9] via-[#f6f7f9] via-80% to-transparent pt-5 sm:flex sm:justify-end"
    >
      <a
        href={resolve(
          withQuery("/foods/new", {
            date: data.destination.date,
            mealSlot: data.destination.mealSlot,
          }),
        )}
        class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#172033] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#222d42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2867eb] sm:w-auto sm:min-w-[260px]"
      >
        <span aria-hidden="true" class="mr-1.5 text-base leading-none">+</span>
        Create a custom food
      </a>
    </div>
  </main>
</div>
