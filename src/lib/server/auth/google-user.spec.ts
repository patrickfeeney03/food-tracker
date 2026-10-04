import { describe, expect, it } from 'vitest';
import { createDatabase } from '../db/testing';
import { authAccounts, users } from '../db/schema';
import { findOrCreateGoogleUser, GoogleEmailNotAllowedError } from './google-user';

async function withDatabase<T>(run: (db: Awaited<ReturnType<typeof createDatabase>>['db']) => Promise<T>) {
  const connection = await createDatabase();
  try { return await run(connection.db); }
  finally { await connection.client.close(); }
}

describe('findOrCreateGoogleUser', () => {
  it('normalizes allowlisted email and returns the existing linked user on repeat login', async () => withDatabase(async (db) => {
    const identity = { subject: 'google-subject', email: 'PATRICK@example.com', name: 'Patrick' };
    const first = await findOrCreateGoogleUser(db, identity, ['patrick@example.com']);
    const second = await findOrCreateGoogleUser(db, identity, ['patrick@example.com']);
    expect(first).toMatchObject({ name: 'Patrick', email: 'patrick@example.com' });
    expect(second.id).toBe(first.id);
    expect(await db.select().from(users).all()).toHaveLength(1);
    expect(await db.select().from(authAccounts).all()).toMatchObject([
      { userId: first.id, provider: 'google', providerSubject: 'google-subject', emailAtLink: 'patrick@example.com' }
    ]);
  }));

  it('claims a seeded placeholder account', async () => withDatabase(async (db) => {
    const seeded = await db.insert(users).values({ name: 'Patrick', email: 'patrick@example.com' }).returning().get();
    await db.insert(authAccounts).values({
      userId: seeded.id, provider: 'google', providerSubject: `google-${seeded.id}`, emailAtLink: seeded.email
    }).run();
    const user = await findOrCreateGoogleUser(db, {
      subject: 'real-google-subject', email: 'PATRICK@example.com', name: 'Patrick'
    }, ['patrick@example.com']);
    expect(user.id).toBe(seeded.id);
    expect(await db.select().from(users).all()).toHaveLength(1);
    expect(await db.select().from(authAccounts).all()).toMatchObject([
      { userId: seeded.id, providerSubject: 'real-google-subject', emailAtLink: 'patrick@example.com' }
    ]);
  }));

  it('recovers concurrent duplicate logins to the same account', async () => withDatabase(async (db) => {
    const identity = { subject: 'racing-subject', email: 'patrick@example.com', name: 'Patrick' };
    const [first, second] = await Promise.all([
      findOrCreateGoogleUser(db, identity, ['patrick@example.com']),
      findOrCreateGoogleUser(db, identity, ['patrick@example.com'])
    ]);
    expect(first.id).toBe(second.id);
    expect(await db.select().from(users).all()).toHaveLength(1);
    expect(await db.select().from(authAccounts).all()).toHaveLength(1);
  }));

  it('rolls back user creation if the account insert fails', async () => {
    const connection = await createDatabase();
    try {
      await connection.binding.prepare(`CREATE TRIGGER fail_google_account BEFORE INSERT ON auth_accounts
        BEGIN SELECT RAISE(ABORT, 'injected account failure'); END;`).run();
      await expect(findOrCreateGoogleUser(connection.db, {
        subject: 'triggered-subject', email: 'patrick@example.com', name: 'Patrick'
      }, ['patrick@example.com'])).rejects.toThrow('injected account failure');
      expect(await connection.db.select().from(users).all()).toHaveLength(0);
      expect(await connection.db.select().from(authAccounts).all()).toHaveLength(0);
    } finally {
      await connection.client.close();
    }
  });

  it('rejects an email outside the allowlist without writing', async () => withDatabase(async (db) => {
    await expect(findOrCreateGoogleUser(db, {
      subject: 'other-subject', email: 'other@example.com', name: 'Other'
    }, ['patrick@example.com'])).rejects.toBeInstanceOf(GoogleEmailNotAllowedError);
    expect(await db.select().from(users).all()).toHaveLength(0);
    expect(await db.select().from(authAccounts).all()).toHaveLength(0);
  }));

  it('allows any normalized email listed on the allowlist', async () => withDatabase(async (db) => {
    const user = await findOrCreateGoogleUser(db, {
      subject: 'other-subject', email: 'Other@Example.com', name: 'Other'
    }, ['patrick@example.com', 'other@example.com']);
    expect(user.email).toBe('other@example.com');
  }));
});
