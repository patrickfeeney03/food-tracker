import { z } from 'zod';
import { mealSlots } from './constants';
import { inputLimits } from './input-limits';
import { calendarDateString } from './portion-input';

export const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

export const contextSchema = destinationSchema.extend({
  q: z.string().trim().max(inputLimits.catalogueQuery.maxLength)
});

export type NavigationContext = z.infer<typeof contextSchema>;

export function readContext(values: {
  date: string | null | undefined;
  mealSlot: string | null | undefined;
  q: string | null | undefined;
}): NavigationContext | undefined {
  const result = contextSchema.safeParse({
    date: values.date,
    mealSlot: values.mealSlot,
    q: values.q ?? ''
  });

  return result.success ? result.data : undefined;
}
