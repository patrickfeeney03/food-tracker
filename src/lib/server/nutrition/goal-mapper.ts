import type { NutritionGoalInput } from '$lib/nutrition/goal-input';
import { parseGramsToMg, parseKcalToMkcal, toSafeInteger } from '$lib/nutrition/math';
import type { NewNutritionGoal } from '$lib/server/db/schema';

export function mapNutritionGoalInput(
  input: NutritionGoalInput,
  userId: string
): NewNutritionGoal {
  return {
    userId,
    effectiveFrom: input.effectiveFrom,

    targetEnergyMkcal: toSafeInteger(
      parseKcalToMkcal(input.targetEnergyKcal)
    ),

    targetProteinMg: toSafeInteger(
      parseGramsToMg(input.targetProteinG)
    ),

    targetCarbsMg: toSafeInteger(
      parseGramsToMg(input.targetCarbsG)
    ),

    targetFatMg: toSafeInteger(
      parseGramsToMg(input.targetFatG)
    )
  };
}
