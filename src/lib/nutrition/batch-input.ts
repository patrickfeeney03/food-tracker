import * as z from 'zod';
import { mealSlots } from './constants';
import { readText } from './food-form';
import { inputLimits } from './input-limits';
import { mealShortcutItemInputSchema } from './meal-shortcut-input';
import { calendarDateString } from './portion-input';

export const batchLogModes = ['next-days', 'hold'] as const;

export const batchScheduleSchema = z.object({
  startDate: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

const portionCountMessage = `Choose between 1 and ${inputLimits.batch.portionCount.max} portions`;

const batchFields = {
  name: z.string().trim().min(1, 'Name is required').max(inputLimits.mealShortcut.name.maxLength),
  portionCount: z.coerce.number(portionCountMessage).int(portionCountMessage).min(1, portionCountMessage)
    .max(inputLimits.batch.portionCount.max, portionCountMessage),
  items: z.array(mealShortcutItemInputSchema).min(1).max(inputLimits.batch.items.max),
  schedule: batchScheduleSchema.nullable()
};

export const createBatchInputSchema = z.object({
  clientMutationId: z.uuid('Must be a valid mutation ID'),
  ...batchFields
});

export const updateBatchInputSchema = z.object({
  expectedUpdatedAt: z.string().trim().regex(/^\d+$/, 'Batch version is missing'),
  ...batchFields
});

export type CreateBatchInput = z.infer<typeof createBatchInputSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchInputSchema>;
export type BatchSchedule = z.infer<typeof batchScheduleSchema>;

export function readBatchFormData(formData: FormData) {
  let items: unknown;
  try {
    items = JSON.parse(readText(formData, 'itemsJson'));
  } catch {
    items = [];
  }

  return {
    clientMutationId: readText(formData, 'clientMutationId'),
    expectedUpdatedAt: readText(formData, 'expectedUpdatedAt'),
    name: readText(formData, 'name'),
    portionCount: readText(formData, 'portionCount'),
    items,
    schedule: readText(formData, 'logMode') === 'next-days'
      ? {
          startDate: readText(formData, 'scheduleStartDate'),
          mealSlot: readText(formData, 'scheduleMealSlot')
        }
      : null
  };
}

/** The schedule values echoed back to the form after a failed save. */
export function submittedSchedule(
  raw: { schedule: { startDate: string; mealSlot: string } | null },
  fallback: { startDate: string; mealSlot: string }
) {
  return {
    logMode: raw.schedule === null ? 'hold' as const : 'next-days' as const,
    startDate: raw.schedule?.startDate || fallback.startDate,
    scheduleMealSlot: raw.schedule?.mealSlot || fallback.mealSlot
  };
}
