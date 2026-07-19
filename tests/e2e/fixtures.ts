import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { expect, test as base, type Page } from 'playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';
const DATABASE_PATH = resolve(process.cwd(), '.playwright/e2e.db');
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

type FoodSeed = {
  userId?: string;
  name?: string;
  brand?: string | null;
  amountUnit?: 'mg' | 'ul';
  basisAmount?: number;
  servingAmount?: number | null;
  containerAmount?: number | null;
  energyMkcalPerBasis?: number;
  proteinMgPerBasis?: number;
  carbsMgPerBasis?: number;
  fatMgPerBasis?: number;
  deletedAt?: number | null;
};

export type DiaryRow = {
  id: string;
  foodId: string | null;
  diaryDate: string;
  mealSlot: string;
  foodName: string;
  amountUnit: 'mg' | 'ul';
  basisAmount: number;
  portionKind: string;
  portionAmount: number;
  portionCountMilli: number;
  resolvedAmount: number;
  energyMkcal: number;
};

type AuthenticatedApp = {
  page: Page;
  db: Database.Database;
  userId: string;
  createUser: () => string;
  createFood: (seed?: FoodSeed) => string;
  diaryRows: () => DiaryRow[];
};

type Fixtures = {
  app: AuthenticatedApp;
};

function insertUser(db: Database.Database, trackedUserIds: string[], withGoal: boolean): string {
  const userId = randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (id, name, email, settings_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, 'Playwright User', `e2e-${userId}@example.test`, '{}', now, now);

  if (withGoal) {
    db.prepare(`
      INSERT INTO nutrition_goals (
        id, user_id, effective_from, target_energy_mkcal,
        target_protein_mg, target_carbs_mg, target_fat_mg, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId,
      '2000-01-01',
      2_000_000,
      150_000,
      250_000,
      70_000,
      now,
      now
    );
  }

  trackedUserIds.push(userId);
  return userId;
}

function insertFood(db: Database.Database, ownerId: string, seed: FoodSeed = {}): string {
  const foodId = randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO foods (
      id, user_id, name, brand, barcode, amount_unit, basis_amount,
      serving_amount, container_amount, energy_mkcal_per_basis,
      protein_mg_per_basis, carbs_mg_per_basis, fat_mg_per_basis,
      additional_nutrition_json, notes, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
  `).run(
    foodId,
    seed.userId ?? ownerId,
    seed.name ?? 'Greek yoghurt',
    seed.brand ?? 'E2E Dairy',
    seed.amountUnit ?? 'mg',
    seed.basisAmount ?? 100_000,
    seed.servingAmount === undefined ? 125_000 : seed.servingAmount,
    seed.containerAmount ?? null,
    seed.energyMkcalPerBasis ?? 62_000,
    seed.proteinMgPerBasis ?? 10_000,
    seed.carbsMgPerBasis ?? 4_000,
    seed.fatMgPerBasis ?? 500,
    now,
    now,
    seed.deletedAt ?? null
  );
  return foodId;
}

export const test = base.extend<Fixtures>({
  app: async ({ browser }, use) => {
    const db = new Database(DATABASE_PATH);
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
    const trackedUserIds: string[] = [];
    const userId = insertUser(db, trackedUserIds, true);
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    db.prepare(`
      INSERT INTO sessions (
        id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(
      randomUUID(),
      userId,
      createHash('sha256').update(token).digest('hex'),
      now,
      now,
      now + SESSION_DURATION_MS,
      'Playwright'
    );

    const context = await browser.newContext({ baseURL: BASE_URL });
    await context.addCookies([{
      name: 'session',
      value: token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
      secure: false
    }]);
    const page = await context.newPage();

    try {
      await use({
        page,
        db,
        userId,
        createUser: () => insertUser(db, trackedUserIds, false),
        createFood: (seed) => insertFood(db, userId, seed),
        diaryRows: () => db.prepare(`
          SELECT
            id,
            food_id AS foodId,
            diary_date AS diaryDate,
            meal_slot AS mealSlot,
            food_name AS foodName,
            amount_unit AS amountUnit,
            basis_amount AS basisAmount,
            portion_kind AS portionKind,
            portion_amount AS portionAmount,
            portion_count_milli AS portionCountMilli,
            resolved_amount AS resolvedAmount,
            energy_mkcal AS energyMkcal
          FROM diary_logs
          WHERE user_id = ?
          ORDER BY logged_at, id
        `).all(userId) as DiaryRow[]
      });
    } finally {
      await context.close();
      const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
      for (const trackedUserId of trackedUserIds.reverse()) deleteUser.run(trackedUserId);
      db.close();
    }
  }
});

export { expect };
