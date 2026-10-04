import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import { logFoodInputSchema } from '$lib/nutrition/portion-input';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { diaryLogs, foods, users, type Food } from '$lib/server/db/schema';
import { buildDiaryLogValues } from './diary-entry';
import { findActiveFoodByBarcode, listActiveFoods } from './food-catalogue';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-food-catalogue-'));
    const connection = await createDatabase(join(directory, 'test.db'));
    try {
        await migrate(connection.db, {
            migrationsFolder: 'drizzle'
        });
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
async function insertUser(connection: DatabaseConnection): Promise<string> {
    return (await connection.db
        .insert(users)
        .values({
        name: 'Patrick',
        email: 'patrick@example.com'
    })
        .returning({ id: users.id })
        .get()).id;
}
async function insertFood(connection: DatabaseConnection, userId: string, name: string, barcode?: string): Promise<Food> {
    return await connection.db
        .insert(foods)
        .values({
        userId,
        name,
        barcode,
        amountUnit: 'mg',
        basisAmount: 100000,
        energyMkcalPerBasis: 100000,
        proteinMgPerBasis: 10000,
        carbsMgPerBasis: 20000,
        fatMgPerBasis: 5000
    })
        .returning()
        .get();
}
describe('listActiveFoods', () => {
    it('finds an exact barcode only in the active user catalogue', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const otherUserId = (await connection.db
                .insert(users)
                .values({
                name: 'Another user',
                email: 'other@example.com'
            })
                .returning({ id: users.id })
                .get()).id;
            const matchingFood = await insertFood(connection, userId, 'Own barcode match', '0012345678905');
            await insertFood(connection, otherUserId, 'Other user barcode match', '0012345678905');
            const result = await findActiveFoodByBarcode(connection.db, userId, '0012345678905');
            expect(result).toMatchObject({
                id: matchingFood.id,
                barcode: '0012345678905'
            });
        });
    });
    it('orders by latest use before applying the result limit', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            for (let index = 0; index < 50; index += 1) {
                await insertFood(connection, userId, `Food ${index.toString().padStart(2, '0')}`);
            }
            const recentlyUsedFood = await insertFood(connection, userId, 'Zulu recent');
            const logInput = logFoodInputSchema.parse({
                clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
                portionKind: 'hundred',
                portionCount: '1.25',
                diaryDate: '2026-07-16',
                mealSlot: 'lunch'
            });
            await connection.db
                .insert(diaryLogs)
                .values({
                ...buildDiaryLogValues(recentlyUsedFood, logInput),
                loggedAt: new Date('2026-07-16T12:00:00Z')
            })
                .run();
            const results = await listActiveFoods(connection.db, userId, '', 50);
            expect(results).toHaveLength(50);
            expect(results[0]).toMatchObject({
                id: recentlyUsedFood.id,
                name: 'Zulu recent',
                latestUse: {
                    resolvedAmount: 125000,
                    amountUnit: 'mg',
                    energyMkcal: 125000
                }
            });
        });
    });
});
