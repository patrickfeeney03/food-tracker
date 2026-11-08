import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BatchResultList from './BatchResultList.svelte';
import type { BatchResult } from './types';

const batch: BatchResult = {
  id: 'batch-1',
  name: 'Work chili',
  portionCount: 2,
  loggedCount: 0,
  remainingCount: 2,
  itemCount: 2,
  blocked: false,
  perPortionEnergyMkcal: 1_150_000,
  lastPortionDate: null
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    active: [batch],
    recent: [] as BatchResult[],
    selectedDate: '2026-07-18',
    mealSlot: 'lunch' as const,
    editHref: (id: string) => `/batches/${id}/edit`,
    applyHref: (id: string) => `/meal-shortcuts/${id}/apply`,
    newBatchHref: '/batches/new?date=2026-07-18&mealSlot=lunch',
    cookAgainHref: (id: string) => `/batches/new?from=${id}`,
    ...overrides
  };
}

describe('BatchResultList', () => {
  it('shows the Batches section with a New batch link', async () => {
    render(BatchResultList, props());

    await expect.element(page.getByRole('heading', { name: 'Batches' })).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: /New batch/ })).toHaveAttribute(
      'href',
      '/batches/new?date=2026-07-18&mealSlot=lunch'
    );
  });

  it('opens the editor from the name and adds one portion with plus', async () => {
    render(BatchResultList, props());

    await expect.element(page.getByRole('link', { name: 'Edit batch Work chili' })).toHaveAttribute(
      'href',
      '/batches/batch-1/edit'
    );
    await expect.element(page.getByText('2 of 2 left · 1,150 kcal per portion')).toBeInTheDocument();

    const button = page.getByRole('button', { name: 'Add a portion of Work chili to lunch' });
    const form = button.element().closest('form');
    expect(form).toHaveAttribute('action', '/meal-shortcuts/batch-1/apply');
    expect(form?.querySelector<HTMLInputElement>('input[name="diaryDate"]')?.value).toBe('2026-07-18');
    expect(form?.querySelector<HTMLInputElement>('input[name="mealSlot"]')?.value).toBe('lunch');
  });

  it('disables plus when no portions are left', async () => {
    render(BatchResultList, props({ active: [{ ...batch, loggedCount: 2, remainingCount: 0 }] }));

    await expect.element(page.getByRole('button', { name: 'No portions of Work chili left' })).toBeDisabled();
  });

  it('blocks apply when a food is unavailable', async () => {
    render(BatchResultList, props({ active: [{ ...batch, blocked: true, perPortionEnergyMkcal: null }] }));

    await expect.element(page.getByText('Contains an unavailable food')).toBeInTheDocument();
    await expect.element(page.getByRole('button', {
      name: 'Add Work chili is unavailable until it is fixed'
    })).toBeDisabled();
  });

  it('lists finished batches under Cooked before with their last day, editor and Cook again links', async () => {
    render(BatchResultList, props({
      active: [],
      recent: [{ ...batch, id: 'old-1', loggedCount: 2, remainingCount: 0, lastPortionDate: '2026-11-09' }]
    }));

    const cookedBefore = page.getByRole('list', { name: 'Cooked before' });
    await expect.element(cookedBefore.getByRole('link', { name: 'Edit batch Work chili' })).toHaveAttribute(
      'href',
      '/batches/old-1/edit'
    );
    await expect.element(cookedBefore.getByText('9 Nov')).toBeInTheDocument();
    await expect.element(cookedBefore.getByRole('link', { name: 'Cook Work chili again' })).toHaveAttribute(
      'href',
      '/batches/new?from=old-1'
    );
  });

  it('shows a finished batch name without an editor link while offline', async () => {
    render(BatchResultList, props({
      active: [],
      recent: [{ ...batch, id: 'old-1', loggedCount: 2, remainingCount: 0, lastPortionDate: '2026-11-09' }],
      editHref: () => null,
      cookAgainHref: () => null
    }));

    const cookedBefore = page.getByRole('list', { name: 'Cooked before' });
    await expect.element(cookedBefore.getByText('Work chili')).toBeInTheDocument();
    await expect.element(cookedBefore.getByRole('link')).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    render(BatchResultList, props({ active: [], recent: [] }));

    await expect.element(page.getByText('No batches yet. Start one while you cook.')).toBeInTheDocument();
  });
});
