import { describe, expect, it } from "vitest";
import {
  divideRoundHalfUp,
  formatStoredValue,
  parseFixedPoint,
  resolvePortionAmount,
  scaleNutritionValue,
  toSafeInteger
} from "./math";

describe('divideRoundHalfUp', () => {
  it.each([
    { numerator: 9n, denominator: 4n, expected: 2n },
    { numerator: 10n, denominator: 4n, expected: 3n },
    { numerator: 11n, denominator: 4n, expected: 3n },
    { numerator: 0n, denominator: 4n, expected: 0n },
    { numerator: 1n, denominator: 3n, expected: 0n },
    { numerator: 2n, denominator: 3n, expected: 1n },
  ])(
    'rounds "$numerator: / "$denominator" to "$expected"',
    ({ numerator, denominator, expected }) => {
      expect(divideRoundHalfUp(numerator, denominator)).toBe(expected);
    });

  it('rejects a negative numerator', () => {
    expect(() => divideRoundHalfUp(-1n, 4n)).toThrow(
      new RangeError('Numerator must be non-negative')
    );
  });

  it('rejects a zero denominator', () => {
    expect(() => divideRoundHalfUp(2n, 0n)).toThrow(
      RangeError('Denominator must be positive')
    );
  })

  it('rejects a negative denominator', () => {
    expect(() => divideRoundHalfUp(2n, -10n)).toThrow(
      RangeError('Denominator must be positive')
    );
  })
});

describe('parseFixedPoint', () => {
  it.each([
    { input: '132.5', fractionalDigits: 3, expected: 132_500n },
    { input: '4.7', fractionalDigits: 3, expected: 4_700n },
    { input: '250.25', fractionalDigits: 3, expected: 250_250n },
    { input: '250', fractionalDigits: 3, expected: 250_000n },
    { input: '1.5', fractionalDigits: 3, expected: 1_500n },
    { input: '1.50', fractionalDigits: 3, expected: 1_500n },
    { input: '0001.005', fractionalDigits: 3, expected: 1_005n },
    { input: ' 12.5', fractionalDigits: 3, expected: 12_500n },
    { input: '0', fractionalDigits: 3, expected: 0n },
  ])(
    'parses "$input" with "$fractionalDigits" fraction digits',
    ({ input, fractionalDigits, expected }) => {
      expect(parseFixedPoint(input, fractionalDigits)).toBe(expected);
    });

  it.each([
    '', '   ', '-1', '+1', '.5', '1.', '1e3', '1,000', 'NaN', 'Infinity'
  ])('rejects invalid decimal syntax: "%s"', (input) => {
    expect(() => parseFixedPoint(input, 3)).toThrow(
      new TypeError('Value must be a non-negative decimal')
    )
  });

  it('rejects more fractinoal digits than supported', () => {
    expect(() => parseFixedPoint('1.2345', 3)).toThrow(
      new RangeError('Value supports at most 3 fractional digits')
    );
  });

  it('parses fractional milliliters as microliters', () => {
    expect(parseFixedPoint('250.125', 3)).toBe(250_125n);
  });

  it('rejects decimals when configured with zero fractional digits', () => {
    expect(() => parseFixedPoint('250.0', 0)).toThrow(
      new RangeError('Value supports at most 0 fractional digits')
    );
  });

  it.each([-1, 1.5, Number.NaN])(
    'rejects invalid fractional-digit configuration %s', (input) => {
      expect(() => parseFixedPoint('1', input)).toThrow(
        new RangeError('Fractional digits must be a non-negative integer')
      );
    }
  );
});

describe('toSafeInteger', () => {
  it('converts zero', () => {
    expect(toSafeInteger(0n)).toBe(0);
  });

  it('converts a normal nutrition value', () => {
    expect(toSafeInteger(342000n)).toBe(342_000);
  });

  it('accepts the largest safe integer', () => {
    expect(toSafeInteger(BigInt(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER
    );
  });

  it('rejects a negative value', () => {
    expect(() => toSafeInteger(-1n)).toThrow(
      new RangeError('Value must be non-negative')
    );
  });

  it('rejects a value above the safe integer range', () => {
    const unsafeValue = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

    expect(() => toSafeInteger(unsafeValue)).toThrow(
      new RangeError('Value exceeds the safe integer range')
    );
  });
});

describe('resolvePortionAmount', () => {
  it('resolves 2.5 portions of 100 g', () => {
    expect(resolvePortionAmount(100_000n, 2_500n)).toBe(250_000n);
  });

  it('resolves 1.5 portions of a 250 g serving', () => {
    expect(resolvePortionAmount(250_000n, 1_500n)).toBe(375_000n);
  });

  it('resolves one 330 ml container', () => {
    expect(resolvePortionAmount(330_000n, 1_000n)).toBe(330_000n);
  });

  it('preserves fractional milliliter precision', () => {
    expect(resolvePortionAmount(1_000n, 333n)).toBe(333n);
  });

  it('rounds a resolved amount below half downward', () => {
    expect(resolvePortionAmount(3n, 499n)).toBe(1n);
  });

  it('rounds an exact half upward', () => {
    expect(resolvePortionAmount(3n, 500n)).toBe(2n);
  });

  it('rounds a resolved amount above half upward', () => {
    expect(resolvePortionAmount(3n, 501n)).toBe(2n);
  });

  it('rejects a zero portion amount', () => {
    expect(() => resolvePortionAmount(0n, 1_000n)).toThrow(
      new RangeError('Portion amount must be positive')
    );
  });

  it('rejects a negative portion amount', () => {
    expect(() => resolvePortionAmount(-1n, 1_000n)).toThrow(
      new RangeError('Portion amount must be positive')
    );
  });

  it('rejects a zero portion count', () => {
    expect(() => resolvePortionAmount(100_000n, 0n)).toThrow(
      new RangeError('Portion count must be positive')
    );
  });

  it('rejects a negative portion count', () => {
    expect(() => resolvePortionAmount(100_000n, -1n)).toThrow(
      new RangeError('Portion count must be positive')
    );
  });

  it('rejects an amount that rounds to zero storage units', () => {
    expect(() => resolvePortionAmount(1n, 333n)).toThrow(
      new RangeError('Resolved amount must be positive')
    );
  });
});

describe('scaleNutritionValue', () => {
  it('scales label calories independently', () => {
    expect(
      scaleNutritionValue(342_000n, 150_000n, 250_000n)
    ).toBe(205_200n);
  });

  it('scales protein from the entered basis', () => {
    expect(
      scaleNutritionValue(52_500n, 150_000n, 250_000n)
    ).toBe(31_500n);
  });

  it('scales fat from the entered basis', () => {
    expect(
      scaleNutritionValue(12_500n, 150_000n, 250_000n)
    ).toBe(7_500n);
  });

  it('allows zero nutrition', () => {
    expect(
      scaleNutritionValue(0n, 150_000n, 250_000n)
    ).toBe(0n);
  });

  it('scales an amount larger than the entered basis', () => {
    expect(
      scaleNutritionValue(342_000n, 375_000n, 250_000n)
    ).toBe(513_000n);
  });

  it('rounds a result below half downward', () => {
    expect(scaleNutritionValue(1n, 1n, 3n)).toBe(0n);
  });

  it('rounds an exact half upward', () => {
    expect(scaleNutritionValue(1n, 1n, 2n)).toBe(1n);
  });

  it('rounds a result above half upward', () => {
    expect(scaleNutritionValue(2n, 1n, 3n)).toBe(1n);
  });

  it('rejects negative nutrition', () => {
    expect(() => scaleNutritionValue(-1n, 100_000n, 100_000n)).toThrow(
      new RangeError('Nutrition value must be non-negative')
    );
  });

  it('rejects a zero resolved amount', () => {
    expect(() => scaleNutritionValue(100n, 0n, 100_000n)).toThrow(
      new RangeError('Resolved amount must be positive')
    );
  });

  it('rejects a negative resolved amount', () => {
    expect(() => scaleNutritionValue(100n, -1n, 100_000n)).toThrow(
      new RangeError('Resolved amount must be positive')
    );
  });

  it('rejects a zero basis amount', () => {
    expect(() => scaleNutritionValue(100n, 100_000n, 0n)).toThrow(
      new RangeError('Basis amount must be positive')
    );
  });

  it('rejects a negative basis amount', () => {
    expect(() => scaleNutritionValue(100n, 100_000n, -1n)).toThrow(
      new RangeError('Basis amount must be positive')
    );
  });
});

describe('formatStoredValue', () => {
  it.each([
    { value: 205_200n, displayFractionalDigits: 1, expected: '205.2' },
    { value: 205_250n, displayFractionalDigits: 1, expected: '205.3' },
    { value: 205_249n, displayFractionalDigits: 1, expected: '205.2' },
    { value: 342_500n, displayFractionalDigits: 0, expected: '343' },
    { value: 31_500n, displayFractionalDigits: 1, expected: '31.5' },
    { value: 250_125n, displayFractionalDigits: 3, expected: '250.125' },
    { value: 12_000n, displayFractionalDigits: 1, expected: '12' },
    { value: 5n, displayFractionalDigits: 3, expected: '0.005' },
    { value: 5n, displayFractionalDigits: 2, expected: '0.01' },
    { value: 5n, displayFractionalDigits: 1, expected: '0' },
    { value: 0n, displayFractionalDigits: 3, expected: '0' }
  ])(
    'formats $value with $displayFractionalDigits fractional digits as $expected',
    ({ value, displayFractionalDigits, expected }) => {
      expect(formatStoredValue(value, displayFractionalDigits)).toBe(expected);
    }
  );

  it('carries display rounding into the whole part', () => {
    expect(formatStoredValue(999_950n, 1)).toBe('1000');
  });

  it('rejects a negative value', () => {
    expect(() => formatStoredValue(-1n, 1)).toThrow(
      new RangeError('Value must be non-negative')
    );
  });

  it.each([-1, 4, 1.5, Number.NaN])(
    'rejects invalid display precision: %s',
    (displayFractionalDigits) => {
      expect(() => formatStoredValue(1_000n, displayFractionalDigits)).toThrow(
        new RangeError('Display fractional digits must be between 0 and 3')
      );
    }
  );
});
