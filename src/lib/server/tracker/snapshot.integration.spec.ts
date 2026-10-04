import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { diaryLogs, foods, nutritionGoals, users, type Food, type User } from '$lib/server/db/schema';
import { buildDiaryLogValues } from '$lib/server/nutrition/diary-entry';
import { buildTrackerSnapshot } from './snapshot';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-tracker-snapshot-'));
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
async function insertUser(connection: DatabaseConnection, name: string, email: string): Promise<User> {
    return await connection.db
        .insert(users)
        .values({ name, email })
        .returning()
        .get();
}
async function insertFood(connection: DatabaseConnection, userId: string, values: {
    name: string;
    deletedAt?: Date;
}): Promise<Food> {
    return await connection.db
        .insert(foods)
        .values({
        userId,
        name: values.name,
        brand: 'Test brand',
        barcode: null,
        amountUnit: 'mg',
        basisAmount: 250000,
        servingAmount: 125000,
        containerAmount: 500000,
        energyMkcalPerBasis: 342000,
        proteinMgPerBasis: 52500,
        carbsMgPerBasis: 1000,
        fatMgPerBasis: 12500,
        additionalNutritionJson: {
            fibreMg: 4000,
            sodiumMg: 350
        },
        notes: 'Full food snapshot',
        deletedAt: values.deletedAt
    })
        .returning()
        .get();
}
async function insertDiaryEntry(connection: DatabaseConnection, food: Food, values: {
    diaryDate: string;
    portionKind: 'hundred' | 'serving';
    portionCount: string;
    loggedAt: Date;
    deletedAt?: Date;
}): Promise<void> {
    await connection.db
        .insert(diaryLogs)
        .values({
        ...buildDiaryLogValues(food, {
            clientMutationId: crypto.randomUUID(),
            diaryDate: values.diaryDate,
            mealSlot: 'breakfast',
            portionKind: values.portionKind,
            portionCount: values.portionCount
        }),
        loggedAt: values.loggedAt,
        deletedAt: values.deletedAt
    })
        .run();
}
describe('buildTrackerSnapshot', () => {
    it('returns a complete user-scoped diary and every active food', async () => {
        await withMigratedDatabase(async (connection) => {
            const user = await insertUser(connection, 'Patrick', 'patrick@example.com');
            const otherUser = await insertUser(connection, 'Other', 'other@example.com');
            const savedAt = new Date('2026-07-24T12:30:00.000Z');
            await connection.db
                .insert(nutritionGoals)
                .values({
                userId: user.id,
                effectiveFrom: '2026-07-01',
                targetEnergyMkcal: 2500000,
                targetProteinMg: 200000,
                targetCarbsMg: 300000,
                targetFatMg: 90000
            })
                .run();
            const usedFood = await insertFood(connection, user.id, { name: 'Used food' });
            for (let index = 0; index < 51; index += 1) {
                await insertFood(connection, user.id, {
                    name: `Unused food ${index.toString().padStart(2, '0')}`
                });
            }
            await insertFood(connection, user.id, {
                name: 'Archived food',
                deletedAt: new Date('2026-07-20T00:00:00.000Z')
            });
            await insertFood(connection, otherUser.id, {
                name: 'Other user food'
            });
            await insertDiaryEntry(connection, usedFood, {
                diaryDate: '2026-07-20',
                portionKind: 'hundred',
                portionCount: '1',
                loggedAt: new Date('2026-07-20T08:00:00.000Z')
            });
            await insertDiaryEntry(connection, usedFood, {
                diaryDate: '2026-07-24',
                portionKind: 'serving',
                portionCount: '2',
                loggedAt: new Date('2026-07-24T08:00:00.000Z')
            });
            await insertDiaryEntry(connection, usedFood, {
                diaryDate: '2026-07-25',
                portionKind: 'hundred',
                portionCount: '3',
                loggedAt: new Date('2026-07-25T08:00:00.000Z'),
                deletedAt: new Date('2026-07-25T09:00:00.000Z')
            });
            const result = await buildTrackerSnapshot(connection.db, user, '2026-07-24', savedAt);
            expect(result).toMatchObject({
                schemaVersion: 1,
                user: {
                    id: user.id,
                    name: 'Patrick'
                },
                savedAt: savedAt.getTime(),
                diaryDays: {
                    '2026-07-24': {
                        date: '2026-07-24',
                        goal: {
                            effectiveFrom: '2026-07-01',
                            targetEnergyMkcal: 2500000
                        },
                        totals: {
                            energyMkcal: 342000,
                            proteinMg: 52500,
                            carbsMg: 1000,
                            fatMg: 12500
                        }
                    }
                }
            });
            expect(Object.keys(result.diaryDays)).toEqual([
                '2026-07-19',
                '2026-07-20',
                '2026-07-21',
                '2026-07-22',
                '2026-07-23',
                '2026-07-24',
                '2026-07-25',
                '2026-07-26',
                '2026-07-27',
                '2026-07-28',
                '2026-07-29'
            ]);
            expect(result.diaryDays['2026-07-24'].meals.breakfast.entries).toHaveLength(1);
            expect(result.diaryDays['2026-07-24'].meals.breakfast.entries[0]).toMatchObject({
                foodId: usedFood.id,
                foodName: 'Used food',
                portionKind: 'serving',
                portionAmount: 125000,
                portionCountMilli: 2000,
                resolvedAmount: 250000,
                additionalNutritionPerBasis: {
                    fibreMg: 4000,
                    sodiumMg: 350
                },
                additionalNutritionTotal: {
                    fibreMg: 4000,
                    sodiumMg: 350
                },
                loggedAt: '2026-07-24T08:00:00.000Z'
            });
            expect(result.diaryDays['2026-07-20'].meals.breakfast.entries).toHaveLength(1);
            expect(result.diaryDays['2026-07-24'].meals.lunch.entries).toEqual([]);
            expect(result.foods).toHaveLength(52);
            expect(result.foods.map((food) => food.name)).not.toContain('Archived food');
            expect(result.foods.map((food) => food.name)).not.toContain('Other user food');
            const offlineFood = result.foods.find((food) => food.id === usedFood.id);
            expect(offlineFood).toMatchObject({
                brand: 'Test brand',
                basisAmount: 250000,
                servingAmount: 125000,
                containerAmount: 500000,
                energyMkcalPerBasis: 342000,
                proteinMgPerBasis: 52500,
                carbsMgPerBasis: 1000,
                fatMgPerBasis: 12500,
                additionalNutrition: {
                    fibreMg: 4000,
                    sodiumMg: 350
                },
                notes: 'Full food snapshot',
                latestUse: {
                    loggedAt: '2026-07-24T08:00:00.000Z',
                    portionKind: 'serving',
                    portionAmount: 125000,
                    portionCountMilli: 2000,
                    resolvedAmount: 250000,
                    energyMkcal: 342000
                }
            });
        });
    });
});
