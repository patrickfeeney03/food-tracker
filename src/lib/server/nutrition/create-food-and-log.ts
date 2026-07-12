import { createFoodSchema } from "$lib/nutrition/food-input";
import { logFoodInputSchema } from "$lib/nutrition/portion-input";
import type { DatabaseConnection } from "../db/connection";
import { diaryLogs, foods } from "../db/schema";
import { buildDiaryLogValues } from "./diary-entry";
import { mapCreateFoodInput } from "./food-mapper";

type AppDatabase = DatabaseConnection['db'];

export function createFoodAndLog(
  db: AppDatabase,
  userId: string,
  rawFoodInput: unknown,
  rawLogInput: unknown
) {
  const foodInput = createFoodSchema.parse(rawFoodInput);
  const logInput = logFoodInputSchema.parse(rawLogInput);


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
}
