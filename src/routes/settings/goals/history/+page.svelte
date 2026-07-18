<script lang="ts">
  import { resolve } from "$app/paths";
  import { withQuery } from "$lib/navigation";
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  function formatDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  function formatKcal(value: number): string {
    return formatStoredValue(BigInt(value), 0);
  }

  function formatGrams(value: number): string {
    return formatStoredValue(BigInt(value), 1);
  }
</script>

<svelte:head>
  <title>Goal history | Calorie Tracker</title>
</svelte:head>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class="mx-auto min-h-dvh w-full max-w-[430px] bg-[var(--app-surface)] px-4 pb-8 pt-4
      text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)] sm:rounded-[26px]
      sm:border sm:border-[var(--app-border)]/70 sm:px-7 sm:py-8
      sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]"
  >
    <header class="mb-7 flex items-start gap-3">
      <a
        href={resolve("/settings")}
        aria-label="Back to settings"
        class="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full
          text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </a>
      <div class="min-w-0 flex-1 pt-1">
        <h1 class="text-[21px] font-extrabold leading-tight tracking-[-0.025em]">
          Goal history
        </h1>
        <p class="mt-1 text-sm leading-5 text-[var(--app-muted)]">
          Each period controls diary targets from its effective date onward.
        </p>
      </div>
    </header>

    {#if data.saved}
      <div
        role="status"
        class="mb-5 rounded-xl border border-[var(--app-success-border)]
          bg-[var(--app-success-bg)] px-3 py-2.5 text-sm font-medium
          text-[var(--app-success-text)]"
      >Target period saved.</div>
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
  </main>
</div>
