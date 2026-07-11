import { describe, expect, it } from "vitest";
import { divideRoundHalfUp, parseFixedPoint, toSafeInteger } from "./math";

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
    { input: '250', fractionalDigits: 0, expected: 250n },
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

  it('rejects decimal liquid input when no fractional digits are supported', () => {
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
