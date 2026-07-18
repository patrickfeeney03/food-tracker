<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived(form?.errors);

  const targetFields = [
    { name: "targetEnergyKcal", label: "Calories", unit: "kcal" },
    { name: "targetProteinG", label: "Protein", unit: "g" },
    { name: "targetCarbsG", label: "Carbohydrates", unit: "g" },
    { name: "targetFatG", label: "Fat", unit: "g" },
  ] as const;
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

    <form method="POST" class="flex flex-1 flex-col">
      <div class="space-y-5">
        <div class="space-y-1.5">
          <label
            for="effectiveFrom"
            class="text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--app-muted)]"
          >Effective date</label>
          <input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            value={values.effectiveFrom}
            required
            aria-invalid={errors?.effectiveFrom ? "true" : undefined}
            aria-describedby={errors?.effectiveFrom ? "effectiveFrom-error" : undefined}
            class="!min-h-12 !rounded-[12px] !border-[var(--app-border)]
              !bg-[var(--app-panel)] !px-3.5 !text-sm !font-semibold !text-[var(--app-text)]
              !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
          />
          {#if errors?.effectiveFrom}
            <p id="effectiveFrom-error" role="alert">{errors.effectiveFrom[0]}</p>
          {/if}
        </div>

        <fieldset>
          <legend
            class="mb-2 text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--app-muted)]"
          >Daily targets</legend>
          <div class="grid grid-cols-2 gap-3">
            {#each targetFields as field (field.name)}
              <div class="relative">
                <label
                  for={field.name}
                  class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                    !font-medium text-[var(--app-muted)]"
                >{field.label}</label>
                <input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min="0"
                  step="0.001"
                  inputmode="decimal"
                  value={values[field.name]}
                  required
                  aria-invalid={errors?.[field.name] ? "true" : undefined}
                  aria-describedby={errors?.[field.name] ? `${field.name}-error` : undefined}
                  class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)]
                    !bg-[var(--app-panel)] !pb-1.5 !pl-3 !pr-12 !pt-5 !text-[14px]
                    !font-bold !text-[var(--app-text)] !shadow-none
                    focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
                />
                <span
                  class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                    font-semibold text-[var(--app-muted)]"
                >{field.unit}</span>
                {#if errors?.[field.name]}
                  <p id={`${field.name}-error`} class="mt-1" role="alert">
                    {errors[field.name]?.[0]}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        </fieldset>
      </div>

      <button
        type="submit"
        class="mt-auto flex min-h-[52px] w-full items-center justify-center rounded-[12px]
          bg-[var(--app-accent)] px-4 text-sm font-bold text-white shadow-sm transition
          hover:bg-[var(--app-accent-hover)] focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
      >Confirm goals</button>
    </form>
  </main>
</div>
