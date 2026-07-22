import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';

test('downloads owned JSON and diary CSV exports from settings', async ({ app }) => {
  const { db, page, userId } = app;
  const foodId = app.createFood({ name: 'Exported yoghurt' });
  const now = Date.now();

  db.prepare(`
    INSERT INTO diary_logs (
      id, user_id, food_id, diary_date, meal_slot,
      client_mutation_id, client_request_fingerprint,
      food_name, food_brand, amount_unit, basis_amount,
      energy_mkcal_per_basis, protein_mg_per_basis,
      carbs_mg_per_basis, fat_mg_per_basis,
      additional_nutrition_per_basis_json,
      portion_kind, portion_label, portion_amount, portion_count_milli,
      resolved_amount, energy_mkcal, protein_mg, carbs_mg, fat_mg,
      additional_nutrition_total_json, logged_at, created_at, updated_at, deleted_at
    ) VALUES (
      ?, ?, ?, '2026-07-20', 'breakfast',
      ?, '',
      'Exported yoghurt', 'E2E Dairy', 'mg', 100000,
      62000, 10000, 4000, 500,
      NULL,
      'serving', 'Serving', 125000, 1000,
      125000, 77500, 12500, 5000, 625,
      NULL, ?, ?, ?, NULL
    )
  `).run(randomUUID(), userId, foodId, randomUUID(), now, now, now);

  await page.goto('/settings');
  await page.getByRole('link', { name: /Export data/ }).click();

  await expect(page).toHaveURL(/\/settings\/export$/);
  await expect(page.getByRole('heading', { name: 'Export data' })).toBeVisible();

  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download JSON' }).click()
  ]);
  expect(jsonDownload.suggestedFilename()).toMatch(
    /^calorie-tracker-data-\d{4}-\d{2}-\d{2}\.json$/
  );
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).not.toBeNull();
  const json = JSON.parse(await readFile(jsonPath!, 'utf8'));
  expect(json).toMatchObject({
    formatVersion: 1,
    timezone: 'Europe/Dublin',
    account: { id: userId }
  });
  expect(json.foods).toEqual([
    expect.objectContaining({ id: foodId, name: 'Exported yoghurt' })
  ]);
  expect(json.diaryEntries).toEqual([
    expect.objectContaining({ diaryDate: '2026-07-20', meal: 'breakfast' })
  ]);

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download CSV' }).click()
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(
    /^calorie-tracker-diary-\d{4}-\d{2}-\d{2}\.csv$/
  );
  const csvPath = await csvDownload.path();
  expect(csvPath).not.toBeNull();
  const csv = await readFile(csvPath!, 'utf8');
  expect(csv).toContain('diary_date,meal,food_name');
  expect(csv).toContain(
    '2026-07-20,Breakfast,Exported yoghurt,E2E Dairy,serving,Serving,1,125,g,77.5,12.5,5,0.625'
  );

  const jsonResponse = await page.request.get('/settings/export/json');
  expect(jsonResponse.headers()['content-type']).toBe('application/json; charset=utf-8');
  expect(jsonResponse.headers()['cache-control']).toBe('private, no-store');
  expect(jsonResponse.headers()['x-content-type-options']).toBe('nosniff');

  const csvResponse = await page.request.get('/settings/export/csv');
  expect(csvResponse.headers()['content-type']).toBe('text/csv; charset=utf-8');
  expect(csvResponse.headers()['cache-control']).toBe('private, no-store');
  expect(csvResponse.headers()['x-content-type-options']).toBe('nosniff');
});
