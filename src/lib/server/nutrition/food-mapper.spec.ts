import { createFoodSchema } from "$lib/nutrition/food-input";
import { describe, expect, it } from "vitest";
import { mapCreateFoodInput } from "./food-mapper";

const userId = 'test-user';

describe('mapCreateFoodInput', () => {
  it('maps a validates solid food to database values', () => {
    const input = createFoodSchema.parse({
      name: '5% Lean Steak Mince',
      amountUnit: 'mg',
      basisAmount: '250',
      energyKcal: '342',
      proteinG: '52.5',
      carbsG: '0',
      fatG: '12.5'
    });

    expect(mapCreateFoodInput(input, userId)).toEqual({
      userId,
      name: '5% Lean Steak Mince',
      brand: null,
      barcode: null,
      amountUnit: 'mg',
      basisAmount: 250_000,
      servingAmount: null,
      containerAmount: null,
      energyMkcalPerBasis: 342_000,
      proteinMgPerBasis: 52_500,
      carbsMgPerBasis: 0,
      fatMgPerBasis: 12_500,
      additionalNutritionJson: null,
      notes: null
    });
  });

  it('maps fractional liquid amounts and additional nutrition', () => {
    const input = createFoodSchema.parse({
      name: 'Whole milk',
      brand: ' Dairy Farm ',
      barcode: '001234567890',
      amountUnit: 'ul',
      basisAmount: '100',
      servingAmount: '250.125',
      containerAmount: '1000',
      energyKcal: '160.5',
      proteinG: '8.2',
      carbsG: '12',
      fatG: '8.5',
      fibreG: '0.5',
      saturatedFatG: '4.25',
      sodiumMg: '95',
      potassiumMg: '150',
      notes: ' Keep refrigerated '
    });

    expect(mapCreateFoodInput(input, userId)).toEqual({
      userId,
      name: 'Whole milk',
      brand: 'Dairy Farm',
      barcode: '001234567890',
      amountUnit: 'ul',
      basisAmount: 100_000,
      servingAmount: 250_125,
      containerAmount: 1_000_000,
      energyMkcalPerBasis: 160_500,
      proteinMgPerBasis: 8_200,
      carbsMgPerBasis: 12_000,
      fatMgPerBasis: 8_500,
      additionalNutritionJson: {
        fibreMg: 500,
        saturatedFatMg: 4_250,
        sodiumMg: 95,
        potassiumMg: 150
      },
      notes: 'Keep refrigerated'
    });
  });

  it('preserves an explicitly entered zero optional nutrient', () => {
    const input = createFoodSchema.parse({
      name: 'Water',
      amountUnit: 'ul',
      basisAmount: '500',
      energyKcal: '0',
      proteinG: '0',
      carbsG: '0',
      fatG: '0',
      sodiumMg: '0'
    });

    expect(
      mapCreateFoodInput(input, userId).additionalNutritionJson
    ).toEqual({
      sodiumMg: 0
    });
  });

  it('rejects a value outside the safe database integer range', () => {
    const input = createFoodSchema.parse({
      name: 'Overflow',
      amountUnit: 'mg',
      basisAmount: '100',
      energyKcal: '9007199254740.992',
      proteinG: '0',
      carbsG: '0',
      fatG: '0'
    });

    expect(() => mapCreateFoodInput(input, userId)).toThrow(
      new RangeError('Value exceeds the safe integer range')
    );
  });
});
