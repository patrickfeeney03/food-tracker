import z from "zod";
import { mealSlots, portionKinds } from "./constants";
import { positiveDecimalString } from "./food-input";

const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (
    year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0)
  );
}

function isValidCalendarDate(value: string): boolean {
  const match = calendarDatePattern.exec(value);

  if (!match) return true;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  return day >= 1 && day <= daysInMonth[month - 1];
}

export const calendarDateString = z
  .string()
  .trim()
  .regex(
    calendarDatePattern,
    'Must use YYYY-MM-DD format'
  )
  .refine(
    isValidCalendarDate,
    'Must be a valid calendar date'
  );

export const logFoodInputSchema = z.object({
  portionKind: z.enum(portionKinds),

  portionCount: positiveDecimalString(3),

  diaryDate: calendarDateString,

  mealSlot: z.enum(mealSlots)
});

export type LogFoodInput = z.infer<typeof logFoodInputSchema>;
