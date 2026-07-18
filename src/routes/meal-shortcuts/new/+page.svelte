<script lang="ts">
  import { resolve } from "$app/paths";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import MealShortcutEditor, {
    type MealShortcutEditorItem,
  } from "$lib/components/meal-shortcuts/MealShortcutEditor.svelte";
  import { withQuery } from "$lib/navigation";
  import { untrack } from "svelte";
  import type { PageProps } from "./$types";

  type FieldErrors = {
    form?: string[];
    name?: string[];
    items?: string[];
    clientMutationId?: string[];
  };

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let context = $derived(form?.context ?? data.context);
  let errors = $derived((form?.errors ?? {}) as FieldErrors);
  let name = $state(untrack(() => values.name));
  let items = $state<MealShortcutEditorItem[]>(
    untrack(() => values.items as MealShortcutEditorItem[]),
  );
  let canSave = $derived(
    name.trim() !== "" &&
      items.length > 0 &&
      items.every(
        (item) =>
          !item.blocked &&
          item.foodId !== null &&
          /^\d+(?:\.\d{1,3})?$/.test(item.amount.trim()) &&
          Number(item.amount) > 0,
      ),
  );
  let slotLabel = $derived(
    `${context.mealSlot.slice(0, 1).toUpperCase()}${context.mealSlot.slice(1)}`,
  );
</script>

<svelte:head>
  <title>Create meal shortcut | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="relative flex flex-col overflow-hidden" size="wide">
  <div class="flex flex-1 flex-col px-3 pb-28 pt-5 sm:px-8 sm:pt-8">
    <BackPageHeader
      href={resolve(withQuery("/", { date: context.date }))}
      backLabel="Back to diary"
      title="Create meal shortcut"
      description={`Start with the foods currently in ${slotLabel.toLowerCase()}.`}
    />

    <form method="POST" action="?/save" class="flex flex-1 flex-col">
      <input type="hidden" name="clientMutationId" value={values.clientMutationId} />
      <input type="hidden" name="date" value={context.date} />
      <input type="hidden" name="mealSlot" value={context.mealSlot} />
      <input type="hidden" name="q" value={context.q} />

      {#if errors.form}
        <FeedbackBanner class="mb-4" message={errors.form[0]} tone="danger" />
      {/if}

      <MealShortcutEditor
        bind:name
        bind:items
        availableFoods={data.foods}
        nameError={errors.name?.[0]}
        itemsError={errors.items?.[0]}
      />

      <BottomSubmitBar label="Save meal shortcut" disabled={!canSave} />
    </form>
  </div>
</AppPageShell>
