import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BatchScheduleFields from './BatchScheduleFields.svelte';

const nextDays = {
  remainingCount: 2,
  logMode: 'next-days' as const,
  startDate: '2026-11-09',
  mealSlot: 'lunch' as const
};

describe('BatchScheduleFields', () => {
  it('defaults to adding to the next days with a planned list', async () => {
    render(BatchScheduleFields, nextDays);

    await expect.element(page.getByRole('radio', { name: 'Add to the next days' })).toBeChecked();
    await expect.element(page.getByRole('radio', { name: "Hold — I'll add each one when I eat it" })).not.toBeChecked();
    await expect.element(page.getByRole('radio', { name: 'Add to the next days' })).toHaveAttribute('name', 'logMode');
    await expect.element(page.getByLabelText('Starting')).toHaveValue('2026-11-09');
    await expect.element(page.getByLabelText('Starting')).toHaveAttribute('name', 'scheduleStartDate');
    await expect.element(page.getByLabelText('Meal')).toHaveAttribute('name', 'scheduleMealSlot');
    await expect.element(page.getByLabelText('Meal')).toHaveValue('lunch');

    const planned = page.getByRole('list', { name: 'Planned portions' });
    expect(planned.getByRole('listitem').elements()).toHaveLength(2);
    await expect.element(planned.getByText('9 Nov · Lunch')).toBeInTheDocument();
    await expect.element(planned.getByText('10 Nov · Lunch')).toBeInTheDocument();
  });

  it('updates the planned list when the start date changes', async () => {
    render(BatchScheduleFields, nextDays);

    await page.getByLabelText('Starting').fill('2026-11-20');

    const planned = page.getByRole('list', { name: 'Planned portions' });
    await expect.element(planned.getByText('20 Nov · Lunch')).toBeInTheDocument();
    await expect.element(planned.getByText('21 Nov · Lunch')).toBeInTheDocument();
    await expect.element(planned.getByText('9 Nov · Lunch')).not.toBeInTheDocument();
  });

  it('updates the planned list when the meal changes', async () => {
    render(BatchScheduleFields, nextDays);

    await page.getByLabelText('Meal').selectOptions('dinner');

    const planned = page.getByRole('list', { name: 'Planned portions' });
    await expect.element(planned.getByText('9 Nov · Dinner')).toBeInTheDocument();
    await expect.element(planned.getByText('10 Nov · Dinner')).toBeInTheDocument();
  });

  it('hides the schedule inputs when holding', async () => {
    render(BatchScheduleFields, nextDays);

    await page.getByRole('radio', { name: "Hold — I'll add each one when I eat it" }).click({ force: true });

    await expect.element(page.getByRole('radio', { name: "Hold — I'll add each one when I eat it" })).toBeChecked();
    await expect.element(page.getByLabelText('Starting')).not.toBeInTheDocument();
    await expect.element(page.getByLabelText('Meal')).not.toBeInTheDocument();
    await expect.element(page.getByRole('list', { name: 'Planned portions' })).not.toBeInTheDocument();
  });

  it('lists already logged portions', async () => {
    render(BatchScheduleFields, {
      ...nextDays,
      remainingCount: 1,
      loggedPortions: [{ diaryDate: '2026-11-09', mealSlot: 'lunch' }]
    });

    const logged = page.getByRole('list', { name: 'Logged portions' });
    expect(logged.getByRole('listitem').elements()).toHaveLength(1);
    await expect.element(logged.getByText('9 Nov · Lunch')).toBeInTheDocument();
    expect(page.getByRole('list', { name: 'Planned portions' }).getByRole('listitem').elements()).toHaveLength(1);
  });

  it('shows no log mode when every portion is logged', async () => {
    render(BatchScheduleFields, {
      ...nextDays,
      remainingCount: 0,
      loggedPortions: [
        { diaryDate: '2026-11-09', mealSlot: 'lunch' },
        { diaryDate: '2026-11-10', mealSlot: 'lunch' }
      ]
    });

    await expect.element(page.getByText('All portions are logged.')).toBeInTheDocument();
    await expect.element(page.getByRole('radio')).not.toBeInTheDocument();
    await expect.element(page.getByRole('list', { name: 'Logged portions' })).toBeInTheDocument();
  });

  it('renders an error as an alert', async () => {
    render(BatchScheduleFields, { ...nextDays, error: 'Choose a start date' });

    await expect.element(page.getByRole('alert')).toHaveTextContent('Choose a start date');
  });
});
