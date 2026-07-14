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

<main>
  <header>
    <a
      href={resolve(
        withQuery("/foods", {
          date: data.destination.date,
          mealSlot: data.destination.mealSlot,
        }),
      )}
    >
      Back
    </a>

    <div>
      <h1>Create food</h1>
      <p>
        This food will also be logged to
        {data.destination.mealSlot}
        on {data.destination.date}.
      </p>
    </div>
  </header>

  <form method="POST">
    <input
      type="hidden"
      name="clientMutationId"
      value={values.clientMutationId}
    />
    <input type="hidden" name="diaryDate" value={values.diaryDate} />
    <input type="hidden" name="mealSlot" value={values.mealSlot} />
    <input type="hidden" name="portionKind" value={values.portionKind} />

    <fieldset>
      <legend>Food identity</legend>

      <label for="name">Name</label>
      <input
        id="name"
        name="name"
        value={values.name}
        maxlength="200"
        required
        aria-invalid={errors?.name ? "true" : undefined}
      />
      {#if errors?.name}
        <p role="alert">{errors.name[0]}</p>
      {/if}

      <label for="brand">Brand</label>
      <input id="brand" name="brand" value={values.brand} />

      <label for="barcode">Barcode</label>
      <input
        id="barcode"
        name="barcode"
        value={values.barcode}
        inputmode="numeric"
      />
    </fieldset>

    <fieldset>
      <legend>Measurement</legend>

      <label for="amountUnit">Food type</label>
      <select id="amountUnit" name="amountUnit" value={values.amountUnit}>
        <option value="mg">Solid — grams</option>
        <option value="ul">Liquid — millilitres</option>
      </select>
      {#if errors?.amountUnit}
        <p role="alert">{errors.amountUnit[0]}</p>
      {/if}

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
    </fieldset>

    <fieldset>
      <legend>Nutrition on the stated basis</legend>

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
    </fieldset>

    <fieldset>
      <legend>First diary entry</legend>

      <p>The amount is entered as a number of 100 g/ml portions.</p>

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
    </fieldset>

    <label for="notes">Notes</label>
    <textarea id="notes" name="notes" rows="4">{values.notes}</textarea>

    <button type="submit"> Create and log food </button>
  </form>
</main>
