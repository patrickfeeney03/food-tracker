<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let values = $derived(form?.values ?? data.values);
  let errors = $derived(form?.errors);
</script>

<svelte:head>
  <title>Set your goals | Calorie Tracker</title>
</svelte:head>

<main>
  <h1>Set your nutrition goals</h1>
  <p>These targets will apply from the selected date.</p>

  <form method="POST">
    <label for="effectiveFrom"> Effective date </label>
    <input
      id="effectiveFrom"
      name="effectiveFrom"
      type="date"
      value={values.effectiveFrom}
      required
      aria-invalid={errors?.effectiveFrom ? "true" : undefined}
      aria-describedby={errors?.effectiveFrom
        ? "effectiveFrom-error"
        : undefined}
    />
    {#if errors?.effectiveFrom}
      <p id="effectiveFrom-error" role="alert">
        {errors.effectiveFrom[0]}
      </p>
    {/if}

    <label for="targetEnergyKcal">Calories</label>
    <input
      id="targetEnergyKcal"
      name="targetEnergyKcal"
      type="number"
      min="0"
      step="0.001"
      inputmode="decimal"
      value={values.targetEnergyKcal}
      required
      aria-invalid={errors?.targetEnergyKcal ? "true" : undefined}
      aria-describedby={errors?.targetEnergyKcal
        ? "targetEnergyKcal-error"
        : undefined}
    />
    {#if errors?.targetEnergyKcal}
      <p id="targetEnergyKcal-error" role="alert">
        {errors.targetEnergyKcal[0]}
      </p>
    {/if}

    <label for="targetProteinG">Protein (g)</label>
    <input
      id="targetProteinG"
      name="targetProteinG"
      type="number"
      min="0"
      step="0.001"
      inputmode="decimal"
      value={values.targetProteinG}
      required
      aria-invalid={errors?.targetProteinG ? "true" : undefined}
    />
    {#if errors?.targetProteinG}
      <p role="alert">{errors.targetProteinG[0]}</p>
    {/if}

    <label for="targetCarbsG">Carbohydrates (g)</label>
    <input
      id="targetCarbsG"
      name="targetCarbsG"
      type="number"
      min="0"
      step="0.001"
      inputmode="decimal"
      value={values.targetCarbsG}
      required
      aria-invalid={errors?.targetCarbsG ? "true" : undefined}
    />
    {#if errors?.targetCarbsG}
      <p role="alert">{errors.targetCarbsG[0]}</p>
    {/if}

    <label for="targetFatG">Fat (g)</label>
    <input
      id="targetFatG"
      name="targetFatG"
      type="number"
      min="0"
      step="0.001"
      inputmode="decimal"
      value={values.targetFatG}
      required
      aria-invalid={errors?.targetFatG ? "true" : undefined}
    />
    {#if errors?.targetFatG}
      <p role="alert">{errors.targetFatG[0]}</p>
    {/if}

    <button type="submit">Confirm goals</button>
  </form>
</main>
