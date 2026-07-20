import { createHash } from 'node:crypto';
import { createFoodSchema } from "$lib/nutrition/food-input";
import { logFoodInputSchema, type LogFoodInput } from "$lib/nutrition/portion-input";
import { parsePortionCountToMilli, toSafeInteger } from "$lib/nutrition/math";
import { and, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "../db/connection";
import { diaryLogs, foods } from "../db/schema";
import { buildDiaryLogValues } from "./diary-entry";
import { mapFoodInput, type MutableFoodValues } from "./food-mapper";

export class FoodCreateBarcodeConflictError extends Error {
  constructor() {
    super('This barcode is already assigned to another active food.');
    this.name = 'FoodCreateBarcodeConflictError';
  }
}

export class FoodCreateMutationConflictError extends Error {
  constructor() {
    super('This create-food request was already used with different details. Reload before trying again.');
    this.name = 'FoodCreateMutationConflictError';
  }
}

function createRequestFingerprint(
  food: MutableFoodValues,
  log: LogFoodInput
): string {
  const canonicalRequest = JSON.stringify({
    food,
    log: {
      portionKind: log.portionKind,
      portionCountMilli: toSafeInteger(parsePortionCountToMilli(log.portionCount)),
      diaryDate: log.diaryDate,
      mealSlot: log.mealSlot
    }
  });

  return createHash('sha256').update(canonicalRequest).digest('hex');
}

function barcodeAlreadyExists(
  db: AppDatabase,
  userId: string,
  barcode: string
): boolean {
  if (barcode === '') return false;

  return db
    .select({ id: foods.id })
    .from(foods)
    .where(
      and(
        eq(foods.userId, userId),
        eq(foods.barcode, barcode),
        isNull(foods.deletedAt)
      )
    )
    .get() !== undefined;
}

function isUniqueConstraintError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    'code' in caught &&
    String(caught.code) === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

function findExistingMutation(
  db: AppDatabase,
  userId: string,
  clientMutationId: string
) {
  const diaryLog = db
    .select()
    .from(diaryLogs)
    .where(
      and(
        eq(diaryLogs.userId, userId),
        eq(
          diaryLogs.clientMutationId,
          clientMutationId
        )
      )
    ).get();

  if (diaryLog === undefined) {
    return undefined;
  }

  if (diaryLog.foodId === null) {
    throw new Error(
      'Existing mutation no longer references a food'
    );
  }

  const food = db
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, diaryLog.foodId),
        eq(foods.userId, userId)
      )
    ).get();

  if (food === undefined) {
    throw new Error(
      'Existing mutation references a missing food'
    );
  }

  return {
    food,
    diaryLog
  };
}

function replayExistingMutation(
  existing: NonNullable<ReturnType<typeof findExistingMutation>>,
  requestFingerprint: string
) {
  if (existing.diaryLog.clientRequestFingerprint !== requestFingerprint) {
    throw new FoodCreateMutationConflictError();
  }

  return existing;
}

export function createFoodAndLog(
  db: AppDatabase,
  userId: string,
  rawFoodInput: unknown,
  rawLogInput: unknown
) {
  const foodInput = createFoodSchema.parse(rawFoodInput);
  const logInput = logFoodInputSchema.parse(rawLogInput);
  const foodValues = mapFoodInput(foodInput);
  const requestFingerprint = createRequestFingerprint(foodValues, logInput);

  const existing = findExistingMutation(db, userId, logInput.clientMutationId);

  if (existing !== undefined) {
    return replayExistingMutation(existing, requestFingerprint);
  }

  if (barcodeAlreadyExists(db, userId, foodInput.barcode)) {
    throw new FoodCreateBarcodeConflictError();
  }

  try {
    return db.transaction((transaction) => {
      const food = transaction
        .insert(foods)
        .values(
          { userId, ...foodValues }
        )
        .returning()
        .get();

      const diaryLog = transaction
        .insert(diaryLogs)
        .values(
          {
            ...buildDiaryLogValues(food, logInput),
            clientRequestFingerprint: requestFingerprint
          }
        )
        .returning()
        .get();

      return {
        food,
        diaryLog
      }
    });
  } catch (error) { // for concurrency scenarios
    const replayed = findExistingMutation(db, userId, logInput.clientMutationId);

    if (replayed !== undefined) {
      return replayExistingMutation(replayed, requestFingerprint);
    }

    if (isUniqueConstraintError(error)) {
      throw new FoodCreateBarcodeConflictError();
    }

    throw error;
  }
}
