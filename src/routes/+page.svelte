<script lang="ts">
  import { resolve } from "$app/paths";
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

<main class="min-h-dvh bg-[#e7e7e7] text-[#18212f] sm:py-5 lg:p-7">
  <div
    class="mx-auto min-h-dvh w-full max-w-[430px] bg-[#f5f7fa] px-4 pb-12
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
        class="inline-flex size-11 items-center justify-center rounded-full text-[#18212f]
          transition hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2
          focus-visible:outline-[#2865e8]/30"
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
        class="min-w-[116px] justify-self-center rounded-full bg-white px-6 py-[9px]
          text-center text-[14px] font-bold leading-none text-[#18212f] no-underline
          focus-visible:outline-3 focus-visible:outline-offset-2
          focus-visible:outline-[#2865e8]/30 lg:min-w-[150px]"
      >
        {dateLabel}
      </a>

      <form method="POST" action={resolve("/logout")} class="contents">
        <button
          type="submit"
          class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full
            border-0 bg-transparent text-[#18212f] transition hover:bg-white
            focus-visible:outline-3 focus-visible:outline-offset-2
            focus-visible:outline-[#2865e8]/30"
          aria-label="Sign out"
          title="Sign out"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            class="size-[21px] fill-none stroke-current stroke-2 [stroke-linecap:round]
              [stroke-linejoin:round]"
          >
            <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
          </svg>
        </button>
      </form>

      <a
        href={resolve(withQuery("/", { date: nextDate }))}
        aria-label="Next day"
        class="inline-flex size-11 items-center justify-center rounded-full text-[#18212f]
          transition hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2
          focus-visible:outline-[#2865e8]/30"
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

    <div
      class="contents lg:grid lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]
        lg:items-start lg:gap-[34px] xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-11"
    >
      <aside class="block lg:sticky lg:top-7">
        {#if data.diary.balances}
          <section
            aria-labelledby="daily-energy"
            class="rounded-[14px] border border-[#d9dee6] bg-white px-4 pb-5 pt-[18px]"
          >
            <h1
              id="daily-energy"
              class="m-0 text-[11px] font-bold uppercase tracking-[0.02em] text-[#707c91]"
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
                <span class="mt-1.5 block text-[11px] text-[#7b8799]">goal</span>
              </div>

              <b aria-hidden="true" class="text-[16px] font-semibold text-[#7b8799]">
                −
              </b>

              <div class="min-w-0">
                <strong
                  class="block text-[clamp(22px,7vw,28px)] font-extrabold leading-none
                    tracking-[-0.035em] lg:text-[28px]"
                >
                  {formatKcal(data.diary.balances.energyMkcal.consumed)}
                </strong>
                <span class="mt-1.5 block text-[11px] text-[#7b8799]">
                  consumed
                </span>
              </div>

              <b aria-hidden="true" class="text-[16px] font-semibold text-[#7b8799]">
                =
              </b>

              <div
                class={data.diary.balances.energyMkcal.over > 0
                  ? "min-w-0 text-[#ee8b0b]"
                  : "min-w-0 text-[#159c6a]"}
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
                <span class="mt-1.5 block text-[11px] text-[#7b8799]">
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
              <dt class="text-[11px] font-medium text-[#6f7b8f]">Protein</dt>
              <dd
                class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
                  text-[12px] font-bold text-[#202a38]"
              >
                {formatGrams(data.diary.balances.proteinMg.consumed)} /
                {formatGrams(data.diary.balances.proteinMg.target)} g
              </dd>
              <span
                class="block h-[5px] overflow-hidden rounded-full bg-[#e6eaf0]"
              >
                <span
                  class="block h-full rounded-full bg-[#7c55e8]"
                  style:width={`${progress(
                    data.diary.balances.proteinMg.consumed,
                    data.diary.balances.proteinMg.target,
                  )}%`}
                ></span>
              </span>
            </div>

            <div class="min-w-0">
              <dt class="text-[11px] font-medium text-[#6f7b8f]">Carbs</dt>
              <dd
                class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
                  text-[12px] font-bold text-[#202a38]"
              >
                {formatGrams(data.diary.balances.carbsMg.consumed)} /
                {formatGrams(data.diary.balances.carbsMg.target)} g
              </dd>
              <span
                class="block h-[5px] overflow-hidden rounded-full bg-[#e6eaf0]"
              >
                <span
                  class="block h-full rounded-full bg-[#ed8b0c]"
                  style:width={`${progress(
                    data.diary.balances.carbsMg.consumed,
                    data.diary.balances.carbsMg.target,
                  )}%`}
                ></span>
              </span>
            </div>

            <div class="min-w-0">
              <dt class="text-[11px] font-medium text-[#6f7b8f]">Fat</dt>
              <dd
                class="my-1 mb-2 overflow-hidden text-ellipsis whitespace-nowrap
                  text-[12px] font-bold text-[#202a38]"
              >
                {formatGrams(data.diary.balances.fatMg.consumed)} /
                {formatGrams(data.diary.balances.fatMg.target)} g
              </dd>
              <span
                class="block h-[5px] overflow-hidden rounded-full bg-[#e6eaf0]"
              >
                <span
                  class="block h-full rounded-full bg-[#159c6a]"
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
            class="mb-6 rounded-[14px] border border-[#d9dee6] bg-white p-4
              text-[14px] text-[#6f7b8f]"
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
                  text-[#707c91]"
              >
                {mealNames[slot]}
              </h2>
              {#if data.diary.meals[slot].entries.length > 0}
                <span class="text-[11px] font-bold text-[#707c91]">
                  {formatKcal(data.diary.meals[slot].totals.energyMkcal)} kcal
                </span>
              {/if}
            </header>

            {#if data.diary.meals[slot].entries.length === 0}
              <div
                class="rounded-[13px] border border-[#d9dee6] bg-white px-[15px]
                  py-3.5 lg:min-h-[88px]"
              >
                <p class="mb-2 mt-0 text-[13px] text-[#7b8799]">
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
                    font-bold text-[#2865ee] no-underline
                    focus-visible:outline-3 focus-visible:outline-offset-2
                    focus-visible:outline-[#2865e8]/30"
                >
                  <span aria-hidden="true">+</span> Add food
                </a>
              </div>
            {:else}
              <div class="grid gap-[9px]">
                {#each data.diary.meals[slot].entries as entry (entry.id)}
                  <article
                    class="rounded-[13px] border border-[#d9dee6] bg-white px-[15px]
                      py-[13px]"
                  >
                    <h3 class="m-0 text-[15px] font-bold leading-tight">
                      {entry.foodName}
                    </h3>
                    <p class="mb-0 mt-1 text-[12px] text-[#7b8799]">
                      {formatAmount(entry.resolvedAmount, entry.amountUnit)}
                      · {formatKcal(entry.energyMkcal)} kcal
                    </p>
                  </article>
                {/each}

                <a
                  href={resolve(
                    withQuery("/foods", {
                      date: data.diary.date,
                      mealSlot: slot,
                    }),
                  )}
                  class="flex min-h-12 items-center gap-[7px] rounded-[13px] border
                    border-[#d9dee6] bg-white px-[15px] text-[13px] font-bold
                    text-[#2865ee] no-underline focus-visible:outline-3
                    focus-visible:outline-offset-2 focus-visible:outline-[#2865e8]/30"
                >
                  <span aria-hidden="true">+</span> Add food
                </a>
              </div>
            {/if}
          </section>
        {/each}
      </div>
    </div>
  </div>
</main>
