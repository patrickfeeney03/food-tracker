<script lang="ts">
  import { resolve } from "$app/paths";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BottomSubmitBar from "$lib/components/BottomSubmitBar.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import UntrackedEntryFields from "$lib/components/UntrackedEntryFields.svelte";
  import { withQuery } from "$lib/navigation";
  import type { MealSlot } from "$lib/nutrition/constants";
  import { untrack } from "svelte";
  import type { PageProps } from "./$types";

  type FieldErrors = Partial<
    Record<"name" | "diaryDate" | "mealSlot" | "clientMutationId" | "form", string[]>
  >;

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let errors = $derived((form?.errors ?? {}) as FieldErrors);
  let diaryDate = $state(untrack(() => values.diaryDate));
  let mealSlot = $state<MealSlot>(untrack(() => values.mealSlot as MealSlot));
</script>

<svelte:head>
  <title>Add untracked food | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="flex flex-col overflow-hidden" size="wide">
  <BackPageHeader
    href={resolve(withQuery("/foods", {
      date: data.destination.date,
      mealSlot: data.destination.mealSlot,
    }))}
    backLabel="Back to add food"
    title="Add untracked food"
    description="Record what you ate without nutrition. It won't count toward your totals."
    class="flex items-start gap-3 px-3 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8"
    linkClass="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--app-text)] transition hover:bg-[var(--app-panel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
    titleClass="text-[18px] font-bold leading-6 tracking-[-0.02em]"
    descriptionClass="mt-0.5 text-[11px] leading-4 text-[var(--app-muted)]"
  />

  <form method="POST" class="flex flex-1 flex-col px-3 pb-28 sm:px-8">
    <input type="hidden" name="clientMutationId" value={values.clientMutationId} />

    <div class="mx-auto w-full max-w-xl flex-1">
      {#if errors.form}
        <FeedbackBanner class="mb-4" message={errors.form[0]} tone="danger" />
      {/if}
      {#if errors.clientMutationId}
        <FeedbackBanner class="mb-4" message={errors.clientMutationId[0]} tone="danger" />
      {/if}

      <UntrackedEntryFields
        name={values.name}
        bind:diaryDate
        bind:mealSlot
        nameError={errors.name?.[0]}
        diaryDateError={errors.diaryDate?.[0]}
        mealSlotError={errors.mealSlot?.[0]}
      />
    </div>

    <BottomSubmitBar label="Add to diary" />
  </form>
</AppPageShell>
