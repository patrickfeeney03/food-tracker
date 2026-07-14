<script lang="ts">
  import { mealSlots, type MealSlot } from "$lib/nutrition/constants";
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { PageProps } from "./$types";
  import { resolve } from "$app/paths";
  import { shiftDate } from "$lib/date";
  import { withQuery } from "$lib/navigation";

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

  function formatGrams(value: number): string {
    return formatStoredValue(BigInt(value), 1);
  }

  function formatAmount(value: number, unit: "mg" | "ul"): string {
    const displayUnit = unit === "mg" ? "g" : "ml";

    return `${formatStoredValue(BigInt(value), 3)} ${displayUnit}`;
  }

  let previousDate = $derived(shiftDate(data.diary.date, -1));

  let nextDate = $derived(shiftDate(data.diary.date, +1));
</script>

<svelte:head>
  <title>Diary {data.diary.date} | Calorie Tracker</title>
</svelte:head>

<main class="mx-auto min-h-dvh w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
  <header class="mb-6 flex items-start justify-between gap-4">
    <div class="space-y-1">
      <p class="text-sm font-medium text-slate-600">Hello, {data.user.name}</p>
      <h1 class="text-3xl font-bold tracking-tight text-slate-950">
        Food diary
      </h1>
    </div>

    <form method="POST" action={resolve("/logout")} class="shrink-0">
      <button
        type="submit"
        class="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >Sign out</button
      >
    </form>
  </header>

  <nav
    aria-label="Diary date"
    class="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
  >
    <a
      href={resolve(withQuery("/", { date: previousDate }))}
      aria-label="Previous Day"
      class="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-stone-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      Previous
    </a>
    <div class="space-y-1 text-center">
      <strong class="block text-sm font-semibold text-slate-950">
        {data.diary.date}
      </strong>
      <a
        href={resolve("/")}
        class="text-xs font-medium text-emerald-700 hover:text-emerald-800"
      >
        Today
      </a>
    </div>
    <a
      href={resolve(withQuery("/", { date: nextDate }))}
      aria-label="Next day"
      class="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-stone-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      Next
    </a>
  </nav>

  {#if data.diary.balances}
    <section aria-labelledby="daily-summary">
      <h2 id="daily-summary">Daily Summary</h2>

      <div>
        <p>
          Goal:
          {formatKcal(data.diary.balances.energyMkcal.target)}
          kcal
        </p>

        <p>
          Consumed:
          {formatKcal(data.diary.balances.energyMkcal.consumed)}
          kcal
        </p>

        {#if data.diary.balances.energyMkcal.over > 0}
          <strong>
            {formatKcal(data.diary.balances.energyMkcal.over)}
            kcal over
          </strong>
        {:else}
          <strong>
            {formatKcal(data.diary.balances.energyMkcal.remaining)}
            kcal remaining
          </strong>
        {/if}
      </div>

      <dl>
        <div>
          <dt>Protein</dt>
          <dd>
            {formatGrams(data.diary.balances.proteinMg.consumed)}
            /
            {formatGrams(data.diary.balances.proteinMg.target)}
            g
          </dd>
        </div>

        <div>
          <dt>Carbohydrates</dt>
          <dd>
            {formatGrams(data.diary.balances.carbsMg.consumed)}
            /
            {formatGrams(data.diary.balances.carbsMg.target)}
            g
          </dd>
        </div>

        <div>
          <dt>Fat</dt>
          <dd>
            {formatGrams(data.diary.balances.fatMg.consumed)}
            /
            {formatGrams(data.diary.balances.fatMg.target)}
            g
          </dd>
        </div>
      </dl>
    </section>
  {:else}
    <p>No nutrition goal applies to this date.</p>
  {/if}

  {#each mealSlots as slot (slot)}
    <section aria-labelledby={`${slot}-heading`}>
      <header>
        <h2 id={`${slot}-heading`}>{mealNames[slot]}</h2>

        <strong>
          {formatKcal(data.diary.meals[slot].totals.energyMkcal)}
          kcal
        </strong>
      </header>
      <a
        href={resolve(
          withQuery("/foods", { date: data.diary.date, mealSlot: slot }),
        )}
      >
        Add food
      </a>

      {#if data.diary.meals[slot].entries.length === 0}
        <p>No food logged.</p>
      {:else}
        {#each data.diary.meals[slot].entries as entry (entry.id)}
          <article>
            <h3>{entry.foodName}</h3>

            {#if entry.foodBrand}
              <p>{entry.foodBrand}</p>
            {/if}

            <p>
              {formatStoredValue(BigInt(entry.portionCountMilli), 3)}
              × {entry.portionLabel}
              ({formatAmount(entry.resolvedAmount, entry.amountUnit)})
            </p>

            <p>
              {formatKcal(entry.energyMkcal)} kcal ·
              {formatGrams(entry.proteinMg)} g protein ·
              {formatGrams(entry.carbsMg)} g carbs ·
              {formatGrams(entry.fatMg)} g fat
            </p>
          </article>
        {/each}
      {/if}
    </section>
  {/each}
</main>
