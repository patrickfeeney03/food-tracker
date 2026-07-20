<script lang="ts">
  let {
    id,
    name = id,
    label,
    unit,
    value,
    max,
    min = '0',
    step = '0.001',
    required = false,
    error
  }: {
    id: string;
    name?: string;
    label: string;
    unit: string;
    value: string;
    max: number;
    min?: string;
    step?: string;
    required?: boolean;
    error?: string;
  } = $props();

  let errorId = $derived(`${id}-error`);
</script>

<div class="relative">
  <label
    for={id}
    class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
      !font-medium text-[var(--app-muted)]"
  >{label}</label>
  <input
    id={id}
    name={name}
    type="number"
    {min}
    {max}
    {step}
    inputmode="decimal"
    {value}
    {required}
    aria-invalid={error ? "true" : undefined}
    aria-describedby={error ? errorId : undefined}
    class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)]
      !bg-[var(--app-panel)] !pb-1.5 !pl-3 !pr-12 !pt-5 !text-[14px]
      !font-bold !text-[var(--app-text)] !shadow-none
      focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
  />
  <span
    class="pointer-events-none absolute bottom-2 right-3 text-[11px]
      font-semibold text-[var(--app-muted)]"
  >{unit}</span>
  {#if error}
    <p id={errorId} class="mt-1" role="alert">{error}</p>
  {/if}
</div>
