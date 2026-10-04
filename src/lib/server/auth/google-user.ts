import { and, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/connection';
import { authAccounts, users, type User } from '../db/schema';

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

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && /unique|constraint|foreign key/i.test(error.message);
}

export async function findOrCreateGoogleUser(
  db: AppDatabase,
  identity: GoogleIdentity,
  allowedEmails: readonly string[]
): Promise<User> {
  const normalizedEmail = identity.email.trim().toLowerCase();
  if (!allowedEmails.includes(normalizedEmail)) throw new GoogleEmailNotAllowedError();

  const findLinked = async () => db.select({ user: users })
    .from(authAccounts)
    .innerJoin(users, eq(authAccounts.userId, users.id))
    .where(and(eq(authAccounts.provider, 'google'), eq(authAccounts.providerSubject, identity.subject)))
    .get();

  const linked = await findLinked();
  if (linked) return linked.user;

  const sameEmail = await db.select().from(users).where(eq(users.email, normalizedEmail)).all();
  for (const seededUser of sameEmail) {
    const account = await db.select().from(authAccounts).where(and(
      eq(authAccounts.userId, seededUser.id), eq(authAccounts.provider, 'google')
    )).get();
    if (account?.providerSubject === `google-${seededUser.id}`) {
      await db.update(authAccounts).set({
        providerSubject: identity.subject,
        emailAtLink: normalizedEmail
      }).where(and(
        eq(authAccounts.userId, seededUser.id),
        eq(authAccounts.provider, 'google'),
        eq(authAccounts.providerSubject, account.providerSubject)
      )).run();
      const claimed = await findLinked();
      if (claimed) return claimed.user;
    }
  }

  // D1 batches are atomic. Generate IDs before constructing the batch so a
  // concurrent login either creates both rows or neither, then recover by
  // reading the account that won the unique provider-subject constraint.
  const id = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const now = new Date();
  try {
    await db.batch([
      db.insert(users).values({ id, name: identity.name, email: normalizedEmail, createdAt: now, updatedAt: now }),
      db.insert(authAccounts).values({
        id: accountId,
        userId: id,
        provider: 'google',
        providerSubject: identity.subject,
        emailAtLink: normalizedEmail,
        createdAt: now
      })
    ]);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const winner = await findLinked();
    if (winner) return winner.user;
    throw error;
  }

  const created = await db.select().from(users).where(eq(users.id, id)).get();
  if (!created) throw new Error('Google user creation did not persist');
  return created;
}
