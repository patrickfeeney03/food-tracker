import { describe, expect, it } from 'vitest';
import { mealSlots, type MealSlot } from '$lib/nutrition/constants';
import { emptyDiaryDay } from '$lib/offline/optimistic-diary';
import type { CachedOfflineData } from '$lib/offline/indexed-db';
import type { OfflineDiaryDay, OfflineFood } from '$lib/offline/types';
import {
  filterCatalogueFoods,
  mapFoodResults,
  selectCachedDates,
  selectNextDate,
  selectPreviousDate,
  selectShortcutEligibility
} from './selectors';

const baseFood: OfflineFood = {
  id: 'food-1',
  name: 'Apple',
  brand: null,
  barcode: null,
  amountUnit: 'mg',
  basisAmount: 100_000,
  servingAmount: null,
  containerAmount: null,
  energyMkcalPerBasis: 520_000,
  proteinMgPerBasis: 3_000,
  carbsMgPerBasis: 14_000,
  fatMgPerBasis: 2_000,
  additionalNutrition: null,
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  latestUse: null
};

function food(overrides: Partial<OfflineFood> = {}): OfflineFood {
  return {
    ...baseFood,
    ...overrides
  };
}

function cache(
  dates: readonly string[] = [],
  foods: readonly OfflineFood[] = []
): CachedOfflineData {
  return {
    schemaVersion: 1,
    user: {
      id: 'user-1',
      name: 'Patrick'
    },
    savedAt: 1,
    diaryDays: Object.fromEntries(
      dates.map((date) => [date, emptyDiaryDay(date)])
    ),
    foods: [...foods]
  };
}

function diaryWithEntries(date: string, slots: readonly MealSlot[]): OfflineDiaryDay {
  const diary = emptyDiaryDay(date);

  for (const slot of slots) {
    diary.meals[slot].entries = [{ id: `${slot}-entry` } as OfflineDiaryDay['meals'][MealSlot]['entries'][number]];
  }

  return diary;
}

describe('tracker selectors', () => {
  describe('cached and adjacent dates', () => {
    it('sorts cached dates lexically and returns no dates for an empty cache', () => {
      expect(selectCachedDates(cache(['2026-07-25', '2026-07-03', '2026-07-24']))).toEqual([
        '2026-07-03',
        '2026-07-24',
        '2026-07-25'
      ]);
      expect(selectCachedDates(null)).toEqual([]);
    });

    it('selects the nearest saved previous and next dates offline', () => {
      const dates = ['2026-07-03', '2026-07-24', '2026-07-25'];

      expect(selectPreviousDate(dates, '2026-07-24', true, '2026-07-24')).toBe('2026-07-03');
      expect(selectNextDate(dates, '2026-07-24', true, '2026-07-24')).toBe('2026-07-25');
      expect(selectPreviousDate(dates, '2026-07-03', true, '2026-07-24')).toBeNull();
      expect(selectNextDate(dates, '2026-07-25', true, '2026-07-24')).toBeNull();
    });

    it('shifts the selected or fallback date online and with no cached dates', () => {
      expect(selectPreviousDate([], '2026-07-24', false, '2026-07-01')).toBe('2026-07-23');
      expect(selectNextDate([], '', false, '2026-07-01')).toBe('2026-07-02');
      expect(selectPreviousDate(['2026-07-24'], '2026-07-24', true, '2026-07-24')).toBeNull();
    });
  });

  describe('catalogue selection', () => {
    it('preserves empty-query order, sorts non-empty matches, and limits results to 50', () => {
      const foods = [
        food({ id: 'food-z', name: 'Zucchini' }),
        food({ id: 'food-a', name: 'Apple' }),
        food({ id: 'food-b', name: 'Banana' })
      ];

      expect(filterCatalogueFoods(foods, ' ')).toEqual(foods);
      expect(filterCatalogueFoods(foods, 'a').map((item) => item.name)).toEqual([
        'Apple',
        'Banana'
      ]);

      const manyFoods = Array.from({ length: 51 }, (_, index) =>
        food({ id: `food-${index}`, name: `Food ${String(index).padStart(2, '0')}` })
      );
      expect(filterCatalogueFoods(manyFoods, '').length).toBe(50);
    });

    it('matches names and brands case-insensitively but barcodes exactly after trimming', () => {
      const foods = [
        food({ id: 'name', name: 'Greek Yoghurt' }),
        food({ id: 'brand', name: 'Plain', brand: 'Dairy Farm' }),
        food({ id: 'barcode', name: 'Scanned', barcode: '001234' })
      ];

      expect(filterCatalogueFoods(foods, ' yoghurt ').map((item) => item.id)).toEqual(['name']);
      expect(filterCatalogueFoods(foods, 'dAiRy').map((item) => item.id)).toEqual(['brand']);
      expect(filterCatalogueFoods(foods, ' 001234 ').map((item) => item.id)).toEqual(['barcode']);
    });
  });

  describe('mapFoodResults', () => {
    it('maps food results and derives Quick Add from replayability', () => {
      const usedFood = food({
        latestUse: {
          diaryEntryId: 'entry-1',
          loggedAt: '2026-07-24T12:00:00.000Z',
          amountUnit: 'mg',
          portionKind: 'hundred',
          portionLabel: '100 g',
          portionAmount: 100_000,
          portionCountMilli: 1_000,
          resolvedAmount: 100_000,
          energyMkcal: 520_000,
          proteinMg: 3_000,
          carbsMg: 14_000,
          fatMg: 2_000,
          additionalNutritionTotal: null
        }
      });

      expect(mapFoodResults([usedFood])).toEqual([
        {
          id: 'food-1',
          name: 'Apple',
          brand: null,
          amountUnit: 'mg',
          basisAmount: 100_000,
          energyMkcalPerBasis: 520_000,
          latestUse: usedFood.latestUse,
          canQuickAdd: true
        }
      ]);
      expect(mapFoodResults([baseFood])[0]?.canQuickAdd).toBe(false);
      expect(mapFoodResults([food({
        latestUse: { ...usedFood.latestUse!, amountUnit: 'ul' }
      })])[0]?.canQuickAdd).toBe(false);
    });
  });

  describe('selectShortcutEligibility', () => {
    it('prefers server-provided eligibility', () => {
      const provided = Object.fromEntries(
        mealSlots.map((slot) => [slot, slot === 'dinner'])
      ) as Record<MealSlot, boolean>;

      expect(selectShortcutEligibility(provided, null)).toBe(provided);
    });

    it('derives eligibility from whether each meal has entries', () => {
      expect(
        selectShortcutEligibility(undefined, diaryWithEntries('2026-07-24', ['breakfast', 'snacks']))
      ).toEqual({
        breakfast: true,
        lunch: false,
        dinner: false,
        snacks: true
      });
    });
  });

});
