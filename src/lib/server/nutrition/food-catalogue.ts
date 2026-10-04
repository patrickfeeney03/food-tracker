import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  isNull,
  like,
  max,
  or
} from 'drizzle-orm';
import type { AppDatabase } from '$lib/server/db/connection';
import { diaryLogs, foods } from '$lib/server/db/schema';

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

export async function findActiveFoodByBarcode(
  db: AppDatabase,
  userId: string,
  barcode: string
) {
  const food = await db
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

  const latestUse = await db
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

export async function listActiveFoods(
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
      ? await db
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
      : await db
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
    const diaryEntries = await db
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
          inArray(diaryLogs.foodId, sql`(select value from json_each(${JSON.stringify(foodIds)}))`)
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
