import { expect, test } from './fixtures';

const diaryDate = '2026-07-18';

test('logs an untracked food from search, renames and moves it, then deletes it', async ({ app }) => {
  const { page } = app;
  const foodId = app.createFood({ name: 'Greek yoghurt' });
  app.createDiaryEntry({
    foodId,
    foodName: 'Greek yoghurt',
    diaryDate,
    mealSlot: 'dinner',
    energyMkcal: 500_000
  });

  await page.goto(`/foods?date=${diaryDate}&mealSlot=dinner`);
  await page.getByLabel('Search foods').fill('Boojum');
  await expect(page.getByText('No saved foods match this search.')).toBeVisible();
  await page.getByRole('link', { name: 'Add untracked food' }).click();

  await expect(page).toHaveURL(/\/diary\/untracked\/new\?/);
  await expect(page.getByLabel('What did you eat?')).toHaveValue('Boojum');
  await page.getByRole('button', { name: 'Add to diary' }).click();

  await expect(page).toHaveURL(/\/\?date=2026-07-18&updated=1#dinner$/);
  const dinner = page.locator('section[aria-labelledby="dinner-heading"]');
  await expect(dinner.getByRole('heading', { name: 'Boojum' })).toBeVisible();
  await expect(dinner.getByText('Untracked', { exact: true })).toBeVisible();
  await expect(dinner.getByText('500 kcal', { exact: true })).toBeVisible();
  await expect(page.getByText('1 untracked item not counted')).toBeVisible();
  // Goal 2,000 − 500 consumed: the untracked entry adds nothing.
  await expect(page.getByText('1,500', { exact: true })).toBeVisible();

  expect(app.diaryRows()).toEqual([
    expect.objectContaining({ foodId, untracked: 0, energyMkcal: 500_000 }),
    expect.objectContaining({
      foodId: null,
      foodName: 'Boojum',
      diaryDate,
      mealSlot: 'dinner',
      untracked: 1,
      energyMkcal: 0,
      deletedAt: null
    })
  ]);

  await dinner.getByRole('heading', { name: 'Boojum' }).click();
  await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByLabel('What did you eat?').fill('Boojum burrito bowl');
  await page.getByLabel('Meal').selectOption('snacks');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page).toHaveURL(/#snacks$/);
  const snacks = page.locator('section[aria-labelledby="snacks-heading"]');
  await expect(snacks.getByRole('heading', { name: 'Boojum burrito bowl' })).toBeVisible();
  // A meal holding only untracked entries has no calorie total to show.
  await expect(snacks.getByText(/kcal/)).toHaveCount(0);
  await expect(dinner.getByRole('heading', { name: 'Boojum' })).toHaveCount(0);

  await snacks.getByRole('heading', { name: 'Boojum burrito bowl' }).click();
  await page.getByRole('button', { name: 'Delete entry' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Boojum burrito bowl was removed from this diary.'
  );
  await expect(page.getByText(/untracked items? not counted/)).toHaveCount(0);
  expect(app.diaryRows()[1]).toEqual(expect.objectContaining({
    foodName: 'Boojum burrito bowl',
    mealSlot: 'snacks',
    untracked: 1,
    deletedAt: expect.any(Number)
  }));
});

test('rejects a blank untracked food name without writing a diary entry', async ({ app }) => {
  const { page } = app;
  await page.goto(`/diary/untracked/new?date=${diaryDate}&mealSlot=lunch`);

  const name = page.getByLabel('What did you eat?');
  await name.fill('   ');
  // Bypass the browser's required check to exercise the server action.
  await name.evaluate((input) => input.removeAttribute('required'));
  await page.getByRole('button', { name: 'Add to diary' }).click();

  await expect(page.getByText('Name is required')).toBeVisible();
  expect(app.diaryRows()).toEqual([]);
});
