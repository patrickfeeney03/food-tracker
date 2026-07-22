<script lang="ts">
  import { resolve } from "$app/paths";
  import ChevronRightIcon from "../icons/ChevronRightIcon.svelte";

  type SettingsRoute =
    | "/settings/account"
    | "/settings/export"
    | "/settings/goals"
    | "/settings/goals/history"
    | "/settings/sessions";

  type RowDetail =
    | { description: string; value?: never }
    | { description?: never; value: string }
    | { description?: undefined; value?: undefined };

  type Props = RowDetail & {
    label: string;
    route?: SettingsRoute;
    separatorBefore?: boolean;
    showChevron?: boolean;
  };

  let {
    label,
    description,
    value,
    route,
    separatorBefore = false,
    showChevron = true,
  }: Props = $props();
</script>

{#snippet content()}
  <div class="min-w-0 flex-1">
    <p class="text-sm font-semibold text-[var(--app-text)]">{label}</p>
    {#if value !== undefined}
      <p class="mt-0.5 truncate text-xs text-[var(--app-muted)]">{value}</p>
    {:else if description !== undefined}
      <p class="mt-0.5 text-xs text-[var(--app-muted)]">{description}</p>
    {/if}
  </div>

  {#if showChevron}
    <ChevronRightIcon class="size-4 shrink-0 text-[var(--app-muted)]" />
  {/if}
{/snippet}

{#if separatorBefore}
  <div aria-hidden="true" class="mx-4 border-t border-[var(--app-border)]"></div>
{/if}

{#if route !== undefined}
  <a
    href={resolve(route)}
    class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3 text-[var(--app-text)]
      no-underline transition hover:bg-[var(--app-panel-hover)]
      focus-visible:outline-2 focus-visible:outline-offset-[-2px]
      focus-visible:outline-[var(--app-accent)]"
  >
    {@render content()}
  </a>
{:else}
  <div class="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
    {@render content()}
  </div>
{/if}
