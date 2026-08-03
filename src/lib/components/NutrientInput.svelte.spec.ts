import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NutrientInput from './NutrientInput.svelte';

describe('NutrientInput', () => {
  it('accepts 7000 mg of sodium', async () => {
    render(NutrientInput, {
      id: 'sodiumMg',
      label: 'Sodium',
      unit: 'mg',
      value: '',
      max: 50_000,
      step: '1'
    });
    const input = page.getByLabelText('Sodium');

    await input.fill('7000');

    expect((input.element() as HTMLInputElement).checkValidity()).toBe(true);
    await expect.element(input).not.toHaveAttribute('aria-invalid');
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });

  it('shows and clears inline browser-validation feedback', async () => {
    render(NutrientInput, {
      id: 'sodiumMg',
      label: 'Sodium',
      unit: 'mg',
      value: '',
      max: 50_000,
      step: '1'
    });
    const input = page.getByLabelText('Sodium');

    await input.fill('50001');

    await expect.element(input).toHaveAttribute('aria-invalid', 'true');
    await expect.element(page.getByRole('alert')).toHaveTextContent(
      'Must be at most 50000 mg.'
    );

    await input.fill('7000');

    await expect.element(input).not.toHaveAttribute('aria-invalid');
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });
});
