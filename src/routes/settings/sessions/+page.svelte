<script lang="ts">
  import { resolve } from '$app/paths';
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import BackPageHeader from '$lib/components/BackPageHeader.svelte';
  import FeedbackBanner from '$lib/components/FeedbackBanner.svelte';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
  import { formatDate } from '$lib/nutrition/format';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();

  function deviceLabel(userAgent: string | null): string {
    if (userAgent === null || userAgent.trim().length === 0) {
      return 'Unknown device';
    }

    return userAgent;
  }
</script>

<svelte:head>
  <title>Active Sessions | Calorie Tracker</title>
  <meta
    name="description"
    content="Review and sign out active Calorie Tracker sessions."
  />
</svelte:head>

<AppPageShell class="px-4 pb-8 pt-4 sm:px-7 sm:py-8">
  <BackPageHeader
    href={resolve('/settings')}
    backLabel="Back to settings"
    title="Active sessions"
    description="Review devices signed in to your account and remove access you no longer need."
  />

  {#if data.revoked}
    <FeedbackBanner class="mb-5" message="Session signed out." />
  {/if}

  {#if form?.revokeError}
    <p
      class="mb-5 rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--app-danger-text)]"
      role="alert"
    >
      {form.revokeError}
    </p>
  {/if}

  <SettingsSection headingId="sessions-heading" title="Sessions">
    {#if data.sessions.length === 0}
      <p class="px-4 py-3 text-sm text-[var(--app-muted)]">
        No active sessions are available for this account.
      </p>
    {:else}
      <ul class="divide-y divide-[var(--app-border)]">
        {#each data.sessions as session (session.id)}
          <li class="px-4 py-4">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="break-words text-sm font-semibold text-[var(--app-text)]">
                    {deviceLabel(session.userAgent)}
                  </h3>
                  {#if session.isCurrent}
                    <span
                      class="rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--app-accent)]"
                    >
                      Current
                    </span>
                  {/if}
                </div>

                <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <dt class="font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      Signed in
                    </dt>
                    <dd class="mt-0.5 font-medium text-[var(--app-text)]">
                      {formatDate(session.createdAt, { time: true })}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      Last seen
                    </dt>
                    <dd class="mt-0.5 font-medium text-[var(--app-text)]">
                      {formatDate(session.lastSeenAt, { time: true })}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      Expires
                    </dt>
                    <dd class="mt-0.5 font-medium text-[var(--app-text)]">
                      {formatDate(session.expiresAt, { time: true })}
                    </dd>
                  </div>
                </dl>
              </div>

              <form method="POST" action="?/revoke" class="shrink-0">
                <input type="hidden" name="sessionId" value={session.id} />
                <button
                  type="submit"
                  class="inline-flex min-h-11 w-full items-center justify-center rounded-lg
                    bg-[var(--app-danger-bg)] px-3 text-sm font-semibold
                    text-[var(--app-danger-text)] transition hover:bg-[var(--app-panel)]
                    focus-visible:outline-2 focus-visible:outline-offset-2
                    focus-visible:outline-[var(--app-danger-text)] sm:w-auto"
                >
                  {session.isCurrent ? 'Sign out' : 'Revoke'}
                </button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </SettingsSection>
</AppPageShell>
