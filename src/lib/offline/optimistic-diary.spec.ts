import { describe, expect, it } from 'vitest';
import type { CachedOfflineData } from './indexed-db';
import { applyPendingDiaryLogs } from './optimistic-diary';
import type {
  OfflineDiaryDay,
  OfflineFood,
  OfflineLogExistingFoodMutation
} from './types';

const food: OfflineFood = {
  id: 'food-1',
  name: 'Greek yoghurt',
  brand: 'Dairy',
  barcode: null,
  amountUnit: 'mg',
  basisAmount: 100_000,
  servingAmount: 125_000,
  containerAmount: null,
  energyMkcalPerBasis: 60_000,
  proteinMgPerBasis: 10_000,
  carbsMgPerBasis: 4_000,
  fatMgPerBasis: 500,
  additionalNutrition: {
    sodiumMg: 50
  },
  notes: null,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  latestUse: null
};

function diary(date = '2026-07-24'): OfflineDiaryDay {
  const emptyTotals = {
    energyMkcal: 0,
    proteinMg: 0,
    carbsMg: 0,
    fatMg: 0
  };

  return {
    date,
    goal: {
      id: 'goal-1',
      effectiveFrom: '2026-07-01',
      targetEnergyMkcal: 2_000_000,
      targetProteinMg: 100_000,
      targetCarbsMg: 200_000,
      targetFatMg: 70_000,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z'
    },
    meals: {
      breakfast: { slot: 'breakfast', entries: [], totals: emptyTotals },
      lunch: { slot: 'lunch', entries: [], totals: emptyTotals },
      dinner: { slot: 'dinner', entries: [], totals: emptyTotals },
      snacks: { slot: 'snacks', entries: [], totals: emptyTotals }
    },
    totals: emptyTotals,
    balances: {
      energyMkcal: {
        consumed: 0,
        target: 2_000_000,
        remaining: 2_000_000,
        over: 0
      },
      proteinMg: {
        consumed: 0,
        target: 100_000,
        remaining: 100_000,
        over: 0
      },
      carbsMg: {
        consumed: 0,
        target: 200_000,
        remaining: 200_000,
        over: 0
      },
      fatMg: {
        consumed: 0,
        target: 70_000,
        remaining: 70_000,
        over: 0
      }
    }
  };
}

function cache(): CachedOfflineData {
  return {
    schemaVersion: 1,
    user: {
      id: 'user-1',
      name: 'Patrick'
    },
    savedAt: 1,
    diaryDays: {
      '2026-07-24': diary()
    },
    foods: [food]
  };
}

function mutation(
  overrides: Partial<OfflineLogExistingFoodMutation> = {}
): OfflineLogExistingFoodMutation {
  return {
    userId: 'user-1',
    clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
    kind: 'log-existing-food',
    foodId: 'food-1',
    input: {
      clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
      portionKind: 'serving',
      portionCount: '1.5',
      diaryDate: '2026-07-24',
      mealSlot: 'breakfast'
    },
    createdAt: Date.parse('2026-07-24T08:00:00.000Z'),
    state: 'pending',
    ...overrides
  };
}

describe('optimistic offline diary', () => {
  it('adds pending food logs and recomputes meal, day, and balance totals', () => {
    const source = cache();
    const view = applyPendingDiaryLogs(source, [mutation()]);
    const entry = view.diaryDays['2026-07-24'].meals.breakfast.entries[0];

    expect(entry).toMatchObject({
      id: 'pending:550e8400-e29b-41d4-a716-446655440000',
      foodId: 'food-1',
      portionKind: 'serving',
      portionLabel: 'Serving',
      portionAmount: 125_000,
      portionCountMilli: 1_500,
      resolvedAmount: 187_500,
      energyMkcal: 112_500,
      proteinMg: 18_750,
      carbsMg: 7_500,
      fatMg: 938,
      additionalNutritionTotal: {
        sodiumMg: 94
      }
    });
    expect(view.diaryDays['2026-07-24'].totals).toEqual({
      energyMkcal: 112_500,
      proteinMg: 18_750,
      carbsMg: 7_500,
      fatMg: 938
    });
    expect(
      view.diaryDays['2026-07-24'].balances?.energyMkcal
    ).toEqual({
      consumed: 112_500,
      target: 2_000_000,
      remaining: 1_887_500,
      over: 0
    });
    expect(source.diaryDays['2026-07-24'].meals.breakfast.entries).toEqual([]);
  });

  it('orders optimistic entries and leaves failed or other-user logs out', () => {
    const later = mutation({
      clientMutationId: '550e8400-e29b-41d4-a716-446655440002',
      input: {
        ...mutation().input,
        clientMutationId: '550e8400-e29b-41d4-a716-446655440002'
      },
      createdAt: 20
    });
    const earlier = mutation({
      clientMutationId: '550e8400-e29b-41d4-a716-446655440001',
      input: {
        ...mutation().input,
        clientMutationId: '550e8400-e29b-41d4-a716-446655440001'
      },
      createdAt: 10
    });

    const view = applyPendingDiaryLogs(cache(), [
      later,
      earlier,
      mutation({ state: 'failed' }),
      mutation({ userId: 'user-2' })
    ]);

    expect(
      view.diaryDays['2026-07-24'].meals.breakfast.entries.map(
        (entry) => entry.id
      )
    ).toEqual([
      'pending:550e8400-e29b-41d4-a716-446655440001',
      'pending:550e8400-e29b-41d4-a716-446655440002'
    ]);
    expect(view.foods[0].latestUse).toMatchObject({
      diaryEntryId: 'pending:550e8400-e29b-41d4-a716-446655440002',
      loggedAt: new Date(20).toISOString(),
      portionKind: 'serving',
      portionCountMilli: 1_500,
      resolvedAmount: 187_500
    });
  });

  it('projects the latest pending amount onto the cached food for Quick Add', () => {
    const source = cache();
    const view = applyPendingDiaryLogs(source, [
      mutation({
        input: {
          ...mutation().input,
          portionKind: 'hundred',
          portionCount: '2'
        }
      })
    ]);

    expect(view.foods[0].latestUse).toMatchObject({
      diaryEntryId: 'pending:550e8400-e29b-41d4-a716-446655440000',
      portionKind: 'hundred',
      portionLabel: '100 g',
      portionAmount: 100_000,
      portionCountMilli: 2_000,
      resolvedAmount: 200_000,
      energyMkcal: 120_000
    });
    expect(source.foods[0].latestUse).toBeNull();
  });

  it('creates an empty local day when the destination was not cached', () => {
    const view = applyPendingDiaryLogs(cache(), [
      mutation({
        input: {
          ...mutation().input,
          diaryDate: '2026-07-25'
        }
      })
    ]);

    expect(
      view.diaryDays['2026-07-25'].meals.breakfast.entries
    ).toHaveLength(1);
    expect(view.diaryDays['2026-07-25'].goal).toBeNull();
    expect(view.diaryDays['2026-07-25'].balances).toBeNull();
  });

  it('does not duplicate a mutation already present in a refreshed snapshot', () => {
    const pending = mutation();
    const firstView = applyPendingDiaryLogs(cache(), [pending]);
    const canonical = structuredClone(firstView);
    canonical.diaryDays['2026-07-24'].meals.breakfast.entries[0].id =
      'server-entry-1';

    const refreshedView = applyPendingDiaryLogs(canonical, [pending]);

    expect(
      refreshedView.diaryDays['2026-07-24'].meals.breakfast.entries
    ).toHaveLength(1);
    expect(
      refreshedView.diaryDays['2026-07-24'].totals.energyMkcal
    ).toBe(112_500);
  });

  it('does not add an optimistic entry when the cached food is unavailable', () => {
    const source = cache();
    const view = applyPendingDiaryLogs(source, [
      mutation({ foodId: 'missing-food' })
    ]);

    expect(view).toEqual(source);
  });
});
