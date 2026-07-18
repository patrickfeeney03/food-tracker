<script lang="ts">
  let {
    portionCount = $bindable(),
    portionLabel,
    resolvedAmount,
    error,
    fallbackLabel = "",
    wideSuffix = false,
  }: {
    portionCount: string | number | undefined;
    portionLabel?: string;
    resolvedAmount: string;
    error?: string;
    fallbackLabel?: string;
    wideSuffix?: boolean;
  } = $props();
</script>

<div class="space-y-3">
  <div class="space-y-1.5">
    <label
      for="portionCount"
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >
      Number of portions
    </label>
    <div class="relative">
      <input
        id="portionCount"
        name="portionCount"
        type="number"
        min="0.001"
        step="0.001"
        inputmode="decimal"
        bind:value={portionCount}
        required
        autocomplete="off"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "portion-count-error" : undefined}
        class={[
          "!min-h-[58px] !rounded-[13px] !border-[var(--app-border)] !px-3.5 !text-[20px] !font-bold !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15",
          wideSuffix ? "!pr-32" : "!pr-24",
        ]}
      />
      <span
        class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px]
          font-semibold text-[var(--app-muted)]"
      >
        × {portionLabel ?? fallbackLabel}
      </span>
    </div>
    {#if error}
      <p
        id="portion-count-error"
        class="text-[12px] text-[var(--app-danger-text)]"
        role="alert"
      >
        {error}
      </p>
    {/if}
  </div>

  <div class="flex items-center justify-between gap-5 px-0.5" aria-live="polite">
    <span class="text-[12px] text-[var(--app-muted)]">Resolved amount</span>
    <strong class="text-[15px]">{resolvedAmount}</strong>
  </div>
</div>
