import { describe, expect, it } from 'vitest';
import { batchPortionTotals, portionAmount, previewBatchPortion, scheduleDates, type BatchNutritionFood } from './batch';

const mince: BatchNutritionFood & { id: string } = {
  id: 'mince',
  basisAmount: 100000,
  energyMkcalPerBasis: 250000,
  proteinMgPerBasis: 26000,
  carbsMgPerBasis: 0,
  fatMgPerBasis: 15000
};
const penne: BatchNutritionFood & { id: string } = {
  id: 'penne',
  basisAmount: 100000,
  energyMkcalPerBasis: 350000,
  proteinMgPerBasis: 12000,
  carbsMgPerBasis: 70000,
  fatMgPerBasis: 1500
};
const items = [
  { totalAmount: 500000n, food: mince },
  { totalAmount: 300000n, food: penne }
];

describe('portionAmount', () => {
  it('divides a total evenly', () => {
    expect(portionAmount(500000n, 2n)).toBe(250000n);
  });

  it('rounds half up', () => {
    expect(portionAmount(500000n, 3n)).toBe(166667n);
    expect(portionAmount(1n, 2n)).toBe(1n);
  });

  it('throws when the portion would be zero', () => {
    expect(() => portionAmount(1n, 3n)).toThrow(RangeError);
  });

  it('throws for an invalid portion count', () => {
    expect(() => portionAmount(1000n, 0n)).toThrow(RangeError);
    expect(() => portionAmount(1000n, -1n)).toThrow(RangeError);
  });

  it('throws for a non-positive total', () => {
    expect(() => portionAmount(0n, 2n)).toThrow(RangeError);
    expect(() => portionAmount(-5n, 2n)).toThrow(RangeError);
  });
});

describe('batchPortionTotals', () => {
  it('sums one half portion', () => {
    expect(batchPortionTotals(items, 2)).toEqual({
      energyMkcal: 1150000n,
      proteinMg: 83000n,
      carbsMg: 105000n,
      fatMg: 39750n
    });
  });

  it('sums the nutrition of rounded third portions', () => {
    const totals = batchPortionTotals(items, 3);
    expect(totals.energyMkcal).toBe(766668n);
    expect(typeof totals.proteinMg).toBe('bigint');
  });

  it('throws for an invalid input', () => {
    expect(() => batchPortionTotals(items, 0)).toThrow(RangeError);
    expect(() => batchPortionTotals([{ totalAmount: 1n, food: mince }], 3)).toThrow(RangeError);
  });
});

describe('previewBatchPortion', () => {
  const foods = [mince, penne];
  const rows = [
    { foodId: 'mince', amount: '500' },
    { foodId: 'penne', amount: '300' }
  ];

  it('matches batchPortionTotals for valid input', () => {
    expect(previewBatchPortion(rows, foods, 2)).toEqual(batchPortionTotals(items, 2));
  });

  it('returns null without items', () => {
    expect(previewBatchPortion([], foods, 2)).toBeNull();
  });

  it('returns null for a null or unknown food', () => {
    expect(previewBatchPortion([{ foodId: null, amount: '500' }], foods, 2)).toBeNull();
    expect(previewBatchPortion([{ foodId: 'missing', amount: '500' }], foods, 2)).toBeNull();
  });

  it.each(['', 'abc', '1.2345'])('returns null for the invalid amount %j', (amount) => {
    expect(previewBatchPortion([{ foodId: 'mince', amount }], foods, 2)).toBeNull();
  });

  it.each([0, 11, 2.5])('returns null for the portion count %s', (portionCount) => {
    expect(previewBatchPortion(rows, foods, portionCount)).toBeNull();
  });
});

describe('scheduleDates', () => {
  it('lists consecutive days', () => {
    expect(scheduleDates('2026-11-09', 3)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });

  it('crosses a year boundary', () => {
    expect(scheduleDates('2026-12-31', 3)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
  });
});
