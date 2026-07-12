import { describe, expect, it } from 'vitest';
import { nutritionGoalInputSchema } from '$lib/nutrition/goal-input';
import { mapNutritionGoalInput } from './goal-mapper';

describe('mapNutritionGoalInput', () => {
  it('maps a validated goal to database values', () => {
    const input = nutritionGoalInputSchema.parse({
      effectiveFrom: '2026-07-12',
      targetEnergyKcal: '2900',
      targetProteinG: '200',
      targetCarbsG: '300',
      targetFatG: '90'
    });

    expect(mapNutritionGoalInput(input, 'user-id')).toEqual({
      userId: 'user-id',
      effectiveFrom: '2026-07-12',
      targetEnergyMkcal: 2_900_000,
      targetProteinMg: 200_000,
      targetCarbsMg: 300_000,
      targetFatMg: 90_000
    });
  });

  it('preserves decimal precision', () => {
    const input = nutritionGoalInputSchema.parse({
      effectiveFrom: '2026-07-12',
      targetEnergyKcal: '2000.125',
      targetProteinG: '150.5',
      targetCarbsG: '250.25',
      targetFatG: '70.75'
    });

    expect(mapNutritionGoalInput(input, 'user-id')).toEqual(
      expect.objectContaining({
        targetEnergyMkcal: 2_000_125,
        targetProteinMg: 150_500,
        targetCarbsMg: 250_250,
        targetFatMg: 70_750
      })
    );
  });

  it('supports zero targets', () => {
    const input = nutritionGoalInputSchema.parse({
      effectiveFrom: '2026-07-12',
      targetEnergyKcal: '0',
      targetProteinG: '0',
      targetCarbsG: '0',
      targetFatG: '0'
    });

    expect(mapNutritionGoalInput(input, 'user-id')).toEqual(
      expect.objectContaining({
        targetEnergyMkcal: 0,
        targetProteinMg: 0,
        targetCarbsMg: 0,
        targetFatMg: 0
      })
    );
  });

  it('rejects values outside the safe integer range', () => {
    const input = nutritionGoalInputSchema.parse({
      effectiveFrom: '2026-07-12',
      targetEnergyKcal: '9007199254740.992',
      targetProteinG: '0',
      targetCarbsG: '0',
      targetFatG: '0'
    });

    expect(() => mapNutritionGoalInput(input, 'user-id')).toThrow(
      new RangeError('Value exceeds the safe integer range')
    );
  });
});
