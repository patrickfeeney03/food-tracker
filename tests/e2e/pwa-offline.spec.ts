import type { Page } from 'playwright/test';
import { expect, test } from './fixtures';

const diaryDate = '2026-07-18';
const earlierDiaryDate = '2026-07-16';
const foodName = 'Offline test porridge';

async function waitForServiceWorkerControl(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);

  if (await page.evaluate(() => navigator.serviceWorker.controller === null)) {
    await page.reload({ waitUntil: 'networkidle' });
  }

  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.controller !== null)
  ).toBe(true);
}

async function hasSavedSnapshot(
  page: Page,
  userId: string,
  date: string,
  expectedFoodName: string
): Promise<boolean> {
  return page.evaluate(
    ({ userId, date, expectedFoodName }) => new Promise<boolean>((resolve) => {
      const request = indexedDB.open('calorie-tracker-offline');
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['users', 'diary-days'], 'readonly');
        const userRequest = transaction.objectStore('users').get(userId);
        const diaryRequest = transaction.objectStore('diary-days').get([userId, date]);

        transaction.oncomplete = () => {
          const hasFood = userRequest.result?.foods?.some(
            (food: { name?: string }) => food.name === expectedFoodName
          ) === true;
          const hasDiaryEntry = Object.values(
            diaryRequest.result?.diary?.meals ?? {}
          ).some((meal) => {
            return (meal as { entries?: Array<{ foodName?: string }> }).entries?.some(
              (entry) => entry.foodName === expectedFoodName
            ) === true;
          });

          database.close();
          resolve(hasFood && hasDiaryEntry);
        };
        transaction.onerror = () => {
          database.close();
          resolve(false);
        };
      };
    }),
    { userId, date, expectedFoodName }
  );
}

async function queuedChangeCount(
  page: Page,
  userId: string
): Promise<number> {
  return page.evaluate(
    (userId) => new Promise<number>((resolve) => {
      const request = indexedDB.open('calorie-tracker-offline');
      request.onerror = () => resolve(-1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('outbox', 'readonly');
        const queued = transaction.objectStore('outbox').getAll();

        transaction.oncomplete = () => {
          const count = queued.result.filter(
            (mutation: { userId?: string }) => mutation.userId === userId
          ).length;
          database.close();
          resolve(count);
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

async function hasSavedDiaryDate(
  page: Page,
  userId: string,
  date: string
): Promise<boolean> {
  return page.evaluate(
    ({ userId, date }) => new Promise<boolean>((resolve) => {
      const request = indexedDB.open('calorie-tracker-offline');
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('diary-days', 'readonly');
        const diaryRequest = transaction.objectStore('diary-days').get([userId, date]);

        transaction.oncomplete = () => {
          database.close();
          resolve(diaryRequest.result !== undefined);
        };
        transaction.onerror = () => {
          database.close();
          resolve(false);
        };
      };
    }),
    { userId, date }
  );
}

test('keeps the familiar UI and syncs offline food logs on reconnect', async ({ app }) => {
  const { page, userId } = app;
  const foodId = app.createFood({ name: foodName });
  const nestedWorkerRequests: string[] = [];
  const failedAppAssetRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/sw.js') && url.pathname !== '/sw.js') {
      nestedWorkerRequests.push(url.pathname);
    }
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/_app/')) {
      failedAppAssetRequests.push(url.pathname);
    }
  });

  // Register from the app root so the worker owns the whole application scope.
  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await waitForServiceWorkerControl(page);

  await page.goto(`/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`);
  expect(nestedWorkerRequests).toEqual([]);
  await page.getByRole('radio', { name: '100 g' }).locator('..').click();
  await expect(page.getByRole('radio', { name: '100 g' })).toBeChecked();
  await page.getByLabel('Number of portions').fill('1');
  await page.getByRole('button', { name: 'Add to diary' }).click();
  await expect(page).toHaveURL(/\/foods\?/);

  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await expect.poll(
    () => hasSavedSnapshot(page, userId, diaryDate, foodName)
  ).toBe(true);
  await page.goto(`/?date=${earlierDiaryDate}`, { waitUntil: 'networkidle' });
  await expect.poll(
    () => hasSavedDiaryDate(page, userId, earlierDiaryDate)
  ).toBe(true);
  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });

  await page.context().setOffline(true);
  try {
    await page.goto(
      `/foods/${foodId}/log?date=${diaryDate}&mealSlot=breakfast`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page.getByRole('heading', { name: foodName })).toBeVisible();
    await page.getByLabel('Number of portions').fill('2');
    await page.getByRole('button', { name: 'Add to diary' }).click();

    await expect(page).toHaveURL(/\/foods\?/);
    await expect(page.getByText('Offline · 1 change saved on this device.')).toBeVisible();
    await expect(
      page.locator('article').filter({ hasText: foodName }).locator('p')
    ).toContainText('Last: 200 g');
    await page.getByLabel('Search foods').fill('Offline test');
    await expect(page.getByRole('heading', { name: foodName })).toBeVisible();
    await page.getByRole('button', {
      name: `Quick add ${foodName} to breakfast using the last amount`
    }).click();
    await expect(page.getByText('Offline · 2 changes saved on this device.')).toBeVisible();
    await expect.poll(() => queuedChangeCount(page, userId)).toBe(2);

    await page.getByRole('link', { name: 'Back to diary' }).click();
    await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: foodName })).toHaveCount(3);
    await expect(page.getByLabel('Settings are available when online')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Previous saved day' }))
      .toHaveAttribute('href', `/?date=${earlierDiaryDate}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: foodName })).toHaveCount(3);
    expect(failedAppAssetRequests).toEqual([]);

    await page.context().setOffline(false);
    await expect(page.getByText('All changes synced.')).toBeVisible();
    await expect.poll(() => queuedChangeCount(page, userId)).toBe(0);
    await expect.poll(() => app.diaryRows().length).toBe(3);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: foodName })).toHaveCount(3);
  } finally {
    await page.context().setOffline(false);
  }
});

test('asserts zero document/__data requests and tight latency bounds on local offline transitions', async ({ app }) => {
  const { page } = app;
  app.createFood({ name: foodName });

  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await waitForServiceWorkerControl(page);

  await page.context().setOffline(true);

  try {
    const emittedRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (req.isNavigationRequest() || url.includes('__data.json')) {
        emittedRequests.push(url);
      }
    });

    // 1. Diary to Foods
    let start = Date.now();
    await page.locator('a', { hasText: 'Add food' }).first().click();
    await expect(page).toHaveURL(/\/foods\?/);
    await expect(page.getByRole('heading', { name: 'Add food' })).toBeVisible();
    const diaryToFoods = Date.now() - start;
    expect(diaryToFoods).toBeLessThan(1000);

    // 2. Foods to Amount Adjuster
    start = Date.now();
    await page.getByRole('heading', { name: foodName }).click();
    await expect(page).toHaveURL(/\/foods\/[^/]+\/log\?/);
    const foodsToAmount = Date.now() - start;
    expect(foodsToAmount).toBeLessThan(1000);

    // 3. Amount Adjuster back to Foods
    start = Date.now();
    await page.getByRole('link', { name: 'Back to foods' }).click();
    await expect(page).toHaveURL(/\/foods\?/);
    const amountToFoods = Date.now() - start;
    expect(amountToFoods).toBeLessThan(1000);

    // 4. Foods back to Diary
    start = Date.now();
    await page.getByRole('link', { name: 'Back to diary' }).click();
    await expect(page).toHaveURL(/\/\?date=/);
    const foodsToDiary = Date.now() - start;
    expect(foodsToDiary).toBeLessThan(1000);

    // 5. Saved-date navigation
    start = Date.now();
    await page.getByRole('link', { name: 'Previous saved day' }).click();
    await expect(page).toHaveURL(new RegExp(`\\/\\?date=${earlierDiaryDate}`));
    const dateNav = Date.now() - start;
    expect(dateNav).toBeLessThan(1000);

    // 6. Back/Forward
    start = Date.now();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`\\/\\?date=${diaryDate}`));
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`\\/\\?date=${earlierDiaryDate}`));
    const historyNav = Date.now() - start;
    expect(historyNav).toBeLessThan(1000);

    // Zero document / __data.json requests emitted during local transitions
    expect(emittedRequests).toEqual([]);
  } finally {
    await page.context().setOffline(false);
  }
});

test('asserts fast cold entry when genuinely offline and 2-second cap when network is stalled', async ({ app }) => {
  const { page } = app;
  await page.goto(`/?date=${diaryDate}`, { waitUntil: 'networkidle' });
  await waitForServiceWorkerControl(page);

  // 1. Cold entry when genuinely offline (< 1500ms)
  await page.context().setOffline(true);
  try {
    const start = Date.now();
    await page.goto('/offline', { waitUntil: 'domcontentloaded' });
    const coldOfflineDuration = Date.now() - start;
    await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();
    expect(coldOfflineDuration).toBeLessThan(1500);
  } finally {
    await page.context().setOffline(false);
  }

  // 2. Cold entry when network is black-holed / stalled (~2000ms cap)
  await page.route('**/*', async (route) => {
    // Delay network requests to emulate black-hole connection
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await route.abort('timedout');
  });

  const startStalled = Date.now();
  await page.goto('/offline', { waitUntil: 'domcontentloaded' });
  const stalledDuration = Date.now() - startStalled;
  await expect(page.getByRole('heading', { name: 'Daily energy' })).toBeVisible();
  // Bound around 2 seconds (with 1.5s tolerance for test execution)
  expect(stalledDuration).toBeLessThan(3500);
});
