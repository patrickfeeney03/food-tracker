import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { diaryLogs, foods, mealShortcutApplications, mealShortcutItems, mealShortcuts, users, type Food } from '$lib/server/db/schema';
import { buildDiaryLogValues } from './diary-entry';
import { applyMealShortcut, archiveMealShortcut, createMealShortcut, getMealShortcut, listMealShortcuts, loadMealShortcutDraft, MealShortcutApplicationConflictError, MealShortcutBlockedError, MealShortcutCreateConflictError, MealShortcutEditConflictError, MealShortcutNotFoundError, undoMealShortcutApplication, updateMealShortcut } from './meal-shortcut';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-meal-shortcut-'));
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
async function insertUser(connection: DatabaseConnection, email: string): Promise<string> {
    return (await connection.db.insert(users).values({ name: email, email }).returning({ id: users.id }).get()).id;
}
async function insertFood(connection: DatabaseConnection, userId: string, overrides: Partial<typeof foods.$inferInsert> = {}): Promise<Food> {
    return await connection.db.insert(foods).values({
        userId,
        name: 'Porridge',
        amountUnit: 'mg',
        basisAmount: 100000,
        servingAmount: 40000,
        energyMkcalPerBasis: 100000,
        proteinMgPerBasis: 10000,
        carbsMgPerBasis: 20000,
        fatMgPerBasis: 5000,
        ...overrides
    }).returning().get();
}
async function logFood(connection: DatabaseConnection, food: Food, portionKind: 'serving' | 'hundred', portionCount: string) {
    return await connection.db.insert(diaryLogs).values(buildDiaryLogValues(food, {
        clientMutationId: crypto.randomUUID(),
        diaryDate: '2026-07-18',
        mealSlot: 'breakfast',
        portionKind,
        portionCount
    })).returning().get();
}
describe('meal shortcuts', () => {
    it('handles 100 distinct foods atomically and allows edits, replay, and concurrent undo', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'large-shortcut@example.com');
            const foodRows = [];
            for (let index = 0; index < 100; index++) {
                foodRows.push(await insertFood(connection, userId, { name: `Food ${index}` }));
            }
            const shortcut = await createMealShortcut(connection.db, userId, {
                clientMutationId: crypto.randomUUID(), name: 'Large meal',
                items: foodRows.map((food) => ({ foodId: food.id, amount: '10' }))
            });
            const detail = await getMealShortcut(connection.db, userId, shortcut.id);
            await updateMealShortcut(connection.db, userId, shortcut.id, {
                expectedUpdatedAt: String(detail.updatedAt.getTime()), name: 'Edited large meal',
                items: detail.items.map((item) => ({ itemId: item.id, foodId: item.foodId, amount: '15' }))
            });
            const input = { clientMutationId: crypto.randomUUID(), diaryDate: '2026-07-19', mealSlot: 'lunch' as const };
            const applied = await applyMealShortcut(connection.db, userId, shortcut.id, input);
            const replayed = await applyMealShortcut(connection.db, userId, shortcut.id, input);
            expect(applied.entries).toHaveLength(100);
            expect(applied.entries.every((entry) => entry.resolvedAmount === 15000)).toBe(true);
            expect(replayed.entries.map((entry) => entry.id)).toEqual(applied.entries.map((entry) => entry.id));
            await Promise.all([
                undoMealShortcutApplication(connection.db, userId, applied.application.id),
                undoMealShortcutApplication(connection.db, userId, applied.application.id)
            ]);
            expect(await connection.db.select().from(diaryLogs).where(isNull(diaryLogs.deletedAt)).all()).toHaveLength(0);
            expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(1);
        });
    });

    it('creates an ordered shortcut from diary snapshots and safely replays creation', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const servingEntry = await logFood(connection, food, 'serving', '1.5');
            const hundredEntry = await logFood(connection, food, 'hundred', '1');
            const mutationId = '11111111-1111-4111-8111-111111111111';
            const input = {
                clientMutationId: mutationId,
                name: 'Breakfast bowl',
                items: [
                    { sourceEntryId: servingEntry.id, foodId: food.id, amount: '60' },
                    { sourceEntryId: hundredEntry.id, foodId: food.id, amount: '100' }
                ]
            };
            const created = await createMealShortcut(connection.db, userId, input);
            const replayed = await createMealShortcut(connection.db, userId, input);
            const detail = await getMealShortcut(connection.db, userId, created.id);
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
                    amount: 60000,
                    portionKind: 'serving',
                    portionAmount: 40000,
                    portionCountMilli: 1500
                },
                {
                    position: 1,
                    foodId: food.id,
                    amount: 100000,
                    portionKind: 'hundred',
                    portionAmount: 100000,
                    portionCountMilli: 1000
                }
            ]);
            await expect(createMealShortcut(connection.db, userId, {
                ...input,
                name: 'Different request'
            })).rejects.toThrow(MealShortcutCreateConflictError);
            expect(await connection.db.select().from(mealShortcuts).all()).toHaveLength(1);
        });
    });
    it('loads repairable drafts and blocks archived shortcut items from catalogue application', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const activeFood = await insertFood(connection, userId, { name: 'Active food' });
            const archivedFood = await insertFood(connection, userId, { name: 'Archived food' });
            const activeEntry = await logFood(connection, activeFood, 'hundred', '1');
            const archivedEntry = await logFood(connection, archivedFood, 'serving', '1');
            await connection.db.update(foods).set({ deletedAt: new Date() })
                .where(eq(foods.id, archivedFood.id)).run();
            const draft = await loadMealShortcutDraft(connection.db, userId, '2026-07-18', 'breakfast');
            expect(draft.items.map((item) => item.sourceEntryId)).toEqual([activeEntry.id]);
            expect(draft.excludedEntries).toEqual([
                expect.objectContaining({ entryId: archivedEntry.id, reason: 'food_archived' })
            ]);
            const shortcut = await createMealShortcut(connection.db, userId, {
                clientMutationId: crypto.randomUUID(),
                name: 'Will be blocked',
                items: [{ sourceEntryId: activeEntry.id, foodId: activeFood.id, amount: '100' }]
            });
            await connection.db.update(foods).set({ deletedAt: new Date() })
                .where(eq(foods.id, activeFood.id)).run();
            expect((await listMealShortcuts(connection.db, userId, ''))[0]).toMatchObject({
                id: shortcut.id,
                blocked: true,
                totals: null
            });
            await expect(applyMealShortcut(connection.db, userId, shortcut.id, {
                clientMutationId: crypto.randomUUID(),
                diaryDate: '2026-07-19',
                mealSlot: 'lunch'
            })).rejects.toThrow(MealShortcutBlockedError);
            expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(0);
        });
    });
    it('applies exact saved amounts using current nutrition and is idempotent', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const entry = await logFood(connection, food, 'serving', '1.5');
            const shortcut = await createMealShortcut(connection.db, userId, {
                clientMutationId: crypto.randomUUID(),
                name: 'Current nutrition',
                items: [{ sourceEntryId: entry.id, foodId: food.id, amount: '60' }]
            });
            await connection.db.update(foods).set({
                name: 'Renamed porridge',
                energyMkcalPerBasis: 200000,
                proteinMgPerBasis: 20000
            }).where(eq(foods.id, food.id)).run();
            const mutationId = '22222222-2222-4222-8222-222222222222';
            const input = { clientMutationId: mutationId, diaryDate: '2026-07-19', mealSlot: 'lunch' as const };
            const applied = await applyMealShortcut(connection.db, userId, shortcut.id, input);
            const replayed = await applyMealShortcut(connection.db, userId, shortcut.id, input);
            expect(applied.replayed).toBe(false);
            expect(replayed.replayed).toBe(true);
            expect(replayed.application.id).toBe(applied.application.id);
            expect(applied.entries[0]).toMatchObject({
                foodName: 'Renamed porridge',
                resolvedAmount: 60000,
                portionKind: 'serving',
                portionAmount: 40000,
                portionCountMilli: 1500,
                energyMkcal: 120000,
                proteinMg: 12000,
                sourceShortcutId: shortcut.id,
                shortcutBatchId: applied.application.id
            });
            expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(1);
            expect(await connection.db.select().from(diaryLogs).where(eq(diaryLogs.shortcutBatchId, applied.application.id)).all()).toHaveLength(1);
            await expect(applyMealShortcut(connection.db, userId, shortcut.id, {
                ...input,
                diaryDate: '2026-07-20'
            })).rejects.toThrow(MealShortcutApplicationConflictError);
        });
    });
    it('undoes every still-active entry in an application, including edited entries, and replays safely', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const firstFood = await insertFood(connection, userId, { name: 'First' });
            const secondFood = await insertFood(connection, userId, { name: 'Second' });
            const firstEntry = await logFood(connection, firstFood, 'hundred', '1');
            const secondEntry = await logFood(connection, secondFood, 'serving', '1');
            const shortcut = await createMealShortcut(connection.db, userId, {
                clientMutationId: crypto.randomUUID(),
                name: 'Two foods',
                items: [
                    { sourceEntryId: firstEntry.id, foodId: firstFood.id, amount: '100' },
                    { sourceEntryId: secondEntry.id, foodId: secondFood.id, amount: '40' }
                ]
            });
            const applied = await applyMealShortcut(connection.db, userId, shortcut.id, {
                clientMutationId: crypto.randomUUID(),
                diaryDate: '2026-07-20',
                mealSlot: 'dinner'
            });
            await connection.db.update(diaryLogs).set({ energyMkcal: 1, updatedAt: new Date() })
                .where(eq(diaryLogs.id, applied.entries[0]!.id)).run();
            const undone = await undoMealShortcutApplication(connection.db, userId, applied.application.id);
            const replayed = await undoMealShortcutApplication(connection.db, userId, applied.application.id);
            const activeBatchEntries = await connection.db.select().from(diaryLogs).where(and(eq(diaryLogs.shortcutBatchId, applied.application.id), isNull(diaryLogs.deletedAt))).all();
            expect(undone).toMatchObject({ entryCount: 2, undone: true });
            expect(replayed).toMatchObject({ entryCount: 2, undone: true });
            expect(activeBatchEntries).toEqual([]);
        });
    });
    it('isolates ownership and supports optimistic reorder and archive', async () => {
        await withMigratedDatabase(async (connection) => {
            const ownerId = await insertUser(connection, 'owner@example.com');
            const otherId = await insertUser(connection, 'other@example.com');
            const first = await insertFood(connection, ownerId, { name: 'First' });
            const second = await insertFood(connection, ownerId, { name: 'Second' });
            const shortcut = await createMealShortcut(connection.db, ownerId, {
                clientMutationId: crypto.randomUUID(),
                name: 'Original',
                items: [
                    { foodId: first.id, amount: '10' },
                    { foodId: second.id, amount: '20' }
                ]
            });
            await expect(getMealShortcut(connection.db, otherId, shortcut.id)).rejects.toThrow(MealShortcutNotFoundError);
            const detail = await getMealShortcut(connection.db, ownerId, shortcut.id);
            const updated = await updateMealShortcut(connection.db, ownerId, shortcut.id, {
                expectedUpdatedAt: String(detail.updatedAt.getTime()),
                name: 'Reordered',
                items: [
                    { itemId: detail.items[1]!.id, foodId: second.id, amount: '20' },
                    { itemId: detail.items[0]!.id, foodId: first.id, amount: '15' }
                ]
            });
            expect((await getMealShortcut(connection.db, ownerId, shortcut.id)).items.map((item) => [
                item.position,
                item.foodId,
                item.defaultAmount
            ])).toEqual([
                [0, second.id, 20000],
                [1, first.id, 15000]
            ]);
            await archiveMealShortcut(connection.db, ownerId, shortcut.id, String(updated.updatedAt.getTime()));
            expect(await listMealShortcuts(connection.db, ownerId, '')).toEqual([]);
            await expect(getMealShortcut(connection.db, ownerId, shortcut.id)).rejects.toThrow(MealShortcutNotFoundError);
            expect(await connection.db.select().from(mealShortcutItems)
                .where(eq(mealShortcutItems.shortcutId, shortcut.id))
                .orderBy(asc(mealShortcutItems.position)).all()).toHaveLength(2);
        });
    });
    it('rejects a stale shortcut edit after another edit commits', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const shortcut = await createMealShortcut(connection.db, userId, {
                clientMutationId: crypto.randomUUID(), name: 'Original', items: [{ foodId: food.id, amount: '40' }]
            });
            const original = await getMealShortcut(connection.db, userId, shortcut.id);
            await updateMealShortcut(connection.db, userId, shortcut.id, {
                expectedUpdatedAt: String(original.updatedAt.getTime()), name: 'First edit',
                items: [{ itemId: original.items[0]!.id, foodId: food.id, amount: '50' }]
            });
            await expect(updateMealShortcut(connection.db, userId, shortcut.id, {
                expectedUpdatedAt: String(original.updatedAt.getTime()), name: 'Stale edit',
                items: [{ itemId: original.items[0]!.id, foodId: food.id, amount: '60' }]
            })).rejects.toThrow(MealShortcutEditConflictError);
            expect((await getMealShortcut(connection.db, userId, shortcut.id)).name).toBe('First edit');
        });
    });

});
