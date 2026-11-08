import { createHash } from 'node:crypto';
import { createFoodSchema } from '$lib/nutrition/food-input';
import { createFoodMutationSchema, logFoodInputSchema, type LogFoodInput } from '$lib/nutrition/portion-input';
import { parsePortionCountToMilli, toSafeInteger } from '$lib/nutrition/math';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from '../db/connection';
import { diaryLogs, foods, type DiaryLog, type Food } from '../db/schema';
import { atomicBatch, isAtomicGuardError, isConstraintError } from '../db/atomic';
import { buildDiaryLogValues } from './diary-entry';
import { mapFoodInput, type MutableFoodValues } from './food-mapper';

export class FoodCreateBarcodeConflictError extends Error {
  constructor() { super('This barcode is already assigned to another active food.'); this.name = 'FoodCreateBarcodeConflictError'; }
}
export class FoodCreateMutationConflictError extends Error {
  constructor() { super('This create-food request was already used with different details. Reload before trying again.'); this.name = 'FoodCreateMutationConflictError'; }
}
function createRequestFingerprint(food: MutableFoodValues, log: LogFoodInput | null): string {
  return createHash('sha256').update(JSON.stringify({ food, log: log && {
    portionKind: log.portionKind,
    portionCountMilli: toSafeInteger(parsePortionCountToMilli(log.portionCount)),
    diaryDate: log.diaryDate, mealSlot: log.mealSlot
  } })).digest('hex');
}
async function findExistingMutation(db: AppDatabase, userId: string, clientMutationId: string) {
  const food = await db.select().from(foods).where(and(
    eq(foods.userId, userId), eq(foods.clientMutationId, clientMutationId)
  )).get();
  if (!food) return undefined;
  const diaryLog = await db.select().from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId), eq(diaryLogs.clientMutationId, clientMutationId)
  )).get();
  return { food, diaryLog: diaryLog ?? null };
}
function replay(existing: NonNullable<Awaited<ReturnType<typeof findExistingMutation>>>, fingerprint: string) {
  if (existing.food.clientRequestFingerprint !== fingerprint) throw new FoodCreateMutationConflictError();
  return { ...existing, replayed: true as const };
}

async function insertFood(db: AppDatabase, userId: string, rawFoodInput: unknown, clientMutationId: string, logInput: LogFoodInput | null) {
  const foodInput = createFoodSchema.parse(rawFoodInput);
  const foodValues = mapFoodInput(foodInput);
  const fingerprint = createRequestFingerprint(foodValues, logInput);
  const existing = await findExistingMutation(db, userId, clientMutationId);
  if (existing) return replay(existing, fingerprint);

  const id = crypto.randomUUID();
  const timestamp = new Date();
  const food = {
    id, userId, ...foodValues, clientMutationId, clientRequestFingerprint: fingerprint,
    createdAt: timestamp, updatedAt: timestamp, deletedAt: null
  } as Food;
  // Built before the batch so an unavailable portion fails as a RangeError without writing anything.
  const logValues = logInput && { ...buildDiaryLogValues(food, logInput), id: crypto.randomUUID(), clientRequestFingerprint: fingerprint };
  const guards = [sql`not exists (select 1 from ${foods} where ${foods.userId} = ${userId} and ${foods.clientMutationId} = ${clientMutationId})`];
  if (logInput) guards.push(sql`not exists (select 1 from ${diaryLogs} where ${diaryLogs.userId} = ${userId} and ${diaryLogs.clientMutationId} = ${clientMutationId})`);
  if (foodInput.barcode !== '') guards.push(sql`not exists (select 1 from ${foods} where ${foods.userId} = ${userId} and ${foods.barcode} = ${foodInput.barcode} and ${foods.deletedAt} is null)`);
  try {
    const foodInsert = db.insert(foods).values(food).returning();
    let createdFood: Food | undefined;
    let diaryLog: DiaryLog | null = null;
    if (logValues) {
      const [createdFoods, createdLogs] = await atomicBatch(db, guards, [foodInsert, db.insert(diaryLogs).values(logValues).returning()]);
      createdFood = createdFoods[0];
      diaryLog = createdLogs[0] ?? null;
    } else {
      [[createdFood]] = await atomicBatch(db, guards, [foodInsert]);
    }
    if (!createdFood || (logValues && !diaryLog)) throw new Error('D1 did not return the created food and diary entry');
    return { food: createdFood, diaryLog, replayed: false as const };
  } catch (error) {
    const raced = await findExistingMutation(db, userId, clientMutationId);
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

/** Creates a food and its first diary entry atomically. */
export async function createFoodAndLog(db: AppDatabase, userId: string, rawFoodInput: unknown, rawLogInput: unknown) {
  const logInput = logFoodInputSchema.parse(rawLogInput);
  const created = await insertFood(db, userId, rawFoodInput, logInput.clientMutationId, logInput);
  // Diary entries are soft-deleted, so a matching replay always finds its first entry.
  if (!created.diaryLog) throw new Error('Existing mutation no longer references a diary entry');
  return { ...created, diaryLog: created.diaryLog };
}

/** Creates a catalogue food without adding it to the diary. */
export async function createFood(db: AppDatabase, userId: string, rawFoodInput: unknown, rawMutationInput: unknown) {
  const { clientMutationId } = createFoodMutationSchema.parse(rawMutationInput);
  const created = await insertFood(db, userId, rawFoodInput, clientMutationId, null);
  return { ...created, diaryLog: null };
}
