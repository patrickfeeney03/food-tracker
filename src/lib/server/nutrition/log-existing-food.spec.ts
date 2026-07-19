import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '../db/connection';
import { diaryLogs, foods, users } from '../db/schema';
import {
  ExistingFoodLogConflictError,
  ExistingFoodNotFoundError,
  logExistingFood,
  quickAddExistingFood,
  QuickAddUnavailableError
} from './log-existing-food';

function withMigratedDatabase(run: (connection: DatabaseConnection) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'calories-log-existing-food-'));
  const connection = createDatabase(join(directory, 'test.db'));

  try {
    migrate(connection.db, { migrationsFolder: 'drizzle' });
    run(connection);
  } finally {
    connection.client.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function insertUser(
  connection: DatabaseConnection,
  email = 'patrick@example.com'
): string {
  return connection.db
    .insert(users)
    .values({ name: 'Patrick', email })
    .returning({ id: users.id })
    .get().id;
}

function insertFood(
  connection: DatabaseConnection,
  userId: string,
  overrides: Partial<typeof foods.$inferInsert> = {}
) {
  return connection.db
    .insert(foods)
    .values({
      userId,
      name: 'Greek yoghurt',
      brand: 'Test',
      amountUnit: 'mg',
      basisAmount: 100_000,
      servingAmount: 125_000,
      energyMkcalPerBasis: 62_000,
      proteinMgPerBasis: 9_000,
      carbsMgPerBasis: 4_000,
      fatMgPerBasis: 1_500,
      additionalNutritionJson: { fibreMg: 800 },
      ...overrides
    })
    .returning()
    .get();
}

function logInput(overrides: Record<string, unknown> = {}) {
  return {
    clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
    portionKind: 'serving',
    portionCount: '2',
    diaryDate: '2026-07-18',
    mealSlot: 'breakfast',
    ...overrides
  };
}

function quickAddInput(overrides: Record<string, unknown> = {}) {
  return {
    clientMutationId: 'a3b1c2d3-e4f5-4678-9abc-def012345678',
    diaryDate: '2026-07-18',
    mealSlot: 'lunch',
    ...overrides
  };
}

describe('logExistingFood', () => {
  it('logs an active owned food as a complete nutrition snapshot', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);

      const entry = logExistingFood(
        connection.db,
        userId,
        food.id,
        logInput()
      );

      expect(entry).toEqual(
        expect.objectContaining({
          userId,
          foodId: food.id,
          clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
          diaryDate: '2026-07-18',
          mealSlot: 'breakfast',
          foodName: 'Greek yoghurt',
          portionKind: 'serving',
          portionAmount: 125_000,
          portionCountMilli: 2_000,
          resolvedAmount: 250_000,
          energyMkcal: 155_000,
          proteinMg: 22_500,
          carbsMg: 10_000,
          fatMg: 3_750,
          additionalNutritionTotalJson: { fibreMg: 2_000 }
        })
      );
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(1);
    });
  });

  it('does not expose or log another user\'s food', () => {
    withMigratedDatabase((connection) => {
      const ownerId = insertUser(connection);
      const otherUserId = insertUser(connection, 'other@example.com');
      const food = insertFood(connection, ownerId);

      expect(() =>
        logExistingFood(connection.db, otherUserId, food.id, logInput())
      ).toThrow(ExistingFoodNotFoundError);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(0);
    });
  });

  it('rejects an archived food without writing a diary entry', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId, {
        deletedAt: new Date('2026-07-18T12:00:00.000Z')
      });

      expect(() =>
        logExistingFood(connection.db, userId, food.id, logInput())
      ).toThrow(ExistingFoodNotFoundError);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(0);
    });
  });

  it('rejects an unknown food without writing a diary entry', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);

      expect(() =>
        logExistingFood(connection.db, userId, crypto.randomUUID(), logInput())
      ).toThrow(ExistingFoodNotFoundError);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(0);
    });
  });

  it('returns the original diary row for a semantically identical retry', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);
      const first = logExistingFood(connection.db, userId, food.id, logInput());

      const replayed = logExistingFood(
        connection.db,
        userId,
        food.id,
        logInput({ portionCount: '2.000' })
      );

      expect(replayed.id).toBe(first.id);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(1);
    });
  });

  it('allows different users to use the same mutation ID independently', () => {
    withMigratedDatabase((connection) => {
      const firstUserId = insertUser(connection);
      const secondUserId = insertUser(connection, 'other@example.com');
      const firstFood = insertFood(connection, firstUserId);
      const secondFood = insertFood(connection, secondUserId, { barcode: '2' });

      const first = logExistingFood(connection.db, firstUserId, firstFood.id, logInput());
      const second = logExistingFood(connection.db, secondUserId, secondFood.id, logInput());

      expect(second.id).not.toBe(first.id);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(2);
    });
  });

  const mismatches = [
    ['food', { foodId: 'different' }],
    ['date', { diaryDate: '2026-07-19' }],
    ['meal', { mealSlot: 'lunch' }],
    ['portion kind', { portionKind: 'hundred' }],
    ['portion count', { portionCount: '3' }]
  ] as const;

  it.each(mismatches)('rejects a retry with a different %s', (_label, change) => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);
      const original = logExistingFood(connection.db, userId, food.id, logInput());
      const retryFoodId = 'foodId' in change && change.foodId === 'different'
        ? insertFood(connection, userId, { name: 'Banana', barcode: '2' }).id
        : food.id;

      expect(() =>
        logExistingFood(
          connection.db,
          userId,
          retryFoodId,
          logInput(change)
        )
      ).toThrow(ExistingFoodLogConflictError);

      expect(connection.db.select().from(diaryLogs).all()).toEqual([original]);
    });
  });

  it('replays the original entry even if the food is archived after the first write', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);
      const first = logExistingFood(connection.db, userId, food.id, logInput());

      connection.db
        .update(foods)
        .set({ deletedAt: new Date('2026-07-18T13:00:00.000Z') })
        .where(eq(foods.id, food.id))
        .run();

      const replayed = logExistingFood(connection.db, userId, food.id, logInput());

      expect(replayed.id).toBe(first.id);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(1);
    });
  });
});

describe('quickAddExistingFood', () => {
  it('reuses the latest portion representation with the food’s current nutrition', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);
      logExistingFood(connection.db, userId, food.id, logInput());

      connection.db
        .update(foods)
        .set({ energyMkcalPerBasis: 100_000 })
        .where(eq(foods.id, food.id))
        .run();

      const quickAdded = quickAddExistingFood(
        connection.db,
        userId,
        food.id,
        quickAddInput()
      );

      expect(quickAdded).toEqual(expect.objectContaining({
        portionKind: 'serving',
        portionAmount: 125_000,
        portionCountMilli: 2_000,
        resolvedAmount: 250_000,
        energyMkcalPerBasis: 100_000,
        energyMkcal: 250_000,
        mealSlot: 'lunch'
      }));
    });
  });

  it('falls back to the previous exact amount when the serving definition changed', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);
      logExistingFood(connection.db, userId, food.id, logInput());

      connection.db
        .update(foods)
        .set({ servingAmount: 200_000 })
        .where(eq(foods.id, food.id))
        .run();

      const quickAdded = quickAddExistingFood(
        connection.db,
        userId,
        food.id,
        quickAddInput()
      );

      expect(quickAdded).toEqual(expect.objectContaining({
        portionKind: 'unit',
        portionLabel: '1 g',
        portionAmount: 1_000,
        portionCountMilli: 250_000,
        resolvedAmount: 250_000,
        energyMkcal: 155_000
      }));
    });
  });

  it('requires a compatible previous use', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);

      expect(() =>
        quickAddExistingFood(connection.db, userId, food.id, quickAddInput())
      ).toThrow(QuickAddUnavailableError);

      logExistingFood(connection.db, userId, food.id, logInput());
      connection.db
        .update(foods)
        .set({ amountUnit: 'ul' })
        .where(eq(foods.id, food.id))
        .run();

      expect(() =>
        quickAddExistingFood(connection.db, userId, food.id, quickAddInput())
      ).toThrow(QuickAddUnavailableError);
    });
  });

  it('returns the original Quick Add row for an identical retry', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const food = insertFood(connection, userId);
      logExistingFood(connection.db, userId, food.id, logInput());
      const first = quickAddExistingFood(
        connection.db,
        userId,
        food.id,
        quickAddInput()
      );

      const replayed = quickAddExistingFood(
        connection.db,
        userId,
        food.id,
        quickAddInput()
      );

      expect(replayed.id).toBe(first.id);
      expect(connection.db.select().from(diaryLogs).all()).toHaveLength(2);
    });
  });
});
