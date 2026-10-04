import type { ReadDatabase } from "$lib/server/db/connection";
import { diaryLogs, type DiaryLog } from "$lib/server/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

export async function getActiveDiaryEntry(db: ReadDatabase, userId: string, entryId: string): Promise<DiaryLog | undefined> {
  return db.select().from(diaryLogs).where(and(
    eq(diaryLogs.id, entryId), eq(diaryLogs.userId, userId), isNull(diaryLogs.deletedAt)
  )).get();
}

export async function getDeletedDiaryEntry(db: ReadDatabase, userId: string, entryId: string): Promise<DiaryLog | undefined> {
  return db.select().from(diaryLogs).where(and(
    eq(diaryLogs.id, entryId), eq(diaryLogs.userId, userId), isNotNull(diaryLogs.deletedAt)
  )).get();
}
