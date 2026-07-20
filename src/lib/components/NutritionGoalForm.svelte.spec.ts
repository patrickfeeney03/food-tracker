import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NutritionGoalForm from './NutritionGoalForm.svelte';

const values = {
  effectiveFrom: '2026-07-18',
  targetEnergyKcal: '2900',
  targetProteinG: '200',
  targetCarbsG: '300',
  targetFatG: '90'
};

describe('NutritionGoalForm', () => {
  it('renders the shared effective-date and nutrition fields', async () => {
    render(NutritionGoalForm, {
      values,
      submitLabel: 'Save targets'
    });

    await expect.element(page.getByLabelText('Effective date')).toHaveValue('2026-07-18');
    await expect.element(page.getByLabelText('Effective date')).not.toHaveAttribute('max');
    await expect.element(page.getByLabelText('Calories')).toHaveValue(2900);
    await expect.element(page.getByLabelText('Calories')).toHaveAttribute('max', '10000');
    await expect.element(page.getByLabelText('Protein')).toHaveAttribute('max', '1000');
    await expect.element(page.getByLabelText('Protein')).toHaveValue(200);
    await expect.element(page.getByLabelText('Carbohydrates')).toHaveValue(300);
    await expect.element(page.getByLabelText('Fat')).toHaveValue(90);
    await expect.element(page.getByRole('button', { name: 'Save targets' })).toBeInTheDocument();
  });

  it('renders shared field and form errors', async () => {
    render(NutritionGoalForm, {
      values,
      submitLabel: 'Confirm goals',
      errors: {
        form: ['Targets could not be saved'],
        targetProteinG: ['Must be a non-negative decimal']
      }
    });

    await expect.element(page.getByText('Targets could not be saved')).toBeInTheDocument();
    await expect.element(page.getByText('Must be a non-negative decimal')).toBeInTheDocument();
    await expect.element(page.getByLabelText('Protein')).toHaveAttribute('aria-invalid', 'true');
  });

  it('only constrains the effective date when a maximum is provided', async () => {
    render(NutritionGoalForm, {
      values,
      submitLabel: 'Confirm goals',
      maxEffectiveDate: '2026-07-18'
    });

    await expect.element(page.getByLabelText('Effective date')).toHaveAttribute(
      'max',
      '2026-07-18'
    );
  });
});
