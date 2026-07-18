<script lang="ts">
  import { formatStoredValue } from "$lib/nutrition/math";
  import MealShortcutFoodPicker from "./MealShortcutFoodPicker.svelte";

  export type MealShortcutEditorItem = {
    key: string;
    itemId?: string;
    sourceEntryId?: string;
    foodId: string | null;
    foodName: string;
    foodBrand: string | null;
    amountUnit: "mg" | "ul" | null;
    amount: string;
    blocked: boolean;
    blockedReason?: string;
  };

  export type MealShortcutPickerFood = {
    id: string;
    name: string;
    brand: string | null;
    amountUnit: "mg" | "ul";
    suggestedAmount: number;
  };

  let {
    name = $bindable(),
    items = $bindable(),
    availableFoods,
    nameError,
    itemsError,
  }: {
    name: string;
    items: MealShortcutEditorItem[];
    availableFoods: readonly MealShortcutPickerFood[];
    nameError?: string;
    itemsError?: string;
  } = $props();

  let pickerMode = $state<"add" | string | null>(null);

  let serializedItems = $derived(
    JSON.stringify(
      items.map((item) => ({
        itemId: item.itemId,
        sourceEntryId: item.sourceEntryId,
        foodId: item.foodId,
        amount: item.amount,
      })),
    ),
  );

  function moveItem(index: number, offset: -1 | 1) {
    const destination = index + offset;
    if (destination < 0 || destination >= items.length) return;

    const next = [...items];
    [next[index], next[destination]] = [next[destination], next[index]];
    items = next;
  }

  function removeItem(key: string) {
    items = items.filter((item) => item.key !== key);
    if (pickerMode === key) closePicker();
  }

  function updateAmount(key: string, amount: string) {
    items = items.map((item) => (item.key === key ? { ...item, amount } : item));
  }

  function openPicker(mode: "add" | string) {
    pickerMode = mode;
  }

  function closePicker() {
    pickerMode = null;
  }

  function chooseFood(food: MealShortcutPickerFood) {
    const replacement = {
      foodId: food.id,
      foodName: food.name,
      foodBrand: food.brand,
      amountUnit: food.amountUnit,
      amount: formatStoredValue(BigInt(food.suggestedAmount), 3),
      blocked: false,
      blockedReason: undefined,
    };

    if (pickerMode === "add") {
      items = [
        ...items,
        {
          key: crypto.randomUUID(),
          ...replacement,
        },
      ];
    } else if (pickerMode !== null) {
      items = items.map((item) =>
        item.key === pickerMode ? { ...item, ...replacement } : item,
      );
    }

    closePicker();
  }
</script>

<input type="hidden" name="itemsJson" value={serializedItems} />

<div class="space-y-1.5">
  <label
    for="shortcut-name"
    class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
  >Meal shortcut name</label>
  <input
    id="shortcut-name"
    name="name"
    bind:value={name}
    required
    maxlength="200"
    autocomplete="off"
    aria-invalid={nameError ? "true" : undefined}
    aria-describedby={nameError ? "shortcut-name-error" : undefined}
    class="!min-h-12 !rounded-[12px] !border-[var(--app-border)] !px-3.5 !text-[14px]
      !font-semibold !shadow-none focus:!border-[var(--app-accent)]
      focus:!ring-[var(--app-accent)]/15"
  />
  {#if nameError}
    <p id="shortcut-name-error" role="alert">{nameError}</p>
  {/if}
</div>

<section aria-labelledby="shortcut-items-heading" class="mt-7">
  <div class="mb-2 flex items-center justify-between gap-4">
    <div>
      <h2
        id="shortcut-items-heading"
        class="text-[10px] font-bold uppercase tracking-[0.02em] text-[var(--app-muted)]"
      >Foods</h2>
      <p class="mt-1 text-xs text-[var(--app-muted)]">
        Amounts are exact and use each food's g or ml unit.
      </p>
    </div>
    <button
      type="button"
      onclick={() => openPicker("add")}
      class="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-bold
        text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-[var(--app-accent)]"
    >+ Add food</button>
  </div>

  {#if items.length === 0}
    <div
      class="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-panel)]
        px-4 py-6 text-center text-sm text-[var(--app-muted)]"
    >Add at least one food to save this shortcut.</div>
  {:else}
    <ol class="grid gap-3">
      {#each items as item, index (item.key)}
        <li
          class={[
            "rounded-xl border bg-[var(--app-panel)] p-3",
            item.blocked
              ? "border-[var(--app-danger-border)]"
              : "border-[var(--app-border)]",
          ]}
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-sm font-bold text-[var(--app-text)]">
                {item.foodName}
              </h3>
              <p class="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">
                {item.foodBrand ?? "Custom food"}
              </p>
              {#if item.blocked}
                <p class="mt-2 text-xs font-medium text-[var(--app-danger-text)]" role="status">
                  {item.blockedReason ?? "This food is unavailable. Replace or remove it."}
                </p>
              {/if}
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onclick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${item.foodName} up`}
                class="inline-flex size-11 items-center justify-center rounded-lg text-lg
                  text-[var(--app-muted)] hover:bg-[var(--app-panel-hover)] disabled:opacity-30
                  focus-visible:outline-2 focus-visible:outline-offset-1
                  focus-visible:outline-[var(--app-accent)]"
              >↑</button>
              <button
                type="button"
                onclick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move ${item.foodName} down`}
                class="inline-flex size-11 items-center justify-center rounded-lg text-lg
                  text-[var(--app-muted)] hover:bg-[var(--app-panel-hover)] disabled:opacity-30
                  focus-visible:outline-2 focus-visible:outline-offset-1
                  focus-visible:outline-[var(--app-accent)]"
              >↓</button>
            </div>
          </div>

          <div class="mt-3 flex items-end gap-2">
            {#if item.blocked}
              <div
                class="flex min-h-[58px] min-w-0 flex-1 items-center rounded-xl border
                  border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] px-3 text-xs
                  font-semibold text-[var(--app-danger-text)]"
              >Replace or remove this row before saving.</div>
            {:else}
              <div class="relative min-w-0 flex-1">
                <label
                  for={`shortcut-amount-${item.key}`}
                  class="pointer-events-none absolute left-3 top-2 z-10 !text-[10px]
                    !font-medium text-[var(--app-muted)]"
                >Exact amount</label>
                <input
                  id={`shortcut-amount-${item.key}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  inputmode="decimal"
                  value={item.amount}
                  oninput={(event) =>
                    updateAmount(item.key, (event.currentTarget as HTMLInputElement).value)}
                  required
                  class="!min-h-[58px] !rounded-[12px] !border-[var(--app-border)] !pb-1.5
                    !pl-3 !pr-11 !pt-5 !text-[14px] !font-bold !shadow-none
                    focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
                />
                <span
                  class="pointer-events-none absolute bottom-2 right-3 text-[11px] font-semibold
                    text-[var(--app-muted)]"
                >{item.amountUnit === "ul" ? "ml" : "g"}</span>
              </div>
            {/if}
            <button
              type="button"
              onclick={() => openPicker(item.key)}
              class="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold
                text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-1
                focus-visible:outline-[var(--app-accent)]"
            >Replace</button>
            <button
              type="button"
              onclick={() => removeItem(item.key)}
              aria-label={`Remove ${item.foodName}`}
              class="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold
                text-[var(--app-danger-text)] focus-visible:outline-2 focus-visible:outline-offset-1
                focus-visible:outline-[var(--app-danger-text)]"
            >Remove</button>
          </div>
        </li>
      {/each}
    </ol>
  {/if}

  {#if itemsError}
    <p class="mt-2 text-sm font-medium text-[var(--app-danger-text)]" role="alert">
      {itemsError}
    </p>
  {/if}
</section>

{#if pickerMode !== null}
  <MealShortcutFoodPicker
    mode={pickerMode === "add" ? "add" : "replace"}
    foods={availableFoods}
    onChoose={chooseFood}
    onCancel={closePicker}
  />
{/if}
