import type { PortionKind } from '$lib/nutrition/constants';
import {
  applyMealShortcutInputSchema,
  createMealShortcutInputSchema,
  mealShortcutDraftSourceSchema,
  updateMealShortcutInputSchema,
  type ApplyMealShortcutInput,
  type CreateMealShortcutInput,
  type MealShortcutItemInput
} from '$lib/nutrition/meal-shortcut-input';
import { parseFixedPoint, scaleNutritionValue, toSafeInteger } from '$lib/nutrition/math';
import type { AppDatabase, ReadDatabase } from '$lib/server/db/connection';
import {
  diaryLogs,
  foods,
  mealShortcutApplications,
  mealShortcutItems,
  mealShortcuts,
  type Food,
  type MealShortcut,
  type MealShortcutApplication,
  type MealShortcutItem
} from '$lib/server/db/schema';
import { and, asc, eq, inArray, isNull, like, sql, type SQL } from 'drizzle-orm';
import { atomicBatch, isAtomicGuardError, isConstraintError } from '$lib/server/db/atomic';
import { buildDiaryLogValuesForExactAmount } from './diary-entry';
import { getActiveDiaryEntry } from './diary-entry-query';
import { listActiveFoods } from './food-catalogue';

export class MealShortcutNotFoundError extends Error {
  constructor() {
    super('Meal shortcut not found');
    this.name = 'MealShortcutNotFoundError';
  }
}

export class MealShortcutCreateConflictError extends Error {
  constructor() {
    super('This shortcut request was already used with different details.');
    this.name = 'MealShortcutCreateConflictError';
  }
}

export class MealShortcutEditConflictError extends Error {
  constructor() {
    super('This meal shortcut changed elsewhere. Reload before saving again.');
    this.name = 'MealShortcutEditConflictError';
  }
}

export class MealShortcutBlockedError extends Error {
  constructor(message = 'This meal shortcut contains an unavailable food. Replace or remove it.') {
    super(message);
    this.name = 'MealShortcutBlockedError';
  }
}

export class MealShortcutApplicationConflictError extends Error {
  constructor() {
    super('This shortcut application ID was already used for a different request.');
    this.name = 'MealShortcutApplicationConflictError';
  }
}

export class MealShortcutApplicationNotFoundError extends Error {
  constructor() {
    super('Meal shortcut application not found');
    this.name = 'MealShortcutApplicationNotFoundError';
  }
}

type BlockedReason = 'food_archived' | 'amount_unit_changed';

export interface MealShortcutDetailItem extends MealShortcutItem {
  foodName: string;
  foodBrand: string | null;
  currentAmountUnit: 'mg' | 'ul' | null;
  blockedReason: BlockedReason | null;
}

export interface MealShortcutDetail extends MealShortcut {
  items: MealShortcutDetailItem[];
}

interface NormalizedItem {
  snapshotGuard?: SQL;
  userId: string;
  foodId: string;
  amountUnit: 'mg' | 'ul';
  defaultAmount: number;
  defaultPortionKind: PortionKind;
  defaultPortionLabel: string;
  defaultPortionAmount: number;
  defaultPortionCountMilli: number;
}

function exactAmount(value: string): number {
  return toSafeInteger(parseFixedPoint(value, 3));
}

function canonicalPortion(unit: 'mg' | 'ul', amount: number) {
  return {
    defaultPortionKind: 'unit' as const,
    defaultPortionLabel: `1 ${unit === 'mg' ? 'g' : 'ml'}`,
    defaultPortionAmount: 1_000,
    defaultPortionCountMilli: amount
  };
}

async function activeOwnedFood(db: ReadDatabase, userId: string, foodId: string): Promise<Food | undefined> {
  return db.select().from(foods).where(and(
    eq(foods.id, foodId),
    eq(foods.userId, userId),
    isNull(foods.deletedAt)
  )).get();
}

function itemSnapshotGuard(item: MealShortcutItem): SQL {
  return sql`exists (select 1 from meal_shortcut_items where id = ${item.id} and user_id = ${item.userId} and shortcut_id = ${item.shortcutId} and food_id = ${item.foodId} and amount_unit = ${item.amountUnit} and position = ${item.position} and default_amount = ${item.defaultAmount} and default_portion_kind is ${item.defaultPortionKind} and default_portion_label is ${item.defaultPortionLabel} and default_portion_amount is ${item.defaultPortionAmount} and default_portion_count_milli is ${item.defaultPortionCountMilli})`;
}

async function preservedSnapshot(
  db: ReadDatabase,
  userId: string,
  shortcutId: string | null,
  input: MealShortcutItemInput,
  food: Food,
  amount: number
) {
  if (input.itemId !== undefined) {
    const item = await db.select().from(mealShortcutItems).where(and(
      eq(mealShortcutItems.id, input.itemId),
      eq(mealShortcutItems.userId, userId),
      ...(shortcutId === null ? [] : [eq(mealShortcutItems.shortcutId, shortcutId)])
    )).get();

    if (item === undefined) {
      throw new MealShortcutBlockedError('A shortcut item is no longer available. Reload the editor.');
    }

    if (
      item.foodId === food.id &&
      item.amountUnit === food.amountUnit &&
      item.defaultAmount === amount &&
      item.defaultPortionKind !== null &&
      item.defaultPortionLabel !== null &&
      item.defaultPortionAmount !== null &&
      item.defaultPortionCountMilli !== null
    ) {
      return {
        defaultPortionKind: item.defaultPortionKind,
        defaultPortionLabel: item.defaultPortionLabel,
        defaultPortionAmount: item.defaultPortionAmount,
        defaultPortionCountMilli: item.defaultPortionCountMilli,
        snapshotGuard: itemSnapshotGuard(item)
      };
    }
    return { ...canonicalPortion(food.amountUnit, amount), snapshotGuard: itemSnapshotGuard(item) };
  }

  if (input.sourceEntryId !== undefined) {
    const entry = await getActiveDiaryEntry(db, userId, input.sourceEntryId);

    if (entry === undefined) {
      throw new MealShortcutBlockedError('A source diary entry is no longer available.');
    }

    const snapshotGuard = sql`exists (select 1 from diary_logs where id = ${entry.id} and user_id = ${userId} and updated_at = ${entry.updatedAt.getTime()} and deleted_at is null)`;
    if (entry.foodId !== food.id) {
      return { ...canonicalPortion(food.amountUnit, amount), snapshotGuard };
    }

    if (entry.amountUnit !== food.amountUnit) {
      throw new MealShortcutBlockedError('A source food changed between g and ml.');
    }

    if (entry.resolvedAmount === amount) {
      return {
        defaultPortionKind: entry.portionKind,
        defaultPortionLabel: entry.portionLabel,
        defaultPortionAmount: entry.portionAmount,
        defaultPortionCountMilli: entry.portionCountMilli,
        snapshotGuard
      };
    }
    return { ...canonicalPortion(food.amountUnit, amount), snapshotGuard };
  }

  return null;
}

async function normalizeItems(
  db: ReadDatabase,
  userId: string,
  inputs: readonly MealShortcutItemInput[],
  shortcutId: string | null
): Promise<NormalizedItem[]> {
  return Promise.all(inputs.map(async (input) => {
    const food = await activeOwnedFood(db, userId, input.foodId);
    if (food === undefined) throw new MealShortcutBlockedError();

    const amount = exactAmount(input.amount);
    const snapshot = await preservedSnapshot(db, userId, shortcutId, input, food, amount) ??
      canonicalPortion(food.amountUnit, amount);

    return {
      userId,
      foodId: food.id,
      amountUnit: food.amountUnit,
      defaultAmount: amount,
      ...snapshot
    };
  }));
}

async function isMatchingShortcutCreationReplay(
  db: ReadDatabase,
  shortcut: MealShortcut,
  input: CreateMealShortcutInput
): Promise<boolean> {
  const items = await db.select().from(mealShortcutItems)
    .where(eq(mealShortcutItems.shortcutId, shortcut.id))
    .orderBy(asc(mealShortcutItems.position)).all();

  return shortcut.name === input.name && items.length === input.items.length &&
    items.every((item, index) => {
      const requested = input.items[index];
      return requested !== undefined && item.foodId === requested.foodId &&
        item.defaultAmount === exactAmount(requested.amount);
    });
}

async function findCreationReplay(db: ReadDatabase, userId: string, mutationId: string) {
  return db.select().from(mealShortcuts).where(and(
    eq(mealShortcuts.userId, userId),
    eq(mealShortcuts.clientMutationId, mutationId)
  )).get();
}

export async function loadMealShortcutDraft(
  db: AppDatabase,
  userId: string,
  rawDate: string,
  rawMealSlot: string
) {
  const source = mealShortcutDraftSourceSchema.parse({
    diaryDate: rawDate,
    mealSlot: rawMealSlot
  });
  const entries = await db.select().from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId),
    eq(diaryLogs.diaryDate, source.diaryDate),
    eq(diaryLogs.mealSlot, source.mealSlot),
    isNull(diaryLogs.deletedAt)
  )).orderBy(asc(diaryLogs.loggedAt), asc(diaryLogs.id)).all();
  const foodIds = entries.flatMap((entry) => entry.foodId === null ? [] : [entry.foodId]);
  const currentFoods = foodIds.length === 0 ? [] : await db.select().from(foods)
    .where(and(eq(foods.userId, userId), inArray(foods.id, sql`(select value from json_each(${JSON.stringify(foodIds)}))`))).all();
  const foodsById = new Map(currentFoods.map((food) => [food.id, food]));
  const items: Array<{
    position: number;
    sourceEntryId: string;
    foodId: string;
    foodName: string;
    foodBrand: string | null;
    amountUnit: 'mg' | 'ul';
    defaultAmount: number;
  }> = [];
  const excludedEntries: Array<{
    position: number;
    entryId: string;
    foodName: string;
    reason: 'food_missing' | 'food_archived' | 'amount_unit_changed';
  }> = [];

  for (const [position, entry] of entries.entries()) {
    const food = entry.foodId === null ? undefined : foodsById.get(entry.foodId);
    if (food === undefined) {
      excludedEntries.push({
        position,
        entryId: entry.id,
        foodName: entry.foodName,
        reason: 'food_missing'
      });
    } else if (food.deletedAt !== null) {
      excludedEntries.push({
        position,
        entryId: entry.id,
        foodName: entry.foodName,
        reason: 'food_archived'
      });
    } else if (food.amountUnit !== entry.amountUnit) {
      excludedEntries.push({
        position,
        entryId: entry.id,
        foodName: entry.foodName,
        reason: 'amount_unit_changed'
      });
    } else {
      items.push({
        position,
        sourceEntryId: entry.id,
        foodId: food.id,
        foodName: entry.foodName,
        foodBrand: entry.foodBrand,
        amountUnit: food.amountUnit,
        defaultAmount: entry.resolvedAmount
      });
    }
  }

  return {
    clientMutationId: crypto.randomUUID(),
    name: '',
    items,
    excludedEntries
  };
}

export async function searchMealShortcutFoods(
  db: AppDatabase,
  userId: string,
  query: string,
  limit = 200
) {
  return (await listActiveFoods(db, userId, query, limit)).map((food) => ({
    id: food.id,
    name: food.name,
    brand: food.brand,
    amountUnit: food.amountUnit,
    suggestedAmount: food.latestUse?.amountUnit === food.amountUnit
      ? food.latestUse.resolvedAmount
      : food.servingAmount ?? 100_000
  }));
}

export async function createMealShortcut(db: AppDatabase, userId: string, rawInput: unknown): Promise<MealShortcut> {
  const input = createMealShortcutInputSchema.parse(rawInput);
  const replay = await findCreationReplay(db, userId, input.clientMutationId);
  if (replay) {
    if (!(await isMatchingShortcutCreationReplay(db, replay, input))) throw new MealShortcutCreateConflictError();
    return replay;
  }
  const normalized = await normalizeItems(db, userId, input.items, null);
  const shortcutId = crypto.randomUUID();
  const createdAt = new Date();
  const shortcutValues = { id: shortcutId, userId, name: input.name, clientMutationId: input.clientMutationId, createdAt, updatedAt: createdAt, deletedAt: null };
  const itemValues = normalized.map(({ snapshotGuard: _snapshotGuard, ...item }, position) => { void _snapshotGuard; return { ...item, id: crypto.randomUUID(), shortcutId, position }; });
  const guards = [sql`not exists (select 1 from meal_shortcuts where user_id = ${userId} and client_mutation_id = ${input.clientMutationId})`];
  for (const item of normalized) {
    if (item.snapshotGuard) guards.push(item.snapshotGuard);
    guards.push(sql`exists (select 1 from foods where id = ${item.foodId} and user_id = ${userId} and amount_unit = ${item.amountUnit} and deleted_at is null)`);
  }
  try {
    const [shortcuts] = await atomicBatch(db, guards, [
      db.insert(mealShortcuts).values(shortcutValues).returning(),
      ...itemValues.map((item) => db.insert(mealShortcutItems).values(item))
    ]);
    return shortcuts[0]!;
  } catch (error) {
    const raced = await findCreationReplay(db, userId, input.clientMutationId);
    if (raced) {
      if (await isMatchingShortcutCreationReplay(db, raced, input)) return raced;
      throw new MealShortcutCreateConflictError();
    }
    if (isAtomicGuardError(error)) throw new MealShortcutBlockedError();
    throw error;
  }
}

export async function getMealShortcut(
  db: ReadDatabase,
  userId: string,
  shortcutId: string
): Promise<MealShortcutDetail> {
  const shortcut = await db.select().from(mealShortcuts).where(and(
    eq(mealShortcuts.id, shortcutId),
    eq(mealShortcuts.userId, userId),
    isNull(mealShortcuts.deletedAt)
  )).get();
  if (shortcut === undefined) throw new MealShortcutNotFoundError();

  const storedItems = await db.select().from(mealShortcutItems).where(and(
    eq(mealShortcutItems.shortcutId, shortcut.id),
    eq(mealShortcutItems.userId, userId)
  )).orderBy(asc(mealShortcutItems.position)).all();
  const foodIds = storedItems.map((item) => item.foodId);
  const currentFoods = foodIds.length === 0 ? [] : await db.select().from(foods)
    .where(and(eq(foods.userId, userId), inArray(foods.id, sql`(select value from json_each(${JSON.stringify(foodIds)}))`))).all();
  const foodsById = new Map(currentFoods.map((food) => [food.id, food]));

  return {
    ...shortcut,
    items: storedItems.map((item) => {
      const food = foodsById.get(item.foodId);
      const blockedReason: BlockedReason | null = food === undefined || food.deletedAt !== null
        ? 'food_archived'
        : food.amountUnit !== item.amountUnit
          ? 'amount_unit_changed'
          : null;
      return {
        ...item,
        foodName: food?.name ?? 'Unavailable food',
        foodBrand: food?.brand ?? null,
        currentAmountUnit: food?.amountUnit ?? null,
        blockedReason
      };
    })
  };
}

export async function listMealShortcuts(
  db: AppDatabase,
  userId: string,
  query: string,
  limit = 50
) {
  const where = query.trim() === ''
    ? and(eq(mealShortcuts.userId, userId), isNull(mealShortcuts.deletedAt))
    : and(
        eq(mealShortcuts.userId, userId),
        isNull(mealShortcuts.deletedAt),
        like(mealShortcuts.name, `%${query.trim()}%`)
      );
  const shortcuts = await db.select().from(mealShortcuts).where(where)
    .orderBy(asc(mealShortcuts.name), asc(mealShortcuts.id)).limit(limit).all();

  return Promise.all(shortcuts.map(async (shortcut) => {
    const detail = await getMealShortcut(db, userId, shortcut.id);
    const blockedItems = detail.items.filter((item) => item.blockedReason !== null);
    const blocked = detail.items.length === 0 || blockedItems.length > 0;
    let energy = 0n;
    if (!blocked) {
      for (const item of detail.items) {
        const food = await activeOwnedFood(db, userId, item.foodId);
        if (food !== undefined) {
          energy += scaleNutritionValue(
            BigInt(food.energyMkcalPerBasis),
            BigInt(item.defaultAmount),
            BigInt(food.basisAmount)
          );
        }
      }
    }
    return {
      id: detail.id,
      name: detail.name,
      itemCount: detail.items.length,
      blocked,
      blockedItems,
      totals: blocked ? null : { energyMkcal: toSafeInteger(energy) }
    };
  }));
}

export async function updateMealShortcut(db: AppDatabase, userId: string, shortcutId: string, rawInput: unknown): Promise<MealShortcut> {
  const input = updateMealShortcutInputSchema.parse(rawInput);
  const expectedUpdatedAt = Number(input.expectedUpdatedAt);
  if (!Number.isSafeInteger(expectedUpdatedAt)) throw new MealShortcutEditConflictError();
  const expectedDate = new Date(expectedUpdatedAt);
  const updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));
  const current = await db.select().from(mealShortcuts).where(and(eq(mealShortcuts.id, shortcutId), eq(mealShortcuts.userId, userId), isNull(mealShortcuts.deletedAt))).get();
  if (!current) throw new MealShortcutNotFoundError();
  if (current.updatedAt.getTime() !== expectedUpdatedAt) throw new MealShortcutEditConflictError();
  const normalized = await normalizeItems(db, userId, input.items, shortcutId);
  const guards = [sql`exists (select 1 from meal_shortcuts where id = ${shortcutId} and user_id = ${userId} and updated_at = ${expectedUpdatedAt} and deleted_at is null)`];
  for (const item of normalized) {
    if (item.snapshotGuard) guards.push(item.snapshotGuard);
    guards.push(sql`exists (select 1 from foods where id = ${item.foodId} and user_id = ${userId} and amount_unit = ${item.amountUnit} and deleted_at is null)`);
  }
  const newItems = normalized.map(({ snapshotGuard: _snapshotGuard, ...item }, position) => { void _snapshotGuard; return { ...item, id: crypto.randomUUID(), shortcutId, position }; });
  try {
    const [updatedRows] = await atomicBatch(db, guards, [
      db.update(mealShortcuts).set({ name: input.name, updatedAt }).where(and(eq(mealShortcuts.id, shortcutId), eq(mealShortcuts.userId, userId), eq(mealShortcuts.updatedAt, expectedDate), isNull(mealShortcuts.deletedAt))).returning(),
      db.delete(mealShortcutItems).where(and(eq(mealShortcutItems.shortcutId, shortcutId), eq(mealShortcutItems.userId, userId))),
      ...newItems.map((item) => db.insert(mealShortcutItems).values(item))
    ]);
    if (!updatedRows[0]) throw new MealShortcutEditConflictError();
    return updatedRows[0];
  } catch (error) {
    if (isAtomicGuardError(error)) {
      const exists = await db.select({ id: mealShortcuts.id }).from(mealShortcuts).where(and(eq(mealShortcuts.id, shortcutId), eq(mealShortcuts.userId, userId), isNull(mealShortcuts.deletedAt))).get();
      if (!exists) throw new MealShortcutNotFoundError();
      throw new MealShortcutEditConflictError();
    }
    throw error;
  }
}

export async function archiveMealShortcut(
  db: AppDatabase,
  userId: string,
  shortcutId: string,
  expectedUpdatedAtText: string
): Promise<MealShortcut> {
  const expectedUpdatedAt = Number(expectedUpdatedAtText);
  if (!Number.isSafeInteger(expectedUpdatedAt)) throw new MealShortcutEditConflictError();
  const archivedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));
  const archived = await db.update(mealShortcuts).set({
    deletedAt: archivedAt,
    updatedAt: archivedAt
  }).where(and(
    eq(mealShortcuts.id, shortcutId),
    eq(mealShortcuts.userId, userId),
    isNull(mealShortcuts.deletedAt),
    eq(mealShortcuts.updatedAt, new Date(expectedUpdatedAt))
  )).returning().get();
  if (archived !== undefined) return archived;
  const exists = await db.select({ id: mealShortcuts.id }).from(mealShortcuts).where(and(
    eq(mealShortcuts.id, shortcutId), eq(mealShortcuts.userId, userId),
    isNull(mealShortcuts.deletedAt)
  )).get();
  if (exists === undefined) throw new MealShortcutNotFoundError();
  throw new MealShortcutEditConflictError();
}

async function findExistingShortcutApplicationByMutationId(
  db: ReadDatabase,
  userId: string,
  mutationId: string
) {
  return db.select().from(mealShortcutApplications).where(and(
    eq(mealShortcutApplications.userId, userId),
    eq(mealShortcutApplications.clientMutationId, mutationId)
  )).get();
}

async function replayExistingShortcutApplication(
  db: ReadDatabase,
  application: MealShortcutApplication,
  shortcutId: string,
  input: ApplyMealShortcutInput
) {
  if (
    application.shortcutId !== shortcutId ||
    application.diaryDate !== input.diaryDate ||
    application.mealSlot !== input.mealSlot
  ) throw new MealShortcutApplicationConflictError();
  const entries = await db.select().from(diaryLogs)
    .where(and(eq(diaryLogs.userId, application.userId),
      eq(diaryLogs.shortcutBatchId, application.id)))
    .orderBy(asc(diaryLogs.loggedAt), asc(diaryLogs.id)).all();
  return { application, entries, replayed: true };
}

export async function applyMealShortcut(db: AppDatabase, userId: string, shortcutId: string, rawInput: unknown) {
  const input = applyMealShortcutInputSchema.parse(rawInput);
  const replay = await findExistingShortcutApplicationByMutationId(db, userId, input.clientMutationId);
  if (replay) return await replayExistingShortcutApplication(db, replay, shortcutId, input);
  const detail = await getMealShortcut(db, userId, shortcutId);
  if (detail.items.length === 0 || detail.items.some((item) => item.blockedReason !== null)) throw new MealShortcutBlockedError();
  const foodIds = detail.items.map((item) => item.foodId);
  const activeFoods = await db.select().from(foods).where(and(eq(foods.userId, userId), isNull(foods.deletedAt), inArray(foods.id, sql`(select value from json_each(${JSON.stringify(foodIds)}))`))).all();
  const foodsById = new Map(activeFoods.map((food) => [food.id, food]));
  const applicationId = crypto.randomUUID();
  const timestamp = new Date();
  const applicationValues = { id: applicationId, userId, shortcutId, shortcutName: detail.name, clientMutationId: input.clientMutationId, diaryDate: input.diaryDate, mealSlot: input.mealSlot, createdAt: timestamp, undoneAt: null };
  const entriesValues = detail.items.map((item, index) => {
    const food = foodsById.get(item.foodId);
    if (!food || food.amountUnit !== item.amountUnit) throw new MealShortcutBlockedError();
    const snapshot = item.defaultPortionKind === null || item.defaultPortionLabel === null || item.defaultPortionAmount === null || item.defaultPortionCountMilli === null
      ? canonicalPortion(item.amountUnit, item.defaultAmount)
      : { defaultPortionKind: item.defaultPortionKind, defaultPortionLabel: item.defaultPortionLabel, defaultPortionAmount: item.defaultPortionAmount, defaultPortionCountMilli: item.defaultPortionCountMilli };
    return { ...buildDiaryLogValuesForExactAmount(food, {
      diaryDate: input.diaryDate, mealSlot: input.mealSlot, resolvedAmount: item.defaultAmount,
      portionKind: snapshot.defaultPortionKind, portionLabel: snapshot.defaultPortionLabel,
      portionAmount: snapshot.defaultPortionAmount, portionCountMilli: snapshot.defaultPortionCountMilli,
      sourceShortcutId: detail.id, shortcutBatchId: applicationId, loggedAt: new Date(timestamp.getTime() + index)
    }), id: crypto.randomUUID() };
  });
  const guards = [
    sql`not exists (select 1 from meal_shortcut_applications where user_id = ${userId} and client_mutation_id = ${input.clientMutationId})`,
    sql`exists (select 1 from meal_shortcuts where id = ${shortcutId} and user_id = ${userId} and updated_at = ${detail.updatedAt.getTime()} and deleted_at is null)`
  ];
  for (const item of detail.items) {
    const food = foodsById.get(item.foodId)!;
    guards.push(itemSnapshotGuard(item));
    guards.push(sql`exists (select 1 from foods where id = ${food.id} and user_id = ${userId} and updated_at = ${food.updatedAt.getTime()} and amount_unit = ${item.amountUnit} and deleted_at is null)`);
  }
  try {
    const [apps, ...entryBatches] = await atomicBatch(db, guards, [
      db.insert(mealShortcutApplications).values(applicationValues).returning(),
      ...entriesValues.map((entry) => db.insert(diaryLogs).values(entry).returning())
    ]);
    const application = apps[0];
    if (!application) throw new Error('D1 did not return the meal shortcut application');
    return { application, entries: entryBatches.flat(), replayed: false };
  } catch (error) {
    const raced = await findExistingShortcutApplicationByMutationId(db, userId, input.clientMutationId);
    if (raced) return await replayExistingShortcutApplication(db, raced, shortcutId, input);
    if (isAtomicGuardError(error)) throw new MealShortcutBlockedError();
    if (isConstraintError(error)) throw new MealShortcutApplicationConflictError();
    throw error;
  }
}

export async function getMealShortcutApplicationFeedback(
  db: AppDatabase,
  userId: string,
  applicationId: string
) {
  const application = await db.select().from(mealShortcutApplications).where(and(
    eq(mealShortcutApplications.id, applicationId),
    eq(mealShortcutApplications.userId, userId)
  )).get();
  if (application === undefined) throw new MealShortcutApplicationNotFoundError();
  const entries = await db.select({ id: diaryLogs.id }).from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId),
    eq(diaryLogs.shortcutBatchId, application.id)
  )).all();
  return {
    application,
    entryCount: entries.length,
    undone: application.undoneAt !== null
  };
}

export async function undoMealShortcutApplication(
  db: AppDatabase,
  userId: string,
  applicationId: string
) {
  const application = await db.select().from(mealShortcutApplications).where(and(
    eq(mealShortcutApplications.id, applicationId),
    eq(mealShortcutApplications.userId, userId)
  )).get();
  if (application === undefined) throw new MealShortcutApplicationNotFoundError();
  if (application.undoneAt === null) {
    const undoneAt = new Date();
    try {
    await atomicBatch(db, [sql`exists (select 1 from meal_shortcut_applications where id = ${application.id} and user_id = ${userId} and undone_at is null)`], [
      db.update(diaryLogs).set({ deletedAt: undoneAt, updatedAt: undoneAt }).where(and(eq(diaryLogs.userId, userId), eq(diaryLogs.shortcutBatchId, application.id), isNull(diaryLogs.deletedAt))),
      db.update(mealShortcutApplications).set({ undoneAt }).where(and(eq(mealShortcutApplications.id, application.id), eq(mealShortcutApplications.userId, userId), isNull(mealShortcutApplications.undoneAt)))
    ]);
    } catch (error) {
      if (!isAtomicGuardError(error)) throw error;
      const latest = await db.select().from(mealShortcutApplications).where(and(eq(mealShortcutApplications.id, application.id), eq(mealShortcutApplications.userId, userId))).get();
      if (latest?.undoneAt === null || latest === undefined) throw error;
    }

  }
  return getMealShortcutApplicationFeedback(db, userId, application.id);
}
