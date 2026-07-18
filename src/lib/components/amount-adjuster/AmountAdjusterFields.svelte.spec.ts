import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DiaryDestinationFields from './DiaryDestinationFields.svelte';
import NutritionPreview from './NutritionPreview.svelte';
import PortionBasisSelector from './PortionBasisSelector.svelte';
import PortionQuantityField from './PortionQuantityField.svelte';

const portionOptions = [
  { kind: 'unit' as const, label: '1 g' },
  { kind: 'hundred' as const, label: '100 g' },
  { kind: 'serving' as const, label: 'Serving' }
];

describe('amount adjuster fields', () => {
  it('renders a bound portion-kind radio group with linked validation', async () => {
    render(PortionBasisSelector, {
      options: portionOptions,
      portionKind: 'hundred',
      error: 'Choose an available portion'
    });

    const hundred = page.getByLabelText('100 g');
    const serving = page.getByLabelText('Serving');

    await expect.element(hundred).toBeChecked();
    await expect.element(hundred).toHaveAttribute('name', 'portionKind');
    await expect.element(serving).toHaveAttribute('aria-describedby', 'portion-kind-error');
    await expect.element(page.getByText('Choose an available portion')).toBeInTheDocument();

    await serving.click();
    await expect.element(serving).toBeChecked();
  });

  it('preserves the portion-count field contract and resolved amount feedback', async () => {
    render(PortionQuantityField, {
      portionCount: '1.25',
      portionLabel: '100 g',
      resolvedAmount: '125 g',
      error: 'Enter a positive amount'
    });

    const input = page.getByLabelText('Number of portions');

    await expect.element(input).toHaveValue(1.25);
    await expect.element(input).toHaveAttribute('name', 'portionCount');
    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect.element(input).toHaveAttribute('aria-describedby', 'portion-count-error');
    await expect.element(page.getByText('× 100 g')).toBeInTheDocument();
    await expect.element(page.getByText('125 g')).toBeInTheDocument();

    await input.fill('2.5');
    await expect.element(input).toHaveValue(2.5);
  });

  it('formats the shared live nutrition summary from fixed-point values', async () => {
    render(NutritionPreview, {
      preview: {
        energyMkcal: 342_550n,
        proteinMg: 52_500n,
        carbsMg: 0n,
        fatMg: 12_550n
      },
      energyFractionalDigits: 1
    });

    const preview = page.getByRole('region', { name: 'Nutrition preview' });

    await expect.element(preview).toHaveTextContent('342.6');
    await expect.element(preview).toHaveTextContent('52.5 g');
    await expect.element(preview).toHaveTextContent('0 g');
    await expect.element(preview).toHaveTextContent('12.6 g');
    await expect.element(preview).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps diary destination names, values, options, errors, and logged time', async () => {
    render(DiaryDestinationFields, {
      diaryDate: '2026-07-18',
      mealSlot: 'lunch',
      diaryDateError: 'Choose a valid date',
      loggedAt: '08:12'
    });

    const date = page.getByLabelText('Date');
    const meal = page.getByLabelText('Meal');

    await expect.element(date).toHaveValue('2026-07-18');
    await expect.element(date).toHaveAttribute('name', 'diaryDate');
    await expect.element(date).toHaveAttribute('aria-describedby', 'destination-error');
    await expect.element(meal).toHaveValue('lunch');
    await expect.element(meal).toHaveAttribute('name', 'mealSlot');
    await expect.element(page.getByText('Choose a valid date')).toBeInTheDocument();
    await expect.element(page.getByText('08:12')).toBeInTheDocument();

    await meal.selectOptions('dinner');
    await expect.element(meal).toHaveValue('dinner');
  });
});
