<script lang="ts">
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { MealShortcutPickerFood } from "./MealShortcutEditor.svelte";

  let {
    mode,
    foods,
    onChoose,
    onCancel,
  }: {
    mode: "add" | "replace";
    foods: readonly MealShortcutPickerFood[];
    onChoose: (food: MealShortcutPickerFood) => void;
    onCancel: () => void;
  } = $props();

  let query = $state("");
  let filteredFoods = $derived.by(() => {
    const normalized = query.trim().toLocaleLowerCase("en-IE");
    if (normalized === "") return foods;

    return foods.filter((food) =>
      `${food.name} ${food.brand ?? ""}`.toLocaleLowerCase("en-IE").includes(normalized),
    );
  });
</script>

<section
  aria-labelledby="food-picker-heading"
  class="mt-6 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-3"
>
  <div class="flex items-center justify-between gap-3">
    <h2 id="food-picker-heading" class="text-sm font-bold">
      {mode === "add" ? "Add food" : "Replace food"}
    </h2>
    <button
      type="button"
      onclick={onCancel}
      class="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold
        text-[var(--app-muted)] focus-visible:outline-2 focus-visible:outline-offset-1
        focus-visible:outline-[var(--app-accent)]"
    >Close</button>
  </div>

  <label for="shortcut-food-search" class="sr-only">Search active foods</label>
  <input
    id="shortcut-food-search"
    type="search"
    bind:value={query}
    placeholder="Search active foods"
    autocomplete="off"
    class="mt-2 !min-h-11 !rounded-lg !border-[var(--app-border)] !text-sm !shadow-none
      focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
  />

  {#if filteredFoods.length === 0}
    <p class="py-5 text-center text-sm text-[var(--app-muted)]">No active foods match.</p>
  {:else}
    <ul class="mt-2 grid max-h-64 gap-1 overflow-y-auto" aria-label="Active foods">
      {#each filteredFoods as food (food.id)}
        <li>
          <button
            type="button"
            onclick={() => onChoose(food)}
            class="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3
              py-2 text-left hover:bg-[var(--app-panel-hover)] focus-visible:outline-2
              focus-visible:outline-offset-1 focus-visible:outline-[var(--app-accent)]"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{food.name}</span>
              {#if food.brand}
                <span class="block truncate text-[11px] text-[var(--app-muted)]">
                  {food.brand}
                </span>
              {/if}
            </span>
            <span class="shrink-0 text-xs font-medium text-[var(--app-muted)]">
              {formatStoredValue(BigInt(food.suggestedAmount), 3)}
              {food.amountUnit === "mg" ? "g" : "ml"}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
