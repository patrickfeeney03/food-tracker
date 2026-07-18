<script lang="ts">
  import { formatStoredValue } from "$lib/nutrition/math";

  export type NutritionPreviewValue = {
    energyMkcal: bigint;
    proteinMg: bigint;
    carbsMg: bigint;
    fatMg: bigint;
  };

  let {
    preview,
    label = "Nutrition preview",
    energyFractionalDigits = 0,
    compact = false,
  }: {
    preview: NutritionPreviewValue | null;
    label?: string;
    energyFractionalDigits?: number;
    compact?: boolean;
  } = $props();
</script>

<section
  aria-label={label}
  aria-live="polite"
  class="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4"
>
  <strong class="block text-[28px] font-extrabold leading-none">
    {preview
      ? formatStoredValue(preview.energyMkcal, energyFractionalDigits)
      : "—"}
  </strong>
  <span class="mt-1 block text-[10px] text-[var(--app-muted)]">kcal</span>

  <dl class={compact ? "mt-5 grid grid-cols-3 gap-4" : "mt-6 grid grid-cols-3 gap-4"}>
    <div>
      <dt class="text-[10px] text-[var(--app-muted)]">Protein</dt>
      <dd class="mt-1 text-[13px] font-bold text-[var(--app-purple)]">
        {preview ? formatStoredValue(preview.proteinMg, 1) : "—"} g
      </dd>
    </div>
    <div>
      <dt class="text-[10px] text-[var(--app-muted)]">Carbs</dt>
      <dd class="mt-1 text-[13px] font-bold text-[var(--app-orange)]">
        {preview ? formatStoredValue(preview.carbsMg, 1) : "—"} g
      </dd>
    </div>
    <div>
      <dt class="text-[10px] text-[var(--app-muted)]">Fat</dt>
      <dd class="mt-1 text-[13px] font-bold text-[var(--app-green)]">
        {preview ? formatStoredValue(preview.fatMg, 1) : "—"} g
      </dd>
    </div>
  </dl>
</section>
