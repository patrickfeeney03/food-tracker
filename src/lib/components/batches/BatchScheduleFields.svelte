<script lang="ts">
  import { scheduleDates } from "$lib/nutrition/batch";
  import { mealNames, mealSlots, type MealSlot } from "$lib/nutrition/constants";
  import { formatDate } from "$lib/nutrition/format";
  import type { BatchLoggedPortion } from "./types";

  let {
    loggedPortions = [],
    remainingCount,
    logMode = $bindable(),
    startDate = $bindable(),
    mealSlot = $bindable(),
    error,
  }: {
    loggedPortions?: BatchLoggedPortion[];
    remainingCount: number;
    logMode: "next-days" | "hold";
    startDate: string;
    mealSlot: MealSlot;
    error?: string;
  } = $props();

  const modes = [
    { value: "next-days", label: "Add to the next days" },
    { value: "hold", label: "Hold — I'll add each one when I eat it" },
  ] as const;

  let planned = $derived(
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) && remainingCount > 0
      ? scheduleDates(startDate, remainingCount)
      : [],
  );

  function describe(date: string, slot: MealSlot): string {
    return `${formatDate(date, { year: false })} · ${mealNames[slot]}`;
  }
</script>

<section class="mt-7 space-y-3" aria-labelledby="batch-schedule-heading">
  <h2
    id="batch-schedule-heading"
    class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
  >Diary</h2>

  {#if loggedPortions.length > 0}
    <ul
      aria-label="Logged portions"
      class="divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)]
        bg-[var(--app-panel)] px-3 text-[13px] font-semibold"
    >
      {#each loggedPortions as portion, index (index)}
        <li class="min-h-11 py-3">{describe(portion.diaryDate, portion.mealSlot)}</li>
      {/each}
    </ul>
  {/if}

  {#if remainingCount <= 0}
    <p class="text-[13px] text-[var(--app-muted)]">All portions are logged.</p>
  {:else}
    <fieldset>
      <legend
        class="mb-2 text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
      >Log portions</legend>
      <div class="grid gap-2">
        {#each modes as mode (mode.value)}
          <label
            class={[
              "flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[12px] font-bold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]",
              logMode === mode.value
                ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
                : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)]",
            ]}
          >
            <input
              class="sr-only"
              type="radio"
              name="logMode"
              value={mode.value}
              bind:group={logMode}
            />
            {mode.label}
          </label>
        {/each}
      </div>
    </fieldset>

    {#if logMode === "next-days"}
      <div class="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
        <label
          class="flex min-h-14 items-center justify-between gap-5 focus-within:outline-2
            focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]"
        >
          <span class="text-[12px] text-[var(--app-muted)]">Starting</span>
          <input
            type="date"
            name="scheduleStartDate"
            bind:value={startDate}
            required
            aria-invalid={error ? "true" : undefined}
            class="!w-auto !border-0 !bg-transparent !p-0 !text-right !text-[13px] !font-bold
              !shadow-none focus:!ring-0"
          />
        </label>
        <label
          class="flex min-h-14 items-center justify-between gap-5 focus-within:outline-2
            focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]"
        >
          <span class="text-[12px] text-[var(--app-muted)]">Meal</span>
          <select
            name="scheduleMealSlot"
            bind:value={mealSlot}
            class="!w-auto !border-0 !bg-transparent !py-0 !pl-0 !pr-7 !text-right !text-[13px]
              !font-bold !shadow-none focus:!ring-0"
          >
            {#each mealSlots as slot (slot)}
              <option value={slot}>{mealNames[slot]}</option>
            {/each}
          </select>
        </label>
      </div>

      <ul
        aria-label="Planned portions"
        class="divide-y divide-[var(--app-border)] rounded-xl border border-dashed
          border-[var(--app-border)] px-3 text-[13px] font-semibold text-[var(--app-muted)]"
      >
        {#each planned as date, index (index)}
          <li class="min-h-11 py-3">{describe(date, mealSlot)}</li>
        {/each}
      </ul>
    {/if}
  {/if}

  {#if error}
    <p class="text-[12px] text-[var(--app-danger-text)]" role="alert">{error}</p>
  {/if}
</section>
