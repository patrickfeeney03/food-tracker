import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BatchPortionsField from './BatchPortionsField.svelte';

const preview = {
  energyMkcal: 1_150_000n,
  proteinMg: 83_000n,
  carbsMg: 105_000n,
  fatMg: 39_750n
};

describe('BatchPortionsField', () => {
  it('offers portion chips 1 to 4 and checks the current count', async () => {
    render(BatchPortionsField, { portionCount: 2, preview });

    await expect.element(page.getByRole('group', { name: 'Portions' })).toBeInTheDocument();
    for (const chip of ['1', '2', '3', '4']) {
      await expect.element(page.getByRole('radio', { name: chip, exact: true })).toBeInTheDocument();
    }
    await expect.element(page.getByRole('radio', { name: '2', exact: true })).toBeChecked();
    await expect.element(page.getByLabelText('Number of portions')).toHaveValue(2);
  });

  it('updates the number input when a chip is chosen', async () => {
    render(BatchPortionsField, { portionCount: 2, preview });

    await page.getByRole('radio', { name: '3', exact: true }).click({ force: true });

    await expect.element(page.getByLabelText('Number of portions')).toHaveValue(3);
    await expect.element(page.getByRole('radio', { name: '3', exact: true })).toBeChecked();
  });

  it('leaves no chip checked for counts above four', async () => {
    render(BatchPortionsField, { portionCount: 2, preview });

    await page.getByLabelText('Number of portions').fill('6');

    await expect.element(page.getByLabelText('Number of portions')).toHaveValue(6);
    for (const chip of ['1', '2', '3', '4']) {
      await expect.element(page.getByRole('radio', { name: chip, exact: true })).not.toBeChecked();
    }
  });

  it('disables chips below the minimum', async () => {
    render(BatchPortionsField, { portionCount: 3, min: 3, preview });

    await expect.element(page.getByRole('radio', { name: '1', exact: true })).toBeDisabled();
    await expect.element(page.getByRole('radio', { name: '2', exact: true })).toBeDisabled();
    await expect.element(page.getByRole('radio', { name: '3', exact: true })).toBeEnabled();
    await expect.element(page.getByLabelText('Number of portions')).toHaveAttribute('min', '3');
  });

  it('shows the per-portion nutrition preview', async () => {
    render(BatchPortionsField, { portionCount: 2, preview });

    await expect.element(page.getByLabelText('Each portion')).toBeInTheDocument();
    await expect.element(page.getByText('1150', { exact: true })).toBeInTheDocument();
  });

  it('shows a dash when there is no preview', async () => {
    render(BatchPortionsField, { portionCount: 2, preview: null });

    await expect.element(page.getByLabelText('Each portion').getByText('—').first()).toBeInTheDocument();
  });

  it('renders an error as an alert', async () => {
    render(BatchPortionsField, {
      portionCount: 2,
      preview: null,
      error: 'Choose between 1 and 10 portions'
    });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Choose between 1 and 10 portions');
  });
});
