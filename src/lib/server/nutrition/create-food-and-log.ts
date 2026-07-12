import { createFoodSchema } from "$lib/nutrition/food-input";
import { logFoodInputSchema } from "$lib/nutrition/portion-input";
import { and, eq } from "drizzle-orm";
import type { DatabaseConnection } from "../db/connection";
import { diaryLogs, foods } from "../db/schema";
import { buildDiaryLogValues } from "./diary-entry";
import { mapCreateFoodInput } from "./food-mapper";

type AppDatabase = DatabaseConnection['db'];

function findExistingMutation(
  db: AppDatabase,
  userId: string,
  clientMutationId: string
) {
  const diaryLog = db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.userId, userId),
        eq(
          diaryLogs.clientMutationId,
          clientMutationId
        )
      )
    ).get();

  if (diaryLog === undefined) {
    return undefined;
  }

  if (diaryLog.foodId === null) {
    throw new Error(
      'Existing mutation no longer references a food'
    );
  }

  const food = db
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, diaryLog.foodId),
        eq(foods.userId, userId)
      )
    ).get();

  if (food === undefined) {
    throw new Error(
      'Existing mutation references a missing food'
    );
  }

  return {
    food,
    diaryLog
  };
}

export function createFoodAndLog(
  db: AppDatabase,
  userId: string,
  rawFoodInput: unknown,
  rawLogInput: unknown
) {
  const foodInput = createFoodSchema.parse(rawFoodInput);
  const logInput = logFoodInputSchema.parse(rawLogInput);

  const existing = findExistingMutation(db, userId, logInput.clientMutationId);

  if (existing !== undefined) {
    return existing;
  }

  try {
    return db.transaction((transaction) => {
      const food = transaction
        .insert(foods)
        .values(
          mapCreateFoodInput(foodInput, userId)
        )
        .returning()
        .get();

      const diaryLog = transaction
        .insert(diaryLogs)
        .values(
          buildDiaryLogValues(food, logInput)
        )
        .returning()
        .get();

      return {
        food,
        diaryLog
      }
    });
  } catch (error) { // for concurrency scenarios
    const replayed = findExistingMutation(db, userId, logInput.clientMutationId);

    if (replayed !== undefined) {
      return replayed;
    }

    throw error;
  }
}
