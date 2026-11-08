import { describe, expect, it } from 'vitest';
import { createBatchInputSchema, readBatchFormData, updateBatchInputSchema } from './batch-input';

const foodId = '11111111-1111-4111-8111-111111111111';
const validCreate = {
  clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Bolognese',
  portionCount: 2,
  items: [{ foodId, amount: '500' }],
  schedule: null
};
const validUpdate = {
  expectedUpdatedAt: '1760000000000',
  name: 'Bolognese',
  portionCount: 2,
  items: [{ foodId, amount: '500' }],
  schedule: { startDate: '2026-11-09', mealSlot: 'lunch' }
};

describe('createBatchInputSchema', () => {
  it('accepts a held batch', () => {
    expect(createBatchInputSchema.safeParse(validCreate).success).toBe(true);
  });

  it('accepts a schedule', () => {
    const result = createBatchInputSchema.safeParse({ ...validCreate, schedule: validUpdate.schedule });
    expect(result.success).toBe(true);
  });

  it('coerces a string portion count', () => {
    const result = createBatchInputSchema.safeParse({ ...validCreate, portionCount: '2' });
    expect(result.success && result.data.portionCount).toBe(2);
  });

  it.each([0, 11, 2.5])('rejects %s portions with a friendly message', (portionCount) => {
    const result = createBatchInputSchema.safeParse({ ...validCreate, portionCount });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.find((issue) => issue.path[0] === 'portionCount')?.message)
      .toBe('Choose between 1 and 10 portions');
  });

  it('accepts the portion bounds 1 and 10', () => {
    expect(createBatchInputSchema.safeParse({ ...validCreate, portionCount: 1 }).success).toBe(true);
    expect(createBatchInputSchema.safeParse({ ...validCreate, portionCount: 10 }).success).toBe(true);
  });

  it('requires at least one item', () => {
    expect(createBatchInputSchema.safeParse({ ...validCreate, items: [] }).success).toBe(false);
  });

  it('allows 30 items but not 31', () => {
    const many = (count: number) => Array.from({ length: count }, () => ({ foodId, amount: '1' }));
    expect(createBatchInputSchema.safeParse({ ...validCreate, items: many(30) }).success).toBe(true);
    expect(createBatchInputSchema.safeParse({ ...validCreate, items: many(31) }).success).toBe(false);
  });

  it('requires a name', () => {
    const result = createBatchInputSchema.safeParse({ ...validCreate, name: '   ' });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe('Name is required');
  });

  it('rejects an invalid schedule date at its path', () => {
    const result = createBatchInputSchema.safeParse({
      ...validCreate,
      schedule: { startDate: '09/11/2026', mealSlot: 'lunch' }
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.some((issue) =>
      issue.path[0] === 'schedule' && issue.path[1] === 'startDate')).toBe(true);
  });

  it('rejects a missing schedule', () => {
    const withoutSchedule: Partial<typeof validCreate> = { ...validCreate };
    delete withoutSchedule.schedule;
    expect(createBatchInputSchema.safeParse(withoutSchedule).success).toBe(false);
  });
});

describe('updateBatchInputSchema', () => {
  it('accepts a valid update', () => {
    expect(updateBatchInputSchema.safeParse(validUpdate).success).toBe(true);
  });

  it('requires a numeric expectedUpdatedAt', () => {
    expect(updateBatchInputSchema.safeParse({ ...validUpdate, expectedUpdatedAt: 'x' }).success).toBe(false);
  });

  it('rejects out-of-range portion counts', () => {
    expect(updateBatchInputSchema.safeParse({ ...validUpdate, portionCount: 0 }).success).toBe(false);
    expect(updateBatchInputSchema.safeParse({ ...validUpdate, portionCount: 11 }).success).toBe(false);
  });
});

describe('readBatchFormData', () => {
  function form(fields: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
  }
  const base = {
    clientMutationId: validCreate.clientMutationId,
    expectedUpdatedAt: '123',
    name: 'Bolognese',
    portionCount: '3',
    itemsJson: JSON.stringify([{ foodId, amount: '500' }])
  };

  it('reads a hold form', () => {
    const data = readBatchFormData(form({ ...base, logMode: 'hold' }));
    expect(data).toMatchObject({
      clientMutationId: validCreate.clientMutationId,
      expectedUpdatedAt: '123',
      name: 'Bolognese',
      items: [{ foodId, amount: '500' }],
      schedule: null
    });
    expect(Number(data.portionCount)).toBe(3);
  });

  it('treats a missing logMode as hold', () => {
    expect(readBatchFormData(form(base)).schedule).toBeNull();
  });

  it('reads a next-days schedule', () => {
    const data = readBatchFormData(form({
      ...base,
      logMode: 'next-days',
      scheduleStartDate: '2026-11-09',
      scheduleMealSlot: 'dinner'
    }));
    expect(data.schedule).toEqual({ startDate: '2026-11-09', mealSlot: 'dinner' });
  });

  it('falls back to no items for invalid JSON', () => {
    expect(readBatchFormData(form({ ...base, itemsJson: '{nope' })).items).toEqual([]);
  });

  it('reports an invalid schedule date at its path', () => {
    const data = readBatchFormData(form({
      ...base,
      logMode: 'next-days',
      scheduleStartDate: 'tomorrow',
      scheduleMealSlot: 'lunch'
    }));
    const result = updateBatchInputSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.some((issue) =>
      issue.path[0] === 'schedule' && issue.path[1] === 'startDate')).toBe(true);
  });
});
