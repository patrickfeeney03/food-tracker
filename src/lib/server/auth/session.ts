import { createHash, randomBytes } from "node:crypto";
import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from "../db/connection";
import {
  sessions,
  users,
  type Session,
  type User
} from "../db/schema";

type AppDatabase = DatabaseConnection['db'];

export const SESSION_DURATION_MS =
  90 * 24 * 60 * 60 * 1000;

export interface SessionValidationResult {
  user: User | null;
  session: Session | null;
}

export function createSession(
  db: AppDatabase,
  userId: string,
  userAgent: string | null,
  now = new Date()
) {
  const token = generateSessionToken();

  const session = db
    .insert(sessions)
    .values({
      userId,
      tokenHash: hashSessionToken(token),
      lastSeenAt: now,
      expiresAt: new Date(
        now.getTime() + SESSION_DURATION_MS
      ),
      userAgent
    })
    .returning()
    .get();

  return {
    token,
    session
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function validateSessionToken(
  db: AppDatabase,
  token: string,
  now = new Date()
): SessionValidationResult {
  const result = db
    .select({
      user: users,
      session: sessions
    })
    .from(sessions)
    .innerJoin(
      users,
      eq(sessions.userId, users.id)
    )
    .where(
      eq(
        sessions.tokenHash,
        hashSessionToken(token)
      )
    )
    .get();

  if (
    result === undefined ||
    result.session.revokedAt !== null ||
    result.session.expiresAt <= now
  ) {
    return {
      user: null,
      session: null
    };
  }

  return result;
}
