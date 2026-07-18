import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  mealShortcutItems,
  mealShortcuts,
  users,
  type Food
} from '$lib/server/db/schema';
import { createFoodAndLog } from './create-food-and-log';
import {
  archiveFood,
  FoodBarcodeConflictError,
  FoodAmountUnitConflictError,
  FoodEditConflictError,
  FoodNotFoundError,
  formatFoodForEdit,
  getActiveFoodForEdit,
  updateFood
} from './edit-food';
import { listActiveFoods } from './food-catalogue';

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(join(tmpdir(), 'calories-edit-food-'));
  const connection = createDatabase(join(directory, 'test.db'));

  try {
    migrate(connection.db, { migrationsFolder: 'drizzle' });
    run(connection);
  } finally {
    connection.client.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function insertUser(connection: DatabaseConnection, email: string): string {
  return connection.db
    .insert(users)
    .values({ name: email.split('@')[0], email })
    .returning({ id: users.id })
    .get().id;
}

function insertFood(
  connection: DatabaseConnection,
  userId: string,
  overrides: Partial<typeof foods.$inferInsert> = {}
): Food {
  return connection.db
    .insert(foods)
    .values({
      userId,
      name: 'Original food',
      brand: 'Original brand',
      barcode: '000111222333',
      amountUnit: 'mg',
      basisAmount: 100_000,
      servingAmount: 125_500,
      containerAmount: 500_000,
      energyMkcalPerBasis: 245_750,
      proteinMgPerBasis: 12_500,
      carbsMgPerBasis: 30_250,
      fatMgPerBasis: 7_125,
      additionalNutritionJson: {
        fibreMg: 2_500,
        sugarMg: 4_250,
        saturatedFatMg: 1_500,
        sodiumMg: 95,
        potassiumMg: 210
      },
      notes: 'Original note',
      updatedAt: new Date('2026-07-18T10:00:00.000Z'),
      ...overrides
    })
    .returning()
    .get();
}

describe('food editing', () => {
  it('formats every stored field for the edit form without fixed-point drift', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);

      expect(formatFoodForEdit(food)).toEqual({
        name: 'Original food',
        brand: 'Original brand',
        barcode: '000111222333',
        amountUnit: 'mg',
        basisAmount: '100',
        servingAmount: '125.5',
        containerAmount: '500',
        energyKcal: '245.75',
        proteinG: '12.5',
        carbsG: '30.25',
        fatG: '7.125',
        fibreG: '2.5',
        sugarG: '4.25',
        saturatedFatG: '1.5',
        sodiumMg: '95',
        potassiumMg: '210',
        notes: 'Original note',
        expectedUpdatedAt: String(food.updatedAt.getTime())
      });
    });
  });

  it('updates all core fields and maps additional nutrition', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);
      const createdAt = food.createdAt;

      const updated = updateFood(connection.db, userId, food.id, {
        ...formatFoodForEdit(food),
        name: 'Updated drink',
        brand: 'New brand',
        barcode: '999888777666',
        amountUnit: 'ul',
        basisAmount: '330.125',
        servingAmount: '165.5',
        containerAmount: '990.375',
        energyKcal: '123.456',
        proteinG: '4.125',
        carbsG: '18.75',
        fatG: '3.5',
        fibreG: '1.25',
        sugarG: '8.75',
        saturatedFatG: '2.125',
        sodiumMg: '101',
        potassiumMg: '234',
        notes: 'Updated note'
      });

      expect(updated).toMatchObject({
        id: food.id,
        userId,
        name: 'Updated drink',
        brand: 'New brand',
        barcode: '999888777666',
        amountUnit: 'ul',
        basisAmount: 330_125,
        servingAmount: 165_500,
        containerAmount: 990_375,
        energyMkcalPerBasis: 123_456,
        proteinMgPerBasis: 4_125,
        carbsMgPerBasis: 18_750,
        fatMgPerBasis: 3_500,
        additionalNutritionJson: {
          fibreMg: 1_250,
          sugarMg: 8_750,
          saturatedFatMg: 2_125,
          sodiumMg: 101,
          potassiumMg: 234
        },
        notes: 'Updated note',
        createdAt,
        deletedAt: null
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(food.updatedAt.getTime());
    });
  });

  it('turns cleared optional values into null', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);

      const updated = updateFood(connection.db, userId, food.id, {
        ...formatFoodForEdit(food),
        brand: '',
        barcode: '',
        servingAmount: '',
        containerAmount: '',
        fibreG: '',
        sugarG: '',
        saturatedFatG: '',
        sodiumMg: '',
        potassiumMg: '',
        notes: ''
      });

      expect(updated).toMatchObject({
        brand: null,
        barcode: null,
        servingAmount: null,
        containerAmount: null,
        additionalNutritionJson: null,
        notes: null
      });
    });
  });

  it('prevents changing between g and ml while any meal shortcut references the food', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);
      const shortcut = connection.db.insert(mealShortcuts).values({
        userId,
        name: 'Referenced meal'
      }).returning().get();
      connection.db.insert(mealShortcutItems).values({
        userId,
        shortcutId: shortcut.id,
        foodId: food.id,
        amountUnit: food.amountUnit,
        position: 0,
        defaultAmount: 100_000,
        defaultPortionKind: 'hundred',
        defaultPortionLabel: '100 g',
        defaultPortionAmount: 100_000,
        defaultPortionCountMilli: 1_000
      }).run();

      expect(() => updateFood(connection.db, userId, food.id, {
        ...formatFoodForEdit(food),
        amountUnit: 'ul'
      })).toThrow(FoodAmountUnitConflictError);

      connection.db.update(mealShortcuts).set({ deletedAt: new Date() })
        .where(eq(mealShortcuts.id, shortcut.id)).run();
      expect(() => updateFood(connection.db, userId, food.id, {
        ...formatFoodForEdit(food),
        amountUnit: 'ul'
      })).toThrow(FoodAmountUnitConflictError);
      expect(getActiveFoodForEdit(connection.db, userId, food.id)?.amountUnit).toBe('mg');
    });
  });

  it('isolates ownership and treats missing or archived foods as not found', () => {
    withMigratedDatabase((connection) => {
      const ownerId = insertUser(connection, 'owner@example.com');
      const otherId = insertUser(connection, 'other@example.com');
      const food = insertFood(connection, ownerId);
      const input = formatFoodForEdit(food);

      expect(getActiveFoodForEdit(connection.db, otherId, food.id)).toBeUndefined();
      expect(getActiveFoodForEdit(connection.db, ownerId, 'missing')).toBeUndefined();
      expect(() => updateFood(connection.db, otherId, food.id, input)).toThrow(FoodNotFoundError);

      connection.db
        .update(foods)
        .set({ deletedAt: new Date('2026-07-18T11:00:00Z') })
        .where(eq(foods.id, food.id))
        .run();

      expect(getActiveFoodForEdit(connection.db, ownerId, food.id)).toBeUndefined();
      expect(() => updateFood(connection.db, ownerId, food.id, input)).toThrow(FoodNotFoundError);
    });
  });

  it('returns a specific barcode collision and leaves both foods unchanged', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);
      const other = insertFood(connection, userId, {
        name: 'Other food',
        barcode: '444555666777'
      });

      expect(() =>
        updateFood(connection.db, userId, food.id, {
          ...formatFoodForEdit(food),
          name: 'Should not save',
          barcode: other.barcode
        })
      ).toThrow(FoodBarcodeConflictError);

      expect(getActiveFoodForEdit(connection.db, userId, food.id)).toMatchObject({
        name: 'Original food',
        barcode: '000111222333'
      });
    });
  });

  it('rejects a stale optimistic-concurrency version', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);
      const staleInput = formatFoodForEdit(food);

      updateFood(connection.db, userId, food.id, {
        ...staleInput,
        name: 'First update wins'
      });

      expect(() =>
        updateFood(connection.db, userId, food.id, {
          ...staleInput,
          name: 'Stale overwrite'
        })
      ).toThrow(FoodEditConflictError);
      expect(getActiveFoodForEdit(connection.db, userId, food.id)?.name).toBe('First update wins');
    });
  });

  it('soft-archives an owned active food and removes it from listActiveFoods', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);

      const archived = archiveFood(
        connection.db,
        userId,
        food.id,
        String(food.updatedAt.getTime())
      );

      expect(archived.deletedAt).toBeInstanceOf(Date);
      expect(connection.db.select().from(foods).where(eq(foods.id, food.id)).get()).toBeDefined();
      expect(getActiveFoodForEdit(connection.db, userId, food.id)).toBeUndefined();
      expect(listActiveFoods(connection.db, userId, '')).toEqual([]);
      expect(() =>
        archiveFood(connection.db, userId, food.id, String(archived.updatedAt.getTime()))
      ).toThrow(FoodNotFoundError);
    });
  });

  it('does not change an existing diary snapshot when the reusable food is edited or archived', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const created = createFoodAndLog(
        connection.db,
        userId,
        {
          name: 'Historical oats',
          brand: 'Old brand',
          amountUnit: 'mg',
          basisAmount: '100',
          servingAmount: '40',
          energyKcal: '380',
          proteinG: '13',
          carbsG: '67',
          fatG: '7',
          fibreG: '10'
        },
        {
          clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
          portionKind: 'serving',
          portionCount: '1.5',
          diaryDate: '2026-07-18',
          mealSlot: 'breakfast'
        }
      );
      const snapshotBefore = connection.db
        .select()
        .from(diaryLogs)
        .where(eq(diaryLogs.id, created.diaryLog.id))
        .get();

      const updated = updateFood(connection.db, userId, created.food.id, {
        ...formatFoodForEdit(created.food),
        name: 'Future oats',
        brand: 'New brand',
        basisAmount: '50',
        servingAmount: '30',
        energyKcal: '999',
        proteinG: '1',
        carbsG: '2',
        fatG: '3',
        fibreG: '4'
      });

      expect(
        connection.db.select().from(diaryLogs).where(eq(diaryLogs.id, created.diaryLog.id)).get()
      ).toEqual(snapshotBefore);

      archiveFood(connection.db, userId, updated.id, String(updated.updatedAt.getTime()));

      expect(
        connection.db.select().from(diaryLogs).where(eq(diaryLogs.id, created.diaryLog.id)).get()
      ).toEqual(snapshotBefore);
      expect(snapshotBefore).toMatchObject({
        foodName: 'Historical oats',
        foodBrand: 'Old brand',
        basisAmount: 100_000,
        portionKind: 'serving',
        portionAmount: 40_000,
        resolvedAmount: 60_000,
        energyMkcalPerBasis: 380_000,
        energyMkcal: 228_000
      });
    });
  });
});
