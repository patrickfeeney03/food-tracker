<script lang="ts">
  import { resolve } from "$app/paths";
  import { withQuery } from "$lib/navigation";
  import {
    mealSlots,
    type MealSlot,
    type PortionKind,
  } from "$lib/nutrition/constants";
  import {
    formatStoredValue,
    parsePortionCountToMilli,
    resolvePortionAmount,
    scaleNutritionValue,
  } from "$lib/nutrition/math";
  import { untrack } from "svelte";
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

  function formatKcal(value: bigint): string {
    return formatStoredValue(value, 0);
  }

  function formatGrams(value: bigint): string {
    return formatStoredValue(value, 1);
  }
</script>

<svelte:head>
  <title>Add {data.food.name} | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="relative mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-[var(--app-surface)]
      text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-[26px]
      sm:border sm:border-[var(--app-border)]/70 sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]"
  >
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

    <form method="POST" class="flex flex-1 flex-col px-3 pb-28 sm:px-8">
      <input type="hidden" name="clientMutationId" value={values.clientMutationId} />
      <input type="hidden" name="q" value={data.context.q} />

      <div class="mx-auto w-full max-w-xl flex-1">
        {#if errors.form || errors.clientMutationId}
          <div
            class="mb-5 rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] px-3 py-2.5 text-sm font-medium text-[var(--app-danger-text)]"
            role="alert"
          >
            {errors.form?.[0] ?? errors.clientMutationId?.[0]}
          </div>
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

        <fieldset class="mb-6">
          <legend
            class="mb-2 text-[10px] font-bold uppercase tracking-[0.02em]
              text-[var(--app-muted)]"
          >
            Amount basis
          </legend>
          <div
            class="grid gap-2"
            style:grid-template-columns={`repeat(${data.portionOptions.length}, minmax(0, 1fr))`}
          >
            {#each data.portionOptions as option (option.kind)}
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
                  aria-describedby={errors.portionKind ? "portion-kind-error" : undefined}
                />
                {option.label}
              </label>
            {/each}
          </div>
          {#if errors.portionKind}
            <p
              id="portion-kind-error"
              class="mt-2 text-[12px] text-[var(--app-danger-text)]"
              role="alert"
            >
              {errors.portionKind[0]}
            </p>
          {/if}
        </fieldset>

        <div class="mb-3 space-y-1.5">
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
              aria-describedby={errors.portionCount ? "portion-count-error" : undefined}
              class="!min-h-[58px] !rounded-[13px] !border-[var(--app-border)] !px-3.5
                !pr-24 !text-[20px] !font-bold !shadow-none
                focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
            />
            <span
              class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center
                text-[12px] font-semibold text-[var(--app-muted)]"
            >
              × {selectedPortion?.label ?? ""}
            </span>
          </div>
          {#if errors.portionCount}
            <p
              id="portion-count-error"
              class="text-[12px] text-[var(--app-danger-text)]"
              role="alert"
            >
              {errors.portionCount[0]}
            </p>
          {/if}
        </div>

        <div class="mb-5 flex items-center justify-between gap-5 px-0.5" aria-live="polite">
          <span class="text-[12px] text-[var(--app-muted)]">Resolved amount</span>
          <strong class="text-[15px]">
            {preview
              ? `${formatStoredValue(preview.resolvedAmount, 3)} ${displayUnit}`
              : "—"}
          </strong>
        </div>

        <section
          aria-label="Nutrition preview"
          aria-live="polite"
          class="mb-7 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4"
        >
          <strong class="block text-[28px] font-extrabold leading-none">
            {preview ? formatKcal(preview.energyMkcal) : "—"}
          </strong>
          <span class="mt-1 block text-[10px] text-[var(--app-muted)]">kcal</span>

          <dl class="mt-6 grid grid-cols-3 gap-4">
            <div>
              <dt class="text-[10px] text-[var(--app-muted)]">Protein</dt>
              <dd class="mt-1 text-[13px] font-bold text-[var(--app-purple)]">
                {preview ? formatGrams(preview.proteinMg) : "—"} g
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-[var(--app-muted)]">Carbs</dt>
              <dd class="mt-1 text-[13px] font-bold text-[var(--app-orange)]">
                {preview ? formatGrams(preview.carbsMg) : "—"} g
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-[var(--app-muted)]">Fat</dt>
              <dd class="mt-1 text-[13px] font-bold text-[var(--app-green)]">
                {preview ? formatGrams(preview.fatMg) : "—"} g
              </dd>
            </div>
          </dl>
        </section>

        <div class="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">
          <label class="flex min-h-14 items-center justify-between gap-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]">
            <span class="text-[12px] text-[var(--app-muted)]">Date</span>
            <input
              type="date"
              name="diaryDate"
              bind:value={diaryDate}
              required
              aria-invalid={errors.diaryDate ? "true" : undefined}
              aria-describedby={errors.diaryDate ? "destination-error" : undefined}
              class="!w-auto !border-0 !bg-transparent !p-0 !text-right
                !text-[13px] !font-bold !shadow-none focus:!ring-0"
            />
          </label>
          <label class="flex min-h-14 items-center justify-between gap-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]">
            <span class="text-[12px] text-[var(--app-muted)]">Meal</span>
            <select
              name="mealSlot"
              bind:value={mealSlot}
              aria-invalid={errors.mealSlot ? "true" : undefined}
              aria-describedby={errors.mealSlot ? "destination-error" : undefined}
              class="!w-auto !border-0 !bg-transparent !py-0 !pl-0 !pr-7
                !text-right !text-[13px] !font-bold !shadow-none focus:!ring-0"
            >
              {#each mealSlots as slot (slot)}
                <option value={slot}>{mealNames[slot]}</option>
              {/each}
            </select>
          </label>
        </div>

        {#if errors.diaryDate || errors.mealSlot}
          <div
            id="destination-error"
            class="mt-3 text-[12px] text-[var(--app-danger-text)]"
            role="alert"
          >
            {errors.diaryDate?.[0] ?? errors.mealSlot?.[0]}
          </div>
        {/if}
      </div>

      <div
        class="fixed inset-x-0 bottom-0 z-10 bg-[var(--app-surface)] px-3
          pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:absolute sm:px-8 sm:py-4"
      >
        <button
          type="submit"
          disabled={preview === null}
          class="mx-auto block min-h-14 w-full max-w-xl cursor-pointer rounded-[13px]
            border-0 bg-[var(--app-accent)] px-5 text-[14px] font-bold text-white
            shadow-[0_3px_8px_rgba(40,101,232,0.22)] transition
            hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-3 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-accent)]/35"
        >
          Add to diary
        </button>
      </div>
    </form>
  </main>
</div>
