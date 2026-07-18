<script lang="ts">
  import type { PortionKind } from "$lib/nutrition/constants";

  export type PortionOption = {
    kind: PortionKind;
    label: string;
  };

  let {
    options,
    portionKind = $bindable(),
    error,
    legend = "Amount basis",
    wrapOnMobile = false,
  }: {
    options: readonly PortionOption[];
    portionKind: PortionKind;
    error?: string;
    legend?: string;
    wrapOnMobile?: boolean;
  } = $props();
</script>

<fieldset>
  <legend
    class="mb-2 text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
  >
    {legend}
  </legend>
  <div
    class={wrapOnMobile ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "grid gap-2"}
    style:grid-template-columns={wrapOnMobile
      ? undefined
      : `repeat(${options.length}, minmax(0, 1fr))`}
  >
    {#each options as option (option.kind)}
      <label
        class={[
          "flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-2 text-center text-[12px] font-bold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]",
          portionKind === option.kind
            ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
            : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)]",
        ]}
      >
        <input
          class="sr-only"
          type="radio"
          name="portionKind"
          value={option.kind}
          bind:group={portionKind}
          aria-describedby={error ? "portion-kind-error" : undefined}
        />
        {option.label}
      </label>
    {/each}
  </div>
  {#if error}
    <p
      id="portion-kind-error"
      class="mt-2 text-[12px] text-[var(--app-danger-text)]"
      role="alert"
    >
      {error}
    </p>
  {/if}
</fieldset>
