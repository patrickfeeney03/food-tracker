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

async function queuedDiaryLogCount(page: Page, userId: string): Promise<number> {
  return page.evaluate(
    (userId) => new Promise<number>((resolve) => {
      const request = indexedDB.open('calorie-tracker-offline');
      request.onerror = () => resolve(-1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('outbox', 'readonly');
        const queued = transaction.objectStore('outbox').getAll();

        transaction.oncomplete = () => {
          database.close();
          resolve(queued.result.filter(
            (mutation: { userId?: string }) => mutation.userId === userId
          ).length);
        };
        transaction.onerror = () => {
          database.close();
          resolve(-1);
        };
      };
    }),
    userId
  );
}

async function holdDiaryLogSync(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let notifyStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });

  await page.route('**/api/offline/diary-logs', async (route) => {
    notifyStarted();
    await held;
    await route.continue();
  });

  return { release, started };
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

test('warns before sign out permanently discards an unsynced offline change', async ({ app }) => {
  const { page, db, userId } = app;
  const clientMutationId = randomUUID();

  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await expect.poll(() =>
    page.evaluate(async () => {
      if (!(await indexedDB.databases()).some(
        (database) => database.name === 'calorie-tracker-offline'
      )) {
        return null;
      }

      return new Promise<string | null>((resolve) => {
        const request = indexedDB.open('calorie-tracker-offline');
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const database = request.result;
          const activeUser = database
            .transaction('metadata', 'readonly')
            .objectStore('metadata')
            .get('active-user-id');
          activeUser.onsuccess = () => {
            database.close();
            resolve(activeUser.result?.value ?? null);
          };
          activeUser.onerror = () => {
            database.close();
            resolve(null);
          };
        };
      });
    })
  ).toBe(userId);

  await page.evaluate(
    ({ userId, clientMutationId, diaryDate }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('calorie-tracker-offline');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('outbox', 'readwrite');
          transaction.objectStore('outbox').put({
            userId,
            clientMutationId,
            kind: 'log-existing-food',
            foodId: crypto.randomUUID(),
            input: {
              clientMutationId,
              portionKind: 'hundred',
              portionCount: '1',
              diaryDate,
              mealSlot: 'breakfast'
            },
            createdAt: Date.now(),
            state: 'pending'
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
    { userId, clientMutationId, diaryDate }
  );

  await page.goto('/settings/account', { waitUntil: 'networkidle' });

  const warning = new Promise<string>((resolve) => {
    page.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.dismiss();
    });
  });
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(warning).resolves.toContain(
    'Signing out will permanently discard them.'
  );
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  expect(
    (
      db.prepare(
        'SELECT revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(userId) as { revoked_at: number | null }
    ).revoked_at
  ).toBeNull();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    (
      db.prepare(
        'SELECT revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(userId) as { revoked_at: number | null }
    ).revoked_at
  ).not.toBeNull();
  await expect.poll(() =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('calorie-tracker-offline');
          request.onerror = () => resolve(-1);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(
              ['users', 'outbox', 'metadata'],
              'readonly'
            );
            const users = transaction.objectStore('users').getAll();
            const outbox = transaction.objectStore('outbox').getAll();
            const metadata = transaction.objectStore('metadata').getAll();
            transaction.oncomplete = () => {
              database.close();
              resolve(
                (users.result?.length ?? 0) +
                  (outbox.result?.length ?? 0) +
                  (metadata.result?.length ?? 0)
              );
            };
            transaction.onerror = () => {
              database.close();
              resolve(-1);
            };
          };
        })
    )
  ).toBe(0);
});

test('settings footer sign out also warns and clears offline data', async ({ app }) => {
  const { page, db, userId } = app;
  const clientMutationId = randomUUID();

  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await expect.poll(() =>
    page.evaluate(async () => {
      if (!(await indexedDB.databases()).some(
        (database) => database.name === 'calorie-tracker-offline'
      )) {
        return null;
      }

      return new Promise<string | null>((resolve) => {
        const request = indexedDB.open('calorie-tracker-offline');
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const database = request.result;
          const activeUser = database
            .transaction('metadata', 'readonly')
            .objectStore('metadata')
            .get('active-user-id');
          activeUser.onsuccess = () => {
            database.close();
            resolve(activeUser.result?.value ?? null);
          };
          activeUser.onerror = () => {
            database.close();
            resolve(null);
          };
        };
      });
    })
  ).toBe(userId);

  await page.evaluate(
    ({ userId, clientMutationId, diaryDate }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('calorie-tracker-offline');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('outbox', 'readwrite');
          transaction.objectStore('outbox').put({
            userId,
            clientMutationId,
            kind: 'log-existing-food',
            foodId: crypto.randomUUID(),
            input: {
              clientMutationId,
              portionKind: 'hundred',
              portionCount: '1',
              diaryDate,
              mealSlot: 'breakfast'
            },
            createdAt: Date.now(),
            state: 'pending'
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
    { userId, clientMutationId, diaryDate }
  );

  await page.goto('/settings', { waitUntil: 'networkidle' });

  const warning = new Promise<string>((resolve) => {
    page.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.dismiss();
    });
  });
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(warning).resolves.toContain(
    'Signing out will permanently discard them.'
  );
  await expect(page).toHaveURL(/\/settings$/);
  expect(
    (
      db.prepare(
        'SELECT revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(userId) as { revoked_at: number | null }
    ).revoked_at
  ).toBeNull();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    (
      db.prepare(
        'SELECT revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(userId) as { revoked_at: number | null }
    ).revoked_at
  ).not.toBeNull();
  await expect.poll(() =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('calorie-tracker-offline');
          request.onerror = () => resolve(-1);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(
              ['users', 'outbox', 'metadata'],
              'readonly'
            );
            const users = transaction.objectStore('users').getAll();
            const outbox = transaction.objectStore('outbox').getAll();
            const metadata = transaction.objectStore('metadata').getAll();
            transaction.oncomplete = () => {
              database.close();
              resolve(
                (users.result?.length ?? 0) +
                  (outbox.result?.length ?? 0) +
                  (metadata.result?.length ?? 0)
              );
            };
            transaction.onerror = () => {
              database.close();
              resolve(-1);
            };
          };
        })
    )
  ).toBe(0);
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
  await expect(page.getByRole('status')).toContainText(
    'Food created and added to breakfast.'
  );

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

  await expect(page).toHaveURL(/\/foods\?/);
  await expect(page.getByRole('status')).toContainText(
    'Food created and added to snacks.'
  );

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

test('locally logs a catalogue food, then edits its persisted diary snapshot online', async ({ app }) => {
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
    q: 'Greek'
  });
  expect(new URL(page.url()).searchParams.get('added')).toBeNull();
  await expect.poll(() => app.diaryRows()).toEqual([
    expect.objectContaining({
      foodId,
      mealSlot: 'dinner',
      portionKind: 'serving',
      portionCountMilli: 2_000,
      resolvedAmount: 250_000,
      energyMkcal: 155_000
    })
  ]);

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

test('searches the food catalogue automatically while typing', async ({ app }) => {
  app.createFood({ name: 'Automatic search yoghurt' });
  app.createFood({ name: 'Unrelated porridge' });
  const { page } = app;

  await page.goto(`/foods?date=${diaryDate}&mealSlot=breakfast`);
  await page.waitForLoadState('networkidle');
  const search = page.getByLabel('Search foods');
  await search.pressSequentially('Automatic', { delay: 200 });

  await expect(page).toHaveURL((url) => {
    return url.pathname === '/foods' &&
      url.searchParams.get('date') === diaryDate &&
      url.searchParams.get('mealSlot') === 'breakfast' &&
      url.searchParams.get('q') === 'Automatic';
  });
  await expect(page.getByRole('heading', { name: 'Automatic search yoghurt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unrelated porridge' })).toHaveCount(0);
  await expect(search).toHaveValue('Automatic');
  await expect(search).toBeFocused();

  await search.fill('');
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === null);
  await expect(page.getByRole('heading', { name: 'Unrelated porridge' })).toBeVisible();

  await search.fill('Automatic');
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'Automatic');
  const clearSearch = page.getByRole('link', { name: 'Clear search' });
  const searchBounds = await search.boundingBox();
  const clearSearchBounds = await clearSearch.boundingBox();
  expect(searchBounds).not.toBeNull();
  expect(clearSearchBounds).not.toBeNull();
  expect(clearSearchBounds!.x + clearSearchBounds!.width).toBeLessThanOrEqual(
    searchBounds!.x + searchBounds!.width + 1
  );
  await clearSearch.click();
  await expect(search).toHaveValue('');
  await page.goBack();
  await expect(search).toHaveValue('Automatic');
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'Automatic');
});

test('waits for text composition to finish before searching the food catalogue', async ({ app }) => {
  app.createFood({ name: 'Composition yoghurt' });
  app.createFood({ name: 'Unrelated porridge' });
  const { page } = app;

  await page.goto(`/foods?date=${diaryDate}&mealSlot=breakfast`);
  await page.waitForLoadState('networkidle');
  const search = page.getByLabel('Search foods');

  await search.evaluate((input: HTMLInputElement) => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = 'Composition';
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: 'Composition',
      inputType: 'insertCompositionText',
      isComposing: true
    }));
  });
  await page.waitForTimeout(200);
  await expect(search).toHaveValue('Composition');
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === null);
  await expect(page.getByRole('heading', { name: 'Unrelated porridge' })).toBeVisible();

  await search.evaluate((input: HTMLInputElement) => {
    input.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: 'Composition'
    }));
  });
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === 'Composition');
  await expect(page.getByRole('heading', { name: 'Composition yoghurt' })).toBeVisible();
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

test('validates an existing-food log locally before queueing it', async ({ app }) => {
  const foodId = app.createFood({ name: 'Pending yoghurt' });
  const { page } = app;

  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Number of portions').fill('1');
  await page.locator('input[name="clientMutationId"]').evaluate((input) => {
    (input as HTMLInputElement).value = 'invalid-mutation-id';
  });
  await page.getByRole('button', { name: 'Add to diary' }).click();

  await expect(page.getByText('Must be a valid mutation ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to diary' })).toBeEnabled();
  await page.getByLabel('Number of portions').fill('');
  await expect(page.getByRole('button', { name: 'Add to diary' })).toBeDisabled();
});

test('queues an existing-food log while sync is pending and keeps invalid amounts disabled', async ({ app }) => {
  const foodId = app.createFood({ name: 'Pending yoghurt' });
  const { page, userId } = app;
  const sync = await holdDiaryLogSync(page);

  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Number of portions').fill('');
  await expect(page.getByRole('button', { name: 'Add to diary' })).toBeDisabled();

  await page.getByLabel('Number of portions').fill('1');
  await page.getByRole('button', { name: 'Add to diary' }).click();

  await expect(page).toHaveURL(/\/foods\?/);
  await expect(sync.started).resolves.toBeUndefined();
  await expect(page.getByText('Syncing 1 change…')).toBeVisible();
  await expect.poll(() => queuedDiaryLogCount(page, userId)).toBe(1);

  sync.release();
  await expect.poll(() => queuedDiaryLogCount(page, userId)).toBe(0);
  await expect.poll(() => app.diaryRows()).toEqual([
    expect.objectContaining({ foodId, mealSlot: 'breakfast', resolvedAmount: 100_000 })
  ]);
});

test('quick adds the latest portion with current nutrition through the local queue', async ({ app }) => {
  const foodId = app.createFood({ name: 'Quick yoghurt' });
  const { page, db, userId } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  await chooseRadio(page, 'Serving');
  await page.getByLabel('Number of portions').fill('2');
  await page.getByRole('button', { name: 'Add to diary' }).click();
  await expect(page).toHaveURL(/\/foods\?/);
  await expect.poll(() => app.diaryRows()).toHaveLength(1);

  db.prepare(`
    UPDATE foods
    SET energy_mkcal_per_basis = ?, updated_at = ?
    WHERE id = ?
  `).run(100_000, Date.now(), foodId);
  await page.goto(`/foods?date=${diaryDate}&mealSlot=lunch&q=Quick`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Last: 250 g · 155 kcal')).toBeVisible();

  const sync = await holdDiaryLogSync(page);
  await page.getByRole('button', {
    name: 'Quick add Quick yoghurt to lunch using the last amount'
  }).click();

  expectSearchParameters(page, { date: diaryDate, mealSlot: 'lunch', q: 'Quick' });
  await expect(sync.started).resolves.toBeUndefined();
  await expect(page.getByText('Syncing 1 change…')).toBeVisible();
  await expect.poll(() => queuedDiaryLogCount(page, userId)).toBe(1);

  sync.release();
  await expect.poll(() => queuedDiaryLogCount(page, userId)).toBe(0);
  await expect.poll(() => app.diaryRows()).toEqual(expect.arrayContaining([
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
  await expect.poll(() => app.diaryRows()).toHaveLength(1);
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

test('server action rejects a serving removed after the form loaded', async ({ app }) => {
  const foodId = app.createFood({ name: 'Stale serving food', servingAmount: 80_000 });
  const { page, db } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=lunch`);

  db.prepare('UPDATE foods SET serving_amount = NULL, updated_at = ? WHERE id = ?')
    .run(Date.now(), foodId);

  const response = await page.request.post(page.url(), {
    form: {
      clientMutationId: randomUUID(),
      portionKind: 'serving',
      portionCount: '1.5',
      diaryDate,
      mealSlot: 'lunch'
    }
  });

  expect(response.status()).toBe(200);
  const failure = await response.json();
  expect(failure).toMatchObject({ type: 'failure', status: 400 });
  expect(failure.data).toContain('Food does not define a serving amount');
  expect(failure.data).toContain('"1.5"');
  expect(app.diaryRows()).toEqual([]);
});

test('server action rejects a container removed after the form loaded', async ({ app }) => {
  const foodId = app.createFood({ name: 'Stale container food', containerAmount: 500_000 });
  const { page, db } = app;
  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=dinner`);

  db.prepare('UPDATE foods SET container_amount = NULL, updated_at = ? WHERE id = ?')
    .run(Date.now(), foodId);

  const response = await page.request.post(page.url(), {
    form: {
      clientMutationId: randomUUID(),
      portionKind: 'container',
      portionCount: '0.75',
      diaryDate,
      mealSlot: 'dinner'
    }
  });

  expect(response.status()).toBe(200);
  const failure = await response.json();
  expect(failure).toMatchObject({ type: 'failure', status: 400 });
  expect(failure.data).toContain('Food does not define a container amount');
  expect(failure.data).toContain('"0.75"');
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

test('navigates locally without document or __data requests and handles back/forward', async ({ app }) => {
  const { page } = app;
  const foodName = 'Local Navigation Test Oatmeal';
  app.createFood({ name: foodName });
  const diaryDate = '2026-07-24';

  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();

  const documentOrDataRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.resourceType() === 'document' ||
      url.pathname.includes('/__data.json')
    ) {
      documentOrDataRequests.push(url.pathname + url.search);
    }
  });

  await page.route('**/__data.json*', (route) => route.abort());

  await page.getByRole('link', { name: 'Add food' }).first().click();
  await expect(page).toHaveURL(/\/foods\?/);
  await expect(page.getByRole('heading', { name: 'Add food' })).toBeVisible();
  await expect(page.getByLabel('Search foods')).toBeVisible();

  await page.getByLabel('Search foods').fill(foodName);
  await page.getByRole('heading', { name: foodName }).click();
  await expect(page).toHaveURL(/\/foods\/[^/]+\/log\?/);
  await expect(page.getByRole('heading', { name: foodName })).toBeVisible();

  await page.getByRole('link', { name: 'Back to food catalogue' }).click();
  await expect(page).toHaveURL(/\/foods\?/);
  await page.getByRole('link', { name: 'Back to diary' }).click();
  await expect(page).toHaveURL(/\/\?date=2026-07-24/);
  await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();

  await page.getByRole('link', { name: 'Next day' }).click();
  await expect(page).toHaveURL(/\/\?date=2026-07-25/);
  await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/\?date=2026-07-24/);
  await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/\?date=2026-07-25/);
  await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();

  expect(documentOrDataRequests).toEqual([]);
});
