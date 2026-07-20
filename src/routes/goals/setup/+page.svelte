<script lang="ts">
  import NutritionGoalForm, {
    type NutritionGoalFormErrors,
  } from "$lib/components/NutritionGoalForm.svelte";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import PlusIcon from "$lib/components/icons/PlusIcon.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as NutritionGoalFormErrors);
</script>

<svelte:head>
  <title>Set your goals | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="flex flex-col px-4 pb-8 pt-7 sm:px-7 sm:py-9">
    <header class="mb-7">
      <span
        class="mb-5 grid size-12 place-items-center rounded-[15px] bg-[var(--app-accent-soft)]
          text-[var(--app-accent)]"
        aria-hidden="true"
      >
        <PlusIcon class="size-6" />
      </span>
      <h1 class="text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
        Set your nutrition goals
      </h1>
      <p class="mt-2 text-sm leading-6 text-[var(--app-muted)]">
        These targets will apply from the selected date and can be changed later.
      </p>
    </header>

    <NutritionGoalForm
      {values}
      {errors}
      maxEffectiveDate={data.maxEffectiveDate}
      submitLabel="Confirm goals"
    />
</AppPageShell>
