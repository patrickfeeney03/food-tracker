import type { AppDatabase } from "$lib/server/db/connection";
import { diaryLogs, type DiaryLog } from "$lib/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export class DiaryEntryDeletionNotFoundError extends Error {
  constructor() {
    super("Diary entry deletion not found");
    this.name = "DiaryEntryDeletionNotFoundError";
  }
}

export async function deleteDiaryEntry(
  db: AppDatabase,
  userId: string,
  entryId: string,
  deletedAt = new Date(),
): Promise<DiaryLog> {
  const entry = await db
    .update(diaryLogs)
    .set({ deletedAt, updatedAt: deletedAt })
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        isNull(diaryLogs.deletedAt),
      ),
    )
    .returning()
    .get();

  if (entry === undefined) {
    throw new DiaryEntryDeletionNotFoundError();
  }

  return entry;
}

export async function restoreDeletedDiaryEntry(
  db: AppDatabase,
  userId: string,
  entryId: string,
  expectedDeletedAt: Date,
  restoredAt = new Date(),
): Promise<DiaryLog> {
  const entry = await db
    .update(diaryLogs)
    .set({ deletedAt: null, updatedAt: restoredAt })
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        eq(diaryLogs.deletedAt, expectedDeletedAt),
      ),
    )
    .returning()
    .get();

  if (entry === undefined) {
    throw new DiaryEntryDeletionNotFoundError();
  }

  return entry;
}
