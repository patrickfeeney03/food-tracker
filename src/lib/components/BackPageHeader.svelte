<script lang="ts">
  import type { ResolvedPathname } from "$app/types";
  import ChevronLeftIcon from "./icons/ChevronLeftIcon.svelte";

  let {
    href,
    backLabel,
    title,
    description,
    contentClass = "",
  }: {
    href: ResolvedPathname;
    backLabel: string;
    title: string;
    description: string;
    contentClass?: string;
  } = $props();
</script>

<header class="mb-7 flex items-start gap-3">
  <a
    {href}
    aria-label={backLabel}
    class="-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full
      text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)]
      focus-visible:outline-2 focus-visible:outline-offset-2
      focus-visible:outline-[var(--app-accent)]"
  >
    <ChevronLeftIcon class="size-5" />
  </a>
  <div class={["pt-1", contentClass]}>
    <h1 class="text-[21px] font-extrabold leading-tight tracking-[-0.025em]">
      {title}
    </h1>
    <p class="mt-1 text-sm leading-5 text-[var(--app-muted)]">
      {description}
    </p>
  </div>
</header>
