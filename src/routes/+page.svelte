<script lang="ts">
  import { resolve } from "$app/paths";
  import FeedbackBanner from "$lib/components/FeedbackBanner.svelte";
  import { shiftDate } from "$lib/date";
  import { withQuery } from "$lib/navigation";
  import { mealSlots, type MealSlot } from "$lib/nutrition/constants";
  import { formatStoredValue } from "$lib/nutrition/math";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const mealNames: Record<MealSlot, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snacks: "Snacks",
  };

  const integerFormatter = new Intl.NumberFormat("en-IE", {
    maximumFractionDigits: 0,
  });

  function formatKcal(value: number): string {
    return integerFormatter.format(
      Number(formatStoredValue(BigInt(value), 0)),
    );
  }

  function formatGrams(value: number): string {
    return formatStoredValue(BigInt(value), 1);
  }

  function formatAmount(value: number, unit: "mg" | "ul"): string {
    const displayUnit = unit === "mg" ? "g" : "ml";
    return `${formatStoredValue(BigInt(value), 3)} ${displayUnit}`;
  }

  function progress(consumed: number, target: number): number {
    if (target === 0) return consumed > 0 ? 100 : 0;
    return Math.min(100, Math.round((consumed / target) * 100));
  }

  let previousDate = $derived(shiftDate(data.diary.date, -1));
  let nextDate = $derived(shiftDate(data.diary.date, 1));
  let dateLabel = $derived(
    data.diary.date === data.today ? "Today" : data.diary.date,
  );
</script>

<svelte:head>
  <title>{dateLabel} | Calorie Tracker</title>
</svelte:head>

<main class="min-h-dvh bg-[var(--app-canvas)] text-[var(--app-text)] sm:py-5 lg:p-7">
  <div
    class="mx-auto min-h-dvh w-full max-w-[430px] bg-[var(--app-diary-surface)] px-4 pb-12
      pt-[18px] sm:min-h-[calc(100dvh-40px)] sm:rounded-[26px]
      sm:shadow-[0_18px_55px_rgba(24,33,47,0.1)]
      lg:min-h-[calc(100dvh-56px)] lg:max-w-[1180px] lg:rounded-[28px]
      lg:px-[30px] lg:pb-[38px] lg:pt-6 xl:max-w-[1260px] xl:px-10"
  >
    <nav
      aria-label="Diary date"
      class="mb-[22px] grid grid-cols-[44px_1fr_44px_44px] items-center gap-1.5
        lg:mb-[30px] lg:grid-cols-[44px_minmax(180px,1fr)_44px_44px]"
    >
      <a
        href={resolve(withQuery("/", { date: previousDate }))}
        aria-label="Previous day"
        class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-text)]
          transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]/30"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-[21px] fill-none stroke-current stroke-2 [stroke-linecap:round]
            [stroke-linejoin:round]"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </a>

      <a
        href={resolve("/")}
        class="min-w-[116px] justify-self-center rounded-full bg-[var(--app-panel)] px-6 py-[9px]
          text-center text-[14px] font-bold leading-none text-[var(--app-text)] no-underline
          focus-visible:outline-3 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]/30 lg:min-w-[150px]"
      >
        {dateLabel}
      </a>

      <a
        href={resolve("/settings")}
        class="inline-flex size-11 items-center justify-center rounded-full
          text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
          focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
        aria-label="Open settings"
        title="Settings"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-[21px] fill-none stroke-current stroke-2 [stroke-linecap:round]
            [stroke-linejoin:round]"
        >
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.36.72.66 1 .3.28.68.42 1.1.4H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </a>

      <a
        href={resolve(withQuery("/", { date: nextDate }))}
        aria-label="Next day"
        class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-text)]
          transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]/30"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          class="size-[21px] fill-none stroke-current stroke-2 [stroke-linecap:round]
            [stroke-linejoin:round]"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </nav>

    {#if data.entryFeedback?.kind === "deleted"}
      {@const deletedFeedback = data.entryFeedback}
      {#snippet undoEntryDeleteAction()}
        <form method="POST" action="?/undoEntryDelete">
          <input type="hidden" name="entryId" value={deletedFeedback.entryId} />
          <input type="hidden" name="deletedAt" value={deletedFeedback.deletedAt} />
          <button
            type="submit"
            class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
              text-[var(--app-success-text)] underline underline-offset-2
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)]"
          >Undo</button>
        </form>
      {/snippet}
      <FeedbackBanner
        class="mb-5"
        message={`${deletedFeedback.foodName} was removed from this diary.`}
        action={undoEntryDeleteAction}
      />
    {:else if data.entryFeedback?.kind === "restored"}
      <FeedbackBanner
        class="mb-5"
        message={`${data.entryFeedback.foodName} was restored to this diary.`}
      />
    {:else if data.shortcutFeedback?.kind === "applied"}
      {@const appliedFeedback = data.shortcutFeedback}
      {#snippet undoShortcutAction()}
        <form method="POST" action="?/undoShortcut">
          <input
            type="hidden"
            name="applicationId"
            value={appliedFeedback.applicationId}
          />
          <input type="hidden" name="diaryDate" value={data.diary.date} />
          <button
            type="submit"
            class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
              text-[var(--app-success-text)] underline underline-offset-2
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)]"
          >Undo</button>
        </form>
      {/snippet}
      <FeedbackBanner
        class="mb-5"
        message={`${appliedFeedback.shortcutName} added as ${appliedFeedback.entryCount} ${appliedFeedback.entryCount === 1 ? "entry" : "entries"}.`}
        action={undoShortcutAction}
      />
    {:else if data.shortcutFeedback?.kind === "undone"}
      <FeedbackBanner
        class="mb-5"
        message={`${data.shortcutFeedback.shortcutName} was removed from this diary.`}
      />
    {:else if data.shortcutFeedback?.kind === "saved"}
      <FeedbackBanner
        class="mb-5"
        message={`${data.shortcutFeedback.shortcutName} shortcut saved.`}
      />
    {/if}

    <div
      class="contents lg:grid lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]
        lg:items-start lg:gap-[34px] xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-11"
    >
      <aside class="block lg:sticky lg:top-7">
        {#if data.diary.balances}
          <section
            aria-labelledby="daily-energy"
            class="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] px-4 pb-5 pt-[18px]"
          >
            <h1
              id="daily-energy"
              class="m-0 text-[11px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
            >
              Daily energy
            </h1>

            <div
              class="mt-[13px] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]
                items-center gap-[9px]"
            >
              <div class="min-w-0">
                <strong
                  class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                    tracking-[-0.035em] lg:text-[28px]"
                >
                  {formatKcal(data.diary.balances.energyMkcal.target)}
                </strong>
                <span class="mt-1.5 block text-[11px] text-[var(--app-muted)]">goal</span>
              </div>

              <b aria-hidden="true" class="text-[16px] font-semibold text-[var(--app-muted)]">
                −
              </b>

              <div class="min-w-0">
                <strong
                  class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                    tracking-[-0.035em] lg:text-[28px]"
                >
                  {formatKcal(data.diary.balances.energyMkcal.consumed)}
                </strong>
                <span class="mt-1.5 block text-[11px] text-[var(--app-muted)]">
                  consumed
                </span>
              </div>

              <b aria-hidden="true" class="text-[16px] font-semibold text-[var(--app-muted)]">
                =
              </b>

              <div
                class={data.diary.balances.energyMkcal.over > 0
                  ? "min-w-0 text-[var(--app-orange)]"
                  : "min-w-0 text-[var(--app-green)]"}
              >
                <strong
                  class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                    tracking-[-0.035em] lg:text-[28px]"
                >
                  {formatKcal(
                    data.diary.balances.energyMkcal.over > 0
                      ? data.diary.balances.energyMkcal.over
                      : data.diary.balances.energyMkcal.remaining,
                  )}
                </strong>
                <span class="mt-1.5 block text-[11px] text-[var(--app-muted)]">
                  {data.diary.balances.energyMkcal.over > 0
                    ? "over"
                    : "remaining"}
                </span>
              </div>
            </div>
          </section>

          <dl
            class="my-[21px] grid grid-cols-3 gap-5 lg:mb-0 lg:gap-4 lg:px-1 lg:pt-5"
          >
            <div class="min-w-0">
              <dt class="text-[11px] font-medium text-[var(--app-muted)]">Protein</dt>
              <dd
                class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
                  text-[12px] font-bold text-[var(--app-text)]"
              >
                {formatGrams(data.diary.balances.proteinMg.consumed)} /
                {formatGrams(data.diary.balances.proteinMg.target)} g
              </dd>
              <span
                class="block h-[5px] overflow-hidden rounded-full bg-[var(--app-track)]"
              >
                <span
                  class="block h-full rounded-full bg-[var(--app-purple)]"
                  style:width={`${progress(
                    data.diary.balances.proteinMg.consumed,
                    data.diary.balances.proteinMg.target,
                  )}%`}
                ></span>
              </span>
            </div>

            <div class="min-w-0">
              <dt class="text-[11px] font-medium text-[var(--app-muted)]">Carbs</dt>
              <dd
                class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
                  text-[12px] font-bold text-[var(--app-text)]"
              >
                {formatGrams(data.diary.balances.carbsMg.consumed)} /
                {formatGrams(data.diary.balances.carbsMg.target)} g
              </dd>
              <span
                class="block h-[5px] overflow-hidden rounded-full bg-[var(--app-track)]"
              >
                <span
                  class="block h-full rounded-full bg-[var(--app-orange)]"
                  style:width={`${progress(
                    data.diary.balances.carbsMg.consumed,
                    data.diary.balances.carbsMg.target,
                  )}%`}
                ></span>
              </span>
            </div>

            <div class="min-w-0">
              <dt class="text-[11px] font-medium text-[var(--app-muted)]">Fat</dt>
              <dd
                class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
                  text-[12px] font-bold text-[var(--app-text)]"
              >
                {formatGrams(data.diary.balances.fatMg.consumed)} /
                {formatGrams(data.diary.balances.fatMg.target)} g
              </dd>
              <span
                class="block h-[5px] overflow-hidden rounded-full bg-[var(--app-track)]"
              >
                <span
                  class="block h-full rounded-full bg-[var(--app-green)]"
                  style:width={`${progress(
                    data.diary.balances.fatMg.consumed,
                    data.diary.balances.fatMg.target,
                  )}%`}
                ></span>
              </span>
            </div>
          </dl>
        {:else}
          <div
            class="mb-6 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4
              text-[14px] text-[var(--app-muted)]"
            role="status"
          >
            No nutrition goal applies to this date.
          </div>
        {/if}
      </aside>

      <div
        class="grid gap-[25px] lg:grid-cols-2 lg:items-start lg:gap-x-5 lg:gap-y-7"
      >
        {#each mealSlots as slot (slot)}
          <section
            aria-labelledby={`${slot}-heading`}
            class="min-w-0"
          >
            <header
              class="mb-2.5 flex items-center justify-between gap-4"
            >
              <h2
                id={`${slot}-heading`}
                class="m-0 text-[11px] font-bold uppercase tracking-[0.02em]
                  text-[var(--app-muted)]"
              >
                {mealNames[slot]}
              </h2>
              {#if data.diary.meals[slot].entries.length > 0}
                <span class="text-[11px] font-bold text-[var(--app-muted)]">
                  {formatKcal(data.diary.meals[slot].totals.energyMkcal)} kcal
                </span>
              {/if}
            </header>

            {#if data.diary.meals[slot].entries.length === 0}
              <div
                class="rounded-[13px] border border-[var(--app-border)] bg-[var(--app-panel)] px-[15px]
                  py-3.5 lg:min-h-[88px]"
              >
                <p class="mb-2 mt-0 text-[13px] text-[var(--app-muted)]">
                  Nothing logged yet
                </p>
                <a
                  href={resolve(
                    withQuery("/foods", {
                      date: data.diary.date,
                      mealSlot: slot,
                    }),
                  )}
                  class="inline-flex min-h-[26px] items-center gap-1.5 text-[13px]
                    font-bold text-[var(--app-accent)] no-underline
                    focus-visible:outline-3 focus-visible:outline-offset-2
                    focus-visible:outline-[var(--app-accent)]/30"
                >
                  <span aria-hidden="true">+</span> Add food
                </a>
              </div>
            {:else}
              <div class="grid gap-[9px]">
                {#each data.diary.meals[slot].entries as entry (entry.id)}
                  <a
                    href={resolve("/diary/[entryId]/edit", {
                      entryId: entry.id,
                    })}
                    class="block min-w-0 max-w-full rounded-[13px] border border-[var(--app-border)] bg-[var(--app-panel)]
                      px-[15px] py-[13px] text-[var(--app-text)] no-underline transition
                      hover:border-[var(--app-border-strong)] hover:shadow-sm focus-visible:outline-3
                      focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
                  >
                    <h3 class="m-0 min-w-0 max-w-full truncate text-[15px] font-bold leading-tight">
                      {entry.foodName}
                    </h3>
                    <p class="mb-0 mt-1 text-[12px] text-[var(--app-muted)]">
                      {formatAmount(entry.resolvedAmount, entry.amountUnit)}
                      · {formatKcal(entry.energyMkcal)} kcal
                    </p>
                  </a>
                {/each}

                <a
                  href={resolve(
                    withQuery("/foods", {
                      date: data.diary.date,
                      mealSlot: slot,
                    }),
                  )}
                  class="flex min-h-12 items-center gap-[7px] rounded-[13px] border
                    border-[var(--app-border)] bg-[var(--app-panel)] px-[15px] text-[13px] font-bold
                    text-[var(--app-accent)] no-underline focus-visible:outline-3
                    focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
                >
                  <span aria-hidden="true">+</span> Add food
                </a>
                {#if data.shortcutEligibility[slot]}
                  <a
                    href={resolve(
                      withQuery("/meal-shortcuts/new", {
                        date: data.diary.date,
                        mealSlot: slot,
                      }),
                    )}
                    class="flex min-h-11 items-center gap-[7px] rounded-[13px] px-[15px]
                      text-[12px] font-bold text-[var(--app-muted)] no-underline
                      focus-visible:outline-3 focus-visible:outline-offset-2
                      focus-visible:outline-[var(--app-accent)]/30"
                  >
                    Save as meal shortcut
                  </a>
                {/if}
              </div>
            {/if}
          </section>
        {/each}
      </div>
    </div>
  </div>
</main>
