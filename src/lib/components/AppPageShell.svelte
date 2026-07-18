<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    class: className = "",
    size = "compact",
  }: {
    children: Snippet;
    class?: string;
    size?: "compact" | "wide";
  } = $props();
</script>

<div class="min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6">
  <main
    class={[
      `mx-auto min-h-dvh w-full bg-[var(--app-surface)] text-[var(--app-text)]
        sm:min-h-[calc(100dvh-3rem)] sm:rounded-[26px] sm:border
        sm:border-[var(--app-border)]/70
        sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]`,
      size === "wide" ? "sm:max-w-3xl lg:max-w-5xl" : "max-w-[430px]",
      className,
    ]}
  >
    {@render children()}
  </main>
</div>
