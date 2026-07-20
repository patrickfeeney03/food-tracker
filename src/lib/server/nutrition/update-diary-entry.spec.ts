import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createDatabase, type DatabaseConnection } from "../db/connection";
import { diaryLogs, foods, users } from "../db/schema";
import { createFoodAndLog } from "./create-food-and-log";
import {
  deleteDiaryEntry,
  DiaryEntryDeletionNotFoundError,
  restoreDeletedDiaryEntry,
} from "./delete-diary-entry";
import { getActiveDiaryEntry, getDeletedDiaryEntry } from "./diary-entry-query";
import { loadDiaryDay } from "./diary-summary";
import { DiaryEntryNotFoundError, updateDiaryEntry } from "./update-diary-entry";

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-edit-entry-')
  );
  const connection = createDatabase(
    join(directory, 'test.db')
  );

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

function createEntry(
  connection: DatabaseConnection,
  userId: string,
  portionKind: 'hundred' | 'serving' = 'hundred'
) {
  return createFoodAndLog(
    connection.db,
    userId,
    {
      name: 'Greek yoghurt',
      brand: 'Test',
      amountUnit: 'mg',
      basisAmount: '100',
      servingAmount: '125',
      energyKcal: '62',
      proteinG: '9',
      carbsG: '4',
      fatG: '1.5',
      fibreG: '0.8'
    },
    {
      clientMutationId: crypto.randomUUID(),
      portionKind,
      portionCount: '1',
      diaryDate: '2026-07-16',
      mealSlot: 'breakfast'
    }
  );
}

describe('updateDiaryEntry', () => {
  it('updates the portion and destination from the saved nutrition snapshot', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const created = createEntry(connection, userId);
      const originalLoggedAt = created.diaryLog.loggedAt;
      const updatedAt = new Date('2026-07-16T14:00:00.000Z');

      connection.db
        .update(foods)
        .set({
          energyMkcalPerBasis: 999_000,
          proteinMgPerBasis: 999_000
        })
        .run();

      const updated = updateDiaryEntry(
        connection.db,
        userId,
        created.diaryLog.id,
        {
          portionKind: 'unit',
          portionCount: '100',
          diaryDate: '2026-07-17',
          mealSlot: 'lunch'
        },
        updatedAt
      );

      expect(updated).toEqual(
        expect.objectContaining({
          diaryDate: '2026-07-17',
          mealSlot: 'lunch',
          portionKind: 'unit',
          portionLabel: '1 g',
          portionAmount: 1_000,
          portionCountMilli: 100_000,
          resolvedAmount: 100_000,
          energyMkcal: 62_000,
          proteinMg: 9_000,
          carbsMg: 4_000,
          fatMg: 1_500,
          additionalNutritionTotalJson: {
            fibreMg: 800
          },
          loggedAt: originalLoggedAt,
          updatedAt
        })
      );

      expect(
        connection.db.select().from(diaryLogs).all()
      ).toHaveLength(1);
    });
  });

  it('retains an original serving snapshot after the food serving changes', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const created = createEntry(connection, userId, 'serving');

      connection.db
        .update(foods)
        .set({ servingAmount: 300_000 })
        .run();

      const updated = updateDiaryEntry(
        connection.db,
        userId,
        created.diaryLog.id,
        {
          portionKind: 'serving',
          portionCount: '2',
          diaryDate: '2026-07-16',
          mealSlot: 'breakfast'
        }
      );

      expect(updated.portionAmount).toBe(125_000);
      expect(updated.resolvedAmount).toBe(250_000);
      expect(updated.energyMkcal).toBe(155_000);
    });
  });

  it('rejects a serving choice that was not snapshotted on the entry', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const created = createEntry(connection, userId);

      expect(() =>
        updateDiaryEntry(
          connection.db,
          userId,
          created.diaryLog.id,
          {
            portionKind: 'serving',
            portionCount: '1',
            diaryDate: '2026-07-16',
            mealSlot: 'breakfast'
          }
        )
      ).toThrow(
        new RangeError(
          'Diary entry does not contain a serving portion snapshot'
        )
      );

      expect(
        connection.db.select().from(diaryLogs).get()?.portionKind
      ).toBe('hundred');
    });
  });

  it('does not expose another user’s diary entry', () => {
    withMigratedDatabase((connection) => {
      const ownerId = insertUser(connection);
      const otherUserId = insertUser(
        connection,
        'other@example.com'
      );
      const created = createEntry(connection, ownerId);

      expect(() =>
        updateDiaryEntry(
          connection.db,
          otherUserId,
          created.diaryLog.id,
          {
            portionKind: 'hundred',
            portionCount: '2',
            diaryDate: '2026-07-16',
            mealSlot: 'breakfast'
          }
        )
      ).toThrow(DiaryEntryNotFoundError);
    });
  });
});

describe('deleteDiaryEntry', () => {
  it('soft-deletes an entry, removes it from diary totals, and restores the exact deletion', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const created = createEntry(connection, userId);
      const deletedAt = new Date('2026-07-16T15:00:00.000Z');
      const restoredAt = new Date('2026-07-16T15:01:00.000Z');

      const deleted = deleteDiaryEntry(
        connection.db,
        userId,
        created.diaryLog.id,
        deletedAt
      );

      expect(deleted.deletedAt).toEqual(deletedAt);
      expect(deleted.updatedAt).toEqual(deletedAt);
      expect(getDeletedDiaryEntry(connection.db, userId, deleted.id)?.id).toBe(deleted.id);
      expect(getActiveDiaryEntry(connection.db, userId, deleted.id)).toBeUndefined();
      expect(loadDiaryDay(connection.db, userId, deleted.diaryDate).totals.energyMkcal).toBe(0);

      const restored = restoreDeletedDiaryEntry(
        connection.db,
        userId,
        deleted.id,
        deletedAt,
        restoredAt
      );

      expect(restored.deletedAt).toBeNull();
      expect(restored.updatedAt).toEqual(restoredAt);
      expect(getDeletedDiaryEntry(connection.db, userId, restored.id)).toBeUndefined();
      expect(getActiveDiaryEntry(connection.db, userId, restored.id)?.id).toBe(restored.id);
      expect(loadDiaryDay(connection.db, userId, restored.diaryDate).totals.energyMkcal).toBe(62_000);
    });
  });

  it('does not delete another user’s entry or restore a different deletion event', () => {
    withMigratedDatabase((connection) => {
      const ownerId = insertUser(connection);
      const otherUserId = insertUser(connection, 'other@example.com');
      const created = createEntry(connection, ownerId);
      const deletedAt = new Date('2026-07-16T15:00:00.000Z');

      expect(() =>
        deleteDiaryEntry(connection.db, otherUserId, created.diaryLog.id, deletedAt)
      ).toThrow(DiaryEntryDeletionNotFoundError);

      deleteDiaryEntry(connection.db, ownerId, created.diaryLog.id, deletedAt);

      expect(() =>
        restoreDeletedDiaryEntry(
          connection.db,
          otherUserId,
          created.diaryLog.id,
          deletedAt
        )
      ).toThrow(DiaryEntryDeletionNotFoundError);
      expect(() =>
        restoreDeletedDiaryEntry(
          connection.db,
          ownerId,
          created.diaryLog.id,
          new Date(deletedAt.getTime() + 1)
        )
      ).toThrow(DiaryEntryDeletionNotFoundError);

      expect(getDeletedDiaryEntry(connection.db, ownerId, created.diaryLog.id)).toBeDefined();
    });
  });
});
