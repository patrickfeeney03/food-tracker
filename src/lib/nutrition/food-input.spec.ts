import { describe, expect, it } from "vitest";
import { decimalString, positiveDecimalString } from "./food-input";

describe('decimalString', () => {
  it.each([
    '0', '12', '12.5', '001.005'
  ])('accepts a non-negative decimal: "%s"', (input) => {
    expect(decimalString(3).parse(input)).toBe(input);
  });

  it('trims surrounding whitespace', () => {
    expect(decimalString(3).parse(' 12.5     ')).toBe('12.5');
  });

  it.each([
    '',
    '   ',
    '-1',
    '+1',
    '.5',
    '1.',
    '1e3',
    '1,000',
    'NaN',
    'Infinity'
  ])('rejects invalid decimal syntax: %s', (input) => {
    expect(decimalString(3).safeParse(input).success).toBe(false);
  });

  it('rejects excessive precision', () => {
    const result = decimalString(3).safeParse('1.2345');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: 'Must have at most 3 fractional digits'
        })
      );
    }
  });

  it('can enforce whole-number input', () => {
    expect(decimalString(0).parse('450')).toBe('450');
    expect(decimalString(0).safeParse('1.5').success).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN])(
    'rejects invalid precision configuration: %s',
    (maxFractionalDigits) => {
      expect(() => decimalString(maxFractionalDigits)).toThrow(
        new RangeError(
          'Maximum fractional digits must be a non-negative integer'
        )
      );
    }
  );
});

describe('positiveDecimalString', () => {
  it.each([
    '1',
    '0.001',
    '12.5'
  ])('accepts a positive decimal: %s', (input) => {
    expect(positiveDecimalString(3).parse(input)).toBe(input);
  });

  it.each([
    '0',
    '0.0',
    '000.000'
  ])('rejects zero: %s', (input) => {
    const result = positiveDecimalString(3).safeParse(input);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: 'Must be greater than zero'
        })
      );
    }
  });
});
