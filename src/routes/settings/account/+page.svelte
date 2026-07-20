<script lang="ts">
  import { resolve } from '$app/paths';
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import BackPageHeader from '$lib/components/BackPageHeader.svelte';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const dateFormatter = new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const dateTimeFormatter = new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  function formatDate(date: Date): string {
    return dateFormatter.format(date);
  }

  function formatDateTime(date: Date): string {
    return dateTimeFormatter.format(date);
  }
</script>

<svelte:head>
  <title>Account | Calorie Tracker</title>
  <meta
    name="description"
    content="Review your Calorie Tracker account identity and current session."
  />
</svelte:head>

<AppPageShell class="px-4 pb-8 pt-4 sm:px-7 sm:py-8">
  <BackPageHeader
    href={resolve('/settings')}
    backLabel="Back to settings"
    title="Account"
    description="Review the Google identity and current login used by this tracker."
  />

  <div class="space-y-7">
    <SettingsSection headingId="identity-heading" title="Identity">
      <dl class="divide-y divide-[var(--app-border)]">
        <div class="px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Display name
          </dt>
          <dd class="mt-1 text-sm font-semibold text-[var(--app-text)]">{data.user.name}</dd>
        </div>
        <div class="px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Email
          </dt>
          <dd class="mt-1 break-words text-sm font-semibold text-[var(--app-text)]">
            {data.user.email}
          </dd>
        </div>
        <div class="px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Google account
          </dt>
          <dd class="mt-1 break-words text-sm font-semibold text-[var(--app-text)]">
            {data.authAccount?.emailAtLink ?? 'Not linked'}
          </dd>
        </div>
        <div class="px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
            Account created
          </dt>
          <dd class="mt-1 text-sm font-semibold text-[var(--app-text)]">
            {formatDate(data.user.createdAt)}
          </dd>
        </div>
      </dl>
    </SettingsSection>

    <SettingsSection headingId="current-session-heading" title="Current session">
      {#if data.currentSession === null}
        <p class="px-4 py-3 text-sm text-[var(--app-muted)]">
          No active session details are available for this request.
        </p>
      {:else}
        <dl class="divide-y divide-[var(--app-border)]">
          <div class="px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              Signed in
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--app-text)]">
              {formatDateTime(data.currentSession.createdAt)}
            </dd>
          </div>
          <div class="px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              Last seen
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--app-text)]">
              {formatDateTime(data.currentSession.lastSeenAt)}
            </dd>
          </div>
          <div class="px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              Expires
            </dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--app-text)]">
              {formatDateTime(data.currentSession.expiresAt)}
            </dd>
          </div>
          <div class="px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              Device
            </dt>
            <dd class="mt-1 break-words text-sm font-semibold text-[var(--app-text)]">
              {data.currentSession.userAgent ?? 'Unknown device'}
            </dd>
          </div>
        </dl>
      {/if}
    </SettingsSection>

    <form method="POST" action={resolve('/logout')}>
      <button
        type="submit"
        class="inline-flex min-h-12 w-full items-center justify-center rounded-xl
          bg-[var(--app-danger-bg)] px-4 text-sm font-bold
          text-[var(--app-danger-text)] transition hover:border-[var(--app-danger-border)]
          hover:bg-[var(--app-panel)] focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[var(--app-danger-text)]"
      >
        Sign out
      </button>
    </form>
  </div>
</AppPageShell>
