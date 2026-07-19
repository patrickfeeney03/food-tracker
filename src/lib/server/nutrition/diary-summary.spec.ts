import { describe, expect, it } from "vitest";
import type { DiaryLog } from "../db/schema";
import { calculateBalance, sumDiaryNutrition } from "./diary-summary";

function makeDiaryLog(
  overrides: Partial<DiaryLog> = {}
): DiaryLog {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    userId: 'user-id',
    foodId: 'food-id',
    diaryDate: '2026-07-12',
    mealSlot: 'breakfast',
    sourceShortcutId: null,
    shortcutBatchId: null,
    clientMutationId: crypto.randomUUID(),
    clientRequestFingerprint: '',

    foodName: 'Test food',
    foodBrand: null,
    amountUnit: 'mg',
    basisAmount: 100_000,
    energyMkcalPerBasis: 100_000,
    proteinMgPerBasis: 10_000,
    carbsMgPerBasis: 20_000,
    fatMgPerBasis: 5_000,
    additionalNutritionPerBasisJson: null,

    portionKind: 'hundred',
    portionLabel: '100 g',
    portionAmount: 100_000,
    portionCountMilli: 1_000,
    resolvedAmount: 100_000,

    energyMkcal: 100_000,
    proteinMg: 10_000,
    carbsMg: 20_000,
    fatMg: 5_000,
    additionalNutritionTotalJson: null,

    loggedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,

    ...overrides
  };
}
describe('sumDiaryNutrition', () => {
  it('returns zero totals for an empty diary', () => {
    expect(sumDiaryNutrition([])).toEqual({
      energyMkcal: 0,
      proteinMg: 0,
      carbsMg: 0,
      fatMg: 0
    });
  });

  it('sums multiple diary entries', () => {
    const entries = [
      makeDiaryLog({
        energyMkcal: 205_200,
        proteinMg: 31_500,
        carbsMg: 0,
        fatMg: 7_500
      }),
      makeDiaryLog({
        energyMkcal: 390_000,
        proteinMg: 8_000,
        carbsMg: 84_000,
        fatMg: 1_000
      })
    ];

    expect(sumDiaryNutrition(entries)).toEqual({
      energyMkcal: 595_200,
      proteinMg: 39_500,
      carbsMg: 84_000,
      fatMg: 8_500
    });
  });

  it('rejects a total outside the safe integer range', () => {
    const entries = [
      makeDiaryLog({
        energyMkcal: Number.MAX_SAFE_INTEGER
      }),
      makeDiaryLog({
        energyMkcal: 1
      })
    ];

    expect(() => sumDiaryNutrition(entries)).toThrow(
      new RangeError(
        'Value exceeds the safe integer range'
      )
    );
  });
});

describe('calculateBalance', () => {
  it('calculates a remaining amount', () => {
    expect(calculateBalance(700, 1_000)).toEqual({
      consumed: 700,
      target: 1_000,
      remaining: 300,
      over: 0
    });
  });

  it('handles an exactly reached target', () => {
    expect(calculateBalance(1_000, 1_000)).toEqual({
      consumed: 1_000,
      target: 1_000,
      remaining: 0,
      over: 0
    });
  });

  it('calculates an over-target amount', () => {
    expect(calculateBalance(1_200, 1_000)).toEqual({
      consumed: 1_200,
      target: 1_000,
      remaining: 0,
      over: 200
    });
  });

  it('supports a zero target', () => {
    expect(calculateBalance(100, 0)).toEqual({
      consumed: 100,
      target: 0,
      remaining: 0,
      over: 100
    });
  });

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1
  ])('rejects an invalid consumed value: %s', (consumed) => {
    expect(() => calculateBalance(consumed, 100)).toThrow(
      new RangeError(
        'Consumed value must be a non-negative safe integer'
      )
    );
  });

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1
  ])('rejects an invalid target value: %s', (target) => {
    expect(() => calculateBalance(100, target)).toThrow(
      new RangeError(
        'Target value must be a non-negative safe integer'
      )
    );
  });
});
