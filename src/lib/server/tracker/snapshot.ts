import type {
  TrackerSnapshot,
  OfflineDiaryDay,
  OfflineDiaryEntry,
  OfflineFood,
  OfflineLatestFoodUse
} from '$lib/offline/types';
import { shiftDate } from '$lib/date';
import { mealSlots } from '$lib/nutrition/constants';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  type DiaryLog,
  type User
} from '$lib/server/db/schema';
import {
  loadDiaryDay,
  type DiaryDaySummary
} from '$lib/server/nutrition/diary-summary';

function toIsoString(date: Date): string {
  return date.toISOString();
}

function mapDiaryEntry(entry: DiaryLog): OfflineDiaryEntry {
  return {
    id: entry.id,
    foodId: entry.foodId,
    diaryDate: entry.diaryDate,
    mealSlot: entry.mealSlot,
    sourceShortcutId: entry.sourceShortcutId,
    shortcutBatchId: entry.shortcutBatchId,
    clientMutationId: entry.clientMutationId,
    foodName: entry.foodName,
    foodBrand: entry.foodBrand,
    amountUnit: entry.amountUnit,
    basisAmount: entry.basisAmount,
    energyMkcalPerBasis: entry.energyMkcalPerBasis,
    proteinMgPerBasis: entry.proteinMgPerBasis,
    carbsMgPerBasis: entry.carbsMgPerBasis,
    fatMgPerBasis: entry.fatMgPerBasis,
    additionalNutritionPerBasis:
      entry.additionalNutritionPerBasisJson,
    portionKind: entry.portionKind,
    portionLabel: entry.portionLabel,
    portionAmount: entry.portionAmount,
    portionCountMilli: entry.portionCountMilli,
    resolvedAmount: entry.resolvedAmount,
    energyMkcal: entry.energyMkcal,
    proteinMg: entry.proteinMg,
    carbsMg: entry.carbsMg,
    fatMg: entry.fatMg,
    additionalNutritionTotal:
      entry.additionalNutritionTotalJson,
    loggedAt: toIsoString(entry.loggedAt),
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt)
  };
}

function mapDiaryDay(summary: DiaryDaySummary): OfflineDiaryDay {
  const meals = Object.fromEntries(
    mealSlots.map((slot) => [
      slot,
      {
        slot,
        entries: summary.meals[slot].entries.map(mapDiaryEntry),
        totals: summary.meals[slot].totals
      }
    ])
  ) as OfflineDiaryDay['meals'];

  return {
    date: summary.date,
    goal: summary.goal === null
      ? null
      : {
          id: summary.goal.id,
          effectiveFrom: summary.goal.effectiveFrom,
          targetEnergyMkcal: summary.goal.targetEnergyMkcal,
          targetProteinMg: summary.goal.targetProteinMg,
          targetCarbsMg: summary.goal.targetCarbsMg,
          targetFatMg: summary.goal.targetFatMg,
          createdAt: toIsoString(summary.goal.createdAt),
          updatedAt: toIsoString(summary.goal.updatedAt)
        },
    meals,
    totals: summary.totals,
    balances: summary.balances
  };
}

export function buildTrackerDiaryDay(
  db: AppDatabase,
  userId: string,
  date: string
): OfflineDiaryDay {
  return mapDiaryDay(loadDiaryDay(db, userId, date));
}

function listLatestFoodUses(
  db: AppDatabase,
  userId: string
): Map<string, OfflineLatestFoodUse> {
  const entries = db
    .select({
      foodId: diaryLogs.foodId,
      diaryEntryId: diaryLogs.id,
      loggedAt: diaryLogs.loggedAt,
      amountUnit: diaryLogs.amountUnit,
      portionKind: diaryLogs.portionKind,
      portionLabel: diaryLogs.portionLabel,
      portionAmount: diaryLogs.portionAmount,
      portionCountMilli: diaryLogs.portionCountMilli,
      resolvedAmount: diaryLogs.resolvedAmount,
      energyMkcal: diaryLogs.energyMkcal,
      proteinMg: diaryLogs.proteinMg,
      carbsMg: diaryLogs.carbsMg,
      fatMg: diaryLogs.fatMg,
      additionalNutritionTotal:
        diaryLogs.additionalNutritionTotalJson
    })
    .from(diaryLogs)
    .innerJoin(
      foods,
      and(
        eq(foods.id, diaryLogs.foodId),
        eq(foods.userId, userId),
        isNull(foods.deletedAt)
      )
    )
    .where(
      and(
        eq(diaryLogs.userId, userId),
        isNull(diaryLogs.deletedAt)
      )
    )
    .orderBy(
      desc(diaryLogs.loggedAt),
      desc(diaryLogs.id)
    )
    .all();

  const latestUseByFood = new Map<
    string,
    OfflineLatestFoodUse
  >();

  for (const entry of entries) {
    if (
      entry.foodId !== null &&
      !latestUseByFood.has(entry.foodId)
    ) {
      latestUseByFood.set(entry.foodId, {
        diaryEntryId: entry.diaryEntryId,
        loggedAt: toIsoString(entry.loggedAt),
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
        additionalNutritionTotal:
          entry.additionalNutritionTotal
      });
    }
  }

  return latestUseByFood;
}

export function listFoodsForTrackerSnapshot(
  db: AppDatabase,
  userId: string
): OfflineFood[] {
  const latestUseByFood = listLatestFoodUses(
    db,
    userId
  );

  const activeFoods = db
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      barcode: foods.barcode,
      amountUnit: foods.amountUnit,
      basisAmount: foods.basisAmount,
      servingAmount: foods.servingAmount,
      containerAmount: foods.containerAmount,
      energyMkcalPerBasis: foods.energyMkcalPerBasis,
      proteinMgPerBasis: foods.proteinMgPerBasis,
      carbsMgPerBasis: foods.carbsMgPerBasis,
      fatMgPerBasis: foods.fatMgPerBasis,
      additionalNutrition: foods.additionalNutritionJson,
      notes: foods.notes,
      createdAt: foods.createdAt,
      updatedAt: foods.updatedAt
    })
    .from(foods)
    .where(
      and(
        eq(foods.userId, userId),
        isNull(foods.deletedAt)
      )
    )
    .orderBy(asc(foods.name), asc(foods.id))
    .all();

  return activeFoods
    .map((food) => ({
      ...food,
      createdAt: toIsoString(food.createdAt),
      updatedAt: toIsoString(food.updatedAt),
      latestUse: latestUseByFood.get(food.id) ?? null
    }))
    .sort((left, right) => {
      const leftLoggedAt = left.latestUse?.loggedAt ?? '';
      const rightLoggedAt = right.latestUse?.loggedAt ?? '';

      return rightLoggedAt.localeCompare(leftLoggedAt) ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id);
    });
}

export function buildTrackerSnapshot(
  db: AppDatabase,
  user: Pick<User, 'id' | 'name'>,
  date: string,
  savedAt = new Date()
): TrackerSnapshot {
  const dates = Array.from(
    { length: 11 },
    (_, index) => shiftDate(date, index - 5)
  );

  return {
    schemaVersion: 1,
    user: {
      id: user.id,
      name: user.name
    },
    savedAt: savedAt.getTime(),
    diaryDays: Object.fromEntries(
      dates.map((diaryDate) => [
        diaryDate,
        buildTrackerDiaryDay(db, user.id, diaryDate)
      ])
    ),
    foods: listFoodsForTrackerSnapshot(db, user.id)
  };
}
