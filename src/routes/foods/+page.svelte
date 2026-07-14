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
</script>

<svelte:head>
  <title>Add food | Calorie Tracker</title>
</svelte:head>
<main>
  <header>
    <a href={resolve(withQuery("/", { date: data.destination.date }))}>
      Back
    </a>

    <div>
      <h1>
        Add food to
        {mealNames[data.destination.mealSlot]}
      </h1>
      <p>{data.destination.date}</p>
    </div>

    <a
      href={resolve(
        withQuery("/foods/new", {
          date: data.destination.date,
          mealSlot: data.destination.mealSlot,
        }),
      )}
    >
      Create food
    </a>
  </header>
  <form method="GET" action={resolve("/foods")}>
    <input type="hidden" name="date" value={data.destination.date} />
    <input type="hidden" name="mealSlot" value={data.destination.mealSlot} />

    <label for="food-search">Search foods</label>
    <input
      id="food-search"
      name="q"
      type="search"
      value={data.query}
      maxlength="200"
      autocomplete="off"
    />

    <button type="submit">Search</button>

    {#if data.query}
      <a
        href={resolve(
          withQuery("/foods", {
            date: data.destination.date,
            mealSlot: data.destination.mealSlot,
          }),
        )}
      >
        Clear
      </a>
    {/if}
  </form>

  <section aria-labelledby="food-results">
    <h2 id="food-results">
      {data.query ? "Search results" : "Your foods"}
    </h2>

    {#if data.foods.length === 0}
      <p>
        {data.query
          ? "No matching foods."
          : "You have not created any foods yet."}
      </p>
    {:else}
      <ul>
        {#each data.foods as food (food.id)}
          <li>
            <article>
              <h3>{food.name}</h3>
              {#if food.brand}
                <p>{food.brand}</p>
              {/if}
              <p>
                {formatKcal(food.energyMkcalPerBasis)}
                kcal per
                {formatAmount(food.basisAmount, food.amountUnit)}
              </p>
            </article>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>
