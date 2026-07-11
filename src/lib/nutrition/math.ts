export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n) { // i.e. food protein
    throw new RangeError('Numerator must be non-negative');
  }

  if (denominator <= 0n) { // i.e. food basis
    throw new RangeError('Denominator must be positive');
  }

  return (numerator + denominator / 2n) / denominator;
}

export function parseFixedPoint(input: string, fractionalDigits: number): bigint {
  if (!Number.isInteger(fractionalDigits) || fractionalDigits < 0) {
    throw new RangeError('Fractional digits must be a non-negative integer');
  }

  const value = input.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value); // ints before decimal point and after decimal point

  if (!match) {
    throw new TypeError('Value must be a non-negative decimal');
  }

  const wholePart = match[1];
  const fractionalPart = match[2] ?? '';

  if (fractionalPart.length > fractionalDigits) {
    throw new RangeError(
      `Value supports at most ${fractionalDigits} fractional digits`
    );
  }

  const scale = 10n ** BigInt(fractionalDigits);
  const paddedFraction = fractionalPart.padEnd(fractionalDigits, '0');

  return (
    BigInt(wholePart) * scale +
    BigInt(paddedFraction === '' ? '0' : paddedFraction)
  );
}
