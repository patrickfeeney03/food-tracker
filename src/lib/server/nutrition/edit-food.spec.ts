import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '$lib/server/db/testing';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { diaryLogs, foods, mealShortcutItems, mealShortcuts, users, type Food } from '$lib/server/db/schema';
import { createFoodAndLog } from './create-food-and-log';
import { archiveFood, FoodBarcodeConflictError, FoodAmountUnitConflictError, FoodEditConflictError, FoodNotFoundError, formatFoodForEdit, getActiveFoodForEdit, updateFood } from './edit-food';
import { listActiveFoods } from './food-catalogue';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-edit-food-'));
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
    return (await connection.db
        .insert(users)
        .values({ name: email.split('@')[0], email })
        .returning({ id: users.id })
        .get()).id;
}
async function insertFood(connection: DatabaseConnection, userId: string, overrides: Partial<typeof foods.$inferInsert> = {}): Promise<Food> {
    return await connection.db
        .insert(foods)
        .values({
        userId,
        name: 'Original food',
        brand: 'Original brand',
        barcode: '000111222333',
        amountUnit: 'mg',
        basisAmount: 100000,
        servingAmount: 125500,
        containerAmount: 500000,
        energyMkcalPerBasis: 245750,
        proteinMgPerBasis: 12500,
        carbsMgPerBasis: 30250,
        fatMgPerBasis: 7125,
        additionalNutritionJson: {
            fibreMg: 2500,
            sugarMg: 4250,
            saturatedFatMg: 1500,
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
    it('formats every stored field for the edit form without fixed-point drift', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            expect(await formatFoodForEdit(food)).toEqual({
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
    it('updates all core fields and maps additional nutrition', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const createdAt = food.createdAt;
            const updated = await updateFood(connection.db, userId, food.id, {
                ...await formatFoodForEdit(food),
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
                basisAmount: 330125,
                servingAmount: 165500,
                containerAmount: 990375,
                energyMkcalPerBasis: 123456,
                proteinMgPerBasis: 4125,
                carbsMgPerBasis: 18750,
                fatMgPerBasis: 3500,
                additionalNutritionJson: {
                    fibreMg: 1250,
                    sugarMg: 8750,
                    saturatedFatMg: 2125,
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
    it('turns cleared optional values into null', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const updated = await updateFood(connection.db, userId, food.id, {
                ...await formatFoodForEdit(food),
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
    it('prevents changing between g and ml while any meal shortcut references the food', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const shortcut = await connection.db.insert(mealShortcuts).values({
                userId,
                name: 'Referenced meal'
            }).returning().get();
            await connection.db.insert(mealShortcutItems).values({
                userId,
                shortcutId: shortcut.id,
                foodId: food.id,
                amountUnit: food.amountUnit,
                position: 0,
                defaultAmount: 100000,
                defaultPortionKind: 'hundred',
                defaultPortionLabel: '100 g',
                defaultPortionAmount: 100000,
                defaultPortionCountMilli: 1000
            }).run();
            await expect(updateFood(connection.db, userId, food.id, {
                ...await formatFoodForEdit(food),
                amountUnit: 'ul'
            })).rejects.toThrow(FoodAmountUnitConflictError);
            await connection.db.update(mealShortcuts).set({ deletedAt: new Date() })
                .where(eq(mealShortcuts.id, shortcut.id)).run();
            await expect(updateFood(connection.db, userId, food.id, {
                ...await formatFoodForEdit(food),
                amountUnit: 'ul'
            })).rejects.toThrow(FoodAmountUnitConflictError);
            expect((await getActiveFoodForEdit(connection.db, userId, food.id))?.amountUnit).toBe('mg');
        });
    });
    it('isolates ownership and treats missing or archived foods as not found', async () => {
        await withMigratedDatabase(async (connection) => {
            const ownerId = await insertUser(connection, 'owner@example.com');
            const otherId = await insertUser(connection, 'other@example.com');
            const food = await insertFood(connection, ownerId);
            const input = await formatFoodForEdit(food);
            expect(await getActiveFoodForEdit(connection.db, otherId, food.id)).toBeUndefined();
            expect(await getActiveFoodForEdit(connection.db, ownerId, 'missing')).toBeUndefined();
            await expect(updateFood(connection.db, otherId, food.id, input)).rejects.toThrow(FoodNotFoundError);
            await connection.db
                .update(foods)
                .set({ deletedAt: new Date('2026-07-18T11:00:00Z') })
                .where(eq(foods.id, food.id))
                .run();
            expect(await getActiveFoodForEdit(connection.db, ownerId, food.id)).toBeUndefined();
            await expect(updateFood(connection.db, ownerId, food.id, input)).rejects.toThrow(FoodNotFoundError);
        });
    });
    it('returns a specific barcode collision and leaves both foods unchanged', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const other = await insertFood(connection, userId, {
                name: 'Other food',
                barcode: '444555666777'
            });
            await expect(updateFood(connection.db, userId, food.id, {
                ...await formatFoodForEdit(food),
                name: 'Should not save',
                barcode: other.barcode
            })).rejects.toThrow(FoodBarcodeConflictError);
            expect(await getActiveFoodForEdit(connection.db, userId, food.id)).toMatchObject({
                name: 'Original food',
                barcode: '000111222333'
            });
        });
    });
    it('rejects a stale optimistic-concurrency version', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const staleInput = await formatFoodForEdit(food);
            await updateFood(connection.db, userId, food.id, {
                ...staleInput,
                name: 'First update wins'
            });
            await expect(updateFood(connection.db, userId, food.id, {
                ...staleInput,
                name: 'Stale overwrite'
            })).rejects.toThrow(FoodEditConflictError);
            expect((await getActiveFoodForEdit(connection.db, userId, food.id))?.name).toBe('First update wins');
        });
    });
    it('soft-archives an owned active food and removes it from listActiveFoods', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const food = await insertFood(connection, userId);
            const archived = await archiveFood(connection.db, userId, food.id, String(food.updatedAt.getTime()));
            expect(archived.deletedAt).toBeInstanceOf(Date);
            expect(await connection.db.select().from(foods).where(eq(foods.id, food.id)).get()).toBeDefined();
            expect(await getActiveFoodForEdit(connection.db, userId, food.id)).toBeUndefined();
            expect(await listActiveFoods(connection.db, userId, '')).toEqual([]);
            await expect(archiveFood(connection.db, userId, food.id, String(archived.updatedAt.getTime()))).rejects.toThrow(FoodNotFoundError);
        });
    });
    it('does not change an existing diary snapshot when the reusable food is edited or archived', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'owner@example.com');
            const created = await createFoodAndLog(connection.db, userId, {
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
            }, {
                clientMutationId: '550e8400-e29b-41d4-a716-446655440000',
                portionKind: 'serving',
                portionCount: '1.5',
                diaryDate: '2026-07-18',
                mealSlot: 'breakfast'
            });
            const snapshotBefore = await connection.db
                .select()
                .from(diaryLogs)
                .where(eq(diaryLogs.id, created.diaryLog.id))
                .get();
            const updated = await updateFood(connection.db, userId, created.food.id, {
                ...await formatFoodForEdit(created.food),
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
            expect(await connection.db.select().from(diaryLogs).where(eq(diaryLogs.id, created.diaryLog.id)).get()).toEqual(snapshotBefore);
            await archiveFood(connection.db, userId, updated.id, String(updated.updatedAt.getTime()));
            expect(await connection.db.select().from(diaryLogs).where(eq(diaryLogs.id, created.diaryLog.id)).get()).toEqual(snapshotBefore);
            expect(snapshotBefore).toMatchObject({
                foodName: 'Historical oats',
                foodBrand: 'Old brand',
                basisAmount: 100000,
                portionKind: 'serving',
                portionAmount: 40000,
                resolvedAmount: 60000,
                energyMkcalPerBasis: 380000,
                energyMkcal: 228000
            });
        });
    });
});
