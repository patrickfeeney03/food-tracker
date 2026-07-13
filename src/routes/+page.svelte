<script lang="ts">
  import { mealSlots, type MealSlot } from "$lib/nutrition/constants";
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { PageProps } from "./$types";
  import { resolve } from "$app/paths";
  import { shiftDate } from "$lib/date";

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

<main>
  <header>
    <div>
      <p>Hello, {data.user.name}</p>
      <h1>Food diary</h1>
    </div>

    <form method="POST" action={resolve("/logout")}>
      <button type="submit">Sign out</button>
    </form>
  </header>

  <nav aria-label="Diary date">
    <a
      href={`${resolve("/")}?date=${encodeURIComponent(previousDate)}`}
      aria-label="Previous Day">Previous</a
    >
    <div>
      <strong>{data.diary.date}</strong>
      <a href={resolve("/")}>Today</a>
    </div>
    <a
      href={`${resolve("/")}?date=${encodeURIComponent(nextDate)}`}
      aria-label="Next day">Next</a
    >
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
