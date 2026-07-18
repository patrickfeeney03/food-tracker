<script lang="ts">
  export type NutritionGoalFieldName =
    | "effectiveFrom"
    | "targetEnergyKcal"
    | "targetProteinG"
    | "targetCarbsG"
    | "targetFatG";

  export type NutritionGoalFormValues = Record<NutritionGoalFieldName, string>;
  export type NutritionGoalFormErrors = Partial<
    Record<NutritionGoalFieldName | "form", string[]>
  >;

  let {
    values,
    errors = {},
    submitLabel,
    targetsLegend = "Daily targets",
  }: {
    values: NutritionGoalFormValues;
    errors?: NutritionGoalFormErrors;
    submitLabel: string;
    targetsLegend?: string;
  } = $props();

  const targetFields = [
    { name: "targetEnergyKcal", label: "Calories", unit: "kcal" },
    { name: "targetProteinG", label: "Protein", unit: "g" },
    { name: "targetCarbsG", label: "Carbohydrates", unit: "g" },
    { name: "targetFatG", label: "Fat", unit: "g" },
  ] as const;
</script>

<form method="POST" class="flex flex-1 flex-col">
  {#if errors.form}
    <div
      role="alert"
      class="mb-5 rounded-xl border border-[var(--app-danger-border)]
        bg-[var(--app-danger-bg)] px-3 py-2.5 text-sm font-medium
        text-[var(--app-danger-text)]"
    >{errors.form[0]}</div>
  {/if}

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
        aria-invalid={errors.effectiveFrom ? "true" : undefined}
        aria-describedby={errors.effectiveFrom ? "effectiveFrom-error" : undefined}
        class="!min-h-12 !rounded-[12px] !border-[var(--app-border)]
          !bg-[var(--app-panel)] !px-3.5 !text-sm !font-semibold !text-[var(--app-text)]
          !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
      />
      {#if errors.effectiveFrom}
        <p id="effectiveFrom-error" role="alert">{errors.effectiveFrom[0]}</p>
      {/if}
    </div>

    <fieldset>
      <legend
        class="mb-2 text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--app-muted)]"
      >{targetsLegend}</legend>
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
              aria-invalid={errors[field.name] ? "true" : undefined}
              aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
              class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)]
                !bg-[var(--app-panel)] !pb-1.5 !pl-3 !pr-12 !pt-5 !text-[14px]
                !font-bold !text-[var(--app-text)] !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            />
            <span
              class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
            >{field.unit}</span>
            {#if errors[field.name]}
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
  >{submitLabel}</button>
</form>
