<script lang="ts">
  import { resolve } from "$app/paths";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BatchForm from "$lib/components/batches/BatchForm.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import { withQuery } from "$lib/navigation";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let context = $derived(form?.context ?? data.context);
  let errors = $derived(form?.errors ?? {});

  function confirmArchive(event: SubmitEvent) {
    if (!window.confirm("Archive this batch? You cannot add portions from it again.")) {
      event.preventDefault();
    }
  }
</script>

<svelte:head>
  <title>Edit batch | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="relative flex flex-col overflow-hidden" size="wide">
  <div class="flex flex-1 flex-col px-3 pb-28 pt-5 sm:px-8 sm:pt-8">
    <BackPageHeader
      href={resolve(withQuery("/foods", {
        date: context.date,
        mealSlot: context.mealSlot,
        q: context.q || undefined,
        tab: "shortcuts",
      }))}
      backLabel="Back to meal shortcuts"
      title="Edit batch"
      description="Add ingredients as you cook. Saving updates every logged portion."
    />

    {#if data.saved && !form}
      <FeedbackBanner class="mb-4" message="Batch saved." />
    {/if}
    {#if form && "archiveError" in form && form.archiveError}
      <FeedbackBanner class="mb-4" message={form.archiveError} tone="danger" />
    {/if}

    {#key values.expectedUpdatedAt}
    <BatchForm
      {values}
      fallbackStartDate={data.values.startDate}
      {context}
      foods={data.foods}
      {errors}
      hidden={{ expectedUpdatedAt: values.expectedUpdatedAt }}
      loggedPortions={data.loggedPortions}
      loggedCount={data.loggedCount}
    />
    {/key}

    <section
      aria-labelledby="batch-danger-heading"
      class="mt-10 border-t border-[var(--app-border)] pt-6"
    >
      <h2 id="batch-danger-heading" class="text-sm font-bold">Destructive actions</h2>
      <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
        Archiving removes this batch from Search/Add without changing diary history.
      </p>
      <form method="POST" action="?/archive" onsubmit={confirmArchive}>
        <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt} />
        <input type="hidden" name="date" value={context.date} />
        <input type="hidden" name="mealSlot" value={context.mealSlot} />
        <input type="hidden" name="q" value={context.q} />
        <button
          type="submit"
          class="mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
            text-[var(--app-danger-text)] focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-danger-text)]"
        >Archive batch</button>
      </form>
    </section>
  </div>
</AppPageShell>
