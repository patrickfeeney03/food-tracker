<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- coordinator supplies resolved hrefs */
  import SearchIcon from "$lib/components/icons/SearchIcon.svelte";
  import { mealNames, type MealSlot } from "$lib/nutrition/constants";
  import { formatKcal } from "$lib/nutrition/format";
  import type { MealShortcutResult } from "./types";

  let {
    shortcuts,
    activeQuery,
    selectedDate,
    mealSlot,
    editHref,
    applyHref,
  }: {
    shortcuts: MealShortcutResult[];
    activeQuery: string;
    selectedDate: string;
    mealSlot: MealSlot;
    editHref: (shortcutId: string) => string | null;
    applyHref: (shortcutId: string) => string | null;
  } = $props();
</script>

<section aria-labelledby="shortcut-results" class="mt-5 flex-1">
  <h2
    id="shortcut-results"
    class="mb-2 px-0.5 text-[10px] leading-4 font-bold tracking-[0.04em] text-[var(--app-muted)] uppercase"
  >
    {activeQuery ? "Search results" : "Meal shortcuts"}
  </h2>

  {#if shortcuts.length === 0}
    <div
      class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-8 text-center shadow-[0_1px_2px_rgba(23,32,51,0.03)]"
    >
      <div
        class="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
      >
        <SearchIcon class="size-5" />
      </div>
      <h3 class="mt-3 text-sm font-bold text-[var(--app-text)]">
        {activeQuery ? "No matching meal shortcuts" : "No meal shortcuts yet"}
      </h3>
      <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
        {activeQuery
          ? "No meal shortcuts match this search."
          : "Save a meal from the diary to reuse it here."}
      </p>
    </div>
  {:else}
    <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each shortcuts as shortcut (shortcut.id)}
        {@const editor = editHref(shortcut.id)}
        {@const apply = shortcut.blocked ? null : applyHref(shortcut.id)}
        <li>
          <article
            class="flex min-h-[62px] items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] py-2 pr-2 pl-3 shadow-[0_1px_2px_rgba(23,32,51,0.025)]"
          >
            {#if editor !== null}
              <a
                href={editor}
                class="min-w-0 flex-1 rounded-lg py-1 text-[var(--app-text)] no-underline
                  focus-visible:outline-2 focus-visible:outline-offset-2
                  focus-visible:outline-[var(--app-accent)]"
                aria-label={`Choose amounts for ${shortcut.name}`}
              >
                <h3 class="truncate text-sm leading-5 font-bold tracking-[-0.01em]">
                  {shortcut.name}
                </h3>
                <p class="truncate text-[11px] leading-4 font-medium text-[var(--app-muted)]">
                  {#if shortcut.blocked}
                    Contains an unavailable food
                  {:else}
                    {shortcut.itemCount === 1 ? "1 food" : `${shortcut.itemCount} foods`}
                    {#if shortcut.energyMkcal !== null}
                      · {formatKcal(shortcut.energyMkcal)} kcal
                    {/if}
                  {/if}
                </p>
              </a>
            {:else}
              <div class="min-w-0 flex-1 py-1 opacity-75">
                <h3 class="truncate text-sm font-bold">{shortcut.name}</h3>
              </div>
            {/if}

            {#if apply !== null}
              <form method="POST" action={apply} data-sveltekit-reload>
                <input type="hidden" name="clientMutationId" value="" />
                <input type="hidden" name="diaryDate" value={selectedDate} />
                <input type="hidden" name="mealSlot" value={mealSlot} />
                <button
                  type="submit"
                  aria-label={`Add ${shortcut.name} to ${mealNames[mealSlot].toLowerCase()}`}
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
                aria-label={`Add ${shortcut.name} is unavailable until it is fixed`}
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
</section>
