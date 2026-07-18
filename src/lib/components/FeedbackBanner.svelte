<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    message,
    tone = "success",
    action,
    class: className = "",
  }: {
    message: string;
    tone?: "success" | "danger";
    action?: Snippet;
    class?: string;
  } = $props();

  let role = $derived(tone === "danger" ? "alert" : "status");
  let toneClass = $derived(
    tone === "danger"
      ? `border-[var(--app-danger-border)] bg-[var(--app-danger-bg)]
        text-[var(--app-danger-text)]`
      : `border-[var(--app-success-border)] bg-[var(--app-success-bg)]
        text-[var(--app-success-text)]`,
  );
</script>

<div
  {role}
  class={[
    "rounded-xl border px-3 py-2.5 text-sm font-medium",
    toneClass,
    className,
  ]}
>
  {#if action}
    <div class="flex items-center justify-between gap-3">
      <span class="min-w-0">{message}</span>
      <div class="shrink-0">{@render action()}</div>
    </div>
  {:else}
    {message}
  {/if}
</div>
