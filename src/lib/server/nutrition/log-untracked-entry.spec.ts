import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { migrate } from '$lib/server/db/testing';
import { diaryLogs, users } from '$lib/server/db/schema';
import { createFoodAndLog } from './create-food-and-log';
import { loadDiaryDay } from './diary-summary';
import { logUntrackedEntry, UntrackedEntryConflictError } from './log-untracked-entry';

async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-untracked-entry-'));
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
    return (await connection.db.insert(users).values({ name: 'Patrick', email }).returning({ id: users.id }).get()).id;
}
function untrackedInput(overrides: Record<string, unknown> = {}) {
    return {
        clientMutationId: crypto.randomUUID(),
        name: 'Boojum',
        diaryDate: '2026-07-16',
        mealSlot: 'dinner' as const,
        ...overrides
    };
}
describe('logUntrackedEntry', () => {
    it('creates an untracked entry with no food and zero nutrition', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const { entry, replayed } = await logUntrackedEntry(connection.db, userId, untrackedInput());
            expect(replayed).toBe(false);
            expect(entry).toMatchObject({
                userId,
                untracked: true,
                foodId: null,
                foodName: 'Boojum',
                foodBrand: null,
                diaryDate: '2026-07-16',
                mealSlot: 'dinner',
                energyMkcal: 0,
                proteinMg: 0,
                carbsMg: 0,
                fatMg: 0,
                additionalNutritionTotalJson: null
            });
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('replays an identical request without creating another entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const input = untrackedInput();
            const first = await logUntrackedEntry(connection.db, userId, input);
            const second = await logUntrackedEntry(connection.db, userId, input);
            expect(second.replayed).toBe(true);
            expect(second.entry.id).toBe(first.entry.id);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('rejects a reused mutation ID with a different name, date or meal', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const input = untrackedInput();
            await logUntrackedEntry(connection.db, userId, input);
            for (const change of [{ name: 'Other' }, { diaryDate: '2026-07-17' }, { mealSlot: 'lunch' }]) {
                await expect(logUntrackedEntry(connection.db, userId, { ...input, ...change })).rejects.toThrow(UntrackedEntryConflictError);
            }
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('rejects a mutation ID that belongs to a tracked entry', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const clientMutationId = crypto.randomUUID();
            const created = await createFoodAndLog(connection.db, userId, {
                name: 'Boojum',
                amountUnit: 'mg',
                basisAmount: '100',
                energyKcal: '100',
                proteinG: '1',
                carbsG: '1',
                fatG: '1'
            }, {
                clientMutationId,
                portionKind: 'hundred',
                portionCount: '1',
                diaryDate: '2026-07-16',
                mealSlot: 'dinner'
            });
            expect(created.diaryLog.untracked).toBe(false);
            await expect(logUntrackedEntry(connection.db, userId, untrackedInput({ clientMutationId }))).rejects.toThrow(UntrackedEntryConflictError);
        });
    });
    it('rejects invalid input', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            await expect(logUntrackedEntry(connection.db, userId, untrackedInput({ name: '   ' }))).rejects.toThrow(ZodError);
            await expect(logUntrackedEntry(connection.db, userId, untrackedInput({ diaryDate: '2026-02-31' }))).rejects.toThrow(ZodError);
            await expect(logUntrackedEntry(connection.db, userId, untrackedInput({ diaryDate: 'yesterday' }))).rejects.toThrow(ZodError);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(0);
        });
    });
    it('appears in its meal on the diary day without affecting totals', async () => {
        await withMigratedDatabase(async (connection) => {
            const userId = await insertUser(connection);
            const { entry } = await logUntrackedEntry(connection.db, userId, untrackedInput());
            const day = await loadDiaryDay(connection.db, userId, '2026-07-16');
            expect(day.meals.dinner.entries.map((e) => e.id)).toEqual([entry.id]);
            expect(day.totals).toMatchObject({ energyMkcal: 0, proteinMg: 0, carbsMg: 0, fatMg: 0 });
        });
    });
});
