<script lang="ts">
  import { resolve } from "$app/paths";
  import FoodFormFields, {
    type FoodFieldErrors,
  } from "$lib/components/FoodFormFields.svelte";
  import { withQuery } from "$lib/navigation";
  import type { PortionKind } from "$lib/nutrition/constants";
  import {
    formatStoredValue,
    parseFixedPoint,
    parseGramsToMg,
    parseKcalToMkcal,
    parsePortionCountToMilli,
    resolvePortionAmount,
    scaleNutritionValue,
  } from "$lib/nutrition/math";
  import { untrack } from "svelte";
  import type { PageProps } from "./$types";

  type FieldErrors = FoodFieldErrors & {
    form?: string[];
    portionCount?: string[];
    portionKind?: string[];
  };

  type PreviewInput = {
    basisAmount: string;
    servingAmount: string;
    containerAmount: string;
    energyKcal: string;
    proteinG: string;
    carbsG: string;
    fatG: string;
  };

  type PortionOption = {
    kind: PortionKind;
    label: string;
    amount: bigint;
  };

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as FieldErrors);
  let amountUnit = $state<"mg" | "ul">(
    untrack(() => (values.amountUnit === "ul" ? "ul" : "mg")),
  );
  let portionKind = $state<PortionKind>(
    untrack(() => {
      const kind = values.portionKind;
      return kind === "unit" || kind === "serving" || kind === "container"
        ? kind
        : "hundred";
    }),
  );
  let portionCount = $state(untrack(() => values.portionCount));
  let previewInput = $state<PreviewInput>(
    untrack(() => ({
      basisAmount: values.basisAmount,
      servingAmount: values.servingAmount,
      containerAmount: values.containerAmount,
      energyKcal: values.energyKcal,
      proteinG: values.proteinG,
      carbsG: values.carbsG,
      fatG: values.fatG,
    })),
  );

  let displayUnit = $derived(amountUnit === "ul" ? "ml" : "g");

  function formText(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  }

  function parsePositiveAmount(value: string): bigint | null {
    try {
      const amount = parseFixedPoint(value, 3);
      return amount > 0n ? amount : null;
    } catch {
      return null;
    }
  }

  function syncPreviewInput(event: Event) {
    const formElement = event.currentTarget as HTMLFormElement;
    const formData = new FormData(formElement);

    previewInput = {
      basisAmount: formText(formData, "basisAmount"),
      servingAmount: formText(formData, "servingAmount"),
      containerAmount: formText(formData, "containerAmount"),
      energyKcal: formText(formData, "energyKcal"),
      proteinG: formText(formData, "proteinG"),
      carbsG: formText(formData, "carbsG"),
      fatG: formText(formData, "fatG"),
    };

    if (
      (portionKind === "serving" &&
        parsePositiveAmount(previewInput.servingAmount) === null) ||
      (portionKind === "container" &&
        parsePositiveAmount(previewInput.containerAmount) === null)
    ) {
      portionKind = "hundred";
    }
  }

  let portionOptions = $derived.by(() => {
    const options: PortionOption[] = [
      { kind: "unit", label: `1 ${displayUnit}`, amount: 1_000n },
      { kind: "hundred", label: `100 ${displayUnit}`, amount: 100_000n },
    ];
    const servingAmount = parsePositiveAmount(previewInput.servingAmount);
    const containerAmount = parsePositiveAmount(previewInput.containerAmount);

    if (servingAmount !== null) {
      options.push({
        kind: "serving",
        label: `Serving (${formatStoredValue(servingAmount, 3)} ${displayUnit})`,
        amount: servingAmount,
      });
    }

    if (containerAmount !== null) {
      options.push({
        kind: "container",
        label: `Container (${formatStoredValue(containerAmount, 3)} ${displayUnit})`,
        amount: containerAmount,
      });
    }

    return options;
  });

  let selectedPortion = $derived(
    portionOptions.find((option) => option.kind === portionKind),
  );

  let preview = $derived.by(() => {
    if (selectedPortion === undefined) return null;

    try {
      const basisAmount = parseFixedPoint(previewInput.basisAmount, 3);
      const resolvedAmount = resolvePortionAmount(
        selectedPortion.amount,
        parsePortionCountToMilli(String(portionCount)),
      );

      return {
        resolvedAmount,
        energyMkcal: scaleNutritionValue(
          parseKcalToMkcal(previewInput.energyKcal),
          resolvedAmount,
          basisAmount,
        ),
        proteinMg: scaleNutritionValue(
          parseGramsToMg(previewInput.proteinG),
          resolvedAmount,
          basisAmount,
        ),
        carbsMg: scaleNutritionValue(
          parseGramsToMg(previewInput.carbsG),
          resolvedAmount,
          basisAmount,
        ),
        fatMg: scaleNutritionValue(
          parseGramsToMg(previewInput.fatG),
          resolvedAmount,
          basisAmount,
        ),
      };
    } catch {
      return null;
    }
  });
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
    <header class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8">
      <a
        class="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl
          leading-none text-[var(--app-text)] transition hover:bg-[var(--app-panel)]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]"
        href={resolve(withQuery("/foods", {
          date: data.destination.date,
          mealSlot: data.destination.mealSlot,
        }))}
        aria-label="Back to add food"
      ><span aria-hidden="true">‹</span></a>
      <div class="pt-1">
        <h1 class="text-[18px] font-bold leading-6 tracking-[-0.02em]">Create food</h1>
        <p class="mt-0.5 text-[11px] leading-4 text-[var(--app-muted)]">
          Enter nutrition values for the stated label basis
        </p>
      </div>
    </header>

    <form
      method="POST"
      oninput={syncPreviewInput}
      class="flex flex-1 flex-col px-3 pb-28 sm:px-8"
    >
      <input type="hidden" name="clientMutationId" value={values.clientMutationId} />
      <input type="hidden" name="diaryDate" value={values.diaryDate} />
      <input type="hidden" name="mealSlot" value={values.mealSlot} />

      {#if errors.form}
        <div
          class="mb-4 rounded-xl border border-[var(--app-danger-border)]
            bg-[var(--app-danger-bg)] px-3 py-2.5 text-sm font-medium
            text-[var(--app-danger-text)]"
          role="alert"
        >
          {errors.form[0]}
        </div>
      {/if}

      <FoodFormFields {values} {errors} bind:amountUnit />

      <fieldset class="mt-6 space-y-3 sm:col-span-2">
        <legend
          class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
        >
          First diary entry
        </legend>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {#each portionOptions as option (option.kind)}
            <label
              class={[
                "flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-2 text-center text-[12px] font-bold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]",
                portionKind === option.kind
                  ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
                  : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)]",
              ]}
            >
              <input
                class="sr-only"
                type="radio"
                name="portionKind"
                value={option.kind}
                bind:group={portionKind}
              />
              {option.label}
            </label>
          {/each}
        </div>
        {#if errors.portionKind}
          <p role="alert">{errors.portionKind[0]}</p>
        {/if}

        <div class="space-y-1.5">
          <label
            for="portionCount"
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
          >
            Number of portions
          </label>
          <div class="relative">
            <input
              id="portionCount"
              name="portionCount"
              type="number"
              min="0.001"
              step="0.001"
              inputmode="decimal"
              bind:value={portionCount}
              required
              autocomplete="off"
              aria-invalid={errors.portionCount ? "true" : undefined}
              class="!min-h-[58px] !rounded-[13px] !border-[var(--app-border)] !px-3.5
                !pr-32 !text-[20px] !font-bold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            />
            <span
              class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center
                text-[12px] font-semibold text-[var(--app-muted)]"
            >
              × {selectedPortion?.label ?? "portion"}
            </span>
          </div>
          {#if errors.portionCount}
            <p role="alert">{errors.portionCount[0]}</p>
          {/if}
        </div>

        <div class="flex items-center justify-between gap-5 px-0.5">
          <span class="text-[12px] text-[var(--app-muted)]">Resolved amount</span>
          <strong class="text-[15px]">
            {preview
              ? `${formatStoredValue(preview.resolvedAmount, 3)} ${displayUnit}`
              : "—"}
          </strong>
        </div>

        <section
          aria-label="First entry nutrition preview"
          aria-live="polite"
          class="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4"
        >
          <strong class="block text-[28px] font-extrabold leading-none">
            {preview ? formatStoredValue(preview.energyMkcal, 1) : "—"}
          </strong>
          <span class="mt-1 block text-[10px] text-[var(--app-muted)]">kcal</span>

          <dl class="mt-5 grid grid-cols-3 gap-4">
            <div>
              <dt class="text-[10px] text-[var(--app-muted)]">Protein</dt>
              <dd class="mt-1 text-[13px] font-bold text-[var(--app-purple)]">
                {preview ? formatStoredValue(preview.proteinMg, 1) : "—"} g
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-[var(--app-muted)]">Carbs</dt>
              <dd class="mt-1 text-[13px] font-bold text-[var(--app-orange)]">
                {preview ? formatStoredValue(preview.carbsMg, 1) : "—"} g
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-[var(--app-muted)]">Fat</dt>
              <dd class="mt-1 text-[13px] font-bold text-[var(--app-green)]">
                {preview ? formatStoredValue(preview.fatMg, 1) : "—"} g
              </dd>
            </div>
          </dl>
        </section>
      </fieldset>

      <div
        class="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full bg-[var(--app-surface)]
          px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3
          sm:bottom-6 sm:max-w-3xl sm:justify-center sm:rounded-b-[26px]
          sm:px-8 sm:pb-4 sm:pt-4 lg:max-w-5xl"
      >
        <button
          type="submit"
          disabled={preview === null}
          class="flex min-h-[52px] w-full items-center justify-center rounded-[12px]
            bg-[var(--app-accent)] px-4 text-[14px] font-bold text-white shadow-sm transition
            hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-accent)] active:translate-y-px sm:w-56"
        >Save food</button>
      </div>
    </form>
  </main>
</div>
