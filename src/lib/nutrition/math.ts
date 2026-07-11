export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n) { // i.e. food protein
    throw new RangeError('Numerator must be non-negative');
  }

  if (denominator <= 0n) { // i.e. food basis
    throw new RangeError('Denominator must be positive');
  }

  return (numerator + denominator / 2n) / denominator;
}
