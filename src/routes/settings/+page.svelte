<script lang="ts">
  import { resolve } from '$app/paths';
  import { formatStoredValue } from '$lib/nutrition/math';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  let isOnline = $state(true);

  $effect(() => {
    const updateNetworkStatus = () => {
      isOnline = navigator.onLine;
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  });

  function formatKcal(value: number): string {
    return formatStoredValue(BigInt(value), 0);
  }

  function formatGrams(value: number): string {
    return formatStoredValue(BigInt(value), 0);
  }

  let goalSummary = $derived(
    data.currentGoal === null
      ? 'No current targets'
      : `${formatKcal(data.currentGoal.targetEnergyMkcal)} kcal · P ${formatGrams(data.currentGoal.targetProteinMg)} g · C ${formatGrams(data.currentGoal.targetCarbsMg)} g · F ${formatGrams(data.currentGoal.targetFatMg)} g`
  );

  let themeLabel = $derived(
    data.theme === 'system'
      ? 'Use system setting'
      : data.theme === 'dark'
        ? 'Always use dark mode'
        : 'Always use light mode'
  );
</script>

<svelte:head>
  <title>Settings | Calorie Tracker</title>
  <meta
    name="description"
    content="Manage your Calorie Tracker goals, account, data, and appearance."
  />
</svelte:head>

<main class="min-h-dvh bg-slate-100 px-3 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-8">
  <div class="mx-auto w-full max-w-md">
    <header class="mb-8 flex min-h-11 items-center gap-3">
      <a
        href={resolve('/')}
        aria-label="Back to diary"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </a>
      <h1 class="text-xl font-bold tracking-tight">Settings</h1>
    </header>

    <div class="space-y-7">
      <section aria-labelledby="goals-heading">
        <h2
          id="goals-heading"
          class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Goals
        </h2>

        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Daily targets</p>
              <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{goalSummary}</p>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-4 shrink-0 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>

          <div class="mx-4 border-t border-slate-200 dark:border-slate-800"></div>

          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Goal history</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Effective-dated changes</p>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-4 shrink-0 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>
      </section>

      <section aria-labelledby="account-heading">
        <h2
          id="account-heading"
          class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Account &amp; data
        </h2>

        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Account</p>
              <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {data.user.name} · {data.user.email}
              </p>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-4 shrink-0 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>

          <div class="mx-4 border-t border-slate-200 dark:border-slate-800"></div>

          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Active sessions</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {data.activeSessionCount}
                {data.activeSessionCount === 1 ? 'session' : 'sessions'}
              </p>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-4 shrink-0 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>

          <div class="mx-4 border-t border-slate-200 dark:border-slate-800"></div>

          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Export data</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Download JSON or CSV</p>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              class="size-4 shrink-0 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>
      </section>

      <section aria-labelledby="appearance-heading">
        <h2
          id="appearance-heading"
          class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Appearance
        </h2>

        <details class="group rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <summary
            class="flex min-h-[4.25rem] cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Dark mode</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{themeLabel}</p>
            </div>
            <span
              aria-hidden="true"
              class="size-4 shrink-0 rounded-full border-2 border-slate-400 group-open:border-blue-600 group-open:bg-blue-600 group-open:ring-2 group-open:ring-blue-100 dark:border-slate-500 dark:group-open:ring-blue-900"
            ></span>
          </summary>

          <form method="POST" action="?/theme" class="border-t border-slate-200 p-4 dark:border-slate-800">
            <fieldset class="space-y-2">
              <legend class="sr-only">Choose appearance</legend>

              {#each [
                { value: 'system', label: 'System', detail: 'Match this device' },
                { value: 'light', label: 'Light', detail: 'Always use light mode' },
                { value: 'dark', label: 'Dark', detail: 'Always use dark mode' }
              ] as option (option.value)}
                <label
                  class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={data.theme === option.value}
                    class="!size-4 !min-h-0 !w-4 accent-blue-600"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {option.label}
                    </span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400">{option.detail}</span>
                  </span>
                </label>
              {/each}
            </fieldset>

            {#if form?.themeError}
              <p class="mt-3 text-sm font-medium text-red-700 dark:text-red-400" role="alert">
                {form.themeError}
              </p>
            {/if}

            {#if form?.themeSaved}
              <p class="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
                Appearance saved.
              </p>
            {/if}

            <button
              type="submit"
              class="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Apply appearance
            </button>
          </form>
        </details>
      </section>

      <section aria-labelledby="app-heading">
        <h2
          id="app-heading"
          class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          App
        </h2>

        <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Network status</p>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                {isOnline ? 'Online · last synced just now' : 'Offline · changes unavailable'}
              </p>
            </div>
            <span
              aria-hidden="true"
              class={[
                'size-3 shrink-0 rounded-full',
                isOnline ? 'bg-slate-500' : 'bg-orange-500'
              ]}
            ></span>
          </div>
        </div>
      </section>
    </div>

    <footer class="mt-8 flex items-center justify-between gap-4 px-0.5 pb-2">
      <p class="text-xs text-slate-500 dark:text-slate-400">Version {data.version}</p>

      <form method="POST" action={resolve('/logout')}>
        <button
          type="submit"
          class="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
        >
          Sign out
        </button>
      </form>
    </footer>
  </div>
</main>
