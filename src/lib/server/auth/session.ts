import { createHash, randomBytes } from "node:crypto";
import type { DatabaseConnection } from "../db/connection";
import { sessions } from "../db/schema";

type AppDatabase = DatabaseConnection['db'];

export const SESSION_DURATION_MS =
  90 * 24 * 60 * 60 * 1000;

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
