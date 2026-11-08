<script lang="ts">
  import { resolve } from "$app/paths";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import BatchForm from "$lib/components/batches/BatchForm.svelte";
  import { withQuery } from "$lib/navigation";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let values = $derived(form?.values ?? data.values);
  let context = $derived(form?.context ?? data.context);
  let errors = $derived(form?.errors ?? {});
</script>

<svelte:head>
  <title>New batch | Calorie Tracker</title>
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
      title="New batch"
      description="Weigh each ingredient and save as you go."
    />

    <BatchForm
      {values}
      fallbackStartDate={data.values.startDate}
      {context}
      foods={data.foods}
      {errors}
      hidden={{ clientMutationId: values.clientMutationId }}
    />
  </div>
</AppPageShell>
