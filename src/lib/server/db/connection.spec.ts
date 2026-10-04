import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from './testing';
import { foods, mealShortcutItems, mealShortcuts, nutritionGoals, users } from './schema';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-db-'));
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
async function insertUser(connection: DatabaseConnection): Promise<string> {
    return (await connection.db
        .insert(users)
        .values({ name: 'Patrick', email: 'patrick@example.com' })
        .returning({ id: users.id })
        .get()).id;
}
async function insertFood(connection: DatabaseConnection, userId: string, overrides: Partial<typeof foods.$inferInsert> = {}): Promise<string> {
    return (await connection.db
        .insert(foods)
        .values({
        userId,
        name: 'Greek yoghurt',
        barcode: '0001234567890',
        amountUnit: 'mg',
        basisAmount: 100000,
        energyMkcalPerBasis: 65000,
        proteinMgPerBasis: 10000,
        carbsMgPerBasis: 3500,
        fatMgPerBasis: 800,
        ...overrides
    })
        .returning({ id: foods.id })
        .get()).id;
}
async function expectCauseToMatch(rejection: Promise<unknown>, pattern: RegExp): Promise<void> {
    const error = await rejection.then(
        () => { throw new Error('Expected the database operation to reject'); },
        (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(Error);
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    expect(causeMessage).toMatch(pattern);
}
describe('D1 database', () => {
    it('enforces foreign keys and runs the complete migration', async () => {
        await withMigratedDatabase(async ({ binding }) => {
            expect((await binding.prepare('PRAGMA foreign_keys').first<{ foreign_keys: number }>())?.foreign_keys).toBe(1);
            const { results } = await binding.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'").all<{name: string}>();
            const tables = results.map((row) => row.name).filter((name) => !name.startsWith('_')).sort();
            expect(tables).toEqual([
                'atomic_guards',
                'auth_accounts',
                'diary_logs',
                'foods',
                'meal_shortcut_applications',
                'meal_shortcut_items',
                'meal_shortcuts',
                'nutrition_goals',
                'sessions',
                'users'
            ]);
        });
    });
    it('enforces positive food amounts and non-negative nutrition goals', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            await expectCauseToMatch(insertFood(connection, userId, { basisAmount: 0 }), /CHECK constraint/);
            await expectCauseToMatch(connection.db
                .insert(nutritionGoals)
                .values({
                userId,
                effectiveFrom: '2026-07-11',
                targetEnergyMkcal: -1,
                targetProteinMg: 200000,
                targetCarbsMg: 300000,
                targetFatMg: 90000
            })
                .run(), /CHECK constraint/);
        });
    });
    it('allows a barcode to be reused only after its previous food is archived', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const originalFoodId = await insertFood(connection, userId);
            await expectCauseToMatch(insertFood(connection, userId, { name: 'Duplicate' }), /UNIQUE constraint/);
            await connection.db
                .update(foods)
                .set({ deletedAt: new Date() })
                .where(eq(foods.id, originalFoodId))
                .run();
            expect(await insertFood(connection, userId, { name: 'Replacement' })).toBeTypeOf('string');
        });
    });
    it('prevents hard deletion of a food referenced by a meal shortcut', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const foodId = await insertFood(connection, userId);
            const shortcutId = (await connection.db
                .insert(mealShortcuts)
                .values({ userId, name: 'Breakfast' })
                .returning({ id: mealShortcuts.id })
                .get()).id;
            await connection.db
                .insert(mealShortcutItems)
                .values({
                userId,
                shortcutId,
                foodId,
                amountUnit: 'mg',
                position: 0,
                defaultAmount: 100000
            })
                .run();
            await expectCauseToMatch(connection.db.delete(foods).where(eq(foods.id, foodId)).run(), /FOREIGN KEY constraint/);
        });
    });
    it('rejects partially populated meal shortcut portion snapshots', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const foodId = await insertFood(connection, userId);
            const shortcutId = (await connection.db
                .insert(mealShortcuts)
                .values({ userId, name: 'Breakfast' })
                .returning({ id: mealShortcuts.id })
                .get()).id;
            await expectCauseToMatch(connection.db
                .insert(mealShortcutItems)
                .values({
                userId,
                shortcutId,
                foodId,
                amountUnit: 'mg',
                position: 0,
                defaultAmount: 100000,
                defaultPortionKind: 'unit',
                defaultPortionLabel: '1 g',
                defaultPortionAmount: null,
                defaultPortionCountMilli: 1000
            })
                .run(), /CHECK constraint/);
        });
    });
});
