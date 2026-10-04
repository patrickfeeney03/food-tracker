import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '../db/testing';
import { diaryLogs, foods, users } from '../db/schema';
import { ExistingFoodLogConflictError, ExistingFoodNotFoundError, logExistingFood, quickAddExistingFood, QuickAddUnavailableError } from './log-existing-food';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-log-existing-food-'));
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
async function insertFood(connection: DatabaseConnection, userId: string, overrides: Partial<typeof foods.$inferInsert> = {}) {
    return await connection.db
        .insert(foods)
        .values({
        userId,
        name: 'Greek yoghurt',
        brand: 'Test',
        amountUnit: 'mg',
        basisAmount: 100000,
        servingAmount: 125000,
        energyMkcalPerBasis: 62000,
        proteinMgPerBasis: 9000,
        carbsMgPerBasis: 4000,
        fatMgPerBasis: 1500,
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
    it('logs an active owned food as a complete nutrition snapshot', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            const entry = await logExistingFood(connection.db, userId, food.id, logInput());
            expect(entry).toEqual(expect.objectContaining({
                userId,
                foodId: food.id,
                clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
                diaryDate: '2026-07-18',
                mealSlot: 'breakfast',
                foodName: 'Greek yoghurt',
                portionKind: 'serving',
                portionAmount: 125000,
                portionCountMilli: 2000,
                resolvedAmount: 250000,
                energyMkcal: 155000,
                proteinMg: 22500,
                carbsMg: 10000,
                fatMg: 3750,
                additionalNutritionTotalJson: { fibreMg: 2000 }
            }));
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('does not expose or log another user\'s food', async () => {
        await withMigratedDatabase(async (connection) => {
            const ownerId = await insertUser(connection);
            const otherUserId = await insertUser(connection, 'other@example.com');
            const food = await insertFood(connection, ownerId);
            await expect(logExistingFood(connection.db, otherUserId, food.id, logInput())).rejects.toThrow(ExistingFoodNotFoundError);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(0);
        });
    });
    it('rejects an archived food without writing a diary entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId, {
                deletedAt: new Date('2026-07-18T12:00:00.000Z')
            });
            await expect(logExistingFood(connection.db, userId, food.id, logInput())).rejects.toThrow(ExistingFoodNotFoundError);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(0);
        });
    });
    it('rejects an unknown food without writing a diary entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            await expect(logExistingFood(connection.db, userId, crypto.randomUUID(), logInput())).rejects.toThrow(ExistingFoodNotFoundError);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(0);
        });
    });
    it('returns the original diary row for a semantically identical retry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            const first = await logExistingFood(connection.db, userId, food.id, logInput());
            const replayed = await logExistingFood(connection.db, userId, food.id, logInput({ portionCount: '2.000' }));
            expect(replayed.id).toBe(first.id);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('allows different users to use the same mutation ID independently', async () => {
        await withMigratedDatabase(async (connection) => {
            const firstUserId = await insertUser(connection);
            const secondUserId = await insertUser(connection, 'other@example.com');
            const firstFood = await insertFood(connection, firstUserId);
            const secondFood = await insertFood(connection, secondUserId, { barcode: '2' });
            const first = await logExistingFood(connection.db, firstUserId, firstFood.id, logInput());
            const second = await logExistingFood(connection.db, secondUserId, secondFood.id, logInput());
            expect(second.id).not.toBe(first.id);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(2);
        });
    });
    const mismatches = [
        ['food', { foodId: 'different' }],
        ['date', { diaryDate: '2026-07-19' }],
        ['meal', { mealSlot: 'lunch' }],
        ['portion kind', { portionKind: 'hundred' }],
        ['portion count', { portionCount: '3' }]
    ] as const;
    it.each(mismatches)('rejects a retry with a different %s', async (_label, change) => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            const original = await logExistingFood(connection.db, userId, food.id, logInput());
            const retryFoodId = 'foodId' in change && change.foodId === 'different'
                ? (await insertFood(connection, userId, { name: 'Banana', barcode: '2' })).id
                : food.id;
            await expect(logExistingFood(connection.db, userId, retryFoodId, logInput(change))).rejects.toThrow(ExistingFoodLogConflictError);
            expect(await connection.db.select().from(diaryLogs).all()).toEqual([original]);
        });
    });
    it('replays the original entry even if the food is archived after the first write', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            const first = await logExistingFood(connection.db, userId, food.id, logInput());
            await connection.db
                .update(foods)
                .set({ deletedAt: new Date('2026-07-18T13:00:00.000Z') })
                .where(eq(foods.id, food.id))
                .run();
            const replayed = await logExistingFood(connection.db, userId, food.id, logInput());
            expect(replayed.id).toBe(first.id);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
});
describe('quickAddExistingFood', () => {
    it('reuses the latest portion representation with the food’s current nutrition', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            await logExistingFood(connection.db, userId, food.id, logInput());
            await connection.db
                .update(foods)
                .set({ energyMkcalPerBasis: 100000 })
                .where(eq(foods.id, food.id))
                .run();
            const quickAdded = await quickAddExistingFood(connection.db, userId, food.id, quickAddInput());
            expect(quickAdded).toEqual(expect.objectContaining({
                portionKind: 'serving',
                portionAmount: 125000,
                portionCountMilli: 2000,
                resolvedAmount: 250000,
                energyMkcalPerBasis: 100000,
                energyMkcal: 250000,
                mealSlot: 'lunch'
            }));
        });
    });
    it('falls back to the previous exact amount when the serving definition changed', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            await logExistingFood(connection.db, userId, food.id, logInput());
            await connection.db
                .update(foods)
                .set({ servingAmount: 200000 })
                .where(eq(foods.id, food.id))
                .run();
            const quickAdded = await quickAddExistingFood(connection.db, userId, food.id, quickAddInput());
            expect(quickAdded).toEqual(expect.objectContaining({
                portionKind: 'unit',
                portionLabel: '1 g',
                portionAmount: 1000,
                portionCountMilli: 250000,
                resolvedAmount: 250000,
                energyMkcal: 155000
            }));
        });
    });
    it('requires a compatible previous use', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            await expect(quickAddExistingFood(connection.db, userId, food.id, quickAddInput())).rejects.toThrow(QuickAddUnavailableError);
            await logExistingFood(connection.db, userId, food.id, logInput());
            await connection.db
                .update(foods)
                .set({ amountUnit: 'ul' })
                .where(eq(foods.id, food.id))
                .run();
            await expect(quickAddExistingFood(connection.db, userId, food.id, quickAddInput())).rejects.toThrow(QuickAddUnavailableError);
        });
    });
    it('returns the original Quick Add row for an identical retry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const food = await insertFood(connection, userId);
            await logExistingFood(connection.db, userId, food.id, logInput());
            const first = await quickAddExistingFood(connection.db, userId, food.id, quickAddInput());
            const replayed = await quickAddExistingFood(connection.db, userId, food.id, quickAddInput());
            expect(replayed.id).toBe(first.id);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(2);
        });
    });
});
