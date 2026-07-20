import { describe, expect, it } from 'vitest';
import { createMealShortcutInputSchema } from './meal-shortcut-input';

const validInput = {
  clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Breakfast bowl',
  items: [{
    foodId: '11111111-1111-4111-8111-111111111111',
    amount: '80'
  }]
};

describe('createMealShortcutInputSchema', () => {
  it('accepts the maximum display amount', () => {
    expect(createMealShortcutInputSchema.safeParse({
      ...validInput,
      name: 'n'.repeat(200),
      items: [{ ...validInput.items[0], amount: '10000' }]
    }).success).toBe(true);
  });

  it('rejects an amount or name above its limit', () => {
    expect(createMealShortcutInputSchema.safeParse({
      ...validInput,
      items: [{ ...validInput.items[0], amount: '10000.001' }]
    }).success).toBe(false);
    expect(createMealShortcutInputSchema.safeParse({
      ...validInput,
      name: 'n'.repeat(201)
    }).success).toBe(false);
  });
});
