<script module lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- action callbacks return base-resolved app URLs */
  import type { AmountUnit, MealSlot } from "$lib/nutrition/constants";

  interface NutritionBalanceView {
    consumed: number;
    target: number;
    remaining: number;
    over: number;
  }

  interface DiaryEntryView {
    id: string;
    foodName: string;
    amountUnit: AmountUnit;
    resolvedAmount: number;
    energyMkcal: number;
  }

  interface MealView {
    entries: DiaryEntryView[];
    totals: {
      energyMkcal: number;
    };
  }

  export interface DiaryDayViewData {
    balances: {
      energyMkcal: NutritionBalanceView;
      proteinMg: NutritionBalanceView;
      carbsMg: NutritionBalanceView;
      fatMg: NutritionBalanceView;
    } | null;
    meals: Record<MealSlot, MealView>;
  }

  export interface DiaryDayViewActions {
    entryHref?: (entryId: string) => string | null;
    addFoodHref?: (mealSlot: MealSlot) => string | null;
    saveShortcutHref?: (mealSlot: MealSlot) => string | null;
  }
</script>

<script lang="ts">
  import { mealNames, mealSlots } from "$lib/nutrition/constants";
  import { formatAmount, formatGrams, formatKcal } from "$lib/nutrition/format";

  let {
    diary,
    shortcutEligibility,
    actions,
  }: {
    diary: DiaryDayViewData;
    shortcutEligibility: Record<MealSlot, boolean>;
    actions?: DiaryDayViewActions;
  } = $props();

  function progress(consumed: number, target: number): number {
    if (target === 0) return consumed > 0 ? 100 : 0;
    return Math.min(100, Math.round((consumed / target) * 100));
  }
</script>

<div
  class="contents lg:grid lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]
    lg:items-start lg:gap-[34px] xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-11"
>
  <aside class="block lg:sticky lg:top-7">
    {#if diary.balances}
      <section
        aria-labelledby="daily-energy"
        class="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 pb-5 pt-[18px]"
      >
        <h1
          id="daily-energy"
          class="m-0 text-[11px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
        >
          Daily energy
        </h1>

        <div
          class="mt-[13px] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]
            items-center gap-[9px]"
        >
          <div class="min-w-0">
            <strong
              class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                tracking-[-0.035em] lg:text-[28px]"
            >
              {formatKcal(diary.balances.energyMkcal.target)}
            </strong>
            <span class="mt-1.5 block text-[11px] text-[var(--app-muted)]">goal</span>
          </div>

          <b aria-hidden="true" class="text-[16px] font-semibold text-[var(--app-muted)]">
            −
          </b>

          <div class="min-w-0">
            <strong
              class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                tracking-[-0.035em] lg:text-[28px]"
            >
              {formatKcal(diary.balances.energyMkcal.consumed)}
            </strong>
            <span class="mt-1.5 block text-[11px] text-[var(--app-muted)]">
              consumed
            </span>
          </div>

          <b aria-hidden="true" class="text-[16px] font-semibold text-[var(--app-muted)]">
            =
          </b>

          <div
            class={diary.balances.energyMkcal.over > 0
              ? "min-w-0 text-[var(--app-orange)]"
              : "min-w-0 text-[var(--app-green)]"}
          >
            <strong
              class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                tracking-[-0.035em] lg:text-[28px]"
            >
              {formatKcal(
                diary.balances.energyMkcal.over > 0
                  ? diary.balances.energyMkcal.over
                  : diary.balances.energyMkcal.remaining,
              )}
            </strong>
            <span class="mt-1.5 block text-[11px] text-[var(--app-muted)]">
              {diary.balances.energyMkcal.over > 0
                ? "over"
                : "remaining"}
            </span>
          </div>
        </div>
      </section>

      <dl
        class="my-[21px] grid grid-cols-3 gap-5 lg:mb-0 lg:gap-4 lg:px-1 lg:pt-5"
      >
        <div class="min-w-0">
          <dt class="text-[11px] font-medium text-[var(--app-muted)]">Protein</dt>
          <dd
            class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
              text-[12px] font-bold text-[var(--app-text)]"
          >
            {formatGrams(diary.balances.proteinMg.consumed)} /
            {formatGrams(diary.balances.proteinMg.target)} g
          </dd>
          <span
            class="block h-[5px] overflow-hidden rounded-full bg-[var(--app-track)]"
          >
            <span
              class="block h-full rounded-full bg-[var(--app-purple)]"
              style:width={`${progress(
                diary.balances.proteinMg.consumed,
                diary.balances.proteinMg.target,
              )}%`}
            ></span>
          </span>
        </div>

        <div class="min-w-0">
          <dt class="text-[11px] font-medium text-[var(--app-muted)]">Carbs</dt>
          <dd
            class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
              text-[12px] font-bold text-[var(--app-text)]"
          >
            {formatGrams(diary.balances.carbsMg.consumed)} /
            {formatGrams(diary.balances.carbsMg.target)} g
          </dd>
          <span
            class="block h-[5px] overflow-hidden rounded-full bg-[var(--app-track)]"
          >
            <span
              class="block h-full rounded-full bg-[var(--app-orange)]"
              style:width={`${progress(
                diary.balances.carbsMg.consumed,
                diary.balances.carbsMg.target,
              )}%`}
            ></span>
          </span>
        </div>

        <div class="min-w-0">
          <dt class="text-[11px] font-medium text-[var(--app-muted)]">Fat</dt>
          <dd
            class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
              text-[12px] font-bold text-[var(--app-text)]"
          >
            {formatGrams(diary.balances.fatMg.consumed)} /
            {formatGrams(diary.balances.fatMg.target)} g
          </dd>
          <span
            class="block h-[5px] overflow-hidden rounded-full bg-[var(--app-track)]"
          >
            <span
              class="block h-full rounded-full bg-[var(--app-green)]"
              style:width={`${progress(
                diary.balances.fatMg.consumed,
                diary.balances.fatMg.target,
              )}%`}
            ></span>
          </span>
        </div>
      </dl>
    {:else}
      <div
        class="mb-6 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4
          text-[14px] text-[var(--app-muted)]"
        role="status"
      >
        No nutrition goal applies to this date.
      </div>
    {/if}
  </aside>

  <div
    class="grid gap-[25px] lg:grid-cols-2 lg:items-start lg:gap-x-5 lg:gap-y-7"
  >
    {#each mealSlots as slot (slot)}
      {@const meal = diary.meals[slot]}
      {@const addFoodHref = actions?.addFoodHref?.(slot) ?? null}
      <section
        aria-labelledby={`${slot}-heading`}
        class="min-w-0"
      >
        <header
          class="mb-2.5 flex items-center justify-between gap-4"
        >
          <h2
            id={`${slot}-heading`}
            class="m-0 text-[11px] font-bold uppercase tracking-[0.02em]
              text-[var(--app-muted)]"
          >
            {mealNames[slot]}
          </h2>
          {#if meal.entries.length > 0}
            <span class="text-[11px] font-bold text-[var(--app-muted)]">
              {formatKcal(meal.totals.energyMkcal)} kcal
            </span>
          {/if}
        </header>

        {#if meal.entries.length === 0}
          <div
            class="rounded-[13px] border border-[var(--app-border)] bg-[var(--app-panel)] px-[15px]
              py-3.5 lg:min-h-[88px]"
          >
            <p class="mb-2 mt-0 text-[13px] text-[var(--app-muted)]">
              Nothing logged yet
            </p>
            {#if addFoodHref !== null}
              <a
                href={addFoodHref}
                class="inline-flex min-h-[26px] items-center gap-1.5 text-[13px]
                  font-bold text-[var(--app-accent)] no-underline
                  focus-visible:outline-3 focus-visible:outline-offset-2
                  focus-visible:outline-[var(--app-accent)]/30"
              >
                <span aria-hidden="true">+</span> Add food
              </a>
            {:else}
              <span
                aria-disabled="true"
                class="inline-flex min-h-[26px] cursor-not-allowed items-center gap-1.5
                  text-[13px] font-bold text-[var(--app-muted)] opacity-60"
              >
                <span aria-hidden="true">+</span> Add food
              </span>
            {/if}
          </div>
        {:else}
          <div class="grid gap-[9px]">
            {#each meal.entries as entry (entry.id)}
              {@const entryHref = actions?.entryHref?.(entry.id) ?? null}
              {#if entryHref !== null}
                <a
                  href={entryHref}
                  class="block min-w-0 max-w-full rounded-[13px] border border-[var(--app-border)] bg-[var(--app-panel)]
                    px-[15px] py-[13px] text-[var(--app-text)] no-underline transition
                    hover:border-[var(--app-border-strong)] hover:shadow-sm focus-visible:outline-3
                    focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
                >
                  <h3 class="m-0 min-w-0 max-w-full truncate text-[15px] font-bold leading-tight">
                    {entry.foodName}
                  </h3>
                  <p class="mb-0 mt-1 text-[12px] text-[var(--app-muted)]">
                    {formatAmount(entry.resolvedAmount, entry.amountUnit)}
                    · {formatKcal(entry.energyMkcal)} kcal
                  </p>
                </a>
              {:else}
                <div
                  aria-disabled="true"
                  class="block min-w-0 max-w-full rounded-[13px] border border-[var(--app-border)]
                    bg-[var(--app-panel)] px-[15px] py-[13px] text-[var(--app-text)] opacity-75"
                >
                  <h3 class="m-0 min-w-0 max-w-full truncate text-[15px] font-bold leading-tight">
                    {entry.foodName}
                  </h3>
                  <p class="mb-0 mt-1 text-[12px] text-[var(--app-muted)]">
                    {formatAmount(entry.resolvedAmount, entry.amountUnit)}
                    · {formatKcal(entry.energyMkcal)} kcal
                  </p>
                </div>
              {/if}
            {/each}

            {#if addFoodHref !== null}
              <a
                href={addFoodHref}
                class="flex min-h-12 items-center gap-[7px] rounded-[13px] border
                  border-[var(--app-border)] bg-[var(--app-panel)] px-[15px] text-[13px] font-bold
                  text-[var(--app-accent)] no-underline focus-visible:outline-3
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
              >
                <span aria-hidden="true">+</span> Add food
              </a>
            {:else}
              <span
                aria-disabled="true"
                class="flex min-h-12 cursor-not-allowed items-center gap-[7px] rounded-[13px]
                  border border-[var(--app-border)] bg-[var(--app-panel)] px-[15px]
                  text-[13px] font-bold text-[var(--app-muted)] opacity-60"
              >
                <span aria-hidden="true">+</span> Add food
              </span>
            {/if}
            {#if shortcutEligibility[slot]}
              {@const saveShortcutHref = actions?.saveShortcutHref?.(slot) ?? null}
              {#if saveShortcutHref !== null}
                <a
                  href={saveShortcutHref}
                  class="flex min-h-11 items-center gap-[7px] rounded-[13px] px-[15px]
                    text-[12px] font-bold text-[var(--app-muted)] no-underline
                    focus-visible:outline-3 focus-visible:outline-offset-2
                    focus-visible:outline-[var(--app-accent)]/30"
                >
                  Save as meal shortcut
                </a>
              {:else}
                <span
                  aria-disabled="true"
                  class="flex min-h-11 cursor-not-allowed items-center gap-[7px] rounded-[13px]
                    px-[15px] text-[12px] font-bold text-[var(--app-muted)] opacity-60"
                >
                  Save as meal shortcut
                </span>
              {/if}
            {/if}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>
