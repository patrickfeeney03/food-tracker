import { logFoodInputSchema, type LogFoodInput } from '$lib/nutrition/portion-input';
import { parsePortionCountToMilli, toSafeInteger } from '$lib/nutrition/math';
import type { DatabaseConnection } from '$lib/server/db/connection';
import { diaryLogs, foods, type DiaryLog } from '$lib/server/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { buildDiaryLogValues } from './diary-entry';

type AppDatabase = DatabaseConnection['db'];

export class ExistingFoodNotFoundError extends Error {
  constructor() {
    super('Food not found');
    this.name = 'ExistingFoodNotFoundError';
  }
}

export class ExistingFoodLogConflictError extends Error {
  constructor() {
    super('This mutation ID has already been used for a different diary entry.');
    this.name = 'ExistingFoodLogConflictError';
  }
}

function findExistingMutation(
  db: AppDatabase,
  userId: string,
  clientMutationId: string
): DiaryLog | undefined {
  return db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.userId, userId),
        eq(diaryLogs.clientMutationId, clientMutationId)
      )
    )
    .get();
}

function replayExistingMutation(
  existing: DiaryLog,
  foodId: string,
  input: LogFoodInput
): DiaryLog {
  const portionCountMilli = toSafeInteger(
    parsePortionCountToMilli(input.portionCount)
  );

  if (
    existing.foodId !== foodId ||
    existing.diaryDate !== input.diaryDate ||
    existing.mealSlot !== input.mealSlot ||
    existing.portionKind !== input.portionKind ||
    existing.portionCountMilli !== portionCountMilli
  ) {
    throw new ExistingFoodLogConflictError();
  }

  return existing;
}

export function logExistingFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  rawLogInput: unknown
): DiaryLog {
  const input = logFoodInputSchema.parse(rawLogInput);
  const existing = findExistingMutation(db, userId, input.clientMutationId);

  if (existing !== undefined) {
    return replayExistingMutation(existing, foodId, input);
  }

  try {
    return db.transaction((transaction) => {
      const food = transaction
        .select()
        .from(foods)
        .where(
          and(
            eq(foods.id, foodId),
            eq(foods.userId, userId),
            isNull(foods.deletedAt)
          )
        )
        .get();

      if (food === undefined) {
        throw new ExistingFoodNotFoundError();
      }

      return transaction
        .insert(diaryLogs)
        .values(buildDiaryLogValues(food, input))
        .returning()
        .get();
    });
  } catch (caught) {
    // Another request may have committed the same mutation between our
    // initial lookup and insert. Re-read it after the failed transaction.
    const replayed = findExistingMutation(db, userId, input.clientMutationId);

    if (replayed !== undefined) {
      return replayExistingMutation(replayed, foodId, input);
    }

    throw caught;
  }
}
