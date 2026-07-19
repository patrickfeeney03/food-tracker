import type { DatabaseConnection } from "$lib/server/db/connection";
import { diaryLogs, type DiaryLog } from "$lib/server/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

type Database = DatabaseConnection["db"];
type ReadDatabase = Pick<Database, "select">;

export function getActiveDiaryEntry(
  db: ReadDatabase,
  userId: string,
  entryId: string,
): DiaryLog | undefined {
  return db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        isNull(diaryLogs.deletedAt),
      ),
    )
    .get();
}

export function getDeletedDiaryEntry(
  db: ReadDatabase,
  userId: string,
  entryId: string,
): DiaryLog | undefined {
  return db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        isNotNull(diaryLogs.deletedAt),
      ),
    )
    .get();
}
