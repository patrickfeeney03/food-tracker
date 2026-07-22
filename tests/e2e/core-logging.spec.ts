import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright/test';
import { expect, test } from './fixtures';

const diaryDate = '2026-07-18';

async function fillCoreFoodFields(
  page: Page,
  values: {
    name: string;
    basisAmount: string;
    servingAmount?: string;
    energyKcal: string;
    proteinG: string;
    carbsG: string;
    fatG: string;
  }
) {
  await page.getByLabel('Food name').fill(values.name);
  await page.getByLabel('Nutrition label basis').fill(values.basisAmount);
  if (values.servingAmount !== undefined) {
    await page.locator('#servingAmount').fill(values.servingAmount);
  }
  await page.locator('#energyKcal').fill(values.energyKcal);
  await page.locator('#proteinG').fill(values.proteinG);
  await page.locator('#carbsG').fill(values.carbsG);
  await page.locator('#fatG').fill(values.fatG);
}

async function chooseRadio(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.getByRole('radio', { name }).locator('..').click();
  await expect(page.getByRole('radio', { name })).toBeChecked();
}

function expectSearchParameters(page: Page, expected: Record<string, string>) {
  const url = new URL(page.url());
  for (const [name, value] of Object.entries(expected)) {
    expect(url.searchParams.get(name)).toBe(value);
  }
}

function nextCalendarDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

test('rejects a future effective date for a first goal', async ({ app }) => {
  const { page, db } = app;
  const userId = app.createUser();
  await app.signInAs(userId);

  await page.goto('/goals/setup');
  const effectiveDate = page.getByLabel('Effective date');
  const today = await effectiveDate.getAttribute('max');
  expect(today).not.toBeNull();
  const futureDate = nextCalendarDate(today!);

  await effectiveDate.evaluate((input) => input.removeAttribute('max'));
  await effectiveDate.fill(futureDate);
  await page.getByRole('button', { name: 'Confirm goals' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Your first goal cannot start in the future.'
  );
  expect(db.prepare('SELECT id FROM nutrition_goals WHERE user_id = ?').all(userId)).toEqual([]);
});

test('opens account details from settings and signs out', async ({ app }) => {
  const { page, db, userId } = app;

  await page.goto('/settings');
  await page.getByRole('link', { name: /Account/ }).click();

  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  await expect(page.getByText('Playwright User')).toBeVisible();
  await expect(page.getByText(`e2e-${userId}@example.test`).first()).toBeVisible();
  await expect(page.getByText('Playwright', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  const revoked = db
    .prepare('SELECT revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId) as { revoked_at: number | null } | undefined;
  expect(revoked?.revoked_at).not.toBeNull();
});

test('redirects unauthenticated account access to sign in', async ({ page }) => {
  await page.goto('/settings/account');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('creates a food with an arbitrary basis and logs its serving to the selected meal', async ({ app }) => {
  const { page } = app;
  await page.goto(`/foods?date=${diaryDate}&mealSlot=breakfast`);
  await page.getByRole('link', { name: 'Create a custom food' }).click();
  // Exercise a real change before filling the form so the client-side
  // navigation has hydrated and attached the live-preview handlers.
  await chooseRadio(page, 'Liquid (ml)');
  await chooseRadio(page, 'Solid (g)');

  await fillCoreFoodFields(page, {
    name: '250 g label porridge',
    basisAmount: '250',
    servingAmount: '125',
    energyKcal: '310',
    proteinG: '20',
    carbsG: '50',
    fatG: '6'
  });
  await chooseRadio(page, 'Serving (125 g)');
  await page.getByLabel('Number of portions').fill('2');

  await expect(page.getByText('250 g', { exact: true })).toBeVisible();
  await expect(page.getByLabel('First entry nutrition preview').locator('strong').first())
    .toHaveText('310');
  await page.getByRole('button', { name: 'Save food' }).click();

  await expect(page).toHaveURL(/\/foods\?/);
  expectSearchParameters(page, {
    date: diaryDate,
    mealSlot: 'breakfast',
    created: '1'
  });
  await expect(page.getByRole('status')).toContainText('Food created and added to breakfast.');

  await page.goto(`/?date=${diaryDate}`);
  const breakfast = page.locator('section[aria-labelledby="breakfast-heading"]');
  await expect(breakfast.getByRole('heading', { name: '250 g label porridge' })).toBeVisible();
  await expect(breakfast.getByText('250 g · 310 kcal')).toBeVisible();

  expect(app.diaryRows()).toEqual([
    expect.objectContaining({
      diaryDate,
      mealSlot: 'breakfast',
      foodName: '250 g label porridge',
      basisAmount: 250_000,
      portionKind: 'serving',
      portionAmount: 125_000,
      portionCountMilli: 2_000,
      resolvedAmount: 250_000,
      energyMkcal: 310_000
    })
  ]);
});

test('enforces display-unit nutrition limits in the browser and server action', async ({ app }) => {
  const { page } = app;
  await page.goto(`/foods/new?date=${diaryDate}&mealSlot=breakfast`);
  await page.waitForLoadState('networkidle');
  await fillCoreFoodFields(page, {
    name: 'Over-limit protein food',
    basisAmount: '100',
    servingAmount: '125',
    energyKcal: '200',
    proteinG: '1000.001',
    carbsG: '30',
    fatG: '5'
  });

  const protein = page.getByLabel('Protein');
  expect(
    await protein.evaluate((input) => (input as HTMLInputElement).validity.rangeOverflow)
  ).toBe(true);
  await page.getByRole('button', { name: 'Save food' }).click();
  await expect(page).toHaveURL(/\/foods\/new\?/);
  expect(app.diaryRows()).toHaveLength(0);

  const response = await page.request.post(page.url(), {
    form: {
      clientMutationId: randomUUID(),
      name: 'Over-limit protein food',
      brand: '',
      barcode: '',
      amountUnit: 'mg',
      basisAmount: '100',
      servingAmount: '125',
      containerAmount: '',
      energyKcal: '200',
      proteinG: '1000.001',
      carbsG: '30',
      fatG: '5',
      fibreG: '',
      sugarG: '',
      saturatedFatG: '',
      sodiumMg: '',
      potassiumMg: '',
      notes: '',
      portionKind: 'serving',
      portionCount: '1',
      diaryDate,
      mealSlot: 'breakfast'
    }
  });

  expect(response.status()).toBe(200);
  const failure = await response.json();
  expect(failure).toMatchObject({ type: 'failure', status: 400 });
  expect(failure.data).toContain('Must be at most 1000');
  expect(app.diaryRows()).toHaveLength(0);
});

test('supports fractional liquid servings without normalising the label basis', async ({ app }) => {
  const { page } = app;
  await page.goto(`/foods/new?date=${diaryDate}&mealSlot=snacks`);
  await chooseRadio(page, 'Liquid (ml)');
  await fillCoreFoodFields(page, {
    name: 'Fractional smoothie',
    basisAmount: '250',
    servingAmount: '330.5',
    energyKcal: '200',
    proteinG: '10',
    carbsG: '30',
    fatG: '4'
  });
  await chooseRadio(page, 'Serving (330.5 ml)');
  await page.getByLabel('Number of portions').fill('0.5');

  await expect(page.getByText('165.25 ml', { exact: true })).toBeVisible();
  await expect(page.getByLabel('First entry nutrition preview').locator('strong').first())
    .toHaveText('132.2');
  await page.getByRole('button', { name: 'Save food' }).click();
  await expect(page.getByRole('status')).toContainText('Food created and added to snacks.');

  expect(app.diaryRows()).toEqual([
    expect.objectContaining({
      mealSlot: 'snacks',
      foodName: 'Fractional smoothie',
      amountUnit: 'ul',
      basisAmount: 250_000,
      portionAmount: 330_500,
      portionCountMilli: 500,
      resolvedAmount: 165_250,
      energyMkcal: 132_200
    })
  ]);
});

test('rejects a changed Create Food retry that reuses a mutation ID', async ({ app }) => {
  const { page } = app;
  await page.goto(`/foods/new?date=${diaryDate}&mealSlot=breakfast`);
  const clientMutationId = await page.locator('input[name="clientMutationId"]').inputValue();
  const request = {
    clientMutationId,
    name: 'Retry-safe porridge',
    brand: '',
    barcode: '',
    amountUnit: 'mg',
    basisAmount: '100',
    servingAmount: '125',
    containerAmount: '',
    energyKcal: '200',
    proteinG: '10',
    carbsG: '30',
    fatG: '5',
    fibreG: '',
    sugarG: '',
    saturatedFatG: '',
    sodiumMg: '',
    potassiumMg: '',
    notes: '',
    portionKind: 'serving',
    portionCount: '1',
    diaryDate,
    mealSlot: 'breakfast'
  };

  const first = await page.request.post(page.url(), { form: request });
  const changed = await page.request.post(page.url(), {
    form: { ...request, name: 'Changed retry porridge' }
  });

  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ type: 'redirect', status: 303 });
  expect(changed.status()).toBe(200);
  const failure = await changed.json();
  expect(failure).toMatchObject({ type: 'failure', status: 409 });
  expect(failure.data).toContain(
    'This create-food request was already used with different details. Reload before trying again.'
  );
  expect(app.diaryRows()).toEqual([
    expect.objectContaining({ foodName: 'Retry-safe porridge' })
  ]);
});

test('navigates from the catalogue, logs an existing food, then edits its diary snapshot', async ({ app }) => {
  const foodId = app.createFood({ name: 'Greek yoghurt' });
  const { page } = app;
  await page.goto(`/foods?date=${diaryDate}&mealSlot=breakfast&q=Greek`);
  await page.getByRole('link', { name: 'Add Greek yoghurt to breakfast' }).click();
  await expect(page).toHaveURL(new RegExp(`/foods/${foodId}/log\\?`));

  await chooseRadio(page, 'Serving');
  await page.getByLabel('Number of portions').fill('2');
  await page.getByLabel('Meal').selectOption('dinner');
  await expect(page.getByText('250 g', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to diary' }).click();
  await expect(page).toHaveURL(/\/foods\?/);

  expectSearchParameters(page, {
    date: diaryDate,
    mealSlot: 'dinner',
    added: '1'
  });
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  await expect(page.getByRole('status')).toContainText('Food added to dinner.');

  await page.goto(`/?date=${diaryDate}`);
  const dinner = page.locator('section[aria-labelledby="dinner-heading"]');
  await expect(dinner.getByText('250 g · 155 kcal')).toBeVisible();
  await dinner.getByRole('heading', { name: 'Greek yoghurt' }).click();

  await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeVisible();
  await chooseRadio(page, '100 g');
  await page.getByLabel('Number of portions').fill('0.5');
  await page.getByLabel('Meal').selectOption('snacks');
  await page.getByLabel('Number of portions').press('Enter');

  expectSearchParameters(page, { date: diaryDate, updated: '1' });
  const snacks = page.locator('section[aria-labelledby="snacks-heading"]');
  await expect(snacks.getByRole('heading', { name: 'Greek yoghurt' })).toBeVisible();
  await expect(snacks.getByText('50 g · 31 kcal')).toBeVisible();
  await expect(dinner.getByRole('heading', { name: 'Greek yoghurt' })).toHaveCount(0);

  expect(app.diaryRows()).toEqual([
    expect.objectContaining({
      foodId,
      mealSlot: 'snacks',
      portionKind: 'hundred',
      portionAmount: 100_000,
      portionCountMilli: 500,
      resolvedAmount: 50_000,
      energyMkcal: 31_000
    })
  ]);
});

test('truncates a long unbroken food name inside the dashboard meal card', async ({ app }) => {
  const longName = `LongUnbrokenFoodName${'aW'.repeat(80)}`;
  const foodId = app.createFood({ name: longName });
  const { page } = app;

  await page.setViewportSize({ width: 1458, height: 900 });
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  await chooseRadio(page, '100 g');
  await page.getByLabel('Number of portions').fill('1');
  await page.getByRole('button', { name: 'Add to diary' }).click();
  await expect(page).toHaveURL(/\/foods\?/);

  await page.goto(`/?date=${diaryDate}`);
  const breakfast = page.locator('section[aria-labelledby="breakfast-heading"]');
  const heading = breakfast.getByRole('heading', { name: longName });
  const card = heading.locator('xpath=ancestor::a[1]');

  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('overflow', 'hidden');
  await expect(heading).toHaveCSS('text-overflow', 'ellipsis');
  await expect(heading).toHaveCSS('white-space', 'nowrap');
  await expect.poll(async () => card.evaluate((node) => node.scrollWidth <= node.clientWidth))
    .toBe(true);

  await heading.click();
  await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeVisible();
  const editHeading = page.getByRole('heading', { name: longName });
  await expect(editHeading).toBeVisible();
  await expect(editHeading).toHaveCSS('overflow', 'hidden');
  await expect(editHeading).toHaveCSS('text-overflow', 'ellipsis');
  await expect(editHeading).toHaveCSS('white-space', 'nowrap');
});

test('shows pending feedback while adding an existing food and restores the form after validation fails', async ({ app }) => {
  const foodId = app.createFood({ name: 'Pending yoghurt' });
  const { page } = app;
  let releaseRequest!: () => void;
  const requestHeld = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  await page.waitForLoadState('networkidle');
  await page.route((url) => url.pathname === `/foods/${foodId}/log`, async (route) => {
    if (route.request().method() === 'POST') {
      await requestHeld;
    }
    await route.continue();
  });

  await page.getByLabel('Number of portions').fill('1');
  await page.locator('input[name="clientMutationId"]').evaluate((input) => {
    (input as HTMLInputElement).value = 'invalid-mutation-id';
  });
  await page.getByRole('button', { name: 'Add to diary' }).click();

  const pendingButton = page.getByRole('button', { name: 'Adding…' });
  await expect(pendingButton).toBeDisabled();
  await expect(pendingButton).toHaveAttribute('aria-busy', 'true');

  releaseRequest();
  await expect(page.getByText('Must be a valid mutation ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to diary' })).toBeEnabled();

  await page.getByLabel('Number of portions').fill('');
  await expect(page.getByRole('button', { name: 'Add to diary' })).toBeDisabled();
});

test('quick adds the latest portion with current nutrition and supports Undo', async ({ app }) => {
  const foodId = app.createFood({ name: 'Quick yoghurt' });
  const { page, db } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  await chooseRadio(page, 'Serving');
  await page.getByLabel('Number of portions').fill('2');
  await page.getByRole('button', { name: 'Add to diary' }).click();
  await expect(page).toHaveURL(/\/foods\?/);

  db.prepare(`
    UPDATE foods
    SET energy_mkcal_per_basis = ?, updated_at = ?
    WHERE id = ?
  `).run(100_000, Date.now(), foodId);
  await page.goto(`/foods?date=${diaryDate}&mealSlot=lunch&q=Quick`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Last: 250 g · 155 kcal')).toBeVisible();

  await page.getByRole('button', {
    name: 'Quick add Quick yoghurt to lunch using the last amount'
  }).click();

  await page.waitForURL(
    (url) => url.pathname === '/foods' && url.searchParams.get('q') === null
  );
  expectSearchParameters(page, { date: diaryDate, mealSlot: 'lunch' });
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  await expect(page.getByRole('status')).toContainText(
    '250 g of Quick yoghurt added to lunch.'
  );
  expect(app.diaryRows()).toEqual(expect.arrayContaining([
    expect.objectContaining({
      foodId,
      mealSlot: 'breakfast',
      portionKind: 'serving',
      portionCountMilli: 2_000,
      resolvedAmount: 250_000,
      energyMkcal: 155_000,
      deletedAt: null
    }),
    expect.objectContaining({
      foodId,
      mealSlot: 'lunch',
      portionKind: 'serving',
      portionCountMilli: 2_000,
      resolvedAmount: 250_000,
      energyMkcal: 250_000,
      deletedAt: null
    })
  ]));

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  await expect(page.getByRole('status')).toContainText(
    'Quick yoghurt was removed from lunch.'
  );
  const rows = app.diaryRows();
  expect(rows.filter((row) => row.deletedAt === null)).toHaveLength(1);
  expect(rows.find((row) => row.mealSlot === 'lunch')?.deletedAt).toEqual(expect.any(Number));
});

test('opens the Amount Adjuster from the plus when a food has no previous use', async ({ app }) => {
  const foodId = app.createFood({ name: 'Never logged food' });
  const { page } = app;
  await page.goto(`/foods?date=${diaryDate}&mealSlot=snacks&q=Never`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('link', { name: 'Choose an amount for Never logged food' }).click();

  await expect(page).toHaveURL(new RegExp(`/foods/${foodId}/log\\?`));
  expectSearchParameters(page, { date: diaryDate, mealSlot: 'snacks', q: 'Never' });
});

test('deletes a diary entry, recalculates the diary, and restores it with Undo', async ({ app }) => {
  const foodId = app.createFood({ name: 'Undoable yoghurt' });
  const { page } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=lunch`);
  await chooseRadio(page, 'Serving');
  await page.getByLabel('Number of portions').fill('1');
  await page.getByRole('button', { name: 'Add to diary' }).click();
  await page.goto(`/?date=${diaryDate}`);

  const lunch = page.locator('section[aria-labelledby="lunch-heading"]');
  await lunch.getByRole('heading', { name: 'Undoable yoghurt' }).click();
  await page.getByRole('button', { name: 'Delete entry' }).click();

  expectSearchParameters(page, { date: diaryDate });
  expect(new URL(page.url()).searchParams.get('entryDeleted')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  await expect(page.getByRole('status')).toContainText(
    'Undoable yoghurt was removed from this diary.'
  );
  await expect(lunch.getByRole('heading', { name: 'Undoable yoghurt' })).toHaveCount(0);
  expect(app.diaryRows()).toEqual([
    expect.objectContaining({
      foodId,
      diaryDate,
      mealSlot: 'lunch',
      deletedAt: expect.any(Number)
    })
  ]);

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  expectSearchParameters(page, { date: diaryDate });
  await expect(page.getByRole('status')).toContainText(
    'Undoable yoghurt was restored to this diary.'
  );
  await expect(lunch.getByRole('heading', { name: 'Undoable yoghurt' })).toBeVisible();
  expect(app.diaryRows()).toEqual([
    expect.objectContaining({
      foodId,
      diaryDate,
      mealSlot: 'lunch',
      deletedAt: null
    })
  ]);
});

test('rejects a serving removed after the form loaded and preserves submitted values', async ({ app }) => {
  const foodId = app.createFood({ name: 'Stale serving food', servingAmount: 80_000 });
  const { page, db } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=lunch`);
  await chooseRadio(page, 'Serving');
  await page.getByLabel('Number of portions').fill('1.5');

  db.prepare('UPDATE foods SET serving_amount = NULL, updated_at = ? WHERE id = ?')
    .run(Date.now(), foodId);
  await page.getByRole('button', { name: 'Add to diary' }).click();

  await expect(page.getByRole('alert')).toHaveText('Food does not define a serving amount');
  await expect(page.getByLabel('Number of portions')).toHaveValue('1.5');
  await expect(page.getByRole('heading', { name: 'Stale serving food' })).toBeVisible();
  expect(app.diaryRows()).toEqual([]);
});

test('rejects a container removed after the form loaded and preserves submitted values', async ({ app }) => {
  const foodId = app.createFood({ name: 'Stale container food', containerAmount: 500_000 });
  const { page, db } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=dinner`);
  await chooseRadio(page, 'Container');
  await page.getByLabel('Number of portions').fill('0.75');

  db.prepare('UPDATE foods SET container_amount = NULL, updated_at = ? WHERE id = ?')
    .run(Date.now(), foodId);
  await page.getByRole('button', { name: 'Add to diary' }).click();

  await expect(page.getByRole('alert')).toHaveText('Food does not define a container amount');
  await expect(page.getByLabel('Number of portions')).toHaveValue('0.75');
  await expect(page.getByRole('heading', { name: 'Stale container food' })).toBeVisible();
  expect(app.diaryRows()).toEqual([]);
});

test('replays the same existing-food mutation without creating a duplicate diary row', async ({ app }) => {
  const foodId = app.createFood({ name: 'Retry-safe food' });
  const { page } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=lunch`);
  const clientMutationId = await page.locator('input[name="clientMutationId"]').inputValue();
  const request = {
    clientMutationId,
    q: '',
    portionKind: 'serving',
    portionCount: '1.25',
    diaryDate,
    mealSlot: 'lunch'
  };

  const first = await page.request.post(page.url(), { form: request });
  const replay = await page.request.post(page.url(), { form: request });

  expect(first.status()).toBe(200);
  expect(replay.status()).toBe(200);
  expect(await first.json()).toMatchObject({ type: 'redirect', status: 303 });
  expect(await replay.json()).toMatchObject({ type: 'redirect', status: 303 });
  expect(app.diaryRows()).toEqual([
    expect.objectContaining({
      foodId,
      mealSlot: 'lunch',
      portionKind: 'serving',
      portionCountMilli: 1_250,
      resolvedAmount: 156_250
    })
  ]);
});

test('does not expose or log archived and cross-user foods', async ({ app }) => {
  const otherUserId = app.createUser();
  const otherFoodId = app.createFood({ userId: otherUserId, name: 'Other user food' });
  const archivedFoodId = app.createFood({
    name: 'Archived food',
    deletedAt: Date.now()
  });
  const { page } = app;

  await page.goto(`/foods?date=${diaryDate}&mealSlot=breakfast`);
  await expect(page.getByText('Other user food')).toHaveCount(0);
  await expect(page.getByText('Archived food')).toHaveCount(0);

  for (const foodId of [otherFoodId, archivedFoodId]) {
    const getResponse = await page.goto(
      `/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`
    );
    expect(getResponse?.status()).toBe(404);

    const postResponse = await page.request.post(
      `/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`,
      {
        form: {
          clientMutationId: randomUUID(),
          q: '',
          portionKind: 'hundred',
          portionCount: '1',
          diaryDate,
          mealSlot: 'breakfast'
        },
        maxRedirects: 0
      }
    );
    expect(postResponse.status()).toBe(404);
  }

  expect(app.diaryRows()).toEqual([]);
});
