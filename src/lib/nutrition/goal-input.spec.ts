import { describe, expect, it } from "vitest";
import { z } from 'zod';
import {
  firstGoalEffectiveDateError,
  nutritionGoalInputSchema
} from "./goal-input";

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

  it('accepts maximum targets and rejects over-limit targets', () => {
    expect(nutritionGoalInputSchema.safeParse({
      ...validGoal,
      targetEnergyKcal: '10000',
      targetProteinG: '1000',
      targetCarbsG: '1000',
      targetFatG: '1000'
    }).success).toBe(true);
    expect(nutritionGoalInputSchema.safeParse({
      ...validGoal,
      targetProteinG: '1000.001'
    }).success).toBe(false);
  });

  it('allows a first goal today or earlier, but not in the future', () => {
    expect(firstGoalEffectiveDateError('2026-07-18', '2026-07-18')).toBeUndefined();
    expect(firstGoalEffectiveDateError('2026-07-01', '2026-07-18')).toBeUndefined();
    expect(firstGoalEffectiveDateError('2026-07-19', '2026-07-18'))
      .toBe('Your first goal cannot start in the future.');
  });
})
