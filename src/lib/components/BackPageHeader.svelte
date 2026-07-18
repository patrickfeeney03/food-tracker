<script lang="ts">
  import type { ResolvedPathname } from "$app/types";

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
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="size-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
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
