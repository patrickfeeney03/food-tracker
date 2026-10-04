import type { Food } from '$lib/server/db/schema';
import { describe, expect, it } from 'vitest';
import { buildDiaryLogValues, resolvePortionDefinition } from './diary-entry';
const clientMutationId = '550e8400-e29b-41d4-a716-446655440000';
function makeFood(overrides: Partial<Food> = {}): Food {
    return {
        id: 'food-id',
        userId: 'user-id',
        name: 'Test food',
        brand: null,
        barcode: null,
        amountUnit: 'mg',
        basisAmount: 100000,
        servingAmount: 250000,
        containerAmount: 500000,
        energyMkcalPerBasis: 100000,
        proteinMgPerBasis: 10000,
        carbsMgPerBasis: 10000,
        fatMgPerBasis: 5000,
        additionalNutritionJson: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}
describe('resolvePortionDefinition', () => {
    it('resolves a 1 g solid portion', () => {
        expect(resolvePortionDefinition(makeFood(), 'unit')).toEqual({
            label: '1 g',
            amount: 1000n
        });
    });
    it('resolves a 1 ml liquid portion', () => {
        expect(resolvePortionDefinition(makeFood({ amountUnit: 'ul' }), 'unit')).toEqual({
            label: '1 ml',
            amount: 1000n
        });
    });
    it('resolves a 100 g solid portion', () => {
        expect(resolvePortionDefinition(makeFood(), 'hundred')).toEqual({
            label: '100 g',
            amount: 100000n
        });
    });
    it('resolves a 100 ml liquid portion', () => {
        expect(resolvePortionDefinition(makeFood({ amountUnit: 'ul' }), 'hundred')).toEqual({
            label: '100 ml',
            amount: 100000n
        });
    });
    it('uses the exact serving amount', () => {
        expect(resolvePortionDefinition(makeFood(), 'serving')).toEqual({
            label: 'Serving',
            amount: 250000n
        });
    });
    it('uses the exact container amount', () => {
        expect(resolvePortionDefinition(makeFood(), 'container')).toEqual({
            label: 'Container',
            amount: 500000n
        });
    });
    it('rejects a missing serving amount', () => {
        expect(() => resolvePortionDefinition(makeFood({ servingAmount: null }), 'serving')).toThrow(new RangeError('Food does not define a serving amount'));
    });
    it('rejects a missing container amount', () => {
        expect(() => resolvePortionDefinition(makeFood({ containerAmount: null }), 'container')).toThrow(new RangeError('Food does not define a container amount'));
    });
});
describe('buildDiaryLogValues', () => {
    it('builds a complete historical snapshot for a solid food', () => {
        const food = makeFood({
            name: '5% Lean Steak Mince',
            brand: 'Tesco',
            basisAmount: 250000,
            energyMkcalPerBasis: 342000,
            proteinMgPerBasis: 52500,
            carbsMgPerBasis: 0,
            fatMgPerBasis: 12500,
            additionalNutritionJson: {
                fibreMg: 1000,
                sodiumMg: 500,
                potassiumMg: 750
            }
        });
        const result = buildDiaryLogValues(food, {
            clientMutationId,
            portionKind: 'hundred',
            portionCount: '1.5',
            diaryDate: '2026-07-12',
            mealSlot: 'lunch'
        });
        expect(result).toEqual({
            userId: 'user-id',
            foodId: 'food-id',
            diaryDate: '2026-07-12',
            mealSlot: 'lunch',
            clientMutationId: clientMutationId,
            foodName: '5% Lean Steak Mince',
            foodBrand: 'Tesco',
            amountUnit: 'mg',
            basisAmount: 250000,
            energyMkcalPerBasis: 342000,
            proteinMgPerBasis: 52500,
            carbsMgPerBasis: 0,
            fatMgPerBasis: 12500,
            additionalNutritionPerBasisJson: {
                fibreMg: 1000,
                sodiumMg: 500,
                potassiumMg: 750
            },
            portionKind: 'hundred',
            portionLabel: '100 g',
            portionAmount: 100000,
            portionCountMilli: 1500,
            resolvedAmount: 150000,
            energyMkcal: 205200,
            proteinMg: 31500,
            carbsMg: 0,
            fatMg: 7500,
            additionalNutritionTotalJson: {
                fibreMg: 600,
                sodiumMg: 300,
                potassiumMg: 450
            }
        });
    });
    it('builds and rounds a fractional liquid serving', () => {
        const food = makeFood({
            amountUnit: 'ul',
            basisAmount: 100000,
            servingAmount: 250125,
            energyMkcalPerBasis: 64000,
            proteinMgPerBasis: 3400,
            carbsMgPerBasis: 4700,
            fatMgPerBasis: 3600
        });
        const result = buildDiaryLogValues(food, {
            clientMutationId,
            portionKind: 'serving',
            portionCount: '1',
            diaryDate: '2026-07-12',
            mealSlot: 'breakfast'
        });
        expect(result).toEqual(expect.objectContaining({
            amountUnit: 'ul',
            portionKind: 'serving',
            portionLabel: 'Serving',
            portionAmount: 250125,
            portionCountMilli: 1000,
            resolvedAmount: 250125,
            energyMkcal: 160080,
            proteinMg: 8504,
            carbsMg: 11756,
            fatMg: 9005,
            additionalNutritionPerBasisJson: null,
            additionalNutritionTotalJson: null
        }));
    });
    it('rejects an archived food', () => {
        const food = makeFood({
            deletedAt: new Date()
        });
        expect(() => buildDiaryLogValues(food, {
            clientMutationId,
            portionKind: 'unit',
            portionCount: '1',
            diaryDate: '2026-07-12',
            mealSlot: 'snacks'
        })).toThrow(new RangeError('Cannot log an archived food'));
    });
    it('does not derive calories from macros', () => {
        const food = makeFood({
            basisAmount: 100000,
            energyMkcalPerBasis: 50000,
            proteinMgPerBasis: 100000,
            carbsMgPerBasis: 100000,
            fatMgPerBasis: 100000
        });
        const result = buildDiaryLogValues(food, {
            clientMutationId,
            portionKind: 'hundred',
            portionCount: '1',
            diaryDate: '2026-07-12',
            mealSlot: 'dinner'
        });
        expect(result.energyMkcal).toBe(50000);
    });
});
