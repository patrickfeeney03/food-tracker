import { shiftDate } from '$lib/date';
import { mealSlots, type MealSlot } from '$lib/nutrition/constants';
import { replayLatestFoodPortion } from '$lib/nutrition/latest-food-portion';
import type { CachedOfflineData } from '$lib/offline/indexed-db';
import type { OfflineDiaryDay, OfflineFood } from '$lib/offline/types';

export interface TrackerFoodResult {
  id: string;
  name: string;
  brand: string | null;
  amountUnit: OfflineFood['amountUnit'];
  basisAmount: number;
  energyMkcalPerBasis: number;
  latestUse: OfflineFood['latestUse'];
  canQuickAdd: boolean;
}

export const CATALOGUE_RESULT_LIMIT = 50;

export function selectCachedDates(
  cache: Pick<CachedOfflineData, 'diaryDays'> | null
): string[] {
  return cache === null ? [] : Object.keys(cache.diaryDays).sort();
}

function selectAdjacentDate(
  cachedDates: readonly string[],
  selectedDate: string,
  isOffline: boolean,
  fallbackDate: string,
  direction: -1 | 1
): string | null {
  if (isOffline && cachedDates.length > 0) {
    if (direction < 0) {
      return cachedDates.filter((date) => date < selectedDate).at(-1) ?? null;
    }

    return cachedDates.find((date) => date > selectedDate) ?? null;
  }

  return shiftDate(selectedDate || fallbackDate, direction);
}

export function selectPreviousDate(
  cachedDates: readonly string[],
  selectedDate: string,
  isOffline: boolean,
  fallbackDate: string
): string | null {
  return selectAdjacentDate(
    cachedDates,
    selectedDate,
    isOffline,
    fallbackDate,
    -1
  );
}

export function selectNextDate(
  cachedDates: readonly string[],
  selectedDate: string,
  isOffline: boolean,
  fallbackDate: string
): string | null {
  return selectAdjacentDate(
    cachedDates,
    selectedDate,
    isOffline,
    fallbackDate,
    1
  );
}

export function filterCatalogueFoods(
  foods: readonly OfflineFood[],
  foodQuery: string
): OfflineFood[] {
  const trimmedQuery = foodQuery.trim();
  const query = trimmedQuery.toLocaleLowerCase();
  const matches = query === ''
    ? foods
    : foods.filter((food) =>
        food.name.toLocaleLowerCase().includes(query) ||
        food.brand?.toLocaleLowerCase().includes(query) ||
        food.barcode === trimmedQuery
      );

  return (query === ''
    ? matches
    : [...matches].sort((left, right) => left.name.localeCompare(right.name))
  ).slice(0, CATALOGUE_RESULT_LIMIT);
}

export function mapFoodResults(
  foods: readonly OfflineFood[]
): TrackerFoodResult[] {
  return foods.map((food) => ({
    id: food.id,
    name: food.name,
    brand: food.brand,
    amountUnit: food.amountUnit,
    basisAmount: food.basisAmount,
    energyMkcalPerBasis: food.energyMkcalPerBasis,
    latestUse: food.latestUse,
    canQuickAdd: food.latestUse !== null &&
      replayLatestFoodPortion(food, food.latestUse) !== null
  }));
}

export function selectShortcutEligibility(
  initialEligibility: Record<MealSlot, boolean> | undefined,
  diary: OfflineDiaryDay | null
): Record<MealSlot, boolean> {
  if (initialEligibility !== undefined) {
    return initialEligibility;
  }

  return Object.fromEntries(
    mealSlots.map((slot) => [
      slot,
      (diary?.meals?.[slot]?.entries?.length ?? 0) > 0
    ])
  ) as Record<MealSlot, boolean>;
}
