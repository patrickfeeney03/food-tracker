<script lang="ts">
  import { resolve } from '$app/paths';
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import BackPageHeader from '$lib/components/BackPageHeader.svelte';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
</script>

<svelte:head>
  <title>Export Data | Calorie Tracker</title>
  <meta
    name="description"
    content="Download a copy of your Calorie Tracker data."
  />
</svelte:head>

<AppPageShell class="px-4 pb-8 pt-4 sm:px-7 sm:py-8">
  <BackPageHeader
    href={resolve('/settings')}
    backLabel="Back to settings"
    title="Export data"
    description="Download a private copy of your tracker data for safekeeping or analysis."
  />

  <SettingsSection headingId="export-heading" title="Downloads">
    <div class="divide-y divide-[var(--app-border)]">
      <div class="px-4 py-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-[var(--app-text)]">Full JSON export</h3>
            <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
              Includes your goals, foods, diary history, and meal shortcuts, including archived
              and deleted records.
            </p>
          </div>
          <a
            href={resolve('/settings/export/json')}
            download
            class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg
              bg-[var(--app-accent)] px-4 text-sm font-semibold text-white no-underline
              transition hover:bg-[var(--app-accent-hover)] focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          >
            Download JSON
          </a>
        </div>
      </div>

      <div class="px-4 py-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-[var(--app-text)]">Diary CSV</h3>
            <p class="mt-1 text-xs leading-5 text-[var(--app-muted)]">
              Includes active diary entries in readable units for use in a spreadsheet.
            </p>
          </div>
          <a
            href={resolve('/settings/export/csv')}
            download
            class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg
              border border-[var(--app-border)] bg-[var(--app-panel)] px-4 text-sm
              font-semibold text-[var(--app-text)] no-underline transition
              hover:bg-[var(--app-panel-hover)] focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          >
            Download CSV
          </a>
        </div>
      </div>
    </div>
  </SettingsSection>
</AppPageShell>
