import { expect, test } from './fixtures';
import type { Page } from 'playwright/test';

const diaryDate = '2026-07-18';

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function expectSearchParameters(page: Page, expected: Record<string, string>) {
  const url = new URL(page.url());
  for (const [name, value] of Object.entries(expected)) {
    expect(url.searchParams.get(name)).toBe(value);
  }
}

async function addIngredient(page: Page, foodName: string, amount: string) {
  await page.getByRole('button', { name: /Add ingredient/ }).click();
  await page.getByLabel('Search active foods').fill(foodName);
  await page.getByRole('button', { name: new RegExp(foodName) }).click();
  await page.getByLabel('Total amount').last().fill(amount);
}

test('creates a batch while cooking and logs it to the next days', async ({ app }) => {
  const mince = app.createFood({
    name: 'Beef mince',
    energyMkcalPerBasis: 250_000,
    proteinMgPerBasis: 26_000,
    carbsMgPerBasis: 0,
    fatMgPerBasis: 15_000
  });
  const penne = app.createFood({
    name: 'Penne',
    energyMkcalPerBasis: 350_000,
    proteinMgPerBasis: 12_000,
    carbsMgPerBasis: 70_000,
    fatMgPerBasis: 1_500
  });
  const oil = app.createFood({
    name: 'Olive oil',
    energyMkcalPerBasis: 900_000,
    proteinMgPerBasis: 0,
    carbsMgPerBasis: 0,
    fatMgPerBasis: 100_000
  });
  const { page } = app;
  const firstDay = addDays(diaryDate, 1);
  const secondDay = addDays(diaryDate, 2);

  await page.goto(`/foods?date=${diaryDate}&mealSlot=dinner`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: 'Meal shortcuts' }).click();
  await expect(page).toHaveURL(/tab=shortcuts/);
  await page.getByRole('link', { name: /New batch/ }).click();
  await expect(page).toHaveURL(/\/batches\/new/);
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Batch name').fill('Work chili');
  await addIngredient(page, 'Beef mince', '500');
  await addIngredient(page, 'Penne', '300');
  await page.getByRole('radio', { name: '2', exact: true }).locator('..').click();
  await expect(page.getByLabel('Number of portions')).toHaveValue('2');
  await expect(page.getByLabel('Each portion')).toContainText('1150');
  await expect(page.getByRole('radio', { name: 'Add to the next days' })).toBeChecked();
  await expect(page.getByLabel('Starting')).toHaveValue(firstDay);
  await expect(page.getByRole('combobox', { name: 'Meal' })).toHaveValue('lunch');

  await page.getByRole('button', { name: 'Save batch' }).click();

  await expect(page).toHaveURL(/\/batches\/[^/]+\/edit/);
  expectSearchParameters(page, { saved: '1' });
  await expect(page.getByRole('status')).toContainText('Batch saved.');
  const logged = page.getByRole('list', { name: 'Logged portions' });
  await expect(logged.getByRole('listitem')).toHaveCount(2);

  const activeRows = () => app.diaryRows().filter((row) => row.deletedAt === null);
  expect(activeRows()).toHaveLength(4);
  for (const day of [firstDay, secondDay]) {
    const rows = activeRows().filter((row) => row.diaryDate === day);
    expect(rows.map((row) => [row.foodId, row.mealSlot, row.resolvedAmount])).toEqual([
      [mince, 'lunch', 250_000],
      [penne, 'lunch', 150_000]
    ]);
  }

  await page.waitForLoadState('networkidle');
  await addIngredient(page, 'Olive oil', '20');
  await page.getByRole('button', { name: 'Save batch' }).click();
  await expect(page.getByRole('status')).toContainText('Batch saved.');

  expect(activeRows()).toHaveLength(6);
  expect(activeRows().filter((row) => row.foodId === oil).map((row) => row.resolvedAmount)).toEqual([
    10_000,
    10_000
  ]);
  expect(app.diaryRows().filter((row) => row.deletedAt !== null)).toHaveLength(4);

  // Every portion is logged, so the batch is finished even though its days are still ahead.
  await page.goto(`/foods?date=${diaryDate}&mealSlot=dinner&tab=shortcuts`);
  await page.waitForLoadState('networkidle');
  const cookedBefore = page.getByRole('list', { name: 'Cooked before' });
  await expect(cookedBefore.getByText('20 Jul')).toBeVisible();
  await expect(cookedBefore.getByRole('link', { name: 'Cook Work chili again' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Work chili/ })).toHaveCount(0);

  await cookedBefore.getByRole('link', { name: 'Edit batch Work chili' }).click();
  await expect(page).toHaveURL(/\/batches\/[^/]+\/edit/);
  await expect(page.getByRole('list', { name: 'Logged portions' }).getByRole('listitem')).toHaveCount(2);
});

test('logs a held batch portion from Search/Add and undoes it', async ({ app }) => {
  const mince = app.createFood({
    name: 'Beef mince',
    energyMkcalPerBasis: 250_000,
    proteinMgPerBasis: 26_000,
    carbsMgPerBasis: 0,
    fatMgPerBasis: 15_000
  });
  const penne = app.createFood({
    name: 'Penne',
    energyMkcalPerBasis: 350_000,
    proteinMgPerBasis: 12_000,
    carbsMgPerBasis: 70_000,
    fatMgPerBasis: 1_500
  });
  app.createBatch({
    name: 'Work chili',
    portionCount: 2,
    items: [
      { foodId: mince, amount: 500_000 },
      { foodId: penne, amount: 300_000 }
    ]
  });
  const { page } = app;

  await page.goto(`/foods?date=${diaryDate}&mealSlot=lunch&tab=shortcuts`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('2 of 2 left · 1,150 kcal per portion')).toBeVisible();

  await page.getByRole('button', { name: 'Add a portion of Work chili to lunch' }).click();

  await expect(page).not.toHaveURL(/\/foods/);
  expectSearchParameters(page, { date: diaryDate });
  await expect(page.getByRole('status')).toContainText('Work chili was added to this diary.');
  const appliedDiaryUrl = page.url();
  const lunch = page.locator('section[aria-labelledby="lunch-heading"]');
  await expect(lunch.getByRole('heading', { name: 'Beef mince' })).toBeVisible();
  await expect(lunch.getByRole('heading', { name: 'Penne' })).toBeVisible();

  const rows = app.diaryRows().filter((row) => row.deletedAt === null);
  expect(rows.map((row) => [row.foodId, row.diaryDate, row.mealSlot, row.resolvedAmount])).toEqual([
    [mince, diaryDate, 'lunch', 250_000],
    [penne, diaryDate, 'lunch', 150_000]
  ]);

  await page.goto(`/foods?date=${diaryDate}&mealSlot=lunch&tab=shortcuts`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('1 of 2 left · 1,150 kcal per portion')).toBeVisible();

  await page.goto(appliedDiaryUrl);
  await expect(page.getByRole('status')).toContainText('Work chili was added to this diary.');
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  await expect(page.getByRole('status')).toContainText('Work chili was removed from this diary.');
  await expect(lunch.getByRole('heading', { name: 'Beef mince' })).toHaveCount(0);
  const after = app.diaryRows();
  expect(after).toHaveLength(2);
  expect(after.every((row) => row.deletedAt !== null)).toBe(true);
});
