import { nutritionGoalInputSchema } from '$lib/nutrition/goal-input';
import type { DatabaseConnection } from '$lib/server/db/connection';
import { nutritionGoals } from '$lib/server/db/schema';
import { mapNutritionGoalInput } from './goal-mapper';

type AppDatabase = DatabaseConnection['db'];

export function saveNutritionGoal(
  db: AppDatabase,
  userId: string,
  rawInput: unknown
) {
  const input = nutritionGoalInputSchema.parse(rawInput);
  const values = mapNutritionGoalInput(input, userId);

  return db
    .insert(nutritionGoals)
    .values(values)
    .onConflictDoUpdate({
      target: [
        nutritionGoals.userId,
        nutritionGoals.effectiveFrom
      ],
      set: {
        targetEnergyMkcal: values.targetEnergyMkcal,
        targetProteinMg: values.targetProteinMg,
        targetCarbsMg: values.targetCarbsMg,
        targetFatMg: values.targetFatMg,
        updatedAt: new Date()
      }
    })
    .returning()
    .get();
}
