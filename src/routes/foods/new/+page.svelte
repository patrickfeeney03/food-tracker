<script lang="ts">
  import { resolve } from "$app/paths";
  import NutritionPreview from "$lib/components/amount-adjuster/NutritionPreview.svelte";
  import PortionBasisSelector from "$lib/components/amount-adjuster/PortionBasisSelector.svelte";
  import PortionQuantityField from "$lib/components/amount-adjuster/PortionQuantityField.svelte";
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import FoodFormFields, {
    type FoodFieldErrors,
    type FoodFieldValues,
  } from "$lib/components/FoodFormFields.svelte";
  import { readFoodFormValues } from "$lib/nutrition/food-form";
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
  let foodValues = $state<FoodFieldValues>(
    untrack(() => ({ ...values })),
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

    foodValues = readFoodFormValues(formData);

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

<AppPageShell class="flex flex-col overflow-hidden" size="wide">
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
        <FeedbackBanner class="mb-4" message={errors.form[0]} tone="danger" />
      {/if}

      <FoodFormFields values={foodValues} {errors} bind:amountUnit />

      <div class="mt-6 space-y-3 sm:col-span-2">
        <PortionBasisSelector
          options={portionOptions}
          bind:portionKind
          error={errors.portionKind?.[0]}
          legend="First diary entry"
          wrapOnMobile
        />

        <PortionQuantityField
          bind:portionCount
          portionLabel={selectedPortion?.label}
          fallbackLabel="portion"
          resolvedAmount={preview
            ? `${formatStoredValue(preview.resolvedAmount, 3)} ${displayUnit}`
            : "—"}
          error={errors.portionCount?.[0]}
          wideSuffix
        />

        <NutritionPreview
          {preview}
          label="First entry nutrition preview"
          energyFractionalDigits={1}
          compact
        />
      </div>

      <BottomSubmitBar label="Save food" disabled={preview === null} layout="floating" />
    </form>
</AppPageShell>
