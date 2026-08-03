<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    class: className = "",
    size = "compact",
    variant = "default",
  }: {
    children: Snippet;
    class?: string;
    size?: "compact" | "wide";
    variant?: "default" | "diary";
  } = $props();
</script>

<div
  class={variant === "diary"
    ? "min-h-dvh bg-[var(--app-canvas)] text-[var(--app-text)] sm:py-5 lg:p-7"
    : "min-h-dvh bg-[var(--app-canvas)] sm:px-4 sm:py-6"}
>
  <main
    class={[
      variant === "diary"
        ? `mx-auto min-h-dvh w-full max-w-[430px] bg-[var(--app-diary-surface)] px-4 pb-12
          pt-[calc(1.125rem+env(safe-area-inset-top))] sm:min-h-[calc(100dvh-40px)]
          sm:rounded-[26px] sm:shadow-[0_18px_55px_rgba(24,33,47,0.1)]
          lg:min-h-[calc(100dvh-56px)] lg:max-w-[1180px] lg:rounded-[28px]
          lg:px-[30px] lg:pb-[38px] xl:max-w-[1260px] xl:px-10`
        : `mx-auto min-h-dvh w-full bg-[var(--app-surface)] pb-[env(safe-area-inset-bottom)]
          text-[var(--app-text)] sm:min-h-[calc(100dvh-3rem)] sm:rounded-[26px] sm:border
          sm:border-[var(--app-border)]/70
          sm:shadow-[0_24px_60px_rgba(23,32,51,0.12)]`,
      variant === "default"
        ? size === "wide"
          ? "sm:max-w-3xl lg:max-w-5xl"
          : "max-w-[430px]"
        : "",
      className,
    ]}
  >
    {@render children()}
  </main>
</div>
