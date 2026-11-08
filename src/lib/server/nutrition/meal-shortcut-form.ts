import type { searchMealShortcutFoods } from './meal-shortcut';

type PickerFood = Awaited<ReturnType<typeof searchMealShortcutFoods>>[number];

/** Why an editor row cannot be saved until it is replaced or removed. */
export function unavailableItemReason(
  reason: 'food_missing' | 'food_archived' | 'amount_unit_changed'
): string {
  if (reason === 'amount_unit_changed') {
    return 'This food changed between g and ml. Replace it to choose a new exact amount.';
  }
  if (reason === 'food_archived') {
    return 'This food is archived. Replace or remove it.';
  }
  return 'This diary food is no longer available. Replace or remove it.';
}

/**
 * Rebuilds meal shortcut / batch editor rows from a submitted `itemsJson` so a
 * failed save keeps what the user typed.
 */
export function submittedEditorItems(rawItems: unknown, foods: readonly PickerFood[]) {
  if (!Array.isArray(rawItems)) return [];
  const foodsById = new Map(foods.map((food) => [food.id, food]));

  return rawItems.map((rawItem, index) => {
    const item = typeof rawItem === 'object' && rawItem !== null
      ? rawItem as Record<string, unknown>
      : {};
    const foodId = typeof item.foodId === 'string' ? item.foodId : null;
    const food = foodId === null ? undefined : foodsById.get(foodId);
    return {
      key:
        (typeof item.itemId === 'string' && item.itemId) ||
        (typeof item.sourceEntryId === 'string' && item.sourceEntryId) ||
        `submitted-${index}`,
      itemId: typeof item.itemId === 'string' ? item.itemId : undefined,
      sourceEntryId: typeof item.sourceEntryId === 'string' ? item.sourceEntryId : undefined,
      foodId: food === undefined ? null : foodId,
      foodName: food?.name ?? 'Unavailable food',
      foodBrand: food?.brand ?? null,
      amountUnit: food?.amountUnit ?? null,
      amount: typeof item.amount === 'string' ? item.amount : '',
      blocked: food === undefined,
      blockedReason: food === undefined
        ? 'This food is unavailable. Replace or remove it.'
        : undefined
    };
  });
}
