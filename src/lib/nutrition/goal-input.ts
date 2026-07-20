import z from "zod";
import { decimalString } from "./food-input";
import { inputLimits } from "./input-limits";
import { calendarDateString } from "./portion-input";

export const nutritionGoalInputSchema = z.object({
  effectiveFrom: calendarDateString,

  targetEnergyKcal: decimalString(3, inputLimits.goal.targetEnergyKcal.max),
  targetProteinG: decimalString(3, inputLimits.goal.targetProteinG.max),
  targetCarbsG: decimalString(3, inputLimits.goal.targetCarbsG.max),
  targetFatG: decimalString(3, inputLimits.goal.targetFatG.max)
});

export type NutritionGoalInput = z.infer<typeof nutritionGoalInputSchema>;

export function firstGoalEffectiveDateError(
  effectiveFrom: string,
  today: string
): string | undefined {
  return effectiveFrom > today
    ? 'Your first goal cannot start in the future.'
    : undefined;
}
