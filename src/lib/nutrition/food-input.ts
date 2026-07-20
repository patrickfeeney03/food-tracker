import { z } from "zod";
import { amountUnits } from "./constants";
import { inputLimits } from "./input-limits";

const decimalPattern = /^\d+(?:\.\d+)?$/;
const zeroPattern = /^0+(?:\.0+)?$/;

function isAtMost(value: string, maximum: number): boolean {
  const [integerPart, fractionalPart = ""] = value.split(".");
  const normalizedInteger = integerPart.replace(/^0+/, "") || "0";
  const maximumInteger = String(maximum);

  if (normalizedInteger.length !== maximumInteger.length) {
    return normalizedInteger.length < maximumInteger.length;
  }

  if (normalizedInteger !== maximumInteger) {
    return normalizedInteger < maximumInteger;
  }

  return /^0*$/.test(fractionalPart);
}

export function decimalString(maxFractionalDigits: number, maximum?: number) {
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
    }, `Must have at most ${maxFractionalDigits} fractional digits`)
    .refine(
      (value) => maximum === undefined || isAtMost(value, maximum),
      maximum === undefined ? undefined : `Must be at most ${maximum}`
    );
}

export function positiveDecimalString(maxFractionalDigits: number, maximum?: number) {
  return decimalString(maxFractionalDigits, maximum).refine(
    (value) => !zeroPattern.test(value),
    'Must be greater than zero'
  );
}

const optionalText = (maximum: number) => z
  .string()
  .trim()
  .max(maximum, `Must have at most ${maximum} characters`)
  .optional()
  .default('');

const optionalDecimal = (maxFractionalDigits: number, maximum: number) => z
  .union([
    z.literal(''),
    decimalString(maxFractionalDigits, maximum)
  ])
  .optional()
  .default('');

const optionalPositiveDecimal = (maxFractionalDigits: number, maximum: number) => z
  .union([
    z.literal(''),
    positiveDecimalString(maxFractionalDigits, maximum)
  ])
  .optional()
  .default('');

export const createFoodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(inputLimits.food.name.maxLength, 'Name must have at most 200 characters'),

  brand: optionalText(inputLimits.food.brand.maxLength),
  barcode: optionalText(inputLimits.food.barcode.maxLength),

  amountUnit: z.enum(amountUnits),

  basisAmount: positiveDecimalString(3, inputLimits.food.basisAmount.max),
  servingAmount: optionalPositiveDecimal(3, inputLimits.food.servingAmount.max),
  containerAmount: optionalPositiveDecimal(3, inputLimits.food.containerAmount.max),

  energyKcal: decimalString(3, inputLimits.food.energyKcal.max),
  proteinG: decimalString(3, inputLimits.food.proteinG.max),
  carbsG: decimalString(3, inputLimits.food.carbsG.max),
  fatG: decimalString(3, inputLimits.food.fatG.max),

  fibreG: optionalDecimal(3, inputLimits.food.fibreG.max),
  sugarG: optionalDecimal(3, inputLimits.food.sugarG.max),
  saturatedFatG: optionalDecimal(3, inputLimits.food.saturatedFatG.max),

  sodiumMg: optionalDecimal(0, inputLimits.food.sodiumMg.max),
  potassiumMg: optionalDecimal(0, inputLimits.food.potassiumMg.max),

  notes: optionalText(inputLimits.food.notes.maxLength)
});

export type CreateFoodFormInput = z.infer<typeof createFoodSchema>;

export const editFoodSchema = createFoodSchema.extend({
  expectedUpdatedAt: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Food version is missing')
});

export type EditFoodFormInput = z.infer<typeof editFoodSchema>;
