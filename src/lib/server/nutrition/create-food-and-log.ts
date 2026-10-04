import { createHash } from 'node:crypto';
import { createFoodSchema } from '$lib/nutrition/food-input';
import { logFoodInputSchema, type LogFoodInput } from '$lib/nutrition/portion-input';
import { parsePortionCountToMilli, toSafeInteger } from '$lib/nutrition/math';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from '../db/connection';
import { diaryLogs, foods, type Food } from '../db/schema';
import { atomicBatch, isAtomicGuardError, isConstraintError } from '../db/atomic';
import { buildDiaryLogValues } from './diary-entry';
import { mapFoodInput, type MutableFoodValues } from './food-mapper';

export class FoodCreateBarcodeConflictError extends Error {
  constructor() { super('This barcode is already assigned to another active food.'); this.name = 'FoodCreateBarcodeConflictError'; }
}
export class FoodCreateMutationConflictError extends Error {
  constructor() { super('This create-food request was already used with different details. Reload before trying again.'); this.name = 'FoodCreateMutationConflictError'; }
}
function createRequestFingerprint(food: MutableFoodValues, log: LogFoodInput): string {
  return createHash('sha256').update(JSON.stringify({ food, log: {
    portionKind: log.portionKind,
    portionCountMilli: toSafeInteger(parsePortionCountToMilli(log.portionCount)),
    diaryDate: log.diaryDate, mealSlot: log.mealSlot
  } })).digest('hex');
}
async function findExistingMutation(db: AppDatabase, userId: string, clientMutationId: string) {
  const diaryLog = await db.select().from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId), eq(diaryLogs.clientMutationId, clientMutationId)
  )).get();
  if (!diaryLog) return undefined;
  if (diaryLog.foodId === null) throw new Error('Existing mutation no longer references a food');
  const food = await db.select().from(foods).where(and(
    eq(foods.id, diaryLog.foodId), eq(foods.userId, userId)
  )).get();
  if (!food) throw new Error('Existing mutation references a missing food');
  return { food, diaryLog };
}
function replay(existing: NonNullable<Awaited<ReturnType<typeof findExistingMutation>>>, fingerprint: string) {
  if (existing.diaryLog.clientRequestFingerprint !== fingerprint) throw new FoodCreateMutationConflictError();
  return { ...existing, replayed: true as const };
}

export async function createFoodAndLog(db: AppDatabase, userId: string, rawFoodInput: unknown, rawLogInput: unknown) {
  const foodInput = createFoodSchema.parse(rawFoodInput);
  const logInput = logFoodInputSchema.parse(rawLogInput);
  const foodValues = mapFoodInput(foodInput);
  const fingerprint = createRequestFingerprint(foodValues, logInput);
  const existing = await findExistingMutation(db, userId, logInput.clientMutationId);
  if (existing) return replay(existing, fingerprint);

  const id = crypto.randomUUID();
  const timestamp = new Date();
  const food = { id, userId, ...foodValues, createdAt: timestamp, updatedAt: timestamp, deletedAt: null } as Food;
  const logValues = { ...buildDiaryLogValues(food, logInput), id: crypto.randomUUID(), clientRequestFingerprint: fingerprint };
  const guards = [sql`not exists (select 1 from ${diaryLogs} where ${diaryLogs.userId} = ${userId} and ${diaryLogs.clientMutationId} = ${logInput.clientMutationId})`];
  if (foodInput.barcode !== '') guards.push(sql`not exists (select 1 from ${foods} where ${foods.userId} = ${userId} and ${foods.barcode} = ${foodInput.barcode} and ${foods.deletedAt} is null)`);
  try {
    const [createdFoods, createdLogs] = await atomicBatch(db, guards, [
      db.insert(foods).values(food).returning(),
      db.insert(diaryLogs).values(logValues).returning()
    ]);
    const createdFood = createdFoods[0];
    const diaryLog = createdLogs[0];
    if (!createdFood || !diaryLog) throw new Error('D1 did not return the created food and diary entry');
    return { food: createdFood, diaryLog, replayed: false as const };
  } catch (error) {
    const raced = await findExistingMutation(db, userId, logInput.clientMutationId);
    if (raced) return replay(raced, fingerprint);
    if (isAtomicGuardError(error)) {
      if (foodInput.barcode && await db.select({ id: foods.id }).from(foods).where(and(
        eq(foods.userId, userId), eq(foods.barcode, foodInput.barcode), isNull(foods.deletedAt)
      )).get()) throw new FoodCreateBarcodeConflictError();
      throw new FoodCreateMutationConflictError();
    }
    if (isConstraintError(error)) throw new FoodCreateBarcodeConflictError();
    throw error;
  }
}
