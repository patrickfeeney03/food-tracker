import { describe, expect, it } from "vitest";
import { z } from 'zod';
import { nutritionGoalInputSchema } from "./goal-input";

const validGoal = {
  effectiveFrom: '2026-07-12',
  targetEnergyKcal: '2900',
  targetProteinG: '200',
  targetCarbsG: '300',
  targetFatG: '90'
};

describe('nutrtionGoalInputSchema', () => {
  it('validates a copmlete nutrition goal', () => {
    expect(
      nutritionGoalInputSchema.parse(validGoal)
    ).toEqual(validGoal)
  });

  it('trims date and numeric input', () => {
    expect(
      nutritionGoalInputSchema.parse({
        effectiveFrom: '  2026-07-12   ',
        targetEnergyKcal: '  2900 ',
        targetProteinG: ' 200 ',
        targetCarbsG: ' 300 ',
        targetFatG: ' 90 '
      })
    ).toEqual(validGoal)
  });

  it('allows zero targets', () => {
    expect(
      nutritionGoalInputSchema.safeParse({
        effectiveFrom: '2026-07-12',
        targetEnergyKcal: '0',
        targetProteinG: '0',
        targetCarbsG: '0',
        targetFatG: '0'
      }).success
    ).toBe(true);
  });

  it('rejects an invalid effective date', () => {
    const result = nutritionGoalInputSchema.safeParse({
      ...validGoal,
      effectiveFrom: '2026-02-29'
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        z.flattenError(result.error).fieldErrors.effectiveFrom
      ).toContain('Must be a valid calendar date');
    }
  });

  it('rejects negative targets', () => {
    const result = nutritionGoalInputSchema.safeParse({
      ...validGoal,
      targetEnergyKcal: '-1',
      targetProteinG: '-1',
      targetCarbsG: '-1',
      targetFatG: '-1'
    });

    expect(result.success).toBe(false);
  });

  it('rejects excessive precision', () => {
    const result = nutritionGoalInputSchema.safeParse({
      ...validGoal,
      targetEnergyKcal: '2900.1234',
      targetProteinG: '200.1234'
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = z.flattenError(result.error).fieldErrors;

      expect(errors.targetEnergyKcal).toContain(
        'Must have at most 3 fractional digits'
      );

      expect(errors.targetProteinG).toContain(
        'Must have at most 3 fractional digits'
      );
    }
  });
})
