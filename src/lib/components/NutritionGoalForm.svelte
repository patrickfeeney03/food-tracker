<script lang="ts">
  import FeedbackBanner from "./FeedbackBanner.svelte";
  import { inputLimits } from "$lib/nutrition/input-limits";
  import NutrientInput from "./NutrientInput.svelte";

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
    maxEffectiveDate,
  }: {
    values: NutritionGoalFormValues;
    errors?: NutritionGoalFormErrors;
    submitLabel: string;
    targetsLegend?: string;
    maxEffectiveDate?: string;
  } = $props();

  const targetFields = [
    { name: "targetEnergyKcal", label: "Calories", unit: "kcal", max: inputLimits.goal.targetEnergyKcal.max },
    { name: "targetProteinG", label: "Protein", unit: "g", max: inputLimits.goal.targetProteinG.max },
    { name: "targetCarbsG", label: "Carbohydrates", unit: "g", max: inputLimits.goal.targetCarbsG.max },
    { name: "targetFatG", label: "Fat", unit: "g", max: inputLimits.goal.targetFatG.max },
  ] as const;
</script>

<form method="POST" class="flex flex-1 flex-col">
  {#if errors.form}
    <FeedbackBanner class="mb-5" message={errors.form[0]} tone="danger" />
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
        max={maxEffectiveDate}
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
          <NutrientInput
            id={field.name}
            label={field.label}
            unit={field.unit}
            max={field.max}
            value={values[field.name]}
            required
            error={errors[field.name]?.[0]}
          />
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
