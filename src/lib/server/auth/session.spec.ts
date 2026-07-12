import { describe, expect, it } from 'vitest';
import {
  createSession,
  generateSessionToken,
  hashSessionToken,
  SESSION_DURATION_MS,
  SESSION_REFRESH_INTERVAL_MS,
  validateSessionToken
} from './session';
import { createDatabase, type DatabaseConnection } from '../db/connection';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { sessions, users } from '../db/schema';

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

function insertUser(
  connection: DatabaseConnection
): string {
  return connection.db
    .insert(users)
    .values({
      name: 'Patrick',
      email: 'patrick@example.com'
    })
    .returning({ id: users.id })
    .get().id;
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

describe('validateSessionToken', () => {
  it('returns the associated user and session', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const now = new Date('2026-07-12T12:00:00Z');
      const created = createSession(
        connection.db,
        userId,
        'Test browser',
        now
      );

      const result = validateSessionToken(
        connection.db,
        created.token,
        now
      );

      expect(result.user?.id).toBe(userId);
      expect(result.session?.id).toBe(
        created.session.id
      );
    });
  });

  it('rejects an unknown token', () => {
    withMigratedDatabase((connection) => {
      expect(
        validateSessionToken(
          connection.db,
          'unknown-token'
        )
      ).toEqual({
        user: null,
        session: null
      });
    });
  });

  it('rejects an expired session', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const createdAt = new Date(
        '2026-01-01T12:00:00Z'
      );
      const created = createSession(
        connection.db,
        userId,
        null,
        createdAt
      );

      const result = validateSessionToken(
        connection.db,
        created.token,
        new Date('2026-04-02T12:00:00Z')
      );

      expect(result).toEqual({
        user: null,
        session: null
      });
    });
  });

  it('rejects a revoked session', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const now = new Date('2026-07-12T12:00:00Z');
      const created = createSession(
        connection.db,
        userId,
        null,
        now
      );

      connection.db
        .update(sessions)
        .set({ revokedAt: now })
        .where(eq(sessions.id, created.session.id))
        .run();

      expect(
        validateSessionToken(
          connection.db,
          created.token,
          now
        )
      ).toEqual({
        user: null,
        session: null
      });
    });
  });

  it('does not refresh a session before 24 hours', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const createdAt = new Date(
        '2026-07-12T12:00:00Z'
      );
      const created = createSession(
        connection.db,
        userId,
        null,
        createdAt
      );
      const beforeRefreshThreshold = new Date(
        createdAt.getTime() +
          SESSION_REFRESH_INTERVAL_MS -
          1
      );

      const result = validateSessionToken(
        connection.db,
        created.token,
        beforeRefreshThreshold
      );

      expect(result.session?.lastSeenAt).toEqual(
        createdAt
      );
      expect(result.session?.expiresAt).toEqual(
        created.session.expiresAt
      );
    });
  });

  it('refreshes a session at the 24-hour threshold', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(connection);
      const createdAt = new Date(
        '2026-07-12T12:00:00Z'
      );
      const created = createSession(
        connection.db,
        userId,
        null,
        createdAt
      );
      const refreshedAt = new Date(
        createdAt.getTime() +
          SESSION_REFRESH_INTERVAL_MS
      );

      const result = validateSessionToken(
        connection.db,
        created.token,
        refreshedAt
      );
      const storedSession = connection.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, created.session.id))
        .get();

      expect(result.session?.lastSeenAt).toEqual(
        refreshedAt
      );
      expect(result.session?.expiresAt).toEqual(
        new Date(
          refreshedAt.getTime() + SESSION_DURATION_MS
        )
      );
      expect(storedSession).toEqual(result.session);
    });
  });
});
