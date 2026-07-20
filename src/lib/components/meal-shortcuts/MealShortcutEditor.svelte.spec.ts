import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MealShortcutEditor, {
  type MealShortcutEditorItem,
  type MealShortcutPickerFood
} from './MealShortcutEditor.svelte';

const foods: MealShortcutPickerFood[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Greek yogurt',
    brand: 'Dairy Co',
    amountUnit: 'mg',
    suggestedAmount: 175_000
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Orange juice',
    brand: null,
    amountUnit: 'ul',
    suggestedAmount: 250_000
  }
];

function editableItems(): MealShortcutEditorItem[] {
  return [
    {
      key: 'oats-key',
      itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      foodId: '33333333-3333-4333-8333-333333333333',
      foodName: 'Oats',
      foodBrand: null,
      amountUnit: 'mg',
      amount: '80',
      blocked: false
    },
    {
      key: 'milk-key',
      sourceEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      foodId: '44444444-4444-4444-8444-444444444444',
      foodName: 'Milk',
      foodBrand: 'Farm',
      amountUnit: 'ul',
      amount: '200',
      blocked: false
    }
  ];
}

function wireItems() {
  const input = document.querySelector<HTMLInputElement>('input[name="itemsJson"]');
  return JSON.parse(input?.value ?? '[]') as Array<Record<string, unknown>>;
}

describe('MealShortcutEditor', () => {
  it('preserves the compact wire contract and supports accessible ordering and removal', async () => {
    render(MealShortcutEditor, {
      name: 'Breakfast bowl',
      items: editableItems(),
      availableFoods: foods
    });

    await expect.element(page.getByLabelText('Meal shortcut name')).toHaveValue('Breakfast bowl');
    await expect.element(page.getByLabelText('Meal shortcut name')).toHaveAttribute('maxlength', '200');
    await expect.element(page.getByLabelText('Exact amount').first()).toHaveAttribute('max', '10000');
    expect(wireItems()).toEqual([
      {
        itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        foodId: '33333333-3333-4333-8333-333333333333',
        amount: '80'
      },
      {
        sourceEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        foodId: '44444444-4444-4444-8444-444444444444',
        amount: '200'
      }
    ]);

    await page.getByRole('button', { name: 'Move Oats down' }).click();
    expect(wireItems().map((item) => item.foodId)).toEqual([
      '44444444-4444-4444-8444-444444444444',
      '33333333-3333-4333-8333-333333333333'
    ]);

    await page.getByRole('button', { name: 'Remove Milk' }).click();
    await expect.element(page.getByRole('heading', { name: 'Milk' })).not.toBeInTheDocument();
  });

  it('keeps blocked rows visible until they are replaced with an active food', async () => {
    render(MealShortcutEditor, {
      name: 'Old lunch',
      items: [
        {
          key: 'blocked-key',
          foodId: null,
          foodName: 'Archived soup',
          foodBrand: null,
          amountUnit: null,
          amount: '',
          blocked: true,
          blockedReason: 'This food is archived. Replace or remove it.'
        }
      ],
      availableFoods: foods
    });

    await expect.element(page.getByText('This food is archived. Replace or remove it.')).toBeInTheDocument();
    await expect.element(page.getByText('Replace or remove this row before saving.')).toBeInTheDocument();

    await page.getByRole('button', { name: 'Replace' }).click();
    await page.getByLabelText('Search active foods').fill('orange');
    await expect.element(page.getByRole('button', { name: /Orange juice/ })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /Greek yogurt/ })).not.toBeInTheDocument();
    await page.getByRole('button', { name: /Orange juice/ }).click();

    await expect.element(page.getByRole('heading', { name: 'Orange juice' })).toBeInTheDocument();
    await expect.element(page.getByLabelText('Exact amount')).toHaveValue(250);
    expect(wireItems()[0]).toMatchObject({
      foodId: '22222222-2222-4222-8222-222222222222',
      amount: '250'
    });
  });

  it('adds foods using the picker suggestion and links validation feedback', async () => {
    render(MealShortcutEditor, {
      name: '',
      items: [],
      availableFoods: foods,
      nameError: 'Name is required',
      itemsError: 'Add at least one food'
    });

    await expect.element(page.getByLabelText('Meal shortcut name')).toHaveAttribute(
      'aria-describedby',
      'shortcut-name-error'
    );
    await expect.element(page.getByText('Add at least one food', { exact: true })).toBeInTheDocument();

    await page.getByRole('button', { name: /Add food/ }).click();
    await page.getByRole('button', { name: /Greek yogurt/ }).click();
    await expect.element(page.getByLabelText('Exact amount')).toHaveValue(175);
    expect(wireItems()[0]).toMatchObject({
      foodId: '11111111-1111-4111-8111-111111111111',
      amount: '175'
    });
  });
});
