<script lang="ts">
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import MealShortcutEditor from "$lib/components/meal-shortcuts/MealShortcutEditor.svelte";
  import type { MealShortcutEditorItem } from "$lib/components/meal-shortcuts/types";
  import { previewBatchPortion } from "$lib/nutrition/batch";
  import type { MealSlot } from "$lib/nutrition/constants";
  import { inputLimits } from "$lib/nutrition/input-limits";
  import type { NavigationContext } from "$lib/nutrition/navigation-context";
  import { untrack } from "svelte";
  import BatchPortionsField from "./BatchPortionsField.svelte";
  import BatchScheduleFields from "./BatchScheduleFields.svelte";
  import type { BatchLoggedPortion, BatchPickerFood } from "./types";

  type FieldErrors = {
    form?: string[];
    name?: string[];
    items?: string[];
    portionCount?: string[];
    schedule?: string[];
  };

  let {
    values,
    fallbackStartDate,
    context,
    foods,
    errors,
    hidden,
    loggedPortions = [],
    loggedCount = 0,
  }: {
    values: {
      name: string;
      portionCount: number;
      logMode: "next-days" | "hold";
      startDate: string;
      scheduleMealSlot: string;
      items: MealShortcutEditorItem[];
    };
    fallbackStartDate: string;
    context: NavigationContext;
    foods: readonly BatchPickerFood[];
    errors: FieldErrors;
    hidden: Record<string, string>;
    loggedPortions?: BatchLoggedPortion[];
    loggedCount?: number;
  } = $props();

  let name = $state(untrack(() => values.name));
  let items = $state<MealShortcutEditorItem[]>(untrack(() => values.items));
  let portionCount = $state<number>(untrack(() => values.portionCount));
  let logMode = $state<"next-days" | "hold">(untrack(() => values.logMode));
  let startDate = $state(untrack(() => values.startDate || fallbackStartDate));
  let mealSlot = $state<MealSlot>(untrack(() => values.scheduleMealSlot as MealSlot));

  let countValid = $derived(
    Number.isInteger(portionCount) &&
      portionCount >= Math.max(1, loggedCount) &&
      portionCount <= inputLimits.batch.portionCount.max,
  );
  let preview = $derived(previewBatchPortion(items, foods, portionCount));
  let canSave = $derived(
    name.trim() !== "" &&
      countValid &&
      items.length > 0 &&
      items.every(
        (item) =>
          !item.blocked &&
          item.foodId !== null &&
          /^\d+(?:\.\d{1,3})?$/.test(item.amount.trim()) &&
          Number(item.amount) > 0,
      ),
  );
</script>

<form method="POST" action="?/save" class="flex flex-1 flex-col">
  {#each Object.entries(hidden) as [fieldName, fieldValue] (fieldName)}
    <input type="hidden" name={fieldName} value={fieldValue} />
  {/each}
  <input type="hidden" name="date" value={context.date} />
  <input type="hidden" name="mealSlot" value={context.mealSlot} />
  <input type="hidden" name="q" value={context.q} />

  {#if errors.form}
    <FeedbackBanner class="mb-4" message={errors.form[0]} tone="danger" />
  {/if}

  <MealShortcutEditor
    bind:name
    bind:items
    availableFoods={foods}
    nameError={errors.name?.[0]}
    itemsError={errors.items?.[0]}
    nameLabel="Batch name"
    amountLabel="Total amount"
    addLabel="+ Add ingredient"
    emptyMessage="Add each ingredient as you weigh it."
    itemsHint="Enter the total raw weight of each ingredient."
  />

  <BatchPortionsField
    bind:portionCount
    min={Math.max(1, loggedCount)}
    {preview}
    error={errors.portionCount?.[0]}
  />

  <BatchScheduleFields
    {loggedPortions}
    remainingCount={countValid ? portionCount - loggedCount : 0}
    bind:logMode
    bind:startDate
    bind:mealSlot
    error={errors.schedule?.[0]}
  />

  <BottomSubmitBar label="Save batch" disabled={!canSave} />
</form>
