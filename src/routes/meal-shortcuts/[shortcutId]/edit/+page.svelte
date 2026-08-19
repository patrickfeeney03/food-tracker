<script lang="ts">
  import { resolve } from "$app/paths";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import MealShortcutEditor from "$lib/components/meal-shortcuts/MealShortcutEditor.svelte";
  import type { MealShortcutEditorItem } from "$lib/components/meal-shortcuts/types";
  import { withQuery } from "$lib/navigation";
  import { mealNames } from "$lib/nutrition/constants";
  import { untrack } from "svelte";
  import type { PageProps } from "./$types";

  type FieldErrors = {
    form?: string[];
    name?: string[];
    items?: string[];
    expectedUpdatedAt?: string[];
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

  function confirmArchive(event: SubmitEvent) {
    if (!window.confirm("Archive this meal shortcut? You cannot apply it again.")) {
      event.preventDefault();
    }
  }
</script>

<svelte:head>
  <title>Add meal shortcut | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="relative flex flex-col overflow-hidden" size="wide">
  <div class="flex flex-1 flex-col px-3 pb-28 pt-5 sm:px-8 sm:pt-8">
    <BackPageHeader
      href={resolve(withQuery("/foods", {
        date: context.date,
        mealSlot: context.mealSlot,
        q: context.q || undefined,
        tab: "shortcuts",
      }))}
      backLabel="Back to meal shortcuts"
      title="Add meal shortcut"
      description={`Adjust amounts, then add this meal to ${mealNames[context.mealSlot].toLowerCase()}.`}
    />

    {#if form?.archiveError}
      <FeedbackBanner class="mb-4" message={form.archiveError} tone="danger" />
    {/if}

    <form method="POST" action="?/save" class="flex flex-1 flex-col">
      <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt} />
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

      <BottomSubmitBar label="Add to diary" disabled={!canSave} />
    </form>

    <section
      aria-labelledby="shortcut-danger-heading"
      class="mt-10 border-t border-[var(--app-border)] pt-6"
    >
      <h2 id="shortcut-danger-heading" class="text-sm font-bold">Destructive actions</h2>
      <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
        Archiving removes this shortcut from Search/Add without changing diary history.
      </p>
      <form method="POST" action="?/archive" onsubmit={confirmArchive}>
        <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt} />
        <input type="hidden" name="date" value={context.date} />
        <input type="hidden" name="mealSlot" value={context.mealSlot} />
        <input type="hidden" name="q" value={context.q} />
        <button
          type="submit"
          class="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
            text-[var(--app-danger-text)] focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-danger-text)]"
        >Archive meal shortcut</button>
      </form>
    </section>
  </div>
</AppPageShell>
