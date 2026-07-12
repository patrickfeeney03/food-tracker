import z from "zod";
import { decimalString } from "./food-input";
import { calendarDateString } from "./portion-input";

export const nutritionGoalInputSchema = z.object({
  effectiveFrom: calendarDateString,

  targetEnergyKcal: decimalString(3),
  targetProteinG: decimalString(3),
  targetCarbsG: decimalString(3),
  targetFatG: decimalString(3)
});

export type NutritionGoalInput = z.infer<typeof nutritionGoalInputSchema>;
