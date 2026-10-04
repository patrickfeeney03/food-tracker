import {
  logFoodInputSchema,
  quickAddFoodInputSchema,
  type LogFoodInput,
  type QuickAddFoodInput
} from '$lib/nutrition/portion-input';
import { replayLatestFoodPortion } from '$lib/nutrition/latest-food-portion';
import { parsePortionCountToMilli, toSafeInteger } from '$lib/nutrition/math';
import type { AppDatabase } from '$lib/server/db/connection';
import { diaryLogs, foods, type DiaryLog } from '$lib/server/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { atomicBatch, isAtomicGuardError } from '$lib/server/db/atomic';
import { buildDiaryLogValues } from './diary-entry';

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

export class QuickAddUnavailableError extends Error {
  constructor() {
    super('Log an amount for this food before using Quick Add.');
    this.name = 'QuickAddUnavailableError';
  }
}

async function findExistingMutation(
  db: AppDatabase,
  userId: string,
  clientMutationId: string
): Promise<DiaryLog | undefined> {
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

function replayQuickAddMutation(
  existing: DiaryLog,
  foodId: string,
  input: QuickAddFoodInput
): DiaryLog {
  if (
    existing.foodId !== foodId ||
    existing.diaryDate !== input.diaryDate ||
    existing.mealSlot !== input.mealSlot
  ) {
    throw new ExistingFoodLogConflictError();
  }

  return existing;
}

export async function logExistingFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  rawLogInput: unknown
): Promise<DiaryLog> {
  const input = logFoodInputSchema.parse(rawLogInput);
  const existing = await findExistingMutation(db, userId, input.clientMutationId);

  if (existing !== undefined) {
    return replayExistingMutation(existing, foodId, input);
  }

  const food = await db.select().from(foods).where(and(
    eq(foods.id, foodId), eq(foods.userId, userId), isNull(foods.deletedAt)
  )).get();
  if (!food) throw new ExistingFoodNotFoundError();
  const id = crypto.randomUUID();
  const values = { ...buildDiaryLogValues(food, input), id };
  try {
    const [rows] = await atomicBatch(db, [
      sql`exists (select 1 from foods where id = ${foodId} and user_id = ${userId} and updated_at = ${food.updatedAt.getTime()} and deleted_at is null)`,
      sql`not exists (select 1 from diary_logs where user_id = ${userId} and client_mutation_id = ${input.clientMutationId})`
    ], [db.insert(diaryLogs).values(values).returning()]);
    const inserted = rows[0];
    if (!inserted) throw new Error('D1 did not return the logged diary entry');
    return inserted;
  } catch (caught) {
    const replayed = await findExistingMutation(db, userId, input.clientMutationId);
    if (replayed) return replayExistingMutation(replayed, foodId, input);
    if (isAtomicGuardError(caught)) throw new ExistingFoodNotFoundError();
    throw caught;
  }
}

export async function quickAddExistingFood(
  db: AppDatabase,
  userId: string,
  foodId: string,
  rawInput: unknown
): Promise<DiaryLog> {
  const input = quickAddFoodInputSchema.parse(rawInput);
  const existing = await findExistingMutation(db, userId, input.clientMutationId);

  if (existing !== undefined) {
    return replayQuickAddMutation(existing, foodId, input);
  }

  const food = await db.select().from(foods).where(and(
    eq(foods.id, foodId), eq(foods.userId, userId), isNull(foods.deletedAt)
  )).get();
  if (!food) throw new ExistingFoodNotFoundError();
  const latestUse = await db.select({
    id: diaryLogs.id, amountUnit: diaryLogs.amountUnit, portionKind: diaryLogs.portionKind,
    portionAmount: diaryLogs.portionAmount, portionCountMilli: diaryLogs.portionCountMilli,
    resolvedAmount: diaryLogs.resolvedAmount
  }).from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId), eq(diaryLogs.foodId, foodId), isNull(diaryLogs.deletedAt)
  )).orderBy(desc(diaryLogs.loggedAt), desc(diaryLogs.id)).limit(1).get();
  const replay = latestUse === undefined ? null : replayLatestFoodPortion(food, latestUse);
  if (!replay || !latestUse) throw new QuickAddUnavailableError();
  const id = crypto.randomUUID();
  const values = { ...buildDiaryLogValues(food, { ...input, ...replay }), id };
  try {
    const [rows] = await atomicBatch(db, [
      sql`exists (select 1 from foods where id = ${foodId} and user_id = ${userId} and updated_at = ${food.updatedAt.getTime()} and deleted_at is null)`,
      sql`exists (select 1 from diary_logs where id = ${latestUse.id} and user_id = ${userId} and deleted_at is null)`,
      sql`not exists (select 1 from diary_logs where user_id = ${userId} and client_mutation_id = ${input.clientMutationId})`
    ], [db.insert(diaryLogs).values(values).returning()]);
    const inserted = rows[0];
    if (!inserted) throw new Error('D1 did not return the quick-added diary entry');
    return inserted;
  } catch (caught) {
    const replayed = await findExistingMutation(db, userId, input.clientMutationId);
    if (replayed) return replayQuickAddMutation(replayed, foodId, input);
    if (isAtomicGuardError(caught)) throw new QuickAddUnavailableError();
    throw caught;
  }
}
