import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '$lib/server/db/testing';
import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createDatabase, type AppDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import { diaryLogs, foods, users, type Food, type User } from '$lib/server/db/schema';
const databaseState: { database?: AppDatabase } = {};
import { POST } from '../../../routes/api/offline/diary-logs/+server';
async function withMigratedDatabase(run: (connection: DatabaseConnection) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 'calories-offline-diary-logs-'));
    const connection = await createDatabase(join(directory, 'test.db'));
    try {
        await migrate(connection.db, {
            migrationsFolder: 'drizzle'
        });
        databaseState.database = connection.db;
        await run(connection);
    }
    finally {
        databaseState.database = undefined;
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
        brand: 'Queued test food',
        barcode: null,
        amountUnit: 'mg',
        basisAmount: 100000,
        servingAmount: 150000,
        containerAmount: null,
        energyMkcalPerBasis: 250000,
        proteinMgPerBasis: 12000,
        carbsMgPerBasis: 30000,
        fatMgPerBasis: 8000,
        additionalNutritionJson: null,
        notes: null,
        deletedAt: values.deletedAt
    })
        .returning()
        .get();
}
function queuedLog(userId: string, foodId: string, clientMutationId = crypto.randomUUID()) {
    return {
        schemaVersion: 1,
        kind: 'log-existing-food',
        userId,
        foodId,
        input: {
            clientMutationId,
            portionKind: 'serving',
            portionCount: '2',
            diaryDate: '2026-07-24',
            mealSlot: 'breakfast'
        }
    };
}
async function postQueuedLog(user: User | null, body: unknown, raw = false): Promise<Response> {
    const request = new Request('http://localhost/api/offline/diary-logs', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: raw ? String(body) : JSON.stringify(body)
    });
    return await POST({
        locals: {
            db: databaseState.database,
            user
        },
        request
    } as unknown as RequestEvent);
}
describe('POST /api/offline/diary-logs', () => {
    it('requires the authenticated user from request locals', async () => {
        await expect(postQueuedLog(null, queuedLog(crypto.randomUUID(), crypto.randomUUID()))).rejects.toMatchObject({
            status: 303,
            location: '/sign-in'
        });
    });
    it('acknowledges a queued log and returns the refreshed tracker snapshot', async () => {
        await withMigratedDatabase(async (connection) => {
            const user = await insertUser(connection, 'Patrick', 'patrick@example.com');
            const food = await insertFood(connection, user.id, { name: 'Queued oats' });
            const payload = queuedLog(user.id, food.id);
            const response = await postQueuedLog(user, payload);
            const result = await response.json();
            expect(response.status).toBe(200);
            expect(response.headers.get('cache-control')).toBe('private, no-store');
            expect(result).toMatchObject({
                schemaVersion: 1,
                acknowledgedMutationId: payload.input.clientMutationId,
                snapshot: {
                    schemaVersion: 1,
                    user: {
                        id: user.id,
                        name: user.name
                    },
                    diaryDays: {
                        '2026-07-24': {
                            date: '2026-07-24'
                        }
                    }
                }
            });
            expect(result.snapshot.diaryDays['2026-07-24'].meals.breakfast.entries).toHaveLength(1);
            expect(result.snapshot.diaryDays['2026-07-24'].meals.breakfast.entries[0]).toMatchObject({
                foodId: food.id,
                foodName: 'Queued oats',
                portionKind: 'serving',
                portionCountMilli: 2000,
                resolvedAmount: 300000
            });
        });
    });
    it('replays the same mutation without creating a duplicate log', async () => {
        await withMigratedDatabase(async (connection) => {
            const user = await insertUser(connection, 'Patrick', 'patrick@example.com');
            const food = await insertFood(connection, user.id, { name: 'Replayable oats' });
            const payload = queuedLog(user.id, food.id);
            const first = await postQueuedLog(user, payload);
            const replay = await postQueuedLog(user, payload);
            expect(first.status).toBe(200);
            expect(replay.status).toBe(200);
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('returns a conflict when a mutation ID is reused for different input', async () => {
        await withMigratedDatabase(async (connection) => {
            const user = await insertUser(connection, 'Patrick', 'patrick@example.com');
            const food = await insertFood(connection, user.id, { name: 'Conflicting oats' });
            const payload = queuedLog(user.id, food.id);
            const first = await postQueuedLog(user, payload);
            const conflict = await postQueuedLog(user, {
                ...payload,
                input: {
                    ...payload.input,
                    mealSlot: 'lunch'
                }
            });
            expect(first.status).toBe(200);
            expect(conflict.status).toBe(409);
            expect(await conflict.json()).toEqual({
                message: 'This mutation ID has already been used for a different diary entry.'
            });
            expect(conflict.headers.get('cache-control')).toBe('private, no-store');
            expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(1);
        });
    });
    it('does not log archived or cross-user foods', async () => {
        await withMigratedDatabase(async (connection) => {
            const user = await insertUser(connection, 'Patrick', 'patrick@example.com');
            const otherUser = await insertUser(connection, 'Other', 'other@example.com');
            const archivedFood = await insertFood(connection, user.id, {
                name: 'Archived food',
                deletedAt: new Date('2026-07-23T00:00:00.000Z')
            });
            const otherFood = await insertFood(connection, otherUser.id, { name: 'Other user food' });
            const archivedResponse = await postQueuedLog(user, queuedLog(user.id, archivedFood.id));
            const crossUserResponse = await postQueuedLog(user, queuedLog(user.id, otherFood.id));
            expect(archivedResponse.status).toBe(404);
            expect(crossUserResponse.status).toBe(404);
            expect(await crossUserResponse.json()).toEqual({
                message: 'Food not found'
            });
            expect(await connection.db.select().from(diaryLogs).all()).toEqual([]);
        });
    });
    it('rejects malformed JSON and invalid queued log input without writing', async () => {
        await withMigratedDatabase(async (connection) => {
            const user = await insertUser(connection, 'Patrick', 'patrick@example.com');
            const food = await insertFood(connection, user.id, { name: 'Validated oats' });
            const malformedResponse = await postQueuedLog(user, '{not-json', true);
            const invalidResponse = await postQueuedLog(user, {
                ...queuedLog(user.id, food.id),
                input: {
                    ...queuedLog(user.id, food.id).input,
                    diaryDate: '2026-02-30'
                }
            });
            expect(malformedResponse.status).toBe(400);
            expect(await malformedResponse.json()).toEqual({
                message: 'Invalid JSON request body.'
            });
            expect(invalidResponse.status).toBe(400);
            expect(await invalidResponse.json()).toEqual({
                message: 'Invalid queued diary log.'
            });
            expect(invalidResponse.headers.get('cache-control')).toBe('private, no-store');
            expect(await connection.db.select().from(diaryLogs).all()).toEqual([]);
        });
    });
    it('keeps a queued change pending when it belongs to another user', async () => {
        await withMigratedDatabase(async (connection) => {
            const queuedUser = await insertUser(connection, 'Queued user', 'queued@example.com');
            const authenticatedUser = await insertUser(connection, 'Authenticated user', 'authenticated@example.com');
            const food = await insertFood(connection, queuedUser.id, { name: 'Queued oats' });
            const response = await postQueuedLog(authenticatedUser, queuedLog(queuedUser.id, food.id));
            expect(response.status).toBe(403);
            expect(await response.json()).toEqual({
                message: 'Queued change belongs to a different user.'
            });
            expect(await connection.db.select().from(diaryLogs).all()).toEqual([]);
        });
    });
});
