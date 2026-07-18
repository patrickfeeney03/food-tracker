<script lang="ts">
  import { mealSlots, type MealSlot } from "$lib/nutrition/constants";

  const mealNames: Record<MealSlot, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snacks: "Snacks",
  };

  let {
    diaryDate = $bindable(),
    mealSlot = $bindable(),
    diaryDateError,
    mealSlotError,
    loggedAt,
  }: {
    diaryDate: string;
    mealSlot: MealSlot;
    diaryDateError?: string;
    mealSlotError?: string;
    loggedAt?: string;
  } = $props();

  let error = $derived(diaryDateError ?? mealSlotError);
</script>

<div class="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
  <label
    class="flex min-h-14 items-center justify-between gap-5 focus-within:outline-2
      focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]"
  >
    <span class="text-[12px] text-[var(--app-muted)]">Date</span>
    <input
      type="date"
      name="diaryDate"
      bind:value={diaryDate}
      required
      aria-invalid={diaryDateError ? "true" : undefined}
      aria-describedby={error ? "destination-error" : undefined}
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
      name="mealSlot"
      bind:value={mealSlot}
      aria-invalid={mealSlotError ? "true" : undefined}
      aria-describedby={error ? "destination-error" : undefined}
      class="!w-auto !border-0 !bg-transparent !py-0 !pl-0 !pr-7 !text-right !text-[13px]
        !font-bold !shadow-none focus:!ring-0"
    >
      {#each mealSlots as slot (slot)}
        <option value={slot}>{mealNames[slot]}</option>
      {/each}
    </select>
  </label>
  {#if loggedAt}
    <div class="flex min-h-14 items-center justify-between gap-5">
      <span class="text-[12px] text-[var(--app-muted)]">Logged at</span>
      <strong class="text-[13px]">{loggedAt}</strong>
    </div>
  {/if}
</div>

{#if error}
  <div
    id="destination-error"
    class="mt-3 text-[12px] text-[var(--app-danger-text)]"
    role="alert"
  >
    {error}
  </div>
{/if}
