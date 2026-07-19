import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  like,
  max,
  or
} from 'drizzle-orm';
import type { DatabaseConnection } from '$lib/server/db/connection';
import { diaryLogs, foods } from '$lib/server/db/schema';

type AppDatabase = DatabaseConnection['db'];

const foodSelection = {
  id: foods.id,
  name: foods.name,
  brand: foods.brand,
  amountUnit: foods.amountUnit,
  basisAmount: foods.basisAmount,
  servingAmount: foods.servingAmount,
  containerAmount: foods.containerAmount,
  barcode: foods.barcode,
  energyMkcalPerBasis: foods.energyMkcalPerBasis
};

export function findActiveFoodByBarcode(
  db: AppDatabase,
  userId: string,
  barcode: string
) {
  const food = db
    .select(foodSelection)
    .from(foods)
    .where(
      and(
        eq(foods.userId, userId),
        isNull(foods.deletedAt),
        eq(foods.barcode, barcode)
      )
    )
    .get();

  if (food === undefined) return null;

  const latestUse = db
    .select({
      resolvedAmount: diaryLogs.resolvedAmount,
      amountUnit: diaryLogs.amountUnit,
      energyMkcal: diaryLogs.energyMkcal,
      portionKind: diaryLogs.portionKind,
      portionAmount: diaryLogs.portionAmount,
      portionCountMilli: diaryLogs.portionCountMilli
    })
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.userId, userId),
        eq(diaryLogs.foodId, food.id),
        isNull(diaryLogs.deletedAt)
      )
    )
    .orderBy(desc(diaryLogs.loggedAt), desc(diaryLogs.id))
    .limit(1)
    .get();

  return {
    ...food,
    latestUse: latestUse ?? null
  };
}

export function listActiveFoods(
  db: AppDatabase,
  userId: string,
  query: string,
  limit = 50
) {
  const ownerAndActive = and(
    eq(foods.userId, userId),
    isNull(foods.deletedAt)
  );

  const results =
    query === ''
      ? db
          .select(foodSelection)
          .from(foods)
          .leftJoin(
            diaryLogs,
            and(
              eq(diaryLogs.foodId, foods.id),
              eq(diaryLogs.userId, userId),
              isNull(diaryLogs.deletedAt)
            )
          )
          .where(ownerAndActive)
          .groupBy(foods.id)
          .orderBy(
            desc(max(diaryLogs.loggedAt)),
            asc(foods.name)
          )
          .limit(limit)
          .all()
      : db
          .select(foodSelection)
          .from(foods)
          .where(
            and(
              ownerAndActive,
              or(
                like(foods.name, `%${query}%`),
                like(foods.brand, `%${query}%`),
                eq(foods.barcode, query)
              )
            )
          )
          .orderBy(asc(foods.name))
          .limit(limit)
          .all();

  const foodIds = results.map((food) => food.id);
  const latestUseByFood = new Map<
    string,
    {
      resolvedAmount: number;
      amountUnit: 'mg' | 'ul';
      energyMkcal: number;
      portionKind: 'unit' | 'hundred' | 'serving' | 'container';
      portionAmount: number;
      portionCountMilli: number;
    }
  >();

  if (foodIds.length > 0) {
    const diaryEntries = db
      .select({
        foodId: diaryLogs.foodId,
        resolvedAmount: diaryLogs.resolvedAmount,
        amountUnit: diaryLogs.amountUnit,
        energyMkcal: diaryLogs.energyMkcal,
        portionKind: diaryLogs.portionKind,
        portionAmount: diaryLogs.portionAmount,
        portionCountMilli: diaryLogs.portionCountMilli
      })
      .from(diaryLogs)
      .where(
        and(
          eq(diaryLogs.userId, userId),
          isNull(diaryLogs.deletedAt),
          inArray(diaryLogs.foodId, foodIds)
        )
      )
      .orderBy(
        desc(diaryLogs.loggedAt),
        desc(diaryLogs.id)
      )
      .all();

    for (const entry of diaryEntries) {
      if (
        entry.foodId !== null &&
        !latestUseByFood.has(entry.foodId)
      ) {
        latestUseByFood.set(entry.foodId, {
          resolvedAmount: entry.resolvedAmount,
          amountUnit: entry.amountUnit,
          energyMkcal: entry.energyMkcal,
          portionKind: entry.portionKind,
          portionAmount: entry.portionAmount,
          portionCountMilli: entry.portionCountMilli
        });
      }
    }
  }

  return results.map((food) => ({
    ...food,
    latestUse: latestUseByFood.get(food.id) ?? null
  }));
}
