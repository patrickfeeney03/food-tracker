<script lang="ts">
  import { resolve } from "$app/paths";
  import { withQuery } from "$lib/navigation";
  import { untrack } from "svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let values = $derived(form?.values ?? data.values);
  let errors = $derived(form?.errors);
  let amountUnit = $state<"mg" | "ul">(
    untrack(() => (values.amountUnit === "ul" ? "ul" : "mg")),
  );

  let displayUnit = $derived(amountUnit === "mg" ? "g" : "ml");
</script>

<svelte:head>
  <title>Create food | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-[var(--app-surface)]
    text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-[26px]
    sm:border sm:border-[var(--app-border)]/70 sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]
    lg:max-w-5xl"
  >
    <header
      class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8"
    >
      <a
        class="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl
        leading-none text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
        href={resolve(
          withQuery("/foods", {
            date: data.destination.date,
            mealSlot: data.destination.mealSlot,
          }),
        )}
        aria-label="Back to add food"
      >
        <span aria-hidden="true">‹</span>
      </a>

      <div class="pt-1">
        <h1 class="text-[18px] font-bold leading-6 tracking-[-0.02em]">
          Create food
        </h1>
        <p class="mt-0.5 text-[11px] leading-4 text-[var(--app-muted)]">
          Enter nutrition values for the stated label basis
        </p>
      </div>
    </header>

    <form
      method="POST"
      class="flex flex-1 flex-col px-3 pb-24 sm:flex-none sm:px-8 sm:pb-28"
    >
      <input
        type="hidden"
        name="clientMutationId"
        value={values.clientMutationId}
      />
      <input type="hidden" name="diaryDate" value={values.diaryDate} />
      <input type="hidden" name="mealSlot" value={values.mealSlot} />
      <input type="hidden" name="portionKind" value={values.portionKind} />
      <input type="hidden" name="barcode" value={values.barcode} />

      <div
        class="space-y-3 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5 sm:space-y-0"
      >
        <div class="space-y-1.5">
          <label
            for="name"
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Food name
          </label>
          <input
            id="name"
            name="name"
            value={values.name}
            maxlength="200"
            required
            autocomplete="off"
            aria-invalid={errors?.name ? "true" : undefined}
            class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !px-3.5 !text-[14px]
            !font-semibold !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
          />
          {#if errors?.name}
            <p role="alert">{errors.name[0]}</p>
          {/if}
        </div>

        <div class="space-y-1.5">
          <label
            for="brand"
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Brand
          </label>
          <input
            id="brand"
            name="brand"
            value={values.brand}
            maxlength="200"
            autocomplete="organization"
            class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !px-3.5 !text-[14px]
            !font-semibold !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
          />
        </div>

        <fieldset class="space-y-1.5">
          <legend
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Type
          </legend>

          <div
            class="grid min-h-12 grid-cols-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] p-0.5"
          >
            <label
              class={[
                "flex cursor-pointer items-center justify-center rounded-full !text-[13px] !font-semibold transition",
                amountUnit === "mg"
                  ? "bg-[var(--app-accent)] text-white"
                  : "text-[var(--app-muted)]",
              ]}
            >
              <input
                class="sr-only"
                type="radio"
                name="amountUnit"
                value="mg"
                bind:group={amountUnit}
              />
              Solid (g)
            </label>

            <label
              class={[
                "flex cursor-pointer items-center justify-center rounded-full !text-[13px] !font-semibold transition",
                amountUnit === "ul"
                  ? "bg-[var(--app-accent)] text-white"
                  : "text-[var(--app-muted)]",
              ]}
            >
              <input
                class="sr-only"
                type="radio"
                name="amountUnit"
                value="ul"
                bind:group={amountUnit}
              />
              Liquid (ml)
            </label>
          </div>
          {#if errors?.amountUnit}
            <p role="alert">{errors.amountUnit[0]}</p>
          {/if}
        </fieldset>

        <div class="space-y-1.5">
          <label
            for="basisAmount"
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Nutrition label basis
          </label>
          <div class="relative">
            <input
              id="basisAmount"
              name="basisAmount"
              type="number"
              min="0.001"
              step="0.001"
              inputmode="decimal"
              value={values.basisAmount}
              required
              aria-invalid={errors?.basisAmount ? "true" : undefined}
              class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !px-3.5 !pr-12
              !text-[14px] !font-semibold !shadow-none focus:!border-[var(--app-accent)]
              focus:!ring-[var(--app-accent)]/15"
            />
            <span
              class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center
              text-[12px] font-semibold text-[var(--app-muted)]"
            >
              {displayUnit}
            </span>
          </div>
          {#if errors?.basisAmount}
            <p role="alert">{errors.basisAmount[0]}</p>
          {/if}
        </div>

        <fieldset class="space-y-1.5">
          <legend
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Optional portions
          </legend>

          <div class="grid grid-cols-2 gap-3">
            <div class="relative">
              <label
                for="servingAmount"
                class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                !font-medium text-[var(--app-muted)]"
              >
                Serving
              </label>
              <input
                id="servingAmount"
                name="servingAmount"
                type="number"
                min="0.001"
                step="0.001"
                inputmode="decimal"
                value={values.servingAmount}
                placeholder="—"
                aria-invalid={errors?.servingAmount ? "true" : undefined}
                class="!min-h-[54px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5 !pl-3
                !pr-8 !pt-5 !text-[13px] !font-semibold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
              />
              <span
                class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
              >
                {displayUnit}
              </span>
            </div>

            <div class="relative">
              <label
                for="containerAmount"
                class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                !font-medium text-[var(--app-muted)]"
              >
                Container
              </label>
              <input
                id="containerAmount"
                name="containerAmount"
                type="number"
                min="0.001"
                step="0.001"
                inputmode="decimal"
                value={values.containerAmount}
                placeholder="—"
                aria-invalid={errors?.containerAmount ? "true" : undefined}
                class="!min-h-[54px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5 !pl-3
                !pr-8 !pt-5 !text-[13px] !font-semibold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
              />
              <span
                class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
              >
                {displayUnit}
              </span>
            </div>
          </div>
          {#if errors?.servingAmount}
            <p role="alert">{errors.servingAmount[0]}</p>
          {/if}
          {#if errors?.containerAmount}
            <p role="alert">{errors.containerAmount[0]}</p>
          {/if}
        </fieldset>

        <fieldset class="space-y-1.5">
          <legend
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Required nutrition
          </legend>

          <div class="grid grid-cols-2 gap-3">
            <div class="relative">
              <label
                for="energyKcal"
                class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                !font-medium text-[var(--app-muted)]"
              >
                Calories
              </label>
              <input
                id="energyKcal"
                name="energyKcal"
                type="number"
                min="0"
                step="0.001"
                inputmode="decimal"
                value={values.energyKcal}
                required
                aria-invalid={errors?.energyKcal ? "true" : undefined}
                class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5 !pl-3
                !pr-11 !pt-5 !text-[14px] !font-bold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
              />
              <span
                class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
              >
                kcal
              </span>
            </div>

            <div class="relative">
              <label
                for="proteinG"
                class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                !font-medium text-[var(--app-muted)]"
              >
                Protein
              </label>
              <input
                id="proteinG"
                name="proteinG"
                type="number"
                min="0"
                step="0.001"
                inputmode="decimal"
                value={values.proteinG}
                required
                aria-invalid={errors?.proteinG ? "true" : undefined}
                class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5 !pl-3
                !pr-7 !pt-5 !text-[14px] !font-bold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
              />
              <span
                class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
              >
                g
              </span>
            </div>

            <div class="relative">
              <label
                for="carbsG"
                class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                !font-medium text-[var(--app-muted)]"
              >
                Carbs
              </label>
              <input
                id="carbsG"
                name="carbsG"
                type="number"
                min="0"
                step="0.001"
                inputmode="decimal"
                value={values.carbsG}
                required
                aria-invalid={errors?.carbsG ? "true" : undefined}
                class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5 !pl-3
                !pr-7 !pt-5 !text-[14px] !font-bold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
              />
              <span
                class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
              >
                g
              </span>
            </div>

            <div class="relative">
              <label
                for="fatG"
                class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                !font-medium text-[var(--app-muted)]"
              >
                Fat
              </label>
              <input
                id="fatG"
                name="fatG"
                type="number"
                min="0"
                step="0.001"
                inputmode="decimal"
                value={values.fatG}
                required
                aria-invalid={errors?.fatG ? "true" : undefined}
                class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5 !pl-3
                !pr-7 !pt-5 !text-[14px] !font-bold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
              />
              <span
                class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                font-semibold text-[var(--app-muted)]"
              >
                g
              </span>
            </div>
          </div>

          {#if errors?.energyKcal}
            <p role="alert">{errors.energyKcal[0]}</p>
          {/if}
          {#if errors?.proteinG}
            <p role="alert">{errors.proteinG[0]}</p>
          {/if}
          {#if errors?.carbsG}
            <p role="alert">{errors.carbsG[0]}</p>
          {/if}
          {#if errors?.fatG}
            <p role="alert">{errors.fatG[0]}</p>
          {/if}
        </fieldset>

        <details
          class="group"
          open={Boolean(
            errors?.fibreG ||
              errors?.sugarG ||
              errors?.saturatedFatG ||
              errors?.sodiumMg ||
              errors?.potassiumMg,
          )}
        >
          <summary
            class="flex min-h-11 cursor-pointer list-none items-center justify-between
            rounded-lg text-[13px] font-semibold text-[var(--app-accent)]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-accent)]"
          >
            Additional nutrition
            <span
              class="text-lg transition-transform group-open:rotate-90"
              aria-hidden="true">›</span
            >
          </summary>

          <div class="grid grid-cols-2 gap-3 pb-2">
            {#each [{ id: "fibreG", label: "Fibre", value: values.fibreG, unit: "g", error: errors?.fibreG }, { id: "sugarG", label: "Sugar", value: values.sugarG, unit: "g", error: errors?.sugarG }, { id: "saturatedFatG", label: "Saturated fat", value: values.saturatedFatG, unit: "g", error: errors?.saturatedFatG }, { id: "sodiumMg", label: "Sodium", value: values.sodiumMg, unit: "mg", error: errors?.sodiumMg }, { id: "potassiumMg", label: "Potassium", value: values.potassiumMg, unit: "mg", error: errors?.potassiumMg }] as nutrient (nutrient.id)}
              <div class="relative">
                <label
                  for={nutrient.id}
                  class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                  !font-medium text-[var(--app-muted)]"
                >
                  {nutrient.label}
                </label>
                <input
                  id={nutrient.id}
                  name={nutrient.id}
                  type="number"
                  min="0"
                  step={nutrient.unit === "mg" ? "1" : "0.001"}
                  inputmode="decimal"
                  value={nutrient.value}
                  aria-invalid={nutrient.error ? "true" : undefined}
                  class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5
                  !pl-3 !pr-9 !pt-5 !text-[14px] !font-bold !shadow-none
                  focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
                />
                <span
                  class="pointer-events-none absolute bottom-2 right-3 text-[11px]
                  font-semibold text-[var(--app-muted)]"
                >
                  {nutrient.unit}
                </span>
                {#if nutrient.error}
                  <p role="alert" class="mt-1">{nutrient.error[0]}</p>
                {/if}
              </div>
            {/each}
          </div>
        </details>

        <details class="group">
          <summary
            class="flex min-h-11 cursor-pointer list-none items-center justify-between
            rounded-lg text-[13px] font-semibold text-[var(--app-accent)]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-accent)]"
          >
            <span class="flex flex-1 items-center justify-between">
              <span>Notes</span>
              <span class="mr-2 text-[11px] font-medium text-[var(--app-muted)]"
                >Optional</span
              >
            </span>
            <span
              class="text-lg transition-transform group-open:rotate-90"
              aria-hidden="true">›</span
            >
          </summary>

          <label for="notes" class="sr-only">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows="5"
            placeholder="Add anything useful about this food or its values."
            class="!rounded-[12px] !border-[var(--app-border)] !text-[14px] !leading-6
            !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            >{values.notes}</textarea
          >
        </details>

        <fieldset class="space-y-1.5">
          <legend
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            First diary entry
          </legend>

          <p class="text-[11px] leading-4 text-[var(--app-muted)]">
            Enter the number of 100 {displayUnit} portions consumed.
          </p>

          <label for="portionCount" class="sr-only">
            Number of 100 {displayUnit} portions
          </label>
          <div class="relative">
            <input
              id="portionCount"
              name="portionCount"
              type="number"
              min="0.001"
              step="0.001"
              inputmode="decimal"
              value={values.portionCount}
              required
              aria-invalid={errors?.portionCount ? "true" : undefined}
              class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !px-3.5
              !pr-24 !text-[18px] !font-bold !shadow-none
              focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            />
            <span
              class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center
              text-[12px] font-semibold text-[var(--app-muted)]"
            >
              × 100 {displayUnit}
            </span>
          </div>
        </fieldset>

        {#if errors?.portionCount || errors?.portionKind}
          <p role="alert">
            {errors.portionCount?.[0] ?? errors.portionKind?.[0]}
          </p>
        {/if}
      </div>

      <div
        class="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full
        px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3
        sm:bottom-6 sm:max-w-3xl sm:justify-center sm:rounded-b-[26px]
        sm:px-8 sm:pb-4 sm:pt-4 lg:max-w-5xl"
      >
        <button
          type="submit"
          class="flex min-h-[52px] w-full items-center justify-center rounded-[12px]
          bg-[var(--app-accent)] px-4 text-[14px] font-bold text-white shadow-sm transition
          hover:bg-[var(--app-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)] active:translate-y-px sm:w-56"
        >
          Save food
        </button>
      </div>
    </form>
  </main>
</div>
