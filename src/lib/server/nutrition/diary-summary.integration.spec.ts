import { mkdtempSync, rmSync } from "node:fs";
import { createDatabase, type DatabaseConnection } from "../db/testing";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from '$lib/server/db/testing';
import { diaryLogs, nutritionGoals } from "../db/schema";
import type { MealSlot } from "$lib/nutrition/constants";
import { describe, expect, it } from 'vitest';
import { createFoodAndLog } from "./create-food-and-log";
import { insertUser } from "./create-food-and-log.spec";
import { loadDiaryDay } from "./diary-summary";
import { eq } from "drizzle-orm";
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-summary-'));
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
async function insertGoal(connection: DatabaseConnection, userId: string, effectiveFrom: string, energyMkcal: number): Promise<void> {
    await connection.db
        .insert(nutritionGoals)
        .values({
        userId,
        effectiveFrom,
        targetEnergyMkcal: energyMkcal,
        targetProteinMg: 200000,
        targetCarbsMg: 300000,
        targetFatMg: 90000
    })
        .run();
}
interface LogOptions {
    mutationId: string;
    name: string;
    mealSlot: MealSlot;
    energyKcal: string;
    proteinG: string;
    carbsG: string;
    fatG: string;
}
async function logFood(connection: DatabaseConnection, userId: string, options: LogOptions) {
    return await createFoodAndLog(connection.db, userId, {
        name: options.name,
        amountUnit: 'mg',
        basisAmount: '100',
        energyKcal: options.energyKcal,
        proteinG: options.proteinG,
        carbsG: options.carbsG,
        fatG: options.fatG
    }, {
        clientMutationId: options.mutationId,
        portionKind: 'hundred',
        portionCount: '1',
        diaryDate: '2026-07-12',
        mealSlot: options.mealSlot
    });
}
describe('loadDiaryDay', () => {
    it('selects the applicable goal and groups meal totals', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            insertGoal(connection, userId, '2026-01-01', 2000000);
            insertGoal(connection, userId, '2026-07-01', 2500000);
            insertGoal(connection, userId, '2026-08-01', 3000000);
            await logFood(connection, userId, {
                mutationId: '550e8400-e29b-41d4-a716-446655440001',
                name: 'Greek yoghurt',
                mealSlot: 'breakfast',
                energyKcal: '200',
                proteinG: '20',
                carbsG: '10',
                fatG: '5'
            });
            await logFood(connection, userId, {
                mutationId: '550e8400-e29b-41d4-a716-446655440002',
                name: 'Rice',
                mealSlot: 'lunch',
                energyKcal: '400',
                proteinG: '10',
                carbsG: '80',
                fatG: '2'
            });
            const summary = await loadDiaryDay(connection.db, userId, '2026-07-12');
            expect(summary.goal?.effectiveFrom).toBe('2026-07-01');
            expect(summary.totals).toEqual({
                energyMkcal: 600000,
                proteinMg: 30000,
                carbsMg: 90000,
                fatMg: 7000
            });
            expect(summary.meals.breakfast.entries).toHaveLength(1);
            expect(summary.meals.breakfast.totals.energyMkcal)
                .toBe(200000);
            expect(summary.meals.lunch.entries).toHaveLength(1);
            expect(summary.meals.lunch.totals.energyMkcal)
                .toBe(400000);
            expect(summary.meals.dinner.entries).toHaveLength(0);
            expect(summary.meals.snacks.entries).toHaveLength(0);
            expect(summary.balances?.energyMkcal).toEqual({
                consumed: 600000,
                target: 2500000,
                remaining: 1900000,
                over: 0
            });
        });
    });
    it('excludes deleted and other-user entries', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const otherUserId = await insertUser(connection, 'other@example.com');
            insertGoal(connection, userId, '2026-01-01', 2000000);
            await logFood(connection, userId, {
                mutationId: '550e8400-e29b-41d4-a716-446655440003',
                name: 'Active food',
                mealSlot: 'breakfast',
                energyKcal: '100',
                proteinG: '10',
                carbsG: '10',
                fatG: '5'
            });
            const deleted = await logFood(connection, userId, {
                mutationId: '550e8400-e29b-41d4-a716-446655440004',
                name: 'Deleted food',
                mealSlot: 'lunch',
                energyKcal: '500',
                proteinG: '20',
                carbsG: '20',
                fatG: '10'
            });
            await connection.db
                .update(diaryLogs)
                .set({
                deletedAt: new Date()
            })
                .where(eq(diaryLogs.id, deleted.diaryLog.id))
                .run();
            // Same mutation UUID is valid for another user.
            await logFood(connection, otherUserId, {
                mutationId: '550e8400-e29b-41d4-a716-446655440003',
                name: 'Other user food',
                mealSlot: 'dinner',
                energyKcal: '900',
                proteinG: '30',
                carbsG: '30',
                fatG: '20'
            });
            const summary = await loadDiaryDay(connection.db, userId, '2026-07-12');
            expect(summary.totals.energyMkcal).toBe(100000);
            expect(summary.meals.breakfast.entries).toHaveLength(1);
            expect(summary.meals.lunch.entries).toHaveLength(0);
            expect(summary.meals.dinner.entries).toHaveLength(0);
            const beforeFirstGoal = await loadDiaryDay(connection.db, userId, '2025-12-31');
            expect(beforeFirstGoal.goal).toBeNull();
            expect(beforeFirstGoal.balances).toBeNull();
            expect(beforeFirstGoal.totals.energyMkcal).toBe(0);
        });
    });
});
