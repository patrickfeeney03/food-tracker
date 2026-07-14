<script lang="ts">
  import { resolve } from "$app/paths";
  import { withQuery } from "$lib/navigation";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let values = $derived(form?.values ?? data.values);
  let errors = $derived(form?.errors);
</script>

<svelte:head>
  <title>Create food | Calorie Tracker</title>
</svelte:head>

<main class="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
  <header class="mb-8 space-y-5">
    <a
      class="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600
            transition hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-emerald-700"
      href={resolve(
        withQuery("/foods", {
          date: data.destination.date,
          mealSlot: data.destination.mealSlot,
        }),
      )}
    >
      Back
    </a>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight text-slate-950">
        Create food
      </h1>
      <p class="max-w-prose text-sm leading-6 text-slate-600">
        This food will also be logged to
        {data.destination.mealSlot}
        on {data.destination.date}.
      </p>
    </div>
  </header>

  <form method="POST" class="space-y-6">
    <input
      type="hidden"
      name="clientMutationId"
      value={values.clientMutationId}
    />
    <input type="hidden" name="diaryDate" value={values.diaryDate} />
    <input type="hidden" name="mealSlot" value={values.mealSlot} />
    <input type="hidden" name="portionKind" value={values.portionKind} />

    <div
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <fieldset class="space-y-5">
        <legend class="text-base font-semibold text-slate-950">
          Food identity
        </legend>

        <div class="space-y-1.5">
          <label for="name" class="block text-sm font-medium text-slate-700"
            >Name</label
          >
          <input
            id="name"
            name="name"
            value={values.name}
            maxlength="200"
            required
            aria-invalid={errors?.name ? "true" : undefined}
            class="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
          {#if errors?.name}
            <p role="alert">{errors.name[0]}</p>
          {/if}
        </div>

        <div class="space-y-1.5">
          <label for="brand">Brand</label>
          <input id="brand" name="brand" value={values.brand} />
        </div>

        <div class="space-y-1.5">
          <label for="barcode">Barcode</label>
          <input
            id="barcode"
            name="barcode"
            value={values.barcode}
            inputmode="numeric"
          />
        </div>
      </fieldset>
    </div>

    <fieldset>
      <legend>Measurement</legend>

      <div class="space-y-1.5">
        <label for="amountUnit">Food type</label>
        <select id="amountUnit" name="amountUnit" value={values.amountUnit}>
          <option value="mg">Solid — grams</option>
          <option value="ul">Liquid — millilitres</option>
        </select>
        {#if errors?.amountUnit}
          <p role="alert">{errors.amountUnit[0]}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <label for="basisAmount"> Nutrition basis amount (g or ml) </label>
        <input
          id="basisAmount"
          name="basisAmount"
          type="number"
          min="0.001"
          step="0.001"
          inputmode="decimal"
          value={values.basisAmount}
          required
        />
        {#if errors?.basisAmount}
          <p role="alert">{errors.basisAmount[0]}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <label for="servingAmount"> Serving amount (optional) </label>
        <input
          id="servingAmount"
          name="servingAmount"
          type="number"
          min="0.001"
          step="0.001"
          inputmode="decimal"
          value={values.servingAmount}
        />
        {#if errors?.servingAmount}
          <p role="alert">{errors.servingAmount[0]}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <label for="containerAmount"> Container amount (optional) </label>
        <input
          id="containerAmount"
          name="containerAmount"
          type="number"
          min="0.001"
          step="0.001"
          inputmode="decimal"
          value={values.containerAmount}
        />
        {#if errors?.containerAmount}
          <p role="alert">{errors.containerAmount[0]}</p>
        {/if}
      </div>
    </fieldset>

    <fieldset>
      <legend>Nutrition on the stated basis</legend>

      <div class="space-y-1.5">
        <label for="energyKcal">Calories (kcal)</label>
        <input
          id="energyKcal"
          name="energyKcal"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          value={values.energyKcal}
          required
        />
        {#if errors?.energyKcal}
          <p role="alert">{errors.energyKcal[0]}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <label for="proteinG">Protein (g)</label>
        <input
          id="proteinG"
          name="proteinG"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          value={values.proteinG}
          required
        />
        {#if errors?.proteinG}
          <p role="alert">{errors.proteinG[0]}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <label for="carbsG">Carbohydrates (g)</label>
        <input
          id="carbsG"
          name="carbsG"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          value={values.carbsG}
          required
        />
        {#if errors?.carbsG}
          <p role="alert">{errors.carbsG[0]}</p>
        {/if}
      </div>

      <div class="space-y-1.5">
        <label for="fatG">Fat (g)</label>
        <input
          id="fatG"
          name="fatG"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          value={values.fatG}
          required
        />
        {#if errors?.fatG}
          <p role="alert">{errors.fatG[0]}</p>
        {/if}
      </div>
    </fieldset>

    <fieldset>
      <legend>First diary entry</legend>

      <p>The amount is entered as a number of 100 g/ml portions.</p>

      <div class="space-y-1.5">
        <label for="portionCount">Number of portions</label>
        <input
          id="portionCount"
          name="portionCount"
          type="number"
          min="0.001"
          step="0.001"
          inputmode="decimal"
          value={values.portionCount}
          required
        />
        {#if errors?.portionCount}
          <p role="alert">{errors.portionCount[0]}</p>
        {/if}
      </div>
    </fieldset>

    <label for="notes">Notes</label>
    <textarea id="notes" name="notes" rows="4">{values.notes}</textarea>

    <button type="submit"> Create and log food </button>
  </form>
</main>
