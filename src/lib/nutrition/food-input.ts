import { z } from "zod";

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
