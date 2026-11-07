import * as z from 'zod';
import { mealSlots } from './constants';
import { createFoodSchema } from './food-input';
import { calendarDateString } from './portion-input';

// Untracked entries record that something was eaten without known nutrition,
// so the only inputs are what it was and where it belongs in the diary.
export const logUntrackedEntryInputSchema = z.object({
  clientMutationId: z.uuid('Must be a valid mutation ID'),
  name: createFoodSchema.shape.name,
  diaryDate: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

export const editUntrackedEntryInputSchema = logUntrackedEntryInputSchema.omit({
  clientMutationId: true
});

export type LogUntrackedEntryInput = z.infer<typeof logUntrackedEntryInputSchema>;
export type EditUntrackedEntryInput = z.infer<typeof editUntrackedEntryInputSchema>;
