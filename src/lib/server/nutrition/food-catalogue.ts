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
  energyMkcalPerBasis: foods.energyMkcalPerBasis
};

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
                like(foods.brand, `%${query}%`)
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
    }
  >();

  if (foodIds.length > 0) {
    const diaryEntries = db
      .select({
        foodId: diaryLogs.foodId,
        resolvedAmount: diaryLogs.resolvedAmount,
        amountUnit: diaryLogs.amountUnit,
        energyMkcal: diaryLogs.energyMkcal
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
          energyMkcal: entry.energyMkcal
        });
      }
    }
  }

  return results.map((food) => ({
    ...food,
    latestUse: latestUseByFood.get(food.id) ?? null
  }));
}
