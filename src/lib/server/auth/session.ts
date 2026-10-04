import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AppDatabase } from "../db/connection";
import {
  sessions,
  users,
  type Session,
  type User
} from "../db/schema";

export const SESSION_DURATION_MS =
  90 * 24 * 60 * 60 * 1000;

export const SESSION_REFRESH_INTERVAL_MS =
  24 * 60 * 60 * 1000;

export interface SessionValidationResult {
  user: User | null;
  session: Session | null;
}

export async function createSession(
  db: AppDatabase,
  userId: string,
  userAgent: string | null,
  now = new Date()
) {
  const token = generateSessionToken();

  const session = await db
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
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function validateSessionToken(
  db: AppDatabase,
  token: string,
  now = new Date()
): Promise<SessionValidationResult> {
  const result = await db
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

  if (
    now.getTime() -
    result.session.lastSeenAt.getTime() >=
    SESSION_REFRESH_INTERVAL_MS
  ) {
    const refreshedSession = await db
      .update(sessions)
      .set({
        lastSeenAt: now,
        expiresAt: new Date(
          now.getTime() + SESSION_DURATION_MS
        )
      })
      .where(and(
        eq(sessions.id, result.session.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      ))
      .returning()
      .get();

    if (refreshedSession === undefined) {
      return { user: null, session: null };
    }

    return {
      user: result.user,
      session: refreshedSession
    };
  }

  return result;
}

export async function revokeSession(
  db: AppDatabase,
  userId: string,
  sessionId: string,
  now = new Date()
): Promise<boolean> {
  const result = await db
    .update(sessions)
    .set({
      revokedAt: now
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      )
    )
    .run();

  return result.meta.changes === 1;
}
