import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FoodFormFields from './FoodFormFields.svelte';

const values = {
  name: 'Greek yoghurt', brand: 'Dairy Co', barcode: '1234567890123', amountUnit: 'mg',
  basisAmount: '100', servingAmount: '125', containerAmount: '', energyKcal: '62',
  proteinG: '10', carbsG: '4', fatG: '0.5', fibreG: '', sugarG: '', saturatedFatG: '',
  sodiumMg: '', potassiumMg: '', notes: 'Use before Friday'
};

describe('FoodFormFields', () => {
  it('uses the shared display-unit and text limits', async () => {
    render(FoodFormFields, { values });

    await expect.element(page.getByLabelText('Nutrition label basis')).toHaveAttribute('max', '10000');
    await expect.element(page.getByLabelText('Serving')).toHaveAttribute('max', '10000');
    await expect.element(page.getByLabelText('Calories')).toHaveAttribute('max', '10000');
    await expect.element(page.getByLabelText('Protein')).toHaveAttribute('max', '1000');
    await expect.element(page.getByLabelText('Sodium')).toHaveAttribute('max', '50000');
    await expect.element(page.getByLabelText('Barcode (optional)')).toHaveAttribute('maxlength', '200');
    await expect.element(page.getByLabelText('Notes')).toHaveAttribute('maxlength', '2000');
  });

  it('keeps additional nutrition open while entered values refresh the form', async () => {
    const blankValues = {
      ...values,
      fibreG: '',
      sugarG: '',
      saturatedFatG: '',
      sodiumMg: '',
      potassiumMg: '',
      notes: ''
    };
    const rendered = render(FoodFormFields, { values: blankValues });
    const summary = page.getByText('Additional nutrition');
    const fibre = page.getByLabelText('Fibre');

    await summary.click();
    await fibre.fill('3');
    await rendered.rerender({ values: { ...blankValues, fibreG: '3' } });

    const details = summary.element().closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(document.activeElement).toBe(fibre.element());
  });

  it('keeps notes open when an empty form refreshes after focus', async () => {
    const blankValues = { ...values, notes: '' };
    const rendered = render(FoodFormFields, { values: blankValues });
    const notes = page.getByLabelText('Notes');
    const details = notes.element().closest('details') as HTMLDetailsElement;
    const summary = details.querySelector('summary') as HTMLElement;

    summary.click();
    notes.element().focus();
    await rendered.rerender({ values: { ...blankValues } });

    expect(details.open).toBe(true);
    expect(document.activeElement).toBe(notes.element());
  });
});
