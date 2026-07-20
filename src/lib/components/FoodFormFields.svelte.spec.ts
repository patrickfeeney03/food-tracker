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
    await expect.element(page.getByLabelText('Barcode (optional)')).toHaveAttribute('maxlength', '200');
    await expect.element(page.getByLabelText('Notes')).toHaveAttribute('maxlength', '2000');
  });
});
