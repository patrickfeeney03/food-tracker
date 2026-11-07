import { logUntrackedEntryInputSchema, type LogUntrackedEntryInput } from '$lib/nutrition/untracked-entry-input';
import type { AppDatabase } from '$lib/server/db/connection';
import { diaryLogs, type DiaryLog } from '$lib/server/db/schema';
import { buildUntrackedDiaryLogValues } from './diary-entry';
import { getDiaryEntryByClientMutation } from './diary-entry-query';

export class UntrackedEntryConflictError extends Error {
  constructor() {
    super('This request was already used for a different diary entry. Reload before trying again.');
    this.name = 'UntrackedEntryConflictError';
  }
}

function replayExistingMutation(existing: DiaryLog, input: LogUntrackedEntryInput) {
  if (
    !existing.untracked ||
    existing.foodName !== input.name ||
    existing.diaryDate !== input.diaryDate ||
    existing.mealSlot !== input.mealSlot
  ) {
    throw new UntrackedEntryConflictError();
  }

  return { entry: existing, replayed: true as const };
}

export async function logUntrackedEntry(db: AppDatabase, userId: string, rawInput: unknown) {
  const input = logUntrackedEntryInputSchema.parse(rawInput);
  const existing = await getDiaryEntryByClientMutation(db, userId, input.clientMutationId);
  if (existing !== undefined) return replayExistingMutation(existing, input);

  try {
    const entry = await db.insert(diaryLogs)
      .values({ ...buildUntrackedDiaryLogValues(userId, input), id: crypto.randomUUID() })
      .returning()
      .get();
    return { entry, replayed: false as const };
  } catch (caught) {
    // The client mutation ID is unique per user, so a concurrent retry loses here.
    const raced = await getDiaryEntryByClientMutation(db, userId, input.clientMutationId);
    if (raced !== undefined) return replayExistingMutation(raced, input);
    throw caught;
  }
}
