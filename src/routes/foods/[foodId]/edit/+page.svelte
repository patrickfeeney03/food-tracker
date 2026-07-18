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
  let context = $derived(form?.context ?? data.context);
  let errors = $derived((form?.errors ?? {}) as FoodFieldErrors & {
    form?: string[];
  });
  let amountUnit = $state<"mg" | "ul">(
    untrack(() => (values.amountUnit === "ul" ? "ul" : "mg")),
  );

  function confirmArchive(event: SubmitEvent) {
    if (!window.confirm("Archive this food? It will no longer be available for future logs.")) {
      event.preventDefault();
    }
  }
</script>

<svelte:head>
  <title>Edit food | Calorie Tracker</title>
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
          leading-none text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]"
        href={resolve(withQuery("/foods", {
          date: context.date,
          mealSlot: context.mealSlot,
          q: context.q || undefined,
        }))}
        aria-label="Back to food catalogue"
      ><span aria-hidden="true">‹</span></a>
      <div class="pt-1">
        <h1 class="text-[18px] font-bold leading-6 tracking-[-0.02em]">Edit food</h1>
        <p class="mt-0.5 text-[11px] leading-4 text-[var(--app-muted)]">
          Changes apply to future diary entries only
        </p>
      </div>
    </header>

    <form
      method="POST"
      action="?/save"
      class="flex flex-1 flex-col px-3 pb-8 sm:flex-none sm:px-8"
    >
      <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt} />
      <input type="hidden" name="date" value={context.date} />
      <input type="hidden" name="mealSlot" value={context.mealSlot} />
      <input type="hidden" name="q" value={context.q} />

      {#if errors.form}
        <div
          role="alert"
          class="mb-4 rounded-xl border border-[var(--app-danger-border)]
            bg-[var(--app-danger-bg)] px-3 py-2.5 text-sm font-medium
            text-[var(--app-danger-text)]"
        >
          {errors.form[0]}
        </div>
      {/if}

      <FoodFormFields {values} {errors} bind:amountUnit />

      <button
        type="submit"
        class="mx-auto mt-7 flex min-h-[52px] w-full items-center justify-center rounded-[12px]
          bg-[var(--app-accent)] px-4 text-[14px] font-bold text-white shadow-sm transition
          hover:bg-[var(--app-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)] active:translate-y-px sm:w-56"
      >Save food</button>
    </form>

    <section
      aria-labelledby="destructive-actions"
      class="mx-3 mb-[calc(1rem+env(safe-area-inset-bottom))] mt-5 border-t border-[var(--app-border)]
        pt-6 sm:mx-8 sm:mb-8"
    >
      <h2 id="destructive-actions" class="text-sm font-bold text-[var(--app-danger-strong)]">
        Destructive actions
      </h2>
      <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
        Archiving hides this food from the catalogue. Existing diary entries stay unchanged.
      </p>

      {#if form?.archiveError}
        <p class="mt-3 text-sm font-medium text-[var(--app-danger-text)]" role="alert">
          {form.archiveError}
        </p>
      {/if}

      <form method="POST" action="?/archive" onsubmit={confirmArchive} class="mt-4">
        <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt} />
        <input type="hidden" name="date" value={context.date} />
        <input type="hidden" name="mealSlot" value={context.mealSlot} />
        <input type="hidden" name="q" value={context.q} />
        <button
          type="submit"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-xl border
            border-[var(--app-danger-border)] bg-[var(--app-panel)] px-4 text-sm font-bold
            text-[var(--app-danger-text)] transition hover:bg-[var(--app-danger-bg)]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-danger-text)] sm:w-auto"
        >Archive food</button>
      </form>
    </section>
  </main>
</div>
