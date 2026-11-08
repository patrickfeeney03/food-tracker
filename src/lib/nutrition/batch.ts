import { shiftDate } from '$lib/date';
import { inputLimits } from './input-limits';
import { divideRoundHalfUp, parseFixedPoint, scaleNutritionValue } from './math';

export interface BatchNutritionFood {
  basisAmount: number;
  energyMkcalPerBasis: number;
  proteinMgPerBasis: number;
  carbsMgPerBasis: number;
  fatMgPerBasis: number;
}

export interface BatchPortionTotals {
  energyMkcal: bigint;
  proteinMg: bigint;
  carbsMg: bigint;
  fatMg: bigint;
}

/** One portion of an ingredient: total ÷ portionCount, rounded half up. */
export function portionAmount(totalAmount: bigint, portionCount: bigint): bigint {
  if (portionCount < 1n) throw new RangeError('Portion count must be at least 1');
  if (totalAmount <= 0n) throw new RangeError('Total amount must be positive');
  const amount = divideRoundHalfUp(totalAmount, portionCount);
  if (amount === 0n) throw new RangeError('An ingredient is too small to split into that many portions');
  return amount;
}

/** Nutrition of ONE portion; equals the sum of the diary rows logged for it. */
export function batchPortionTotals(
  items: readonly { totalAmount: bigint; food: BatchNutritionFood }[],
  portionCount: number
): BatchPortionTotals {
  if (!Number.isInteger(portionCount)) throw new RangeError('Portion count must be an integer');
  const totals: BatchPortionTotals = { energyMkcal: 0n, proteinMg: 0n, carbsMg: 0n, fatMg: 0n };
  for (const { totalAmount, food } of items) {
    const amount = portionAmount(totalAmount, BigInt(portionCount));
    const basis = BigInt(food.basisAmount);
    totals.energyMkcal += scaleNutritionValue(BigInt(food.energyMkcalPerBasis), amount, basis);
    totals.proteinMg += scaleNutritionValue(BigInt(food.proteinMgPerBasis), amount, basis);
    totals.carbsMg += scaleNutritionValue(BigInt(food.carbsMgPerBasis), amount, basis);
    totals.fatMg += scaleNutritionValue(BigInt(food.fatMgPerBasis), amount, basis);
  }
  return totals;
}

/** Editor preview from raw form values; null whenever the input is not yet valid. */
export function previewBatchPortion(
  items: readonly { foodId: string | null; amount: string }[],
  foods: readonly ({ id: string } & BatchNutritionFood)[],
  portionCount: number
): BatchPortionTotals | null {
  if (items.length === 0) return null;
  if (!Number.isInteger(portionCount) || portionCount < 1 || portionCount > inputLimits.batch.portionCount.max) {
    return null;
  }
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  try {
    return batchPortionTotals(items.map((item) => {
      const food = item.foodId === null ? undefined : foodsById.get(item.foodId);
      if (food === undefined) throw new RangeError('Unknown food');
      return { totalAmount: parseFixedPoint(item.amount, 3), food };
    }), portionCount);
  } catch {
    return null;
  }
}

export function scheduleDates(startDate: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftDate(startDate, index));
}
