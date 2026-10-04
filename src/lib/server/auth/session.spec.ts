import { describe, expect, it } from 'vitest';
import { createDatabase } from '../db/testing';
import { users } from '../db/schema';
import {
  createSession, generateSessionToken, hashSessionToken, revokeSession,
  SESSION_DURATION_MS, SESSION_REFRESH_INTERVAL_MS, validateSessionToken
} from './session';

async function withDatabase<T>(run: (db: Awaited<ReturnType<typeof createDatabase>>['db']) => Promise<T>) {
  const connection = await createDatabase();
  try { return await run(connection.db); }
  finally { await connection.client.close(); }
}

async function insertUser(db: Awaited<ReturnType<typeof createDatabase>>['db']) {
  const user = await db.insert(users).values({ name: 'Patrick', email: 'patrick@example.com' }).returning().get();
  return user.id;
}

describe('session tokens', () => {
  it('generates URL-safe tokens and stable SHA-256 hashes', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(token);
    expect(hashSessionToken('secret-token')).toBe(hashSessionToken('secret-token'));
    expect(hashSessionToken('first-token')).not.toBe(hashSessionToken('second-token'));
    expect(hashSessionToken('secret-token')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken('secret-token')).not.toBe('secret-token');
  });

  it('creates a session and refreshes it after 24 hours', async () => withDatabase(async (db) => {
    const userId = await insertUser(db);
    const createdAt = new Date('2026-07-12T12:00:00Z');
    const created = await createSession(db, userId, 'Test browser', createdAt);
    expect(created.session).toMatchObject({
      userId, tokenHash: hashSessionToken(created.token), lastSeenAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + SESSION_DURATION_MS), userAgent: 'Test browser'
    });

    const active = await validateSessionToken(db, created.token, createdAt);
    expect(active.user?.id).toBe(userId);
    expect(active.session?.id).toBe(created.session.id);

    const refreshedAt = new Date(createdAt.getTime() + SESSION_REFRESH_INTERVAL_MS);
    const result = await validateSessionToken(db, created.token, refreshedAt);
    expect(result.user?.id).toBe(userId);
    expect(result.session?.lastSeenAt).toEqual(refreshedAt);
    expect(result.session?.expiresAt).toEqual(new Date(refreshedAt.getTime() + SESSION_DURATION_MS));
  }));

  it('does not refresh before 24 hours and does not allow another user to revoke', async () => withDatabase(async (db) => {
    const ownerId = await insertUser(db);
    const other = await db.insert(users).values({ name: 'Other', email: 'other@example.com' }).returning().get();
    const createdAt = new Date('2026-07-12T12:00:00Z');
    const created = await createSession(db, ownerId, null, createdAt);
    const beforeThreshold = new Date(createdAt.getTime() + SESSION_REFRESH_INTERVAL_MS - 1);
    const result = await validateSessionToken(db, created.token, beforeThreshold);
    expect(result.session?.lastSeenAt).toEqual(createdAt);
    expect(result.session?.expiresAt).toEqual(created.session.expiresAt);
    expect(await revokeSession(db, other.id, created.session.id, beforeThreshold)).toBe(false);
    expect((await validateSessionToken(db, created.token, beforeThreshold)).user?.id).toBe(ownerId);
  }));

  it('rejects unknown, expired, and revoked sessions', async () => withDatabase(async (db) => {
    expect(await validateSessionToken(db, 'unknown-token')).toEqual({ user: null, session: null });
    const userId = await insertUser(db);
    const now = new Date('2026-07-12T12:00:00Z');
    const expired = await createSession(db, userId, null, new Date(now.getTime() - SESSION_DURATION_MS - 1));
    expect(await validateSessionToken(db, expired.token, now)).toEqual({ user: null, session: null });
    const active = await createSession(db, userId, null, now);
    expect(await revokeSession(db, userId, active.session.id, now)).toBe(true);
    expect(await revokeSession(db, userId, active.session.id, now)).toBe(false);
    expect(await validateSessionToken(db, active.token, now)).toEqual({ user: null, session: null });
  }));
});
