<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- resolvedEditFoodHref is base-resolved */
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import DiaryDestinationFields from "$lib/components/amount-adjuster/DiaryDestinationFields.svelte";
  import NutritionPreview from "$lib/components/amount-adjuster/NutritionPreview.svelte";
  import PortionBasisSelector from "$lib/components/amount-adjuster/PortionBasisSelector.svelte";
  import PortionQuantityField from "$lib/components/amount-adjuster/PortionQuantityField.svelte";
  import { withQuery } from "$lib/navigation";
  import {
    mealNames,
    type MealSlot,
    type PortionKind,
  } from "$lib/nutrition/constants";
  import {
    formatStoredValue,
    parsePortionCountToMilli,
    resolvePortionAmount,
    scaleNutritionValue,
  } from "$lib/nutrition/math";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { untrack } from "svelte";

  export type AmountAdjusterFood = {
    id: string;
    name: string;
    brand: string | null;
    amountUnit: "mg" | "ul";
    basisAmount: number;
    energyMkcalPerBasis: number;
    proteinMgPerBasis: number;
    carbsMgPerBasis: number;
    fatMgPerBasis: number;
  };

  export type AmountAdjusterContext = {
    date: string;
    mealSlot: MealSlot;
    q: string;
  };

  export type AmountAdjusterPortionOption = {
    kind: PortionKind;
    label: string;
    amount: number;
  };

  export type AmountAdjusterValues = {
    clientMutationId: string;
    portionKind: PortionKind | string;
    portionCount: string | number;
    diaryDate: string;
    mealSlot: MealSlot | string;
  };

  export type AmountAdjusterFieldErrors = Partial<
    Record<
      | "form"
      | "clientMutationId"
      | "portionKind"
      | "portionCount"
      | "diaryDate"
      | "mealSlot",
      string[]
    >
  >;

  let {
    food,
    context,
    portionOptions,
    initialValues,
    errors = {},
    enhanceSubmit,
    editFoodHref,
  }: {
    food: AmountAdjusterFood;
    context: AmountAdjusterContext;
    portionOptions: readonly AmountAdjusterPortionOption[];
    initialValues: AmountAdjusterValues;
    errors?: AmountAdjusterFieldErrors;
    enhanceSubmit?: SubmitFunction;
    editFoodHref?: string | null;
  } = $props();

  let portionKind = $state<PortionKind>(
    untrack(() => initialValues.portionKind),
  );
  let portionCount = $state(untrack(() => initialValues.portionCount));
  let diaryDate = $state(untrack(() => initialValues.diaryDate));
  let mealSlot = $state<MealSlot>(untrack(() => initialValues.mealSlot));
  let isSubmitting = $state(false);
  let resolvedEditFoodHref = $derived(
    editFoodHref === undefined
      ? resolve(
          withQuery(`/foods/${food.id}/edit`, {
            date: context.date,
            mealSlot: context.mealSlot,
            q: context.q || undefined,
          }),
        )
      : editFoodHref,
  );

  const enhanceLogFood: SubmitFunction = async (input) => {
    isSubmitting = true;
    let cancelled = false;

    try {
      const submitCallback = await enhanceSubmit?.({
        ...input,
        cancel: () => {
          cancelled = true;
          input.cancel();
        },
      });

      if (cancelled) {
        isSubmitting = false;
        return submitCallback;
      }

      return async (submission) => {
        try {
          if (submitCallback) {
            await submitCallback(submission);
          } else {
            await submission.update();
          }
        } finally {
          if (submission.result.type !== "redirect") {
            isSubmitting = false;
          }
        }
      };
    } catch (error) {
      isSubmitting = false;
      throw error;
    }
  };

  let displayUnit = $derived(food.amountUnit === "mg" ? "g" : "ml");
  let selectedPortion = $derived(
    portionOptions.find((option) => option.kind === portionKind),
  );

  let preview = $derived.by(() => {
    if (selectedPortion === undefined) return null;

    try {
      const resolvedAmount = resolvePortionAmount(
        BigInt(selectedPortion.amount),
        parsePortionCountToMilli(String(portionCount)),
      );
      const basisAmount = BigInt(food.basisAmount);

      return {
        resolvedAmount,
        energyMkcal: scaleNutritionValue(
          BigInt(food.energyMkcalPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        proteinMg: scaleNutritionValue(
          BigInt(food.proteinMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        carbsMg: scaleNutritionValue(
          BigInt(food.carbsMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        fatMg: scaleNutritionValue(
          BigInt(food.fatMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
      };
    } catch {
      return null;
    }
  });
</script>

<AppPageShell class="relative flex flex-col overflow-hidden" size="wide">
  <BackPageHeader
    href={resolve(
      withQuery("/foods", {
        date: context.date,
        mealSlot: context.mealSlot,
        q: context.q || undefined,
      }),
    )}
    backLabel="Back to food catalogue"
    title="Add food"
    description={`${mealNames[mealSlot]} · ${diaryDate}`}
    class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pt-8"
    linkClass="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
    titleClass="text-[18px] font-bold leading-6 tracking-[-0.02em]"
    descriptionClass="mt-0.5 text-[11px] leading-4 text-[var(--app-muted)]"
  />

  <form
    method="POST"
    use:enhance={enhanceLogFood}
    class="flex flex-1 flex-col px-3 pb-28 sm:px-8"
  >
    <input
      type="hidden"
      name="clientMutationId"
      value={initialValues.clientMutationId}
    />

    <div class="mx-auto w-full max-w-xl flex-1">
      {#if errors.form || errors.clientMutationId}
        <FeedbackBanner
          class="mb-5"
          message={errors.form?.[0] ??
            errors.clientMutationId?.[0] ??
            "Unable to add food"}
          tone="danger"
        />
      {/if}

      <section class="mb-6">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h2
              class="text-[21px] font-extrabold leading-tight tracking-[-0.025em]"
            >
              {food.name}
            </h2>
            <p class="mt-1 text-[12px] text-[var(--app-muted)]">
              {food.brand ?? "Custom food"}
            </p>
          </div>
          {#if resolvedEditFoodHref !== null}
            <a
              href={resolvedEditFoodHref}
              class="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold
                text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-[var(--app-accent)]">Edit food</a
            >
          {:else}
            <span
              aria-disabled="true"
              title="Available when online"
              class="inline-flex min-h-11 shrink-0 cursor-not-allowed items-center rounded-lg
                px-2 text-xs font-bold text-[var(--app-muted)] opacity-50"
              >Edit food</span
            >
          {/if}
        </div>
      </section>

      <div class="mb-6">
        <PortionBasisSelector
          options={portionOptions}
          bind:portionKind
          error={errors.portionKind?.[0]}
        />
      </div>

      <div class="mb-5">
        <PortionQuantityField
          bind:portionCount
          portionLabel={selectedPortion?.label}
          resolvedAmount={preview
            ? `${formatStoredValue(preview.resolvedAmount, 3)} ${displayUnit}`
            : "—"}
          error={errors.portionCount?.[0]}
        />
      </div>

      <div class="mb-7">
        <NutritionPreview {preview} />
      </div>

      <DiaryDestinationFields
        bind:diaryDate
        bind:mealSlot
        diaryDateError={errors.diaryDate?.[0]}
        mealSlotError={errors.mealSlot?.[0]}
      />
    </div>

    <BottomSubmitBar
      label={isSubmitting ? "Adding…" : "Add to diary"}
      disabled={preview === null}
      busy={isSubmitting}
    />
  </form>
</AppPageShell>
