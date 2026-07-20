import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../db/connection";
import { authAccounts, users, type User } from "../db/schema";

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
}

export class GoogleEmailNotAllowedError extends Error {
  constructor() {
    super('Google email is not allowed');
    this.name = 'GoogleEmailNotAllowedError';
  }
}

export function findOrCreateGoogleUser(
  db: AppDatabase,
  identity: GoogleIdentity,
  allowedEmail: string
): User {
  const normalizedEmail = identity.email.trim().toLowerCase();

  if (normalizedEmail !== allowedEmail.trim().toLowerCase()) {
    throw new GoogleEmailNotAllowedError();
  }

  return db.transaction((transaction) => {
    const existingAccount = transaction
      .select()
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, 'google'),
          eq(
            authAccounts.providerSubject,
            identity.subject
          )
        )
      )
      .get();

    if (existingAccount !== undefined) {
      const existingUser = transaction
        .select()
        .from(users)
        .where(
          eq(users.id, existingAccount.userId)
        )
        .get();

      if (existingUser === undefined) {
        throw new Error(
          'Google account references a missing user'
        );
      }

      return existingUser;
    }

    const user = transaction
      .insert(users)
      .values({
        name: identity.name,
        email: normalizedEmail
      })
      .returning()
      .get();

    transaction
      .insert(authAccounts)
      .values({
        userId: user.id,
        provider: 'google',
        providerSubject: identity.subject,
        emailAtLink: normalizedEmail
      })
      .run();

    return user;
  });
}
