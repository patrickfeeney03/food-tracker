import { describe, expect, it } from "vitest";
import type { DiaryLog } from "../db/schema";
import { calculateBalance, sumDiaryNutrition } from "./diary-summary";
function makeDiaryLog(overrides: Partial<DiaryLog> = {}): DiaryLog {
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
        basisAmount: 100000,
        energyMkcalPerBasis: 100000,
        proteinMgPerBasis: 10000,
        carbsMgPerBasis: 20000,
        fatMgPerBasis: 5000,
        additionalNutritionPerBasisJson: null,
        portionKind: 'hundred',
        portionLabel: '100 g',
        portionAmount: 100000,
        portionCountMilli: 1000,
        resolvedAmount: 100000,
        energyMkcal: 100000,
        proteinMg: 10000,
        carbsMg: 20000,
        fatMg: 5000,
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
                energyMkcal: 205200,
                proteinMg: 31500,
                carbsMg: 0,
                fatMg: 7500
            }),
            makeDiaryLog({
                energyMkcal: 390000,
                proteinMg: 8000,
                carbsMg: 84000,
                fatMg: 1000
            })
        ];
        expect(sumDiaryNutrition(entries)).toEqual({
            energyMkcal: 595200,
            proteinMg: 39500,
            carbsMg: 84000,
            fatMg: 8500
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
        expect(() => sumDiaryNutrition(entries)).toThrow(new RangeError('Value exceeds the safe integer range'));
    });
});
describe('calculateBalance', () => {
    it('calculates a remaining amount', () => {
        expect(calculateBalance(700, 1000)).toEqual({
            consumed: 700,
            target: 1000,
            remaining: 300,
            over: 0
        });
    });
    it('handles an exactly reached target', () => {
        expect(calculateBalance(1000, 1000)).toEqual({
            consumed: 1000,
            target: 1000,
            remaining: 0,
            over: 0
        });
    });
    it('calculates an over-target amount', () => {
        expect(calculateBalance(1200, 1000)).toEqual({
            consumed: 1200,
            target: 1000,
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
        expect(() => calculateBalance(consumed, 100)).toThrow(new RangeError('Consumed value must be a non-negative safe integer'));
    });
    it.each([
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1
    ])('rejects an invalid target value: %s', (target) => {
        expect(() => calculateBalance(100, target)).toThrow(new RangeError('Target value must be a non-negative safe integer'));
    });
});
