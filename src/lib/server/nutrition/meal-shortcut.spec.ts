import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  mealShortcutApplications,
  mealShortcutItems,
  mealShortcuts,
  users,
  type Food
} from '$lib/server/db/schema';
import { buildDiaryLogValues } from './diary-entry';
import {
  applyMealShortcut,
  archiveMealShortcut,
  createMealShortcut,
  getMealShortcut,
  listMealShortcuts,
  loadMealShortcutDraft,
  MealShortcutApplicationConflictError,
  MealShortcutBlockedError,
  MealShortcutCreateConflictError,
  MealShortcutNotFoundError,
  undoMealShortcutApplication,
  updateMealShortcut
} from './meal-shortcut';

function withMigratedDatabase(run: (connection: DatabaseConnection) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'calories-meal-shortcut-'));
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
  return connection.db.insert(users).values({ name: email, email }).returning({ id: users.id }).get().id;
}

function insertFood(
  connection: DatabaseConnection,
  userId: string,
  overrides: Partial<typeof foods.$inferInsert> = {}
): Food {
  return connection.db.insert(foods).values({
    userId,
    name: 'Porridge',
    amountUnit: 'mg',
    basisAmount: 100_000,
    servingAmount: 40_000,
    energyMkcalPerBasis: 100_000,
    proteinMgPerBasis: 10_000,
    carbsMgPerBasis: 20_000,
    fatMgPerBasis: 5_000,
    ...overrides
  }).returning().get();
}

function logFood(
  connection: DatabaseConnection,
  food: Food,
  portionKind: 'serving' | 'hundred',
  portionCount: string
) {
  return connection.db.insert(diaryLogs).values(buildDiaryLogValues(food, {
    clientMutationId: crypto.randomUUID(),
    diaryDate: '2026-07-18',
    mealSlot: 'breakfast',
    portionKind,
    portionCount
  })).returning().get();
}

describe('meal shortcuts', () => {
  it('creates an ordered shortcut from diary snapshots and safely replays creation', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);
      const servingEntry = logFood(connection, food, 'serving', '1.5');
      const hundredEntry = logFood(connection, food, 'hundred', '1');
      const mutationId = '11111111-1111-4111-8111-111111111111';
      const input = {
        clientMutationId: mutationId,
        name: 'Breakfast bowl',
        items: [
          { sourceEntryId: servingEntry.id, foodId: food.id, amount: '60' },
          { sourceEntryId: hundredEntry.id, foodId: food.id, amount: '100' }
        ]
      };

      const created = createMealShortcut(connection.db, userId, input);
      const replayed = createMealShortcut(connection.db, userId, input);
      const detail = getMealShortcut(connection.db, userId, created.id);

      expect(replayed.id).toBe(created.id);
      expect(detail.items).toHaveLength(2);
      expect(detail.items.map((item) => ({
        position: item.position,
        foodId: item.foodId,
        amount: item.defaultAmount,
        portionKind: item.defaultPortionKind,
        portionAmount: item.defaultPortionAmount,
        portionCountMilli: item.defaultPortionCountMilli
      }))).toEqual([
        {
          position: 0,
          foodId: food.id,
          amount: 60_000,
          portionKind: 'serving',
          portionAmount: 40_000,
          portionCountMilli: 1_500
        },
        {
          position: 1,
          foodId: food.id,
          amount: 100_000,
          portionKind: 'hundred',
          portionAmount: 100_000,
          portionCountMilli: 1_000
        }
      ]);
      expect(() => createMealShortcut(connection.db, userId, {
        ...input,
        name: 'Different request'
      })).toThrow(MealShortcutCreateConflictError);
      expect(connection.db.select().from(mealShortcuts).all()).toHaveLength(1);
    });
  });

  it('loads repairable drafts and blocks archived shortcut items from catalogue application', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const activeFood = insertFood(connection, userId, { name: 'Active food' });
      const archivedFood = insertFood(connection, userId, { name: 'Archived food' });
      const activeEntry = logFood(connection, activeFood, 'hundred', '1');
      const archivedEntry = logFood(connection, archivedFood, 'serving', '1');
      connection.db.update(foods).set({ deletedAt: new Date() })
        .where(eq(foods.id, archivedFood.id)).run();

      const draft = loadMealShortcutDraft(connection.db, userId, '2026-07-18', 'breakfast');
      expect(draft.items.map((item) => item.sourceEntryId)).toEqual([activeEntry.id]);
      expect(draft.excludedEntries).toEqual([
        expect.objectContaining({ entryId: archivedEntry.id, reason: 'food_archived' })
      ]);

      const shortcut = createMealShortcut(connection.db, userId, {
        clientMutationId: crypto.randomUUID(),
        name: 'Will be blocked',
        items: [{ sourceEntryId: activeEntry.id, foodId: activeFood.id, amount: '100' }]
      });
      connection.db.update(foods).set({ deletedAt: new Date() })
        .where(eq(foods.id, activeFood.id)).run();

      expect(listMealShortcuts(connection.db, userId, '')[0]).toMatchObject({
        id: shortcut.id,
        blocked: true,
        totals: null
      });
      expect(() => applyMealShortcut(connection.db, userId, shortcut.id, {
        clientMutationId: crypto.randomUUID(),
        diaryDate: '2026-07-19',
        mealSlot: 'lunch'
      })).toThrow(MealShortcutBlockedError);
      expect(connection.db.select().from(mealShortcutApplications).all()).toHaveLength(0);
    });
  });

  it('applies exact saved amounts using current nutrition and is idempotent', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const food = insertFood(connection, userId);
      const entry = logFood(connection, food, 'serving', '1.5');
      const shortcut = createMealShortcut(connection.db, userId, {
        clientMutationId: crypto.randomUUID(),
        name: 'Current nutrition',
        items: [{ sourceEntryId: entry.id, foodId: food.id, amount: '60' }]
      });
      connection.db.update(foods).set({
        name: 'Renamed porridge',
        energyMkcalPerBasis: 200_000,
        proteinMgPerBasis: 20_000
      }).where(eq(foods.id, food.id)).run();
      const mutationId = '22222222-2222-4222-8222-222222222222';
      const input = { clientMutationId: mutationId, diaryDate: '2026-07-19', mealSlot: 'lunch' as const };

      const applied = applyMealShortcut(connection.db, userId, shortcut.id, input);
      const replayed = applyMealShortcut(connection.db, userId, shortcut.id, input);

      expect(applied.replayed).toBe(false);
      expect(replayed.replayed).toBe(true);
      expect(replayed.application.id).toBe(applied.application.id);
      expect(applied.entries[0]).toMatchObject({
        foodName: 'Renamed porridge',
        resolvedAmount: 60_000,
        portionKind: 'serving',
        portionAmount: 40_000,
        portionCountMilli: 1_500,
        energyMkcal: 120_000,
        proteinMg: 12_000,
        sourceShortcutId: shortcut.id,
        shortcutBatchId: applied.application.id
      });
      expect(connection.db.select().from(mealShortcutApplications).all()).toHaveLength(1);
      expect(connection.db.select().from(diaryLogs).where(eq(
        diaryLogs.shortcutBatchId,
        applied.application.id
      )).all()).toHaveLength(1);
      expect(() => applyMealShortcut(connection.db, userId, shortcut.id, {
        ...input,
        diaryDate: '2026-07-20'
      })).toThrow(MealShortcutApplicationConflictError);
    });
  });

  it('undoes every still-active entry in an application, including edited entries, and replays safely', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection, 'owner@example.com');
      const firstFood = insertFood(connection, userId, { name: 'First' });
      const secondFood = insertFood(connection, userId, { name: 'Second' });
      const firstEntry = logFood(connection, firstFood, 'hundred', '1');
      const secondEntry = logFood(connection, secondFood, 'serving', '1');
      const shortcut = createMealShortcut(connection.db, userId, {
        clientMutationId: crypto.randomUUID(),
        name: 'Two foods',
        items: [
          { sourceEntryId: firstEntry.id, foodId: firstFood.id, amount: '100' },
          { sourceEntryId: secondEntry.id, foodId: secondFood.id, amount: '40' }
        ]
      });
      const applied = applyMealShortcut(connection.db, userId, shortcut.id, {
        clientMutationId: crypto.randomUUID(),
        diaryDate: '2026-07-20',
        mealSlot: 'dinner'
      });
      connection.db.update(diaryLogs).set({ energyMkcal: 1, updatedAt: new Date() })
        .where(eq(diaryLogs.id, applied.entries[0]!.id)).run();

      const undone = undoMealShortcutApplication(connection.db, userId, applied.application.id);
      const replayed = undoMealShortcutApplication(connection.db, userId, applied.application.id);
      const activeBatchEntries = connection.db.select().from(diaryLogs).where(and(
        eq(diaryLogs.shortcutBatchId, applied.application.id),
        isNull(diaryLogs.deletedAt)
      )).all();

      expect(undone).toMatchObject({ entryCount: 2, undone: true });
      expect(replayed).toMatchObject({ entryCount: 2, undone: true });
      expect(activeBatchEntries).toEqual([]);
    });
  });

  it('isolates ownership and supports optimistic reorder and archive', () => {
    withMigratedDatabase((connection) => {
      const ownerId = insertUser(connection, 'owner@example.com');
      const otherId = insertUser(connection, 'other@example.com');
      const first = insertFood(connection, ownerId, { name: 'First' });
      const second = insertFood(connection, ownerId, { name: 'Second' });
      const shortcut = createMealShortcut(connection.db, ownerId, {
        clientMutationId: crypto.randomUUID(),
        name: 'Original',
        items: [
          { foodId: first.id, amount: '10' },
          { foodId: second.id, amount: '20' }
        ]
      });

      expect(() => getMealShortcut(connection.db, otherId, shortcut.id))
        .toThrow(MealShortcutNotFoundError);
      const detail = getMealShortcut(connection.db, ownerId, shortcut.id);
      const updated = updateMealShortcut(connection.db, ownerId, shortcut.id, {
        expectedUpdatedAt: String(detail.updatedAt.getTime()),
        name: 'Reordered',
        items: [
          { itemId: detail.items[1]!.id, foodId: second.id, amount: '20' },
          { itemId: detail.items[0]!.id, foodId: first.id, amount: '15' }
        ]
      });
      expect(getMealShortcut(connection.db, ownerId, shortcut.id).items.map((item) => [
        item.position,
        item.foodId,
        item.defaultAmount
      ])).toEqual([
        [0, second.id, 20_000],
        [1, first.id, 15_000]
      ]);

      archiveMealShortcut(connection.db, ownerId, shortcut.id, String(updated.updatedAt.getTime()));
      expect(listMealShortcuts(connection.db, ownerId, '')).toEqual([]);
      expect(() => getMealShortcut(connection.db, ownerId, shortcut.id))
        .toThrow(MealShortcutNotFoundError);
      expect(connection.db.select().from(mealShortcutItems)
        .where(eq(mealShortcutItems.shortcutId, shortcut.id))
        .orderBy(asc(mealShortcutItems.position)).all()).toHaveLength(2);
    });
  });
});
