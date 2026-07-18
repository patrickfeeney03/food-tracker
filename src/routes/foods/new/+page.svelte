<script lang="ts">
  import { resolve } from "$app/paths";
  import FoodFormFields, {
    type FoodFieldErrors,
  } from "$lib/components/FoodFormFields.svelte";
  import { withQuery } from "$lib/navigation";
  import { untrack } from "svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as FoodFieldErrors & {
    portionCount?: string[];
    portionKind?: string[];
  });
  let amountUnit = $state<"mg" | "ul">(
    untrack(() => (values.amountUnit === "ul" ? "ul" : "mg")),
  );
  let displayUnit = $derived(amountUnit === "ul" ? "ml" : "g");
</script>

<svelte:head>
  <title>Create food | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="mx-auto flex min-h-dvh w-full flex-col overflow-hidden bg-[#f6f7f9]
      text-[#182230] sm:min-h-[calc(100dvh-3rem)] sm:max-w-3xl sm:rounded-[26px]
      sm:border sm:border-white/70 sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]
      lg:max-w-5xl"
  >
    <header class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8">
      <a
        class="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl
          leading-none text-[#182230] transition hover:bg-white focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-[#2865e8]"
        href={resolve(withQuery("/foods", {
          date: data.destination.date,
          mealSlot: data.destination.mealSlot,
        }))}
        aria-label="Back to add food"
      ><span aria-hidden="true">‹</span></a>
      <div class="pt-1">
        <h1 class="text-[18px] font-bold leading-6 tracking-[-0.02em]">Create food</h1>
        <p class="mt-0.5 text-[11px] leading-4 text-[#738096]">
          Enter nutrition values for the stated label basis
        </p>
      </div>
    </header>

    <form method="POST" class="flex flex-1 flex-col px-3 pb-24 sm:flex-none sm:px-8 sm:pb-28">
      <input type="hidden" name="clientMutationId" value={values.clientMutationId} />
      <input type="hidden" name="diaryDate" value={values.diaryDate} />
      <input type="hidden" name="mealSlot" value={values.mealSlot} />
      <input type="hidden" name="portionKind" value={values.portionKind} />

      <FoodFormFields {values} {errors} bind:amountUnit />

      <fieldset class="mt-5 space-y-1.5">
        <legend class="text-[10px] font-bold uppercase tracking-[0.02em] text-[#738096]">
          First diary entry
        </legend>
        <p class="text-[11px] leading-4 text-[#738096]">
          Enter the number of 100 {displayUnit} portions consumed.
        </p>
        <label for="portionCount" class="sr-only">Number of 100 {displayUnit} portions</label>
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
            aria-invalid={errors.portionCount ? "true" : undefined}
            class="!min-h-[58px] !rounded-[12px] !border-[#d9dee6] !px-3.5
              !pr-24 !text-[18px] !font-bold !shadow-none
              focus:!border-[#2865e8] focus:!ring-[#2865e8]/15"
          />
          <span class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-semibold text-[#738096]">
            × 100 {displayUnit}
          </span>
        </div>
      </fieldset>
      {#if errors.portionCount || errors.portionKind}
        <p class="mt-2" role="alert">{errors.portionCount?.[0] ?? errors.portionKind?.[0]}</p>
      {/if}

      <div
        class="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full bg-[#f6f7f9]
          px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3
          sm:bottom-6 sm:max-w-3xl sm:justify-center sm:rounded-b-[26px]
          sm:px-8 sm:pb-4 sm:pt-4 lg:max-w-5xl"
      >
        <button
          type="submit"
          class="flex min-h-[52px] w-full items-center justify-center rounded-[12px]
            bg-[#2865e8] px-4 text-[14px] font-bold text-white shadow-sm transition
            hover:bg-[#1f56cf] focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#2865e8] active:translate-y-px sm:w-56"
        >Save food</button>
      </div>
    </form>
  </main>
</div>
