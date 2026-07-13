import { mkdtempSync, rmSync } from "node:fs";
import { createDatabase, type DatabaseConnection } from "../db/connection";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { findOrCreateGoogleUser, GoogleEmailNotAllowedError } from "./google-user";
import { authAccounts, users } from "../db/schema";

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-google-user-')
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

describe('findOrCreateGoogleUser', () => {
  it('creates a linked local user', () => {
    withMigratedDatabase((connection) => {
      const user = findOrCreateGoogleUser(
        connection.db,
        {
          subject: 'google-subject',
          email: 'PATRIck@example.com',
          name: 'Patrick'
        },
        'patrick@example.com'
      );

      expect(user).toMatchObject({
        name: 'Patrick',
        email: 'patrick@example.com'
      });

      expect(
        connection.db.select().from(authAccounts).get()
      ).toMatchObject({
        userId: user.id,
        provider: 'google',
        providerSubject: 'google-subject',
        emailAtLink: 'patrick@example.com'
      });
    })
  });

  it('returns the same user on repeat login', () => {
    withMigratedDatabase((connection) => {
      const identity = {
        subject: 'google-subject',
        email: 'patrick@example.com',
        name: 'Patrick'
      };

      const first = findOrCreateGoogleUser(
        connection.db,
        identity,
        'patrick@example.com'
      );

      const second = findOrCreateGoogleUser(
        connection.db,
        identity,
        'patrick@example.com'
      );

      expect(second.id).toBe(first.id);
      expect(
        connection.db.select().from(users).all()
      ).toHaveLength(1);
      expect(
        connection.db.select().from(authAccounts).all()
      ).toHaveLength(1);
    });
  });

  it('rejects a non-allowlisted email without writing', () => {
    withMigratedDatabase((connection) => {
      expect(() =>
        findOrCreateGoogleUser(
          connection.db,
          {
            subject: 'other-subject',
            email: 'other@example.com',
            name: 'Other'
          },
          'patrick@example.com'
        )
      ).toThrow(GoogleEmailNotAllowedError);

      expect(
        connection.db.select().from(users).all()
      ).toHaveLength(0);
      expect(
        connection.db.select().from(authAccounts).all()
      ).toHaveLength(0);
    });
  });
});
