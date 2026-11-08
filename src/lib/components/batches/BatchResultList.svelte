<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- coordinator supplies resolved hrefs */
  import { mealNames, type MealSlot } from "$lib/nutrition/constants";
  import { formatDate, formatKcal } from "$lib/nutrition/format";
  import type { BatchResult } from "./types";

  let {
    active,
    recent,
    selectedDate,
    mealSlot,
    editHref,
    applyHref,
    newBatchHref,
    cookAgainHref,
  }: {
    active: BatchResult[];
    recent: BatchResult[];
    selectedDate: string;
    mealSlot: MealSlot;
    editHref: (batchId: string) => string | null;
    applyHref: (batchId: string) => string | null;
    newBatchHref: string | null;
    cookAgainHref: (batchId: string) => string | null;
  } = $props();

  function meta(batch: BatchResult): string {
    const left = `${batch.remainingCount} of ${batch.portionCount} left`;
    return batch.perPortionEnergyMkcal === null
      ? left
      : `${left} · ${formatKcal(batch.perPortionEnergyMkcal)} kcal per portion`;
  }

  const linkClass =
    "inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold text-[var(--app-accent)] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]";
</script>

<section aria-labelledby="batch-results" class="mt-5">
  <div class="mb-2 flex items-center justify-between gap-3">
    <h2
      id="batch-results"
      class="px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[var(--app-muted)] uppercase"
    >Batches</h2>
    {#if newBatchHref !== null}
      <a href={newBatchHref} class={linkClass}>+ New batch</a>
    {:else}
      <span class={`${linkClass} opacity-50`}>+ New batch</span>
    {/if}
  </div>

  {#if active.length === 0 && recent.length === 0}
    <div
      class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-6 text-center text-xs leading-5 text-[var(--app-muted)]"
    >No batches yet. Start one while you cook.</div>
  {/if}

  {#if active.length > 0}
    <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each active as batch (batch.id)}
        {@const editor = editHref(batch.id)}
        {@const apply = applyHref(batch.id)}
        {@const canApply = !batch.blocked && batch.remainingCount > 0}
        <li>
          <article
            class="flex min-h-[62px] items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] py-2 pr-2 pl-3 shadow-[0_1px_2px_rgba(23,32,51,0.025)]"
          >
            {#snippet summary()}
              <h3 class="truncate text-sm leading-5 font-bold tracking-[-0.01em]">
                {batch.name}
              </h3>
              <p class="truncate text-[11px] leading-4 font-medium text-[var(--app-muted)]">
                {#if batch.blocked}
                  Contains an unavailable food
                {:else}
                  {meta(batch)}
                {/if}
              </p>
            {/snippet}

            {#if editor !== null}
              <a
                href={editor}
                aria-label={`Edit batch ${batch.name}`}
                class="min-w-0 flex-1 rounded-lg py-1 text-[var(--app-text)] no-underline
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-[var(--app-accent)]"
              >{@render summary()}</a>
            {:else}
              <div class="min-w-0 flex-1 py-1 opacity-75">{@render summary()}</div>
            {/if}

            {#if canApply && apply !== null}
              <form method="POST" action={apply} data-sveltekit-reload>
                <input type="hidden" name="clientMutationId" value="" />
                <input type="hidden" name="diaryDate" value={selectedDate} />
                <input type="hidden" name="mealSlot" value={mealSlot} />
                <button
                  type="submit"
                  aria-label={`Add a portion of ${batch.name} to ${mealNames[mealSlot].toLowerCase()}`}
                  class="inline-flex size-11 shrink-0 items-center justify-center rounded-full
                    text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-1
                    focus-visible:outline-[var(--app-accent)]"
                >
                  <span
                    aria-hidden="true"
                    class="flex size-8 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-xl leading-none font-medium"
                  >+</span>
                </button>
              </form>
            {:else}
              <button
                type="button"
                disabled
                aria-label={batch.blocked
                  ? `Add ${batch.name} is unavailable until it is fixed`
                  : batch.remainingCount === 0
                    ? `No portions of ${batch.name} left`
                    : `Add a portion of ${batch.name} is unavailable`}
                class="inline-flex size-11 cursor-not-allowed items-center justify-center rounded-full
                  text-[var(--app-muted)] opacity-50"
              >
                <span
                  aria-hidden="true"
                  class="flex size-8 items-center justify-center rounded-full bg-[var(--app-panel-hover)] text-xl font-medium"
                >+</span>
              </button>
            {/if}
          </article>
        </li>
      {/each}
    </ul>
  {/if}

  {#if recent.length > 0}
    <h3
      id="batch-cooked-before"
      class="mt-4 mb-2 px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[var(--app-muted)] uppercase"
    >Cooked before</h3>
    <ul aria-labelledby="batch-cooked-before" class="grid gap-1">
      {#each recent as batch (batch.id)}
        {@const editor = editHref(batch.id)}
        {@const href = cookAgainHref(batch.id)}
        <li class="flex items-center gap-3 pl-1">
          {#if editor !== null}
            <a
              href={editor}
              aria-label={`Edit batch ${batch.name}`}
              class="flex min-h-11 min-w-0 flex-1 items-center rounded-lg text-sm font-semibold
                text-[var(--app-text)] no-underline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-[var(--app-accent)]"
            ><span class="truncate">{batch.name}</span></a>
          {:else}
            <span class="flex min-h-11 min-w-0 flex-1 items-center text-sm font-semibold">
              <span class="truncate">{batch.name}</span>
            </span>
          {/if}
          {#if batch.lastPortionDate !== null}
            <span class="shrink-0 text-[11px] font-medium text-[var(--app-muted)]">
              {formatDate(batch.lastPortionDate, { year: false })}
            </span>
          {/if}
          {#if href !== null}
            <a href={href} aria-label={`Cook ${batch.name} again`} class={linkClass}>Cook again</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
