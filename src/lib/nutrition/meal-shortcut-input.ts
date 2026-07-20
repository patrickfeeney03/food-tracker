import { z } from 'zod';
import { mealSlots } from './constants';
import { positiveDecimalString } from './food-input';
import { inputLimits } from './input-limits';
import { calendarDateString } from './portion-input';

export const mealShortcutItemInputSchema = z.object({
    itemId: z.uuid().optional(),
    sourceEntryId: z.uuid().optional(),
    foodId: z.uuid(),
    amount: positiveDecimalString(3, inputLimits.mealShortcut.amount.max)
  });

export const createMealShortcutInputSchema = z.object({
  clientMutationId: z.uuid('Must be a valid mutation ID'),
  name: z.string().trim().min(1, 'Name is required').max(inputLimits.mealShortcut.name.maxLength),
  items: z.array(mealShortcutItemInputSchema).min(1).max(100)
});

export const updateMealShortcutInputSchema = createMealShortcutInputSchema
  .omit({ clientMutationId: true })
  .extend({
    expectedUpdatedAt: z.string().trim().regex(/^\d+$/, 'Shortcut version is missing')
  });

export const applyMealShortcutInputSchema = z.object({
  clientMutationId: z.uuid('Must be a valid mutation ID'),
  diaryDate: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

export const mealShortcutDraftSourceSchema = z.object({
  diaryDate: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

export type MealShortcutItemInput = z.infer<typeof mealShortcutItemInputSchema>;
export type CreateMealShortcutInput = z.infer<typeof createMealShortcutInputSchema>;
export type UpdateMealShortcutInput = z.infer<typeof updateMealShortcutInputSchema>;
export type ApplyMealShortcutInput = z.infer<typeof applyMealShortcutInputSchema>;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export function readMealShortcutFormData(formData: FormData) {
  const itemsJson = readText(formData, 'itemsJson');
  let items: unknown;

  try {
    items = JSON.parse(itemsJson);
  } catch {
    items = [];
  }

  return {
    clientMutationId: readText(formData, 'clientMutationId'),
    name: readText(formData, 'name'),
    expectedUpdatedAt: readText(formData, 'expectedUpdatedAt'),
    items
  };
}
