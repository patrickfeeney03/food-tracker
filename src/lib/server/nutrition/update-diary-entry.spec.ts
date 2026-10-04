import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from "vitest";
import { createDatabase, type DatabaseConnection } from "../db/testing";
import { diaryLogs, foods, users } from "../db/schema";
import { createFoodAndLog } from "./create-food-and-log";
import { deleteDiaryEntry, DiaryEntryDeletionNotFoundError, restoreDeletedDiaryEntry, } from "./delete-diary-entry";
import { getActiveDiaryEntry, getDeletedDiaryEntry } from "./diary-entry-query";
import { loadDiaryDay } from "./diary-summary";
import { DiaryEntryNotFoundError, updateDiaryEntry } from "./update-diary-entry";
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-edit-entry-'));
    const connection = await createDatabase(join(directory, 'test.db'));
    try {
        await migrate(connection.db, { migrationsFolder: 'drizzle' });
        await run(connection);
    }
    finally {
        await connection.client.close();
        rmSync(directory, { recursive: true, force: true });
    }
}
async function insertUser(connection: DatabaseConnection, email = 'patrick@example.com'): Promise<string> {
    return (await connection.db
        .insert(users)
        .values({ name: 'Patrick', email })
        .returning({ id: users.id })
        .get()).id;
}
async function createEntry(connection: DatabaseConnection, userId: string, portionKind: 'hundred' | 'serving' = 'hundred') {
    return await createFoodAndLog(connection.db, userId, {
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
    }, {
        clientMutationId: crypto.randomUUID(),
        portionKind,
        portionCount: '1',
        diaryDate: '2026-07-16',
        mealSlot: 'breakfast'
    });
}
describe('updateDiaryEntry', () => {
    it('updates the portion and destination from the saved nutrition snapshot', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const created = await createEntry(connection, userId);
            const originalLoggedAt = created.diaryLog.loggedAt;
            const updatedAt = new Date('2026-07-16T14:00:00.000Z');
            await connection.db
                .update(foods)
                .set({
                energyMkcalPerBasis: 999000,
                proteinMgPerBasis: 999000
            })
                .run();
            const updated = await updateDiaryEntry(connection.db, userId, created.diaryLog.id, {
                portionKind: 'unit',
                portionCount: '100',
                diaryDate: '2026-07-17',
                mealSlot: 'lunch'
            }, updatedAt);
            expect(updated).toEqual(expect.objectContaining({
                diaryDate: '2026-07-17',
                mealSlot: 'lunch',
                portionKind: 'unit',
                portionLabel: '1 g',
                portionAmount: 1000,
                portionCountMilli: 100000,
                resolvedAmount: 100000,
                energyMkcal: 62000,
                proteinMg: 9000,
                carbsMg: 4000,
                fatMg: 1500,
                additionalNutritionTotalJson: {
                    fibreMg: 800
                },
                loggedAt: originalLoggedAt,
                updatedAt
            }));
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('retains an original serving snapshot after the food serving changes', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const created = await createEntry(connection, userId, 'serving');
            await connection.db
                .update(foods)
                .set({ servingAmount: 300000 })
                .run();
            const updated = await updateDiaryEntry(connection.db, userId, created.diaryLog.id, {
                portionKind: 'serving',
                portionCount: '2',
                diaryDate: '2026-07-16',
                mealSlot: 'breakfast'
            });
            expect(updated.portionAmount).toBe(125000);
            expect(updated.resolvedAmount).toBe(250000);
            expect(updated.energyMkcal).toBe(155000);
        });
    });
    it('rejects a serving choice that was not snapshotted on the entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const created = await createEntry(connection, userId);
            await expect(updateDiaryEntry(connection.db, userId, created.diaryLog.id, {
                portionKind: 'serving',
                portionCount: '1',
                diaryDate: '2026-07-16',
                mealSlot: 'breakfast'
            })).rejects.toThrow(new RangeError('Diary entry does not contain a serving portion snapshot'));
            expect((await connection.db.select().from(diaryLogs).get())?.portionKind).toBe('hundred');
        });
    });
    it('does not expose another user’s diary entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const ownerId = await insertUser(connection);
            const otherUserId = await insertUser(connection, 'other@example.com');
            const created = await createEntry(connection, ownerId);
            await expect(updateDiaryEntry(connection.db, otherUserId, created.diaryLog.id, {
                portionKind: 'hundred',
                portionCount: '2',
                diaryDate: '2026-07-16',
                mealSlot: 'breakfast'
            })).rejects.toThrow(DiaryEntryNotFoundError);
        });
    });
});
describe('deleteDiaryEntry', () => {
    it('soft-deletes an entry, removes it from diary totals, and restores the exact deletion', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const created = await createEntry(connection, userId);
            const deletedAt = new Date('2026-07-16T15:00:00.000Z');
            const restoredAt = new Date('2026-07-16T15:01:00.000Z');
            const deleted = await deleteDiaryEntry(connection.db, userId, created.diaryLog.id, deletedAt);
            expect(deleted.deletedAt).toEqual(deletedAt);
            expect(deleted.updatedAt).toEqual(deletedAt);
            expect((await getDeletedDiaryEntry(connection.db, userId, deleted.id))?.id).toBe(deleted.id);
            expect(await getActiveDiaryEntry(connection.db, userId, deleted.id)).toBeUndefined();
            expect((await loadDiaryDay(connection.db, userId, deleted.diaryDate)).totals.energyMkcal).toBe(0);
            const restored = await restoreDeletedDiaryEntry(connection.db, userId, deleted.id, deletedAt, restoredAt);
            expect(restored.deletedAt).toBeNull();
            expect(restored.updatedAt).toEqual(restoredAt);
            expect(await getDeletedDiaryEntry(connection.db, userId, restored.id)).toBeUndefined();
            expect((await getActiveDiaryEntry(connection.db, userId, restored.id))?.id).toBe(restored.id);
            expect((await loadDiaryDay(connection.db, userId, restored.diaryDate)).totals.energyMkcal).toBe(62000);
        });
    });
    it('does not delete another user’s entry or restore a different deletion event', async () => {
        await withMigratedDatabase(async (connection) => {
            const ownerId = await insertUser(connection);
            const otherUserId = await insertUser(connection, 'other@example.com');
            const created = await createEntry(connection, ownerId);
            const deletedAt = new Date('2026-07-16T15:00:00.000Z');
            await expect(deleteDiaryEntry(connection.db, otherUserId, created.diaryLog.id, deletedAt)).rejects.toThrow(DiaryEntryDeletionNotFoundError);
            await deleteDiaryEntry(connection.db, ownerId, created.diaryLog.id, deletedAt);
            await expect(restoreDeletedDiaryEntry(connection.db, otherUserId, created.diaryLog.id, deletedAt)).rejects.toThrow(DiaryEntryDeletionNotFoundError);
            await expect(restoreDeletedDiaryEntry(connection.db, ownerId, created.diaryLog.id, new Date(deletedAt.getTime() + 1))).rejects.toThrow(DiaryEntryDeletionNotFoundError);
            expect(await getDeletedDiaryEntry(connection.db, ownerId, created.diaryLog.id)).toBeDefined();
        });
    });
});
