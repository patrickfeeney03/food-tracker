import { describe, expect, it } from 'vitest';
import { createSession, generateSessionToken, hashSessionToken, SESSION_DURATION_MS } from './session';
import { createDatabase, type DatabaseConnection } from '../db/connection';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { users } from '../db/schema';

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-session-')
  );
  const connection = createDatabase(
    join(directory, 'test.db')
  );

  try {
    migrate(connection.db, {
      migrationsFolder: 'drizzle'
    });

    run(connection);
  } finally {
    connection.client.close();
    rmSync(directory, {
      recursive: true,
      force: true
    });
  }
}
describe('hashSessionToken', () => {
  it('returns the same hash for the same token', () => {
    expect(hashSessionToken('secret-token')).toBe(
      hashSessionToken('secret-token')
    );
  });

  it('returns different hashes for different tokens', () => {
    expect(hashSessionToken('first-token')).not.toBe(
      hashSessionToken('second-token')
    );
  });

  it('returns a hexadecimal SHA-256 hash', () => {
    expect(hashSessionToken('secret-token')).toMatch(
      /^[a-f0-9]{64}$/
    );
  });
});

describe('generateSessionToken', () => {
  it('generates a URL-safe token', () => {
    expect(generateSessionToken()).toMatch(
      /^[A-Za-z0-9_-]{43}$/
    );
  });

  it('generates a new token each time', () => {
    expect(generateSessionToken()).not.toBe(
      generateSessionToken()
    );
  });
});

describe('createSession', () => {
  it('stores a hashed token and a 90-day expiry', () => {
    withMigratedDatabase((connection) => {
      const userId = connection.db
        .insert(users)
        .values({
          name: 'Patrick',
          email: 'patrick@example.com'
        })
        .returning({ id: users.id })
        .get().id;

      const now = new Date('2026-07-12T12:00:00Z');

      const result = createSession(
        connection.db,
        userId,
        'Test browser',
        now
      );

      expect(result.session).toMatchObject({
        userId,
        tokenHash: hashSessionToken(result.token),
        lastSeenAt: now,
        expiresAt: new Date(
          now.getTime() + SESSION_DURATION_MS
        ),
        userAgent: 'Test browser'
      });

      expect(result.session.tokenHash).not.toBe(
        result.token
      );
    });
  });
});
