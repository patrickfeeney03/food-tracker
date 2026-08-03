<script lang="ts">
  let {
    message = 'Opening tracker…'
  }: {
    message?: string;
  } = $props();
</script>

<main
  class="flex min-h-dvh items-center justify-center bg-[var(--app-canvas)] px-6
    text-[var(--app-text)]"
>
  <p role="status" class="text-sm font-semibold text-[var(--app-muted)]">
    {message}
  </p>
</main>
