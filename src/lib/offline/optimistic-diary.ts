import { mealSlots } from '$lib/nutrition/constants';
import { calculateFoodLog } from '$lib/nutrition/food-log-calculation';
import type { CachedOfflineData } from './indexed-db';
import type {
  OfflineCoreNutrition,
  OfflineDiaryDay,
  OfflineDiaryEntry,
  OfflineFood,
  OfflineLatestFoodUse,
  OfflineLogExistingFoodMutation,
  OfflineNutritionBalance
} from './types';

function optimisticEntry(
  food: OfflineFood,
  mutation: OfflineLogExistingFoodMutation
): OfflineDiaryEntry {
  const calculation = calculateFoodLog(
    {
      ...food,
      additionalNutrition: food.additionalNutrition
    },
    mutation.input
  );
  const timestamp = new Date(mutation.createdAt).toISOString();

  return {
    id: `pending:${mutation.clientMutationId}`,
    foodId: food.id,
    diaryDate: mutation.input.diaryDate,
    mealSlot: mutation.input.mealSlot,
    sourceShortcutId: null,
    shortcutBatchId: null,
    clientMutationId: mutation.clientMutationId,
    foodName: food.name,
    foodBrand: food.brand,
    amountUnit: food.amountUnit,
    basisAmount: food.basisAmount,
    energyMkcalPerBasis: food.energyMkcalPerBasis,
    proteinMgPerBasis: food.proteinMgPerBasis,
    carbsMgPerBasis: food.carbsMgPerBasis,
    fatMgPerBasis: food.fatMgPerBasis,
    additionalNutritionPerBasis: food.additionalNutrition,
    portionKind: mutation.input.portionKind,
    portionLabel: calculation.portionLabel,
    portionAmount: calculation.portionAmount,
    portionCountMilli: calculation.portionCountMilli,
    resolvedAmount: calculation.resolvedAmount,
    energyMkcal: calculation.energyMkcal,
    proteinMg: calculation.proteinMg,
    carbsMg: calculation.carbsMg,
    fatMg: calculation.fatMg,
    additionalNutritionTotal: calculation.additionalNutritionTotal,
    loggedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function latestUseFromEntry(entry: OfflineDiaryEntry): OfflineLatestFoodUse {
  return {
    diaryEntryId: entry.id,
    loggedAt: entry.loggedAt,
    amountUnit: entry.amountUnit,
    portionKind: entry.portionKind,
    portionLabel: entry.portionLabel,
    portionAmount: entry.portionAmount,
    portionCountMilli: entry.portionCountMilli,
    resolvedAmount: entry.resolvedAmount,
    energyMkcal: entry.energyMkcal,
    proteinMg: entry.proteinMg,
    carbsMg: entry.carbsMg,
    fatMg: entry.fatMg,
    additionalNutritionTotal: entry.additionalNutritionTotal
  };
}

function sumNutrition(entries: OfflineDiaryEntry[]): OfflineCoreNutrition {
  return entries.reduce<OfflineCoreNutrition>(
    (totals, entry) => ({
      energyMkcal: totals.energyMkcal + entry.energyMkcal,
      proteinMg: totals.proteinMg + entry.proteinMg,
      carbsMg: totals.carbsMg + entry.carbsMg,
      fatMg: totals.fatMg + entry.fatMg
    }),
    {
      energyMkcal: 0,
      proteinMg: 0,
      carbsMg: 0,
      fatMg: 0
    }
  );
}

function balance(consumed: number, target: number): OfflineNutritionBalance {
  return consumed <= target
    ? {
        consumed,
        target,
        remaining: target - consumed,
        over: 0
      }
    : {
        consumed,
        target,
        remaining: 0,
        over: consumed - target
      };
}

export function emptyDiaryDay(date: string): OfflineDiaryDay {
  return {
    date,
    goal: null,
    meals: Object.fromEntries(
      mealSlots.map((slot) => [
        slot,
        {
          slot,
          entries: [],
          totals: {
            energyMkcal: 0,
            proteinMg: 0,
            carbsMg: 0,
            fatMg: 0
          }
        }
      ])
    ) as unknown as OfflineDiaryDay['meals'],
    totals: {
      energyMkcal: 0,
      proteinMg: 0,
      carbsMg: 0,
      fatMg: 0
    },
    balances: null
  };
}

function applyEntries(
  diary: OfflineDiaryDay,
  additions: OfflineDiaryEntry[]
): OfflineDiaryDay {
  const meals = Object.fromEntries(
    mealSlots.map((slot) => {
      const entries = [
        ...diary.meals[slot].entries,
        ...additions.filter((entry) => entry.mealSlot === slot)
      ];

      return [
        slot,
        {
          slot,
          entries,
          totals: sumNutrition(entries)
        }
      ];
    })
  ) as OfflineDiaryDay['meals'];
  const totals = sumNutrition(
    mealSlots.flatMap((slot) => meals[slot].entries)
  );

  return {
    ...diary,
    meals,
    totals,
    balances: diary.goal === null
      ? null
      : {
          energyMkcal: balance(totals.energyMkcal, diary.goal.targetEnergyMkcal),
          proteinMg: balance(totals.proteinMg, diary.goal.targetProteinMg),
          carbsMg: balance(totals.carbsMg, diary.goal.targetCarbsMg),
          fatMg: balance(totals.fatMg, diary.goal.targetFatMg)
        }
  };
}

export function applyPendingDiaryLogs(
  cache: CachedOfflineData,
  mutations: OfflineLogExistingFoodMutation[]
): CachedOfflineData {
  const foodById = new Map(cache.foods.map((food) => [food.id, food]));
  const canonicalMutationIds = new Set(
    Object.values(cache.diaryDays).flatMap((diary) =>
      mealSlots.flatMap((slot) =>
        diary.meals[slot].entries.flatMap((entry) =>
          typeof entry.clientMutationId === 'string'
            ? [entry.clientMutationId]
            : []
        )
      )
    )
  );
  const additionsByDate = new Map<string, OfflineDiaryEntry[]>();
  const latestPendingUseByFood = new Map<string, OfflineLatestFoodUse>();
  const pending = mutations
    .filter(
      (mutation) =>
        mutation.userId === cache.user.id &&
        mutation.state === 'pending' &&
        !canonicalMutationIds.has(mutation.clientMutationId)
    )
    .sort((left, right) =>
      left.createdAt - right.createdAt ||
      left.clientMutationId.localeCompare(right.clientMutationId)
    );

  for (const mutation of pending) {
    const food = foodById.get(mutation.foodId);
    if (food === undefined) {
      continue;
    }

    const additions = additionsByDate.get(mutation.input.diaryDate) ?? [];
    const entry = optimisticEntry(food, mutation);
    additions.push(entry);
    additionsByDate.set(mutation.input.diaryDate, additions);
    latestPendingUseByFood.set(food.id, latestUseFromEntry(entry));
  }

  const diaryDays = { ...cache.diaryDays };
  for (const [date, additions] of additionsByDate) {
    diaryDays[date] = applyEntries(
      cache.diaryDays[date] ?? emptyDiaryDay(date),
      additions
    );
  }

  return {
    ...cache,
    diaryDays,
    foods: cache.foods.map((food) => {
      const pendingUse = latestPendingUseByFood.get(food.id);

      if (
        pendingUse === undefined ||
        (
          food.latestUse !== null &&
          food.latestUse.loggedAt > pendingUse.loggedAt
        )
      ) {
        return food;
      }

      return {
        ...food,
        latestUse: pendingUse
      };
    })
  };
}
