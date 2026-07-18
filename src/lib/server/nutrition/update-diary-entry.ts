import { editDiaryEntryInputSchema, type EditDiaryEntryInput } from "$lib/nutrition/portion-input";
import type { DatabaseConnection } from "$lib/server/db/connection";
import { diaryLogs, type DiaryLog } from "$lib/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { buildDiaryLogUpdateValues } from "./diary-entry";

type Database = DatabaseConnection['db'];

export class DiaryEntryNotFoundError extends Error {
  constructor() {
    super('Diary entry not found');
    this.name = 'DiaryEntryNotFoundError';
  }
}

export function updateDiaryEntry(
  db: Database,
  userId: string,
  entryId: string,
  rawInput: EditDiaryEntryInput,
  updatedAt = new Date()
): DiaryLog {
  const input = editDiaryEntryInputSchema.parse(rawInput);
  const entry = db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        isNull(diaryLogs.deletedAt)
      )
    )
    .get();

  if (entry === undefined) {
    throw new DiaryEntryNotFoundError();
  }

  return db
    .update(diaryLogs)
    .set(
      buildDiaryLogUpdateValues(
        entry,
        input,
        updatedAt
      )
    )
    .where(
      and(
        eq(diaryLogs.id, entryId),
        eq(diaryLogs.userId, userId),
        isNull(diaryLogs.deletedAt)
      )
    )
    .returning()
    .get();
}
