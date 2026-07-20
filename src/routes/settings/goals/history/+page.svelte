<script lang="ts">
  import { resolve } from "$app/paths";
  import { withQuery } from "$lib/navigation";
  import { formatDate, formatGrams, formatKcal } from "$lib/nutrition/format";
  import AppPageShell from "$lib/components/AppPageShell.svelte";
  import BackPageHeader from "$lib/components/BackPageHeader.svelte";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

</script>

<svelte:head>
  <title>Goal history | Calorie Tracker</title>
</svelte:head>

<AppPageShell class="px-4 pb-8 pt-4 sm:px-7 sm:py-8">
    <BackPageHeader
      href={resolve("/settings")}
      backLabel="Back to settings"
      title="Goal history"
      description="Each period controls diary targets from its effective date onward."
      contentClass="min-w-0 flex-1"
    />

    {#if data.saved}
      <FeedbackBanner class="mb-5" message="Target period saved." />
    {/if}

    <a
      href={resolve(withQuery("/settings/goals", { from: "history" }))}
      class="mb-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl
        bg-[var(--app-accent)] px-4 text-sm font-bold text-white no-underline shadow-sm
        transition hover:bg-[var(--app-accent-hover)] focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
    >+ Add target period</a>

    {#if data.goals.length === 0}
      <div
        class="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]
          px-5 py-8 text-center"
      >
        <h2 class="text-sm font-bold">No target history yet</h2>
        <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
          Add a target period to begin tracking against daily goals.
        </p>
      </div>
    {:else}
      <ol class="space-y-3">
        {#each data.goals as goal (goal.id)}
          <li>
            <a
              href={resolve(
                withQuery("/settings/goals", {
                  date: goal.effectiveFrom,
                  from: "history",
                }),
              )}
              class="block rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]
                px-4 py-3.5 text-[var(--app-text)] no-underline transition
                hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-hover)]
                focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-[var(--app-accent)]"
            >
              <div class="flex items-center justify-between gap-3">
                <strong class="text-sm">{formatDate(goal.effectiveFrom)}</strong>
                <span
                  class={[
                    "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                    goal.id === data.currentGoalId
                      ? "bg-[var(--app-success-bg)] text-[var(--app-success-text)]"
                      : goal.effectiveFrom > data.today
                        ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                        : "bg-[var(--app-panel-hover)] text-[var(--app-muted)]",
                  ]}
                >
                  {goal.id === data.currentGoalId
                    ? "Current"
                    : goal.effectiveFrom > data.today
                      ? "Upcoming"
                      : "Previous"}
                </span>
              </div>
              <p class="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                {formatKcal(goal.targetEnergyMkcal)} kcal · P {formatGrams(goal.targetProteinMg)} g
                · C {formatGrams(goal.targetCarbsMg)} g · F {formatGrams(goal.targetFatMg)} g
              </p>
            </a>
          </li>
        {/each}
      </ol>
    {/if}
</AppPageShell>
