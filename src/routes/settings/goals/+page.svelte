<script lang="ts">
  import { resolve } from "$app/paths";
  import NutritionGoalForm, {
    type NutritionGoalFormErrors,
  } from "$lib/components/NutritionGoalForm.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as NutritionGoalFormErrors);
</script>

<svelte:head>
  <title>Daily targets | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[var(--app-surface)]
      px-4 pb-8 pt-4 text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)]
      sm:rounded-[26px] sm:border sm:border-[var(--app-border)]/70 sm:px-7 sm:py-8
      sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]"
  >
    <header class="mb-7 flex items-start gap-3">
      <a
        href={resolve("/settings")}
        aria-label="Back to settings"
        class="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full
          text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </a>
      <div class="pt-1">
        <h1 class="text-[21px] font-extrabold leading-tight tracking-[-0.025em]">
          Daily targets
        </h1>
        <p class="mt-1 text-sm leading-5 text-[var(--app-muted)]">
          Changes apply from the selected date without rewriting earlier diary goals.
        </p>
      </div>
    </header>

    <NutritionGoalForm
      {values}
      {errors}
      submitLabel="Save targets"
      targetsLegend="Nutrition targets"
    />
  </main>
</div>
