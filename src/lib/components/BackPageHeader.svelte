<script lang="ts">
  import type { ResolvedPathname } from "$app/types";
  import ChevronLeftIcon from "./icons/ChevronLeftIcon.svelte";

  let {
    href,
    backLabel,
    title,
    description,
    class: className = "mb-7 flex items-start gap-3",
    linkClass = "-ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--app-text)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]",
    titleClass = "text-[21px] font-extrabold leading-tight tracking-[-0.025em]",
    descriptionClass = "mt-1 text-sm leading-5 text-[var(--app-muted)]",
    contentClass = "",
  }: {
    href: ResolvedPathname;
    backLabel: string;
    title: string;
    description?: string;
    class?: string;
    linkClass?: string;
    titleClass?: string;
    descriptionClass?: string;
    contentClass?: string;
  } = $props();
</script>

<header class={className}>
  <a
    {href}
    aria-label={backLabel}
    class={linkClass}
  >
    <ChevronLeftIcon class="size-5" />
  </a>
  <div class={["pt-1", contentClass]}>
    <h1 class={titleClass}>
      {title}
    </h1>
    {#if description !== undefined}
      <p class={descriptionClass}>
        {description}
      </p>
    {/if}
  </div>
</header>
