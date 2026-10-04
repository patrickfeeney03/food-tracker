import { editDiaryEntryInputSchema, type EditDiaryEntryInput } from "$lib/nutrition/portion-input";
import type { AppDatabase } from "$lib/server/db/connection";
import { diaryLogs, type DiaryLog } from "$lib/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { buildDiaryLogUpdateValues } from "./diary-entry";
import { getActiveDiaryEntry } from "./diary-entry-query";

export class DiaryEntryNotFoundError extends Error {
  constructor() {
    super('Diary entry not found');
    this.name = 'DiaryEntryNotFoundError';
  }
}

export async function updateDiaryEntry(
  db: AppDatabase,
  userId: string,
  entryId: string,
  rawInput: EditDiaryEntryInput,
  updatedAt = new Date()
): Promise<DiaryLog> {
  const input = editDiaryEntryInputSchema.parse(rawInput);
  const entry = await getActiveDiaryEntry(db, userId, entryId);

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
