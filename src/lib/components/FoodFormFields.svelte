<script lang="ts">
  import { inputLimits } from "$lib/nutrition/input-limits";
  import NutrientInput from "./NutrientInput.svelte";

  export type FoodFieldValues = {
    name: string;
    brand: string;
    barcode: string;
    amountUnit: string;
    basisAmount: string;
    servingAmount: string;
    containerAmount: string;
    energyKcal: string;
    proteinG: string;
    carbsG: string;
    fatG: string;
    fibreG: string;
    sugarG: string;
    saturatedFatG: string;
    sodiumMg: string;
    potassiumMg: string;
    notes: string;
  };

  export type FoodFieldErrors = Partial<
    Record<keyof FoodFieldValues, string[]>
  >;

  let {
    values,
    errors = {},
    amountUnit = $bindable(values.amountUnit === "ul" ? "ul" : "mg"),
  }: {
    values: FoodFieldValues;
    errors?: FoodFieldErrors;
    amountUnit?: "mg" | "ul";
  } = $props();
  let displayUnit = $derived(amountUnit === "mg" ? "g" : "ml");

  const requiredNutrition = [
    { id: "energyKcal", label: "Calories", unit: "kcal", max: inputLimits.food.energyKcal.max },
    { id: "proteinG", label: "Protein", unit: "g", max: inputLimits.food.proteinG.max },
    { id: "carbsG", label: "Carbs", unit: "g", max: inputLimits.food.carbsG.max },
    { id: "fatG", label: "Fat", unit: "g", max: inputLimits.food.fatG.max },
  ] as const;

  const additionalNutrition = [
    { id: "fibreG", label: "Fibre", unit: "g", step: "0.001", max: inputLimits.food.fibreG.max },
    { id: "sugarG", label: "Sugar", unit: "g", step: "0.001", max: inputLimits.food.sugarG.max },
    {
      id: "saturatedFatG",
      label: "Saturated fat",
      unit: "g",
      step: "0.001",
      max: inputLimits.food.saturatedFatG.max,
    },
    { id: "sodiumMg", label: "Sodium", unit: "mg", step: "1", max: inputLimits.food.sodiumMg.max },
    { id: "potassiumMg", label: "Potassium", unit: "mg", step: "1", max: inputLimits.food.potassiumMg.max },
  ] as const;
</script>

<div
  class="space-y-3 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5 sm:space-y-0"
>
  <div class="space-y-1.5">
    <label
      for="name"
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Food name</label>
    <input
      id="name"
      name="name"
      value={values.name}
      maxlength={inputLimits.food.name.maxLength}
      required
      autocomplete="off"
      aria-invalid={errors.name ? "true" : undefined}
      class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !bg-[var(--app-panel)]
        !px-3.5 !text-[14px] !font-semibold !text-[var(--app-text)] !shadow-none
        focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
    />
    {#if errors.name}<p role="alert">{errors.name[0]}</p>{/if}
  </div>

  <div class="space-y-1.5">
    <label
      for="brand"
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Brand</label>
    <input
      id="brand"
      name="brand"
      value={values.brand}
      maxlength={inputLimits.food.brand.maxLength}
      autocomplete="organization"
      aria-invalid={errors.brand ? "true" : undefined}
      class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !bg-[var(--app-panel)]
        !px-3.5 !text-[14px] !font-semibold !text-[var(--app-text)] !shadow-none
        focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
    />
    {#if errors.brand}<p role="alert">{errors.brand[0]}</p>{/if}
  </div>

  <div class="space-y-1.5 sm:col-span-2">
    <label
      for="barcode"
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Barcode <span class="normal-case font-medium">(optional)</span></label>
    <input
      id="barcode"
      name="barcode"
      value={values.barcode}
      maxlength={inputLimits.food.barcode.maxLength}
      autocomplete="off"
      inputmode="numeric"
      aria-invalid={errors.barcode ? "true" : undefined}
      class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !bg-[var(--app-panel)]
        !px-3.5 !text-[14px] !font-semibold !text-[var(--app-text)] !shadow-none
        focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
    />
    {#if errors.barcode}<p role="alert">{errors.barcode[0]}</p>{/if}
  </div>

  <fieldset class="space-y-1.5">
    <legend
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Type</legend>
    <div
      class="grid min-h-12 grid-cols-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] p-0.5"
    >
      <label
        class="flex cursor-pointer items-center justify-center rounded-full !text-[13px]
          !font-semibold transition focus-within:outline-2 focus-within:outline-offset-2
          focus-within:outline-[var(--app-accent)]"
        class:bg-[var(--app-accent)]={amountUnit === "mg"}
        class:text-white={amountUnit === "mg"}
        class:text-[var(--app-muted)]={amountUnit !== "mg"}
      >
        <input class="sr-only" type="radio" name="amountUnit" value="mg" bind:group={amountUnit} />
        Solid (g)
      </label>
      <label
        class="flex cursor-pointer items-center justify-center rounded-full !text-[13px]
          !font-semibold transition focus-within:outline-2 focus-within:outline-offset-2
          focus-within:outline-[var(--app-accent)]"
        class:bg-[var(--app-accent)]={amountUnit === "ul"}
        class:text-white={amountUnit === "ul"}
        class:text-[var(--app-muted)]={amountUnit !== "ul"}
      >
        <input class="sr-only" type="radio" name="amountUnit" value="ul" bind:group={amountUnit} />
        Liquid (ml)
      </label>
    </div>
    {#if errors.amountUnit}<p role="alert">{errors.amountUnit[0]}</p>{/if}
  </fieldset>

  <div class="space-y-1.5">
    <label
      for="basisAmount"
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Nutrition label basis</label>
    <div class="relative">
      <input
        id="basisAmount"
        name="basisAmount"
        type="number"
        min="0.001"
        max={inputLimits.food.basisAmount.max}
        step="0.001"
        inputmode="decimal"
        value={values.basisAmount}
        required
        aria-invalid={errors.basisAmount ? "true" : undefined}
        class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !bg-[var(--app-panel)]
          !px-3.5 !pr-12 !text-[14px] !font-semibold !text-[var(--app-text)] !shadow-none
          focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
      />
      <span class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-semibold text-[var(--app-muted)]">{displayUnit}</span>
    </div>
    {#if errors.basisAmount}<p role="alert">{errors.basisAmount[0]}</p>{/if}
  </div>

  <fieldset class="space-y-1.5">
    <legend
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Optional portions</legend>
    <div class="grid grid-cols-2 gap-3">
      {#each [{ id: "servingAmount", label: "Serving" }, { id: "containerAmount", label: "Container" }] as const as portion (portion.id)}
        <div class="relative">
          <label for={portion.id} class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px] !font-medium text-[var(--app-muted)]">{portion.label}</label>
          <input
            id={portion.id}
            name={portion.id}
            type="number"
            min="0.001"
            max={inputLimits.food[portion.id].max}
            step="0.001"
            inputmode="decimal"
            value={values[portion.id]}
            placeholder="—"
            aria-invalid={errors[portion.id] ? "true" : undefined}
            class="!min-h-[54px] !rounded-[12px] !border-[var(--app-border)]
              !bg-[var(--app-panel)] !pb-1.5 !pl-3 !pr-8 !pt-5 !text-[13px]
              !font-semibold !text-[var(--app-text)] !shadow-none
              focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
          />
          <span class="pointer-events-none absolute bottom-2 right-3 text-[11px] font-semibold text-[var(--app-muted)]">{displayUnit}</span>
        </div>
      {/each}
    </div>
    {#if errors.servingAmount}<p role="alert">{errors.servingAmount[0]}</p>{/if}
    {#if errors.containerAmount}<p role="alert">{errors.containerAmount[0]}</p>{/if}
  </fieldset>

  <fieldset class="space-y-1.5">
    <legend
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Required nutrition</legend>
    <div class="grid grid-cols-2 gap-3">
      {#each requiredNutrition as nutrient (nutrient.id)}
        <NutrientInput
          id={nutrient.id}
          label={nutrient.label}
          unit={nutrient.unit}
          max={nutrient.max}
          value={values[nutrient.id]}
          required
          error={errors[nutrient.id]?.[0]}
        />
      {/each}
    </div>
  </fieldset>

  <details
    class="group"
    open={Boolean(errors.fibreG || errors.sugarG || errors.saturatedFatG || errors.sodiumMg || errors.potassiumMg)}
  >
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg
        text-[13px] font-semibold text-[var(--app-accent)] focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
    >
      Additional nutrition
      <span class="text-lg transition-transform group-open:rotate-90" aria-hidden="true">›</span>
    </summary>
    <div class="grid grid-cols-2 gap-3 pb-2">
      {#each additionalNutrition as nutrient (nutrient.id)}
        <NutrientInput
          id={nutrient.id}
          label={nutrient.label}
          unit={nutrient.unit}
          max={nutrient.max}
          step={nutrient.step}
          value={values[nutrient.id]}
          error={errors[nutrient.id]?.[0]}
        />
      {/each}
    </div>
  </details>

  <details class="group" open={Boolean(values.notes || errors.notes)}>
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg
        text-[13px] font-semibold text-[var(--app-accent)] focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
    >
      <span class="flex flex-1 items-center justify-between"><span>Notes</span><span class="mr-2 text-[11px] font-medium text-[var(--app-muted)]">Optional</span></span>
      <span class="text-lg transition-transform group-open:rotate-90" aria-hidden="true">›</span>
    </summary>
    <label for="notes" class="sr-only">Notes</label>
    <textarea
      id="notes"
      name="notes"
      rows="5"
      maxlength={inputLimits.food.notes.maxLength}
      placeholder="Add anything useful about this food or its values."
      aria-invalid={errors.notes ? "true" : undefined}
      class="!rounded-[12px] !border-[var(--app-border)] !bg-[var(--app-panel)]
        !text-[14px] !leading-6 !text-[var(--app-text)] !shadow-none
        focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
    >{values.notes}</textarea>
    {#if errors.notes}<p role="alert">{errors.notes[0]}</p>{/if}
  </details>
</div>
