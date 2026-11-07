<script lang="ts">
  import DiaryDestinationFields from "$lib/components/amount-adjuster/DiaryDestinationFields.svelte";
  import { inputLimits } from "$lib/nutrition/input-limits";
  import type { MealSlot } from "$lib/nutrition/constants";

  let {
    name,
    diaryDate = $bindable(),
    mealSlot = $bindable(),
    nameError,
    diaryDateError,
    mealSlotError,
    loggedAt,
  }: {
    name: string;
    diaryDate: string;
    mealSlot: MealSlot;
    nameError?: string;
    diaryDateError?: string;
    mealSlotError?: string;
    loggedAt?: string;
  } = $props();
</script>

<div class="space-y-1.5">
  <label
    for="name"
    class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
  >What did you eat?</label>
  <input
    id="name"
    name="name"
    value={name}
    maxlength={inputLimits.food.name.maxLength}
    required
    autocomplete="off"
    placeholder="Boojum burrito"
    aria-invalid={nameError ? "true" : undefined}
    class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !bg-[var(--app-panel)]
      !px-3.5 !text-[14px] !font-semibold !text-[var(--app-text)] !shadow-none
      focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
  />
  {#if nameError}<p role="alert">{nameError}</p>{/if}
</div>

<div class="mt-6">
  <DiaryDestinationFields
    bind:diaryDate
    bind:mealSlot
    {diaryDateError}
    {mealSlotError}
    {loggedAt}
  />
</div>
