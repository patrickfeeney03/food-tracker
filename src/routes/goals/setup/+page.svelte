<script lang="ts">
  import NutritionGoalForm, {
    type NutritionGoalFormErrors,
  } from "$lib/components/NutritionGoalForm.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as NutritionGoalFormErrors);
</script>

<svelte:head>
  <title>Set your goals | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[var(--app-surface)]
      px-4 pb-8 pt-7 text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)]
      sm:rounded-[26px] sm:border sm:border-[var(--app-border)]/70 sm:px-7 sm:py-9
      sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]"
  >
    <header class="mb-7">
      <span
        class="mb-5 grid size-12 place-items-center rounded-[15px] bg-[var(--app-accent-soft)]
          text-[var(--app-accent)]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v18M3 12h18" stroke-linecap="round"></path>
        </svg>
      </span>
      <h1 class="text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
        Set your nutrition goals
      </h1>
      <p class="mt-2 text-sm leading-6 text-[var(--app-muted)]">
        These targets will apply from the selected date and can be changed later.
      </p>
    </header>

    <NutritionGoalForm {values} {errors} submitLabel="Confirm goals" />
  </main>
</div>
