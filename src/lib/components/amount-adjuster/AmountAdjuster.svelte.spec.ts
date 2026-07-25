import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AmountAdjuster from './AmountAdjuster.svelte';

const food = {
  id: 'food-1',
  name: 'Reusable yoghurt',
  brand: 'Test brand',
  amountUnit: 'mg' as const,
  basisAmount: 100_000,
  energyMkcalPerBasis: 62_000,
  proteinMgPerBasis: 5_000,
  carbsMgPerBasis: 4_000,
  fatMgPerBasis: 3_000
};

const context = {
  date: '2026-07-24',
  mealSlot: 'breakfast' as const,
  q: 'yoghurt'
};

const portionOptions = [
  { kind: 'unit' as const, label: '1 g', amount: 1_000 },
  { kind: 'hundred' as const, label: '100 g', amount: 100_000 }
];

const initialValues = {
  clientMutationId: '84f772df-4e8a-4b88-9ed7-a1664c1b6e6d',
  portionKind: 'hundred' as const,
  portionCount: '2',
  diaryDate: '2026-07-24',
  mealSlot: 'breakfast' as const
};

describe('AmountAdjuster', () => {
  it('keeps its full form contract available to a custom offline submit handler', async () => {
    const submit = vi.fn(({ formData, cancel }) => {
      cancel();
      expect(Object.fromEntries(formData)).toEqual({
        clientMutationId: initialValues.clientMutationId,
        portionKind: 'hundred',
        portionCount: '2',
        diaryDate: '2026-07-24',
        mealSlot: 'breakfast'
      });
    });

    render(AmountAdjuster, {
      props: {
        food,
        context,
        portionOptions,
        initialValues,
        enhanceSubmit: submit
      }
    });

    await expect.element(page.getByRole('heading', { name: 'Add food' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: food.name })).toBeVisible();
    await expect.element(page.getByText('200 g', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add to diary' }).click();

    expect(submit).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('button', { name: 'Add to diary' })).toBeEnabled();
  });
});
