<script lang="ts">
  import AppMark from '$lib/components/icons/AppMark.svelte';

  function retry() {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>Offline | Calorie Tracker</title>
  <meta
    name="description"
    content="Calorie Tracker is waiting for an internet connection."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<main
  class="flex min-h-dvh items-center justify-center bg-[var(--app-surface)] px-6
    pb-[calc(2rem+env(safe-area-inset-bottom))] text-[var(--app-text)]"
>
  <section class="w-full max-w-sm text-center" aria-labelledby="offline-heading">
    <div
      class="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border
        border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-accent)] shadow-sm"
      aria-hidden="true"
    >
      <AppMark class="size-11" />
    </div>

    <p class="text-xs font-bold uppercase text-[var(--app-accent)]">Calorie Tracker</p>
    <h1 id="offline-heading" class="mt-2 text-2xl font-bold">You're offline</h1>
    <p class="mx-auto mt-3 max-w-xs text-sm leading-6 text-[var(--app-muted)]">
      Reconnect to open your diary and log food.
    </p>

    <button
      type="button"
      onclick={retry}
      class="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl
        bg-[var(--app-accent)] px-5 text-sm font-bold text-white shadow-sm transition
        hover:bg-[var(--app-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-3
        focus-visible:outline-[var(--app-accent)] active:translate-y-px"
    >
      Try again
    </button>
  </section>
</main>
