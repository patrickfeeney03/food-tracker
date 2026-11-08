<script lang="ts">
  import NutritionPreview, {
    type NutritionPreviewValue,
  } from "$lib/components/amount-adjuster/NutritionPreview.svelte";
  import { inputLimits } from "$lib/nutrition/input-limits";

  let {
    portionCount = $bindable(),
    min = 1,
    preview,
    error,
  }: {
    portionCount: number;
    min?: number;
    preview: NutritionPreviewValue | null;
    error?: string;
  } = $props();

  const chips = [1, 2, 3, 4];
</script>

<div class="mt-7 space-y-3">
  <fieldset>
    <legend
      class="mb-2 text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Portions</legend>
    <div class="grid grid-cols-4 gap-2">
      {#each chips as chip (chip)}
        <label
          class={[
            "flex min-h-11 items-center justify-center rounded-full border px-2 text-center text-[12px] font-bold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--app-accent)]",
            chip < min ? "cursor-not-allowed opacity-40" : "cursor-pointer",
            portionCount === chip
              ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white"
              : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)]",
          ]}
        >
          <input
            class="sr-only"
            type="radio"
            name="portionChoice"
            value={chip}
            disabled={chip < min}
            checked={portionCount === chip}
            onchange={() => (portionCount = chip)}
          />
          {chip}
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="space-y-1.5">
    <label
      for="batch-portion-count"
      class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
    >Number of portions</label>
    <input
      id="batch-portion-count"
      type="number"
      name="portionCount"
      min={min}
      max={inputLimits.batch.portionCount.max}
      step="1"
      inputmode="numeric"
      bind:value={portionCount}
      required
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? "batch-portion-count-error" : undefined}
      class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !px-3.5 !text-[14px]
        !font-semibold !shadow-none focus:!border-[var(--app-accent)]
        focus:!ring-[var(--app-accent)]/15"
    />
    {#if error}
      <p
        id="batch-portion-count-error"
        class="text-[12px] text-[var(--app-danger-text)]"
        role="alert"
      >{error}</p>
    {/if}
  </div>

  <NutritionPreview {preview} label="Each portion" compact />
</div>
