<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    headingId: string;
    title: string;
    children: Snippet;
  };

  let { headingId, title, children }: Props = $props();
</script>

<section aria-labelledby={headingId}>
  <h2
    id={headingId}
    class="mb-2 px-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--app-muted)]"
  >
    {title}
  </h2>

  <div
    class="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-sm"
  >
    {@render children()}
  </div>
</section>
