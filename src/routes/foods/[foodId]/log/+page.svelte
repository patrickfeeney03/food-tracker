<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import DiaryDestinationFields from "$lib/components/amount-adjuster/DiaryDestinationFields.svelte";
  import NutritionPreview from "$lib/components/amount-adjuster/NutritionPreview.svelte";
  import PortionBasisSelector from "$lib/components/amount-adjuster/PortionBasisSelector.svelte";
  import PortionQuantityField from "$lib/components/amount-adjuster/PortionQuantityField.svelte";
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import { withQuery } from "$lib/navigation";
  import type { MealSlot, PortionKind } from "$lib/nutrition/constants";
  import {
    formatStoredValue,
    parsePortionCountToMilli,
    resolvePortionAmount,
    scaleNutritionValue,
  } from "$lib/nutrition/math";
  import { untrack } from "svelte";
  import type { SubmitFunction } from "@sveltejs/kit";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  type FieldErrors = Partial<
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

  const mealNames: Record<MealSlot, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snacks: "Snacks",
  };

  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as FieldErrors);
  let portionKind = $state<PortionKind>(
    untrack(() => values.portionKind as PortionKind),
  );
  let portionCount = $state(untrack(() => values.portionCount));
  let diaryDate = $state(untrack(() => values.diaryDate));
  let mealSlot = $state<MealSlot>(untrack(() => values.mealSlot as MealSlot));
  let isSubmitting = $state(false);

  const enhanceLogFood: SubmitFunction = () => {
    isSubmitting = true;

    return async ({ result, update }) => {
      await update();

      if (result.type !== "redirect") {
        isSubmitting = false;
      }
    };
  };

  let displayUnit = $derived(data.food.amountUnit === "mg" ? "g" : "ml");
  let selectedPortion = $derived(
    data.portionOptions.find((option) => option.kind === portionKind),
  );

  let preview = $derived.by(() => {
    if (selectedPortion === undefined) return null;

    try {
      const resolvedAmount = resolvePortionAmount(
        BigInt(selectedPortion.amount),
        parsePortionCountToMilli(String(portionCount)),
      );
      const basisAmount = BigInt(data.food.basisAmount);

      return {
        resolvedAmount,
        energyMkcal: scaleNutritionValue(
          BigInt(data.food.energyMkcalPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        proteinMg: scaleNutritionValue(
          BigInt(data.food.proteinMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        carbsMg: scaleNutritionValue(
          BigInt(data.food.carbsMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        fatMg: scaleNutritionValue(
          BigInt(data.food.fatMgPerBasis),
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
  <title>Add {data.food.name} | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="relative flex flex-col overflow-hidden" size="wide">
    <header class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pt-8">
      <a
        href={resolve(
          withQuery("/foods", {
            date: data.context.date,
            mealSlot: data.context.mealSlot,
            q: data.context.q || undefined,
          }),
        )}
        aria-label="Back to food catalogue"
        class="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl
          text-2xl leading-none text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]"
      >
        <span aria-hidden="true">‹</span>
      </a>

      <div class="pt-1">
        <h1 class="text-[18px] font-bold leading-6 tracking-[-0.02em]">Add food</h1>
        <p class="mt-0.5 text-[11px] leading-4 text-[var(--app-muted)]">
          {mealNames[mealSlot]} · {diaryDate}
        </p>
      </div>
    </header>

    <form
      method="POST"
      use:enhance={enhanceLogFood}
      class="flex flex-1 flex-col px-3 pb-28 sm:px-8"
    >
      <input type="hidden" name="clientMutationId" value={values.clientMutationId} />
      <input type="hidden" name="q" value={data.context.q} />

      <div class="mx-auto w-full max-w-xl flex-1">
        {#if errors.form || errors.clientMutationId}
          <FeedbackBanner
            class="mb-5"
            message={errors.form?.[0] ?? errors.clientMutationId?.[0] ?? "Unable to add food"}
            tone="danger"
          />
        {/if}

        <section class="mb-6">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-[21px] font-extrabold leading-tight tracking-[-0.025em]">
                {data.food.name}
              </h2>
              <p class="mt-1 text-[12px] text-[var(--app-muted)]">
                {data.food.brand ?? "Custom food"}
              </p>
            </div>
            <a
              href={resolve(
                withQuery(`/foods/${data.food.id}/edit`, {
                  date: data.context.date,
                  mealSlot: data.context.mealSlot,
                  q: data.context.q || undefined,
                }),
              )}
              class="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold
                text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-[var(--app-accent)]"
            >Edit food</a>
          </div>
        </section>

        <div class="mb-6">
          <PortionBasisSelector
            options={data.portionOptions}
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
