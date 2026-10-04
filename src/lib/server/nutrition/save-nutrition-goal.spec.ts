import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { nutritionGoals, users } from '$lib/server/db/schema';
import { saveNutritionGoal } from './save-nutrition-goal';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-goals-'));
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
async function insertUser(connection: DatabaseConnection, email: string): Promise<string> {
    return (await connection.db
        .insert(users)
        .values({
        name: 'Patrick',
        email
    })
        .returning({ id: users.id })
        .get()).id;
}
function goalInput(overrides: Record<string, unknown> = {}) {
    return {
        effectiveFrom: '2026-07-12',
        targetEnergyKcal: '2900',
        targetProteinG: '200',
        targetCarbsG: '300',
        targetFatG: '90',
        ...overrides
    };
}
describe('saveNutritionGoal', () => {
    it('inserts a validated goal using fixed-point storage', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'patrick@example.com');
            const goal = await saveNutritionGoal(connection.db, userId, goalInput());
            expect(goal).toMatchObject({
                userId,
                effectiveFrom: '2026-07-12',
                targetEnergyMkcal: 2900000,
                targetProteinMg: 200000,
                targetCarbsMg: 300000,
                targetFatMg: 90000
            });
        });
    });
    it('updates the existing goal for the same user and effective date', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'patrick@example.com');
            const original = await saveNutritionGoal(connection.db, userId, goalInput());
            const updated = await saveNutritionGoal(connection.db, userId, goalInput({
                targetEnergyKcal: '2500.5',
                targetProteinG: '180.25'
            }));
            const storedGoals = await connection.db
                .select()
                .from(nutritionGoals)
                .where(eq(nutritionGoals.userId, userId))
                .all();
            expect(updated.id).toBe(original.id);
            expect(updated.createdAt).toEqual(original.createdAt);
            expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
            expect(updated).toMatchObject({
                targetEnergyMkcal: 2500500,
                targetProteinMg: 180250
            });
            expect(storedGoals).toHaveLength(1);
        });
    });
    it('starts a new effective-dated target period without changing the earlier goal', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'patrick@example.com');
            const earlier = await saveNutritionGoal(connection.db, userId, goalInput({ effectiveFrom: '2026-07-01' }));
            const current = await saveNutritionGoal(connection.db, userId, goalInput({
                effectiveFrom: '2026-07-18',
                targetEnergyKcal: '2500',
                targetProteinG: '180'
            }));
            const storedGoals = await connection.db
                .select()
                .from(nutritionGoals)
                .where(eq(nutritionGoals.userId, userId))
                .all();
            expect(current.id).not.toBe(earlier.id);
            expect(storedGoals).toHaveLength(2);
            expect(storedGoals).toContainEqual(expect.objectContaining({
                id: earlier.id,
                effectiveFrom: '2026-07-01',
                targetEnergyMkcal: 2900000
            }));
            expect(storedGoals).toContainEqual(expect.objectContaining({
                id: current.id,
                effectiveFrom: '2026-07-18',
                targetEnergyMkcal: 2500000,
                targetProteinMg: 180000
            }));
        });
    });
    it('allows different users to have a goal on the same date', async () => {
        await withMigratedDatabase(async (connection) => {
            const firstUserId = await insertUser(connection, 'patrick@example.com');
            const secondUserId = await insertUser(connection, 'other@example.com');
            const firstGoal = await saveNutritionGoal(connection.db, firstUserId, goalInput());
            const secondGoal = await saveNutritionGoal(connection.db, secondUserId, goalInput());
            expect(secondGoal.id).not.toBe(firstGoal.id);
            expect(await connection.db.select().from(nutritionGoals).all()).toHaveLength(2);
        });
    });
    it('does not write anything when validation fails', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection, 'patrick@example.com');
            await expect(saveNutritionGoal(connection.db, userId, goalInput({ effectiveFrom: '2026-02-30' }))).rejects.toThrow();
            expect(await connection.db.select().from(nutritionGoals).all()).toHaveLength(0);
        });
    });
});
