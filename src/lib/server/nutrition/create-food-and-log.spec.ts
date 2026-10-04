import { mkdtempSync, rmSync } from "node:fs";
import { createDatabase, type DatabaseConnection } from "../db/testing";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from '$lib/server/db/testing';
import { diaryLogs, foods, users } from "../db/schema";
import { describe, expect, it } from 'vitest';
import { createFoodAndLog, FoodCreateBarcodeConflictError, FoodCreateMutationConflictError } from "./create-food-and-log";
import { eq } from "drizzle-orm";
const clientMutationId = '550e8400-e29b-41d4-a716-446655440000';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-workflow-'));
    const connection = await createDatabase(join(directory, 'test.db'));
    try {
        await migrate(connection.db, { migrationsFolder: 'drizzle' });
        await run(connection);
    }
    finally {
        await connection.client.close();
        rmSync(directory, {
            recursive: true,
            force: true
        });
    }
}
export async function insertUser(connection: DatabaseConnection, email = 'patrick@example.com'): Promise<string> {
    return (await connection.db
        .insert(users)
        .values({
        name: 'Patrick',
        email
    })
        .returning({
        id: users.id
    })
        .get()).id;
}
describe('createFoodAndLog', () => {
    it('atomically inserts a food and its first diary snapshot', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const result = await createFoodAndLog(connection.db, userId, {
                name: '5% Lean Steak Mince',
                brand: 'Tesco',
                amountUnit: 'mg',
                basisAmount: '250',
                energyKcal: '342',
                proteinG: '52.5',
                carbsG: '0',
                fatG: '12.5'
            }, {
                clientMutationId,
                portionKind: 'hundred',
                portionCount: '1.5',
                diaryDate: '2026-07-12',
                mealSlot: 'lunch'
            });
            expect(result.food).toEqual(expect.objectContaining({
                userId,
                name: '5% Lean Steak Mince',
                basisAmount: 250000,
                energyMkcalPerBasis: 342000
            }));
            expect(result.diaryLog).toEqual(expect.objectContaining({
                userId,
                foodId: result.food.id,
                diaryDate: '2026-07-12',
                mealSlot: 'lunch',
                resolvedAmount: 150000,
                energyMkcal: 205200,
                proteinMg: 31500,
                carbsMg: 0,
                fatMg: 7500
            }));
            expect(await connection.db
                .select()
                .from(foods)
                .where(eq(foods.userId, userId))
                .all()).toHaveLength(1);
            expect(await connection.db
                .select()
                .from(diaryLogs)
                .where(eq(diaryLogs.userId, userId))
                .all()).toHaveLength(1);
        });
    });
    it('rolls back the food when diary creation fails', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            await expect(createFoodAndLog(connection.db, userId, {
                name: 'Food without serving',
                amountUnit: 'mg',
                basisAmount: '100',
                servingAmount: '',
                energyKcal: '100',
                proteinG: '10',
                carbsG: '10',
                fatG: '2'
            }, {
                clientMutationId,
                portionKind: 'serving',
                portionCount: '1',
                diaryDate: '2026-07-12',
                mealSlot: 'breakfast'
            })).rejects.toThrow(new RangeError('Food does not define a serving amount'));
            expect(await connection.db
                .select()
                .from(foods)
                .where(eq(foods.userId, userId))
                .all()).toHaveLength(0);
            expect(await connection.db
                .select()
                .from(diaryLogs)
                .where(eq(diaryLogs.userId, userId))
                .all()).toHaveLength(0);
        });
    });
    it('stores the food under only the supplied user', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const otherUserId = (await connection.db
                .insert(users)
                .values({
                name: 'Other',
                email: 'other@example.com'
            })
                .returning({
                id: users.id
            })
                .get()).id;
            await createFoodAndLog(connection.db, userId, {
                name: 'Banana',
                amountUnit: 'mg',
                basisAmount: '100',
                energyKcal: '89',
                proteinG: '1.1',
                carbsG: '22.8',
                fatG: '0.3'
            }, {
                clientMutationId,
                portionKind: 'hundred',
                portionCount: '1',
                diaryDate: '2026-07-12',
                mealSlot: 'snacks'
            });
            expect(await connection.db
                .select()
                .from(foods)
                .where(eq(foods.userId, otherUserId))
                .all()).toHaveLength(0);
            expect(await connection.db
                .select()
                .from(diaryLogs)
                .where(eq(diaryLogs.userId, otherUserId))
                .all()).toHaveLength(0);
        });
    });
    it('rejects a duplicate active barcode without creating a diary entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            await connection.db.insert(foods).values({
                userId,
                name: 'Existing food',
                barcode: '0012345678905',
                amountUnit: 'mg',
                basisAmount: 100000,
                energyMkcalPerBasis: 100000,
                proteinMgPerBasis: 1000,
                carbsMgPerBasis: 2000,
                fatMgPerBasis: 3000
            }).run();
            await expect(createFoodAndLog(connection.db, userId, {
                name: 'Duplicate barcode',
                barcode: '0012345678905',
                amountUnit: 'mg',
                basisAmount: '100',
                energyKcal: '200',
                proteinG: '10',
                carbsG: '20',
                fatG: '5'
            }, {
                clientMutationId,
                portionKind: 'hundred',
                portionCount: '1',
                diaryDate: '2026-07-12',
                mealSlot: 'lunch'
            })).rejects.toThrow(FoodCreateBarcodeConflictError);
            expect(await connection.db.select().from(foods).all()).toHaveLength(1);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(0);
        });
    });
    it('returns the original result when the mutation is retried', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const foodInput = {
                name: 'Greek yogurt',
                amountUnit: 'mg',
                basisAmount: '100',
                energyKcal: '65',
                proteinG: '10',
                carbsG: '3.5',
                fatG: '0.8'
            };
            const logInput = {
                clientMutationId,
                portionKind: 'hundred',
                portionCount: '2',
                diaryDate: '2026-07-12',
                mealSlot: 'breakfast'
            } as const;
            const firstResult = await createFoodAndLog(connection.db, userId, foodInput, logInput);
            const replayedResult = await createFoodAndLog(connection.db, userId, foodInput, logInput);
            expect(replayedResult.food.id).toBe(firstResult.food.id);
            expect(replayedResult.diaryLog.id).toBe(firstResult.diaryLog.id);
            expect(await connection.db
                .select()
                .from(foods)
                .where(eq(foods.userId, userId))
                .all()).toHaveLength(1);
            expect(await connection.db
                .select()
                .from(diaryLogs)
                .where(eq(diaryLogs.userId, userId))
                .all()).toHaveLength(1);
        });
    });
    it('rejects a retried mutation when the food or first-log details changed', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const foodInput = {
                name: 'Greek yogurt',
                amountUnit: 'mg' as const,
                basisAmount: '100',
                energyKcal: '65',
                proteinG: '10',
                carbsG: '3.5',
                fatG: '0.8'
            };
            const logInput = {
                clientMutationId,
                portionKind: 'hundred' as const,
                portionCount: '2',
                diaryDate: '2026-07-12',
                mealSlot: 'breakfast' as const
            };
            await createFoodAndLog(connection.db, userId, foodInput, logInput);
            await expect(createFoodAndLog(connection.db, userId, { ...foodInput, name: 'Changed yogurt' }, logInput)).rejects.toThrow(FoodCreateMutationConflictError);
            await expect(createFoodAndLog(connection.db, userId, foodInput, { ...logInput, mealSlot: 'lunch' })).rejects.toThrow(FoodCreateMutationConflictError);
            expect(await connection.db.select().from(foods).all()).toHaveLength(1);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('atomically replays concurrent duplicate offline requests', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const foodInput = { name: 'Concurrent oats', amountUnit: 'mg', basisAmount: '100', energyKcal: '65', proteinG: '10', carbsG: '3.5', fatG: '0.8' };
            const logInput = { clientMutationId, portionKind: 'hundred', portionCount: '2', diaryDate: '2026-07-12', mealSlot: 'breakfast' } as const;
            const results = await Promise.all([
                createFoodAndLog(connection.db, userId, foodInput, logInput),
                createFoodAndLog(connection.db, userId, foodInput, logInput)
            ]);
            expect(new Set(results.map((result) => result.diaryLog.id)).size).toBe(1);
            expect(results.filter((result) => result.replayed)).toHaveLength(1);
            expect(await connection.db.select().from(foods).all()).toHaveLength(1);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });

});
