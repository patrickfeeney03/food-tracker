import { describe, expect, it } from 'vitest';
import {
  mealSlots,
  portionKinds
} from './constants';
import {
  calendarDateString,
  logFoodInputSchema
} from './portion-input';

const clientMutationId = '550e8400-e29b-41d4-a716-446655440000';

const validInput = {
  clientMutationId,
  portionKind: 'hundred',
  portionCount: '2.5',
  diaryDate: '2026-07-12',
  mealSlot: 'lunch'
} as const;

describe('calendarDateString', () => {
  it.each([
    '2026-07-12',
    '2028-02-29',
    '2000-02-29'
  ])('accepts a valid calendar date: %s', (date) => {
    expect(calendarDateString.parse(date)).toBe(date);
  });

  it.each([
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00'
  ])('rejects an impossible calendar date: %s', (date) => {
    expect(calendarDateString.safeParse(date).success).toBe(false);
  });

  it.each([
    '12/07/2026',
    '2026-7-12',
    '26-07-12',
    '',
    'today'
  ])('rejects an invalid date format: %s', (date) => {
    expect(calendarDateString.safeParse(date).success).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(
      calendarDateString.parse(' 2026-07-12 ')
    ).toBe('2026-07-12');
  });
});

describe('logFoodInputSchema', () => {
  it('validates a complete logging input', () => {
    expect(logFoodInputSchema.parse(validInput)).toEqual(
      validInput
    );
  });

  it.each(portionKinds)(
    'accepts the %s portion kind',
    (portionKind) => {
      expect(
        logFoodInputSchema.safeParse({
          ...validInput,
          portionKind
        }).success
      ).toBe(true);
    }
  );

  it.each(mealSlots)(
    'accepts the %s meal slot',
    (mealSlot) => {
      expect(
        logFoodInputSchema.safeParse({
          ...validInput,
          mealSlot
        }).success
      ).toBe(true);
    }
  );

  it.each([
    '0',
    '0.000',
    '-1',
    '1.2345'
  ])('rejects an invalid portion count: %s', (portionCount) => {
    expect(
      logFoodInputSchema.safeParse({
        ...validInput,
        portionCount
      }).success
    ).toBe(false);
  });

  it('rejects an unsupported portion kind', () => {
    expect(
      logFoodInputSchema.safeParse({
        ...validInput,
        portionKind: 'slice'
      }).success
    ).toBe(false);
  });

  it('rejects an unsupported meal slot', () => {
    expect(
      logFoodInputSchema.safeParse({
        ...validInput,
        mealSlot: 'supper'
      }).success
    ).toBe(false);
  });

  it('rejects an invalid mutation ID', () => {
    expect(
      logFoodInputSchema.safeParse({
        ...validInput,
        clientMutationId: 'not-a-uuid'
      }).success
    ).toBe(false)
  });

  it('preserves the client mutation ID', () => {
    expect(
      logFoodInputSchema.parse(validInput)
        .clientMutationId
    ).toBe(clientMutationId)
  });
});

