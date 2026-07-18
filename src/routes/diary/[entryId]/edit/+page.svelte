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
    Record<"portionKind" | "portionCount" | "diaryDate" | "mealSlot", string[]>
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

  let displayUnit = $derived(data.entry.amountUnit === "mg" ? "g" : "ml");
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
      const basisAmount = BigInt(data.entry.basisAmount);

      return {
        resolvedAmount,
        energyMkcal: scaleNutritionValue(
          BigInt(data.entry.energyMkcalPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        proteinMg: scaleNutritionValue(
          BigInt(data.entry.proteinMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        carbsMg: scaleNutritionValue(
          BigInt(data.entry.carbsMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
        fatMg: scaleNutritionValue(
          BigInt(data.entry.fatMgPerBasis),
          resolvedAmount,
          basisAmount,
        ),
      };
    } catch {
      return null;
    }
  });

  const loggedAtFormatter = new Intl.DateTimeFormat("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Dublin",
  });

  function formatKcal(value: bigint): string {
    return formatStoredValue(value, 0);
  }

  function formatGrams(value: bigint): string {
    return formatStoredValue(value, 1);
  }
</script>

<svelte:head>
  <title>Edit {data.entry.foodName} | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[#e7e7e7] sm:px-4 sm:py-6">
  <main
    class="relative mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-[#f6f7f9]
      text-[#182230] sm:min-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-[26px]
      sm:border sm:border-white/70 sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]"
  >
    <header class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pt-8">
      <a
        href={resolve(withQuery("/", { date: data.entry.diaryDate }))}
        aria-label="Back to diary"
        class="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl
          text-2xl leading-none text-[#182230] transition hover:bg-white
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[#2865e8]"
      >
        <span aria-hidden="true">‹</span>
      </a>

      <div class="pt-1">
        <h1 class="text-[18px] font-bold leading-6 tracking-[-0.02em]">
          Edit entry
        </h1>
        <p class="mt-0.5 text-[11px] leading-4 text-[#738096]">
          {mealNames[data.entry.mealSlot]} · {data.entry.diaryDate}
        </p>
      </div>
    </header>

    <form method="POST" class="flex flex-1 flex-col px-3 pb-28 sm:px-8">
      <div class="mx-auto w-full max-w-xl flex-1">
        <section class="mb-6">
          <h2
            class="text-[21px] font-extrabold leading-tight tracking-[-0.025em]"
          >
            {data.entry.foodName}
          </h2>
          <p class="mt-1 text-[12px] text-[#738096]">
            {data.entry.foodBrand ?? "Custom food"}
          </p>
        </section>

        <fieldset class="mb-6">
          <legend
            class="mb-2 text-[10px] font-bold uppercase tracking-[0.02em]
              text-[#738096]"
          >
            Amount basis
          </legend>
          <div
            class="grid gap-2"
            style:grid-template-columns={`repeat(${data.portionOptions.length}, minmax(0, 1fr))`}
          >
            {#each data.portionOptions as option (option.kind)}
              <label
                class="flex min-h-10 cursor-pointer items-center justify-center rounded-full
                  border px-2 text-center text-[12px] font-bold transition"
                class:border-[#2865e8]={portionKind === option.kind}
                class:bg-[#2865e8]={portionKind === option.kind}
                class:text-white={portionKind === option.kind}
                class:border-[#d9dee6]={portionKind !== option.kind}
                class:bg-white={portionKind !== option.kind}
                class:text-[#738096]={portionKind !== option.kind}
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
          {#if errors?.portionKind}
            <p class="mt-2 text-[12px] text-red-600" role="alert">
              {errors.portionKind[0]}
            </p>
          {/if}
        </fieldset>

        <div class="mb-3 space-y-1.5">
          <label
            for="portionCount"
            class="text-[10px] font-bold uppercase tracking-[0.02em] text-[#738096]"
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
              aria-invalid={errors?.portionCount ? "true" : undefined}
              class="!min-h-[58px] !rounded-[13px] !border-[#d9dee6] !px-3.5
                !pr-24 !text-[20px] !font-bold !shadow-none
                focus:!border-[#2865e8] focus:!ring-[#2865e8]/15"
            />
            <span
              class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center
                text-[12px] font-semibold text-[#738096]"
            >
              × {selectedPortion?.label ?? ""}
            </span>
          </div>
          {#if errors?.portionCount}
            <p class="text-[12px] text-red-600" role="alert">
              {errors.portionCount[0]}
            </p>
          {/if}
        </div>

        <div class="mb-5 flex items-center justify-between gap-5 px-0.5">
          <span class="text-[12px] text-[#738096]">Resolved amount</span>
          <strong class="text-[15px]">
            {preview
              ? `${formatStoredValue(preview.resolvedAmount, 1)} ${displayUnit}`
              : "—"}
          </strong>
        </div>

        <section
          aria-label="Nutrition preview"
          class="mb-7 rounded-[14px] border border-[#d9dee6] bg-white p-4"
        >
          <strong class="block text-[28px] font-extrabold leading-none">
            {preview ? formatKcal(preview.energyMkcal) : "—"}
          </strong>
          <span class="mt-1 block text-[10px] text-[#738096]">kcal</span>

          <dl class="mt-6 grid grid-cols-3 gap-4">
            <div>
              <dt class="text-[10px] text-[#738096]">Protein</dt>
              <dd class="mt-1 text-[13px] font-bold text-[#775eea]">
                {preview ? formatGrams(preview.proteinMg) : "—"} g
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-[#738096]">Carbs</dt>
              <dd class="mt-1 text-[13px] font-bold text-[#ee8b0b]">
                {preview ? formatGrams(preview.carbsMg) : "—"} g
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-[#738096]">Fat</dt>
              <dd class="mt-1 text-[13px] font-bold text-[#159c6a]">
                {preview ? formatGrams(preview.fatMg) : "—"} g
              </dd>
            </div>
          </dl>
        </section>

        <div class="divide-y divide-[#dfe3e9] border-y border-[#dfe3e9]">
          <label class="flex min-h-14 items-center justify-between gap-5">
            <span class="text-[12px] text-[#738096]">Date</span>
            <input
              type="date"
              name="diaryDate"
              bind:value={diaryDate}
              required
              class="!w-auto !border-0 !bg-transparent !p-0 !text-right
                !text-[13px] !font-bold !shadow-none focus:!ring-0"
            />
          </label>
          <label class="flex min-h-14 items-center justify-between gap-5">
            <span class="text-[12px] text-[#738096]">Meal</span>
            <select
              name="mealSlot"
              bind:value={mealSlot}
              class="!w-auto !border-0 !bg-transparent !py-0 !pl-0 !pr-7
                !text-right !text-[13px] !font-bold !shadow-none focus:!ring-0"
            >
              {#each mealSlots as slot (slot)}
                <option value={slot}>{mealNames[slot]}</option>
              {/each}
            </select>
          </label>
          <div class="flex min-h-14 items-center justify-between gap-5">
            <span class="text-[12px] text-[#738096]">Logged at</span>
            <strong class="text-[13px]">
              {loggedAtFormatter.format(data.entry.loggedAt)}
            </strong>
          </div>
        </div>

        {#if errors?.diaryDate || errors?.mealSlot}
          <div class="mt-3 text-[12px] text-red-600" role="alert">
            {errors?.diaryDate?.[0] ?? errors?.mealSlot?.[0]}
          </div>
        {/if}
      </div>

      <div
        class="fixed inset-x-0 bottom-0 z-10 bg-[#f6f7f9] px-3 py-3
          sm:absolute sm:px-8 sm:py-4"
      >
        <button
          type="submit"
          disabled={preview === null}
          class="mx-auto block min-h-14 w-full max-w-xl cursor-pointer rounded-[13px]
            border-0 bg-[#2865e8] px-5 text-[14px] font-bold text-white
            shadow-[0_3px_8px_rgba(40,101,232,0.22)] transition
            hover:bg-[#2058d4] disabled:cursor-not-allowed disabled:opacity-50
            focus-visible:outline-3 focus-visible:outline-offset-2
            focus-visible:outline-[#2865e8]/35"
        >
          Save changes
        </button>
      </div>
    </form>
  </main>
</div>
