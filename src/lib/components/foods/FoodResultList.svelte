<script module lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- action callbacks return base-resolved app URLs */
  import type { AmountUnit, MealSlot } from "$lib/nutrition/constants";

  export interface FoodResultView {
    id: string;
    name: string;
    brand: string | null;
    amountUnit: AmountUnit;
    basisAmount: number;
    energyMkcalPerBasis: number;
    latestUse: {
      amountUnit: AmountUnit;
      resolvedAmount: number;
      energyMkcal: number;
    } | null;
    canQuickAdd: boolean;
  }

  export interface FoodResultListActions {
    foodHref?: (foodId: string) => string | null;
    editHref?: (foodId: string) => string | null;
    quickAdd?: (food: FoodResultView) => void;
    pendingFoodId?: string | null;
  }
</script>

<script lang="ts">
  import SearchIcon from "$lib/components/icons/SearchIcon.svelte";
  import { mealNames } from "$lib/nutrition/constants";
  import { formatAmount, formatKcal } from "$lib/nutrition/format";

  let {
    foods,
    activeQuery,
    mealSlot,
    actions,
    emptyQueryMessage,
    emptyCatalogueMessage,
  }: {
    foods: FoodResultView[];
    activeQuery: string;
    mealSlot: MealSlot;
    actions?: FoodResultListActions;
    emptyQueryMessage?: string;
    emptyCatalogueMessage?: string;
  } = $props();
</script>

<section aria-labelledby="food-results" class="mt-5 flex-1">
  <h2
    id="food-results"
    class="mb-2 px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[var(--app-muted)] uppercase"
  >
    {activeQuery ? "Search results" : "Recent foods"}
  </h2>

  {#if foods.length === 0}
    <div
      class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-8 text-center shadow-[0_1px_2px_rgba(23,32,51,0.03)]"
    >
      <div
        class="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
      >
        <SearchIcon class="size-5" />
      </div>
      <h3 class="mt-3 text-sm font-bold text-[var(--app-text)]">
        {activeQuery ? "No matching foods" : "No foods yet"}
      </h3>
      <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
        {activeQuery
          ? emptyQueryMessage ??
            `Try another search or create “${activeQuery}” as a custom food.`
          : emptyCatalogueMessage ??
            "Create your first custom food to start building your catalogue."}
      </p>
    </div>
  {:else}
    <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each foods as food (food.id)}
        {@const foodHref = actions?.foodHref?.(food.id) ?? null}
        {@const editHref = actions?.editHref?.(food.id) ?? null}
        <li>
          <article
            class="flex min-h-[62px] items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] py-2 pr-2 pl-3 shadow-[0_1px_2px_rgba(23,32,51,0.025)] transition hover:border-[var(--app-border-strong)] hover:shadow-sm"
          >
            {#if foodHref !== null}
              <a
                href={foodHref}
                class="min-w-0 flex-1 rounded-lg py-1 text-[var(--app-text)] no-underline
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-[var(--app-accent)]"
                aria-label={`Add ${food.name} to ${mealNames[mealSlot].toLowerCase()}`}
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
            {:else}
              <div
                aria-disabled="true"
                class="min-w-0 flex-1 rounded-lg py-1 text-[var(--app-text)] opacity-75"
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
              </div>
            {/if}

            <div class="flex shrink-0 items-center gap-1">
              {#if editHref !== null}
                <a
                  href={editHref}
                  aria-label={`Edit ${food.name}`}
                  class="inline-flex min-h-11 items-center justify-center rounded-lg px-2
                    text-xs font-bold text-[var(--app-muted)] transition
                    hover:bg-[var(--app-panel-hover)] hover:text-[var(--app-text)]
                    focus-visible:outline-2 focus-visible:outline-offset-1
                    focus-visible:outline-[var(--app-accent)]"
                >Edit</a>
              {:else}
                <span
                  aria-disabled="true"
                  class="inline-flex min-h-11 cursor-not-allowed items-center justify-center
                    rounded-lg px-2 text-xs font-bold text-[var(--app-muted)] opacity-50"
                >Edit</span>
              {/if}

              {#if food.canQuickAdd}
                {#if actions?.quickAdd !== undefined}
                  <button
                    type="button"
                    onclick={() => actions?.quickAdd?.(food)}
                    disabled={actions.pendingFoodId != null}
                    aria-label={`Quick add ${food.name} to ${mealNames[mealSlot].toLowerCase()} using the last amount`}
                    aria-busy={actions.pendingFoodId === food.id}
                    class="inline-flex size-11 shrink-0 items-center justify-center rounded-full
                      text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-1
                      focus-visible:outline-[var(--app-accent)] disabled:opacity-50"
                  >
                    <span
                      aria-hidden="true"
                      class="flex size-8 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xl leading-none font-medium"
                    >{actions.pendingFoodId === food.id ? "…" : "+"}</span>
                  </button>
                {:else}
                  <button
                    type="button"
                    disabled
                    aria-label={`Quick add ${food.name} is unavailable`}
                    class="inline-flex size-11 shrink-0 cursor-not-allowed items-center justify-center
                      rounded-full text-[var(--app-muted)] opacity-50"
                  >
                    <span
                      aria-hidden="true"
                      class="flex size-8 items-center justify-center rounded-full bg-[var(--app-panel-hover)] text-xl leading-none font-medium"
                    >+</span>
                  </button>
                {/if}
              {:else if foodHref !== null}
                <a
                  href={foodHref}
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
              {:else}
                <button
                  type="button"
                  disabled
                  aria-label={`Choose an amount for ${food.name} is unavailable`}
                  class="inline-flex size-11 shrink-0 cursor-not-allowed items-center justify-center
                    rounded-full text-[var(--app-muted)] opacity-50"
                >
                  <span
                    aria-hidden="true"
                    class="flex size-8 items-center justify-center rounded-full bg-[var(--app-panel-hover)] text-xl leading-none font-medium"
                  >+</span>
                </button>
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
