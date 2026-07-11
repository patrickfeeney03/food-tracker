import { describe, expect, it } from "vitest";
import { divideRoundHalfUp } from "./math";

describe('divideRoundHalfUp', () => {
  it.each([
    { numerator: 9n, denominator: 4n, expected: 2n },
    { numerator: 10n, denominator: 4n, expected: 3n },
    { numerator: 11n, denominator: 4n, expected: 3n },
    { numerator: 0n, denominator: 4n, expected: 0n },
    { numerator: 1n, denominator: 3n, expected: 0n },
    { numerator: 2n, denominator: 3n, expected: 1n },
  ])(
    'rounds $numerator / $denominator to $expected',
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
