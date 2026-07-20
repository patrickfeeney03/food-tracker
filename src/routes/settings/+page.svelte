<script lang="ts">
  import { resolve } from '$app/paths';
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import FeedbackBanner from '$lib/components/FeedbackBanner.svelte';
  import SettingsRow from '$lib/components/settings/SettingsRow.svelte';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
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

<AppPageShell class="px-3 py-4 sm:px-6 sm:py-8">
  <div class="w-full">
    <header class="mb-8 flex min-h-11 items-center gap-3">
      <a
        href={resolve('/')}
        aria-label="Back to diary"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-full
          text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-accent)]"
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

    {#if data.targetsSaved}
      <FeedbackBanner class="mb-5" message="Daily targets saved." />
    {/if}

    <div class="space-y-7">
      <SettingsSection headingId="goals-heading" title="Goals">
        <SettingsRow
          label="Daily targets"
          value={goalSummary}
          route="/settings/goals"
        />
        <SettingsRow
          label="Goal history"
          description="Effective-dated changes"
          route="/settings/goals/history"
          separatorBefore
        />
      </SettingsSection>

      <SettingsSection headingId="account-heading" title="Account & data">
        <SettingsRow
          label="Account"
          value={`${data.user.name} · ${data.user.email}`}
          route="/settings/account"
        />
        <SettingsRow
          label="Active sessions"
          description={`${data.activeSessionCount} ${data.activeSessionCount === 1 ? 'session' : 'sessions'}`}
          separatorBefore
        />
        <SettingsRow
          label="Export data"
          description="Download JSON or CSV"
          separatorBefore
        />
      </SettingsSection>

      <section aria-labelledby="appearance-heading">
        <h2
          id="appearance-heading"
          class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--app-muted)]"
        >
          Appearance
        </h2>

        <details class="group rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-sm">
          <summary
            class="flex min-h-[4.25rem] cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] [&::-webkit-details-marker]:hidden"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-[var(--app-text)]">Dark mode</p>
              <p class="mt-0.5 text-xs text-[var(--app-muted)]">{themeLabel}</p>
            </div>
            <span
              aria-hidden="true"
              class="size-4 shrink-0 rounded-full border-2 border-[var(--app-muted)]
                group-open:border-[var(--app-accent)] group-open:bg-[var(--app-accent)]
                group-open:ring-2 group-open:ring-[var(--app-accent-soft)]"
            ></span>
          </summary>

          <form method="POST" action="?/theme" class="border-t border-[var(--app-border)] p-4">
            <fieldset class="space-y-2">
              <legend class="sr-only">Choose appearance</legend>

              {#each [
                { value: 'system', label: 'System', detail: 'Match this device' },
                { value: 'light', label: 'Light', detail: 'Always use light mode' },
                { value: 'dark', label: 'Dark', detail: 'Always use dark mode' }
              ] as option (option.value)}
                <label
                  class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 transition hover:bg-[var(--app-panel-hover)]"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={data.theme === option.value}
                    class="!size-4 !min-h-0 !w-4 accent-[var(--app-accent)]"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-[var(--app-text)]">
                      {option.label}
                    </span>
                    <span class="block text-xs text-[var(--app-muted)]">{option.detail}</span>
                  </span>
                </label>
              {/each}
            </fieldset>

            {#if form?.themeError}
              <p class="mt-3 text-sm font-medium text-[var(--app-danger-text)]" role="alert">
                {form.themeError}
              </p>
            {/if}

            {#if form?.themeSaved}
              <p class="mt-3 text-sm font-medium text-[var(--app-success-text)]" role="status">
                Appearance saved.
              </p>
            {/if}

            <button
              type="submit"
              class="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg
                bg-[var(--app-accent)] px-4 text-sm font-semibold text-white transition
                hover:bg-[var(--app-accent-hover)] focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
            >
              Apply appearance
            </button>
          </form>
        </details>
      </section>

      <section aria-labelledby="app-heading">
        <h2
          id="app-heading"
          class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--app-muted)]"
        >
          App
        </h2>

        <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-sm">
          <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-[var(--app-text)]">Network status</p>
              <p class="mt-0.5 text-xs text-[var(--app-muted)]" aria-live="polite">
                {isOnline ? 'Online · last synced just now' : 'Offline · changes unavailable'}
              </p>
            </div>
            <span
              aria-hidden="true"
              class={[
                'size-3 shrink-0 rounded-full',
                isOnline ? 'bg-[var(--app-muted)]' : 'bg-[var(--app-orange)]'
              ]}
            ></span>
          </div>
        </div>
      </section>
    </div>

    <footer class="mt-8 flex items-center justify-between gap-4 px-0.5 pb-2">
      <p class="text-xs text-[var(--app-muted)]">Version {data.version}</p>

      <form method="POST" action={resolve('/logout')}>
        <button
          type="submit"
          class="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm
            font-medium text-[var(--app-danger-text)] transition hover:bg-[var(--app-danger-bg)]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-danger-text)]"
        >
          Sign out
        </button>
      </form>
    </footer>
  </div>
</AppPageShell>
