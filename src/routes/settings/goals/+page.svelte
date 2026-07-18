<script lang="ts">
  import { resolve } from "$app/paths";
  import NutritionGoalForm, {
    type NutritionGoalFormErrors,
  } from "$lib/components/NutritionGoalForm.svelte";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as NutritionGoalFormErrors);
  let pageTitle = $derived(
    data.openedFromHistory
      ? data.selectedDate === null
        ? "Add target period"
        : "Edit target period"
      : "Daily targets",
  );
  let backHref = $derived(
    data.openedFromHistory ? resolve("/settings/goals/history") : resolve("/settings"),
  );
</script>

<svelte:head>
  <title>Daily targets | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="flex flex-col px-4 pb-8 pt-4 sm:px-7 sm:py-8">
    <BackPageHeader
      href={backHref}
      backLabel={data.openedFromHistory ? "Back to goal history" : "Back to settings"}
      title={pageTitle}
      description="Changes apply from the selected date without rewriting earlier diary goals."
    />

    <NutritionGoalForm
      {values}
      {errors}
      submitLabel={data.openedFromHistory && data.selectedDate === null
        ? "Add target period"
        : "Save targets"}
      targetsLegend="Nutrition targets"
    />
</AppPageShell>
