import { z } from "zod";
import { amountUnits } from "./constants";

const decimalPattern = /^\d+(?:\.\d+)?$/;
const zeroPattern = /^0+(?:\.0+)?$/;

export function decimalString(maxFractionalDigits: number) {
  if (
    !Number.isInteger(maxFractionalDigits) ||
    maxFractionalDigits < 0
  ) {
    throw new RangeError(
      'Maximum fractional digits must be a non-negative integer'
    );
  }
  return z
    .string()
    .trim()
    .refine(
      (value) => decimalPattern.test(value),
      'Must be a non-negative decimal'
    )
    .refine((value) => {
      const fractionalPart = value.split('.')[1] ?? '';
      return fractionalPart.length <= maxFractionalDigits;
    }, `Must have at most ${maxFractionalDigits} fractional digits`);
}

export function positiveDecimalString(maxFractionalDigits: number) {
  return decimalString(maxFractionalDigits).refine(
    (value) => !zeroPattern.test(value),
    'Must be greater than zero'
  );
}

const optionalText = z
  .string()
  .trim()
  .optional()
  .default('');

const optionalDecimal = (maxFractionalDigits: number) => z
  .union([
    z.literal(''),
    decimalString(maxFractionalDigits)
  ])
  .optional()
  .default('');

const optionalPositiveDecimal = (maxFractionalDigits: number) => z
  .union([
    z.literal(''),
    positiveDecimalString(maxFractionalDigits)
  ])
  .optional()
  .default('');

export const createFoodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must have at most 200 characters'),

  brand: optionalText,
  barcode: optionalText,

  amountUnit: z.enum(amountUnits),

  basisAmount: positiveDecimalString(3),
  servingAmount: optionalPositiveDecimal(3),
  containerAmount: optionalPositiveDecimal(3),

  energyKcal: decimalString(3),
  proteinG: decimalString(3),
  carbsG: decimalString(3),
  fatG: decimalString(3),

  fibreG: optionalDecimal(3),
  sugarG: optionalDecimal(3),
  saturatedFatG: optionalDecimal(3),

  sodiumMg: optionalDecimal(0),
  potassiumMg: optionalDecimal(0),

  notes: optionalText
});

export type CreateFoodFormInput = z.infer<typeof createFoodSchema>;
