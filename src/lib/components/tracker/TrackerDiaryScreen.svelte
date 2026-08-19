<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve -- coordinator supplies resolved hrefs */
  import AppPageShell from '$lib/components/AppPageShell.svelte';
  import DiaryDayView, {
    type DiaryDayViewActions,
    type DiaryDayViewData
  } from '$lib/components/diary/DiaryDayView.svelte';
  import FeedbackBanner from '$lib/components/FeedbackBanner.svelte';
  import ChevronLeftIcon from '$lib/components/icons/ChevronLeftIcon.svelte';
  import ChevronRightIcon from '$lib/components/icons/ChevronRightIcon.svelte';
  import SettingsIcon from '$lib/components/icons/SettingsIcon.svelte';
  import type { MealSlot } from '$lib/nutrition/constants';
  import type { DiaryEntryFeedback } from '$lib/tracker/types';
  import { resolve } from '$app/paths';

  let {
    diary,
    shortcutEligibility,
    actions,
    previousHref,
    nextHref,
    todayHref,
    settingsHref,
    dateLabel,
    isOffline,
    offlineCapabilityMessage,
    diaryLoadError,
    showDiaryLoadError,
    onRetry,
    entryFeedback
  }: {
    diary: DiaryDayViewData;
    shortcutEligibility: Record<MealSlot, boolean>;
    actions: DiaryDayViewActions;
    previousHref: string | null;
    nextHref: string | null;
    todayHref: string;
    settingsHref: string;
    dateLabel: string;
    isOffline: boolean;
    offlineCapabilityMessage: string;
    diaryLoadError: string | null;
    showDiaryLoadError: boolean;
    onRetry: () => void;
    entryFeedback: DiaryEntryFeedback | null;
  } = $props();
</script>

<AppPageShell variant="diary">
  <nav
    aria-label="Diary date"
    class="mb-[22px] grid grid-cols-[2fr_4fr_1fr_1fr] items-center gap-1.5
      lg:mb-[30px] lg:grid-cols-[44px_minmax(180px,1fr)_44px_44px]"
  >
    {#if previousHref !== null}
      <a
        href={previousHref}
        aria-label={isOffline ? 'Previous saved day' : 'Previous day'}
        class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-text)]
          transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
          focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
      >
        <ChevronLeftIcon class="size-[21px]" />
      </a>
    {:else}
      <span
        aria-label="No earlier diary is saved offline"
        aria-disabled="true"
        class="inline-flex size-11 items-center justify-center text-[var(--app-muted)] opacity-35"
      >
        <ChevronLeftIcon class="size-[21px]" />
      </span>
    {/if}

    <a
      href={todayHref}
      aria-label="Go to today"
      class="min-w-[116px] justify-self-center rounded-full bg-[var(--app-panel)] px-6 py-[9px]
        text-center text-[14px] font-bold leading-none text-[var(--app-text)] no-underline
        focus-visible:outline-3 focus-visible:outline-offset-2
        focus-visible:outline-[var(--app-accent)]/30 lg:min-w-[150px]"
    >
      {dateLabel}
    </a>

    {#if isOffline}
      <span
        aria-label="Settings are available when online"
        aria-disabled="true"
        title="Available when online"
        class="inline-flex size-11 cursor-not-allowed items-center justify-center rounded-full
          text-[var(--app-muted)] opacity-45"
      >
        <SettingsIcon class="size-[21px]" />
      </span>
    {:else}
      <a
        href={settingsHref}
        class="inline-flex size-11 items-center justify-center rounded-full
          text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
          focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
        aria-label="Open settings"
        title="Settings"
      >
        <SettingsIcon class="size-[21px]" />
      </a>
    {/if}

    {#if nextHref !== null}
      <a
        href={nextHref}
        aria-label={isOffline ? 'Next saved day' : 'Next day'}
        class="inline-flex size-11 items-center justify-center rounded-full text-[var(--app-text)]
          transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-3
          focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/30"
      >
        <ChevronRightIcon class="size-[21px]" />
      </a>
    {:else}
      <span
        aria-label="No later diary is saved offline"
        aria-disabled="true"
        class="inline-flex size-11 items-center justify-center text-[var(--app-muted)] opacity-35"
      >
        <ChevronRightIcon class="size-[21px]" />
      </span>
    {/if}
  </nav>

  {#if isOffline}
    <FeedbackBanner
      class="mb-5"
      message={offlineCapabilityMessage}
      tone="neutral"
    />
  {/if}

  {#if diaryLoadError !== null && showDiaryLoadError}
    <FeedbackBanner class="mb-5" message={diaryLoadError} tone="danger">
      {#snippet action()}
        <button
          type="button"
          onclick={onRetry}
          class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
            text-[var(--app-danger-text)] underline underline-offset-2
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[var(--app-danger-text)]"
        >
          Retry
        </button>
      {/snippet}
    </FeedbackBanner>
  {/if}

  {#if entryFeedback?.kind === 'deleted'}
    <FeedbackBanner
      class="mb-5"
      message={`${entryFeedback.foodName} was removed from this diary.`}
    >
      {#snippet action()}
        <form method="POST" action={resolve('/api/tracker/undo-entry-delete')}>
          <input type="hidden" name="entryId" value={entryFeedback.entryId} />
          <input type="hidden" name="deletedAt" value={entryFeedback.deletedAt} />
          <button
            type="submit"
            class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
              text-[var(--app-success-text)] underline underline-offset-2
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)]"
          >
            Undo
          </button>
        </form>
      {/snippet}
    </FeedbackBanner>
  {:else if entryFeedback?.kind === 'restored'}
    <FeedbackBanner
      class="mb-5"
      message={`${entryFeedback.foodName} was restored to this diary.`}
    />
  {:else if entryFeedback?.kind === 'shortcut-applied'}
    <FeedbackBanner
      class="mb-5"
      message={`${entryFeedback.shortcutName} was added to this diary.`}
    >
      {#snippet action()}
        <form method="POST" action={resolve('/api/tracker/undo-shortcut-application')}>
          <input type="hidden" name="applicationId" value={entryFeedback.applicationId} />
          <button
            type="submit"
            class="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold
              text-[var(--app-success-text)] underline underline-offset-2
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[var(--app-success-text)]"
          >
            Undo
          </button>
        </form>
      {/snippet}
    </FeedbackBanner>
  {:else if entryFeedback?.kind === 'shortcut-undone'}
    <FeedbackBanner
      class="mb-5"
      message={`${entryFeedback.shortcutName} was removed from this diary.`}
    />
  {/if}

  <DiaryDayView
    {diary}
    {shortcutEligibility}
    {actions}
  />
</AppPageShell>
