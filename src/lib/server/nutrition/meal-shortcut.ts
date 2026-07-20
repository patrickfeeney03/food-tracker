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
import { and, asc, eq, inArray, isNull, like } from 'drizzle-orm';
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
  userId: string;
  foodId: string;
  amountUnit: 'mg' | 'ul';
  defaultAmount: number;
  defaultPortionKind: PortionKind;
  defaultPortionLabel: string;
  defaultPortionAmount: number;
  defaultPortionCountMilli: number;
}

function isConstraintError(caught: unknown): boolean {
  return caught instanceof Error && 'code' in caught &&
    String(caught.code).startsWith('SQLITE_CONSTRAINT');
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

function activeOwnedFood(db: ReadDatabase, userId: string, foodId: string): Food | undefined {
  return db.select().from(foods).where(and(
    eq(foods.id, foodId),
    eq(foods.userId, userId),
    isNull(foods.deletedAt)
  )).get();
}

function preservedSnapshot(
  db: ReadDatabase,
  userId: string,
  shortcutId: string | null,
  input: MealShortcutItemInput,
  food: Food,
  amount: number
) {
  if (input.itemId !== undefined) {
    const item = db.select().from(mealShortcutItems).where(and(
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
        defaultPortionCountMilli: item.defaultPortionCountMilli
      };
    }
  }

  if (input.sourceEntryId !== undefined) {
    const entry = getActiveDiaryEntry(db, userId, input.sourceEntryId);

    if (entry === undefined) {
      throw new MealShortcutBlockedError('A source diary entry is no longer available.');
    }

    if (entry.foodId !== food.id) {
      return null;
    }

    if (entry.amountUnit !== food.amountUnit) {
      throw new MealShortcutBlockedError('A source food changed between g and ml.');
    }

    if (entry.resolvedAmount === amount) {
      return {
        defaultPortionKind: entry.portionKind,
        defaultPortionLabel: entry.portionLabel,
        defaultPortionAmount: entry.portionAmount,
        defaultPortionCountMilli: entry.portionCountMilli
      };
    }
  }

  return null;
}

function normalizeItems(
  db: ReadDatabase,
  userId: string,
  inputs: readonly MealShortcutItemInput[],
  shortcutId: string | null
): NormalizedItem[] {
  return inputs.map((input) => {
    const food = activeOwnedFood(db, userId, input.foodId);
    if (food === undefined) throw new MealShortcutBlockedError();

    const amount = exactAmount(input.amount);
    const snapshot = preservedSnapshot(db, userId, shortcutId, input, food, amount) ??
      canonicalPortion(food.amountUnit, amount);

    return {
      userId,
      foodId: food.id,
      amountUnit: food.amountUnit,
      defaultAmount: amount,
      ...snapshot
    };
  });
}

function isMatchingShortcutCreationReplay(
  db: ReadDatabase,
  shortcut: MealShortcut,
  input: CreateMealShortcutInput
): boolean {
  const items = db.select().from(mealShortcutItems)
    .where(eq(mealShortcutItems.shortcutId, shortcut.id))
    .orderBy(asc(mealShortcutItems.position)).all();

  return shortcut.name === input.name && items.length === input.items.length &&
    items.every((item, index) => {
      const requested = input.items[index];
      return requested !== undefined && item.foodId === requested.foodId &&
        item.defaultAmount === exactAmount(requested.amount);
    });
}

function findCreationReplay(db: ReadDatabase, userId: string, mutationId: string) {
  return db.select().from(mealShortcuts).where(and(
    eq(mealShortcuts.userId, userId),
    eq(mealShortcuts.clientMutationId, mutationId)
  )).get();
}

export function loadMealShortcutDraft(
  db: AppDatabase,
  userId: string,
  rawDate: string,
  rawMealSlot: string
) {
  const source = mealShortcutDraftSourceSchema.parse({
    diaryDate: rawDate,
    mealSlot: rawMealSlot
  });
  const entries = db.select().from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId),
    eq(diaryLogs.diaryDate, source.diaryDate),
    eq(diaryLogs.mealSlot, source.mealSlot),
    isNull(diaryLogs.deletedAt)
  )).orderBy(asc(diaryLogs.loggedAt), asc(diaryLogs.id)).all();
  const foodIds = entries.flatMap((entry) => entry.foodId === null ? [] : [entry.foodId]);
  const currentFoods = foodIds.length === 0 ? [] : db.select().from(foods)
    .where(and(eq(foods.userId, userId), inArray(foods.id, foodIds))).all();
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

export function searchMealShortcutFoods(
  db: AppDatabase,
  userId: string,
  query: string,
  limit = 200
) {
  return listActiveFoods(db, userId, query, limit).map((food) => ({
    id: food.id,
    name: food.name,
    brand: food.brand,
    amountUnit: food.amountUnit,
    suggestedAmount: food.latestUse?.amountUnit === food.amountUnit
      ? food.latestUse.resolvedAmount
      : food.servingAmount ?? 100_000
  }));
}

export function createMealShortcut(
  db: AppDatabase,
  userId: string,
  rawInput: unknown
): MealShortcut {
  const input = createMealShortcutInputSchema.parse(rawInput);
  try {
    return db.transaction((transaction) => {
      const replay = findCreationReplay(transaction, userId, input.clientMutationId);
      if (replay !== undefined) {
        if (!isMatchingShortcutCreationReplay(transaction, replay, input)) {
          throw new MealShortcutCreateConflictError();
        }
        return replay;
      }

      const normalized = normalizeItems(transaction, userId, input.items, null);
      const shortcut = transaction.insert(mealShortcuts).values({
        userId,
        name: input.name,
        clientMutationId: input.clientMutationId
      }).returning().get();
      transaction.insert(mealShortcutItems).values(normalized.map((item, position) => ({
        ...item,
        shortcutId: shortcut.id,
        position
      }))).run();
      return shortcut;
    });
  } catch (caught) {
    if (isConstraintError(caught)) {
      const raced = findCreationReplay(db, userId, input.clientMutationId);
      if (raced !== undefined && isMatchingShortcutCreationReplay(db, raced, input)) return raced;
      if (raced !== undefined) throw new MealShortcutCreateConflictError();
    }
    throw caught;
  }
}

export function getMealShortcut(
  db: ReadDatabase,
  userId: string,
  shortcutId: string
): MealShortcutDetail {
  const shortcut = db.select().from(mealShortcuts).where(and(
    eq(mealShortcuts.id, shortcutId),
    eq(mealShortcuts.userId, userId),
    isNull(mealShortcuts.deletedAt)
  )).get();
  if (shortcut === undefined) throw new MealShortcutNotFoundError();

  const storedItems = db.select().from(mealShortcutItems).where(and(
    eq(mealShortcutItems.shortcutId, shortcut.id),
    eq(mealShortcutItems.userId, userId)
  )).orderBy(asc(mealShortcutItems.position)).all();
  const foodIds = storedItems.map((item) => item.foodId);
  const currentFoods = foodIds.length === 0 ? [] : db.select().from(foods)
    .where(and(eq(foods.userId, userId), inArray(foods.id, foodIds))).all();
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

export function listMealShortcuts(
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
  const shortcuts = db.select().from(mealShortcuts).where(where)
    .orderBy(asc(mealShortcuts.name), asc(mealShortcuts.id)).limit(limit).all();

  return shortcuts.map((shortcut) => {
    const detail = getMealShortcut(db, userId, shortcut.id);
    const blockedItems = detail.items.filter((item) => item.blockedReason !== null);
    const blocked = detail.items.length === 0 || blockedItems.length > 0;
    let energy = 0n;
    if (!blocked) {
      for (const item of detail.items) {
        const food = activeOwnedFood(db, userId, item.foodId);
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
  });
}

export function updateMealShortcut(
  db: AppDatabase,
  userId: string,
  shortcutId: string,
  rawInput: unknown
): MealShortcut {
  const input = updateMealShortcutInputSchema.parse(rawInput);
  const expectedUpdatedAt = Number(input.expectedUpdatedAt);
  if (!Number.isSafeInteger(expectedUpdatedAt)) throw new MealShortcutEditConflictError();
  const updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));

  return db.transaction((transaction) => {
    const normalized = normalizeItems(transaction, userId, input.items, shortcutId);
    const updated = transaction.update(mealShortcuts).set({
      name: input.name,
      updatedAt
    }).where(and(
      eq(mealShortcuts.id, shortcutId),
      eq(mealShortcuts.userId, userId),
      isNull(mealShortcuts.deletedAt),
      eq(mealShortcuts.updatedAt, new Date(expectedUpdatedAt))
    )).returning().get();
    if (updated === undefined) {
      const exists = transaction.select({ id: mealShortcuts.id }).from(mealShortcuts).where(and(
        eq(mealShortcuts.id, shortcutId), eq(mealShortcuts.userId, userId),
        isNull(mealShortcuts.deletedAt)
      )).get();
      if (exists === undefined) throw new MealShortcutNotFoundError();
      throw new MealShortcutEditConflictError();
    }
    transaction.delete(mealShortcutItems).where(and(
      eq(mealShortcutItems.shortcutId, shortcutId),
      eq(mealShortcutItems.userId, userId)
    )).run();
    transaction.insert(mealShortcutItems).values(normalized.map((item, position) => ({
      ...item,
      shortcutId,
      position
    }))).run();
    return updated;
  });
}

export function archiveMealShortcut(
  db: AppDatabase,
  userId: string,
  shortcutId: string,
  expectedUpdatedAtText: string
): MealShortcut {
  const expectedUpdatedAt = Number(expectedUpdatedAtText);
  if (!Number.isSafeInteger(expectedUpdatedAt)) throw new MealShortcutEditConflictError();
  const archivedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));
  const archived = db.update(mealShortcuts).set({
    deletedAt: archivedAt,
    updatedAt: archivedAt
  }).where(and(
    eq(mealShortcuts.id, shortcutId),
    eq(mealShortcuts.userId, userId),
    isNull(mealShortcuts.deletedAt),
    eq(mealShortcuts.updatedAt, new Date(expectedUpdatedAt))
  )).returning().get();
  if (archived !== undefined) return archived;
  const exists = db.select({ id: mealShortcuts.id }).from(mealShortcuts).where(and(
    eq(mealShortcuts.id, shortcutId), eq(mealShortcuts.userId, userId),
    isNull(mealShortcuts.deletedAt)
  )).get();
  if (exists === undefined) throw new MealShortcutNotFoundError();
  throw new MealShortcutEditConflictError();
}

function findExistingShortcutApplicationByMutationId(
  db: ReadDatabase,
  userId: string,
  mutationId: string
) {
  return db.select().from(mealShortcutApplications).where(and(
    eq(mealShortcutApplications.userId, userId),
    eq(mealShortcutApplications.clientMutationId, mutationId)
  )).get();
}

function replayExistingShortcutApplication(
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
  const entries = db.select().from(diaryLogs)
    .where(and(eq(diaryLogs.userId, application.userId),
      eq(diaryLogs.shortcutBatchId, application.id)))
    .orderBy(asc(diaryLogs.loggedAt), asc(diaryLogs.id)).all();
  return { application, entries, replayed: true };
}

export function applyMealShortcut(
  db: AppDatabase,
  userId: string,
  shortcutId: string,
  rawInput: unknown
) {
  const input = applyMealShortcutInputSchema.parse(rawInput);
  try {
    return db.transaction((transaction) => {
      const replay = findExistingShortcutApplicationByMutationId(
        transaction,
        userId,
        input.clientMutationId
      );
      if (replay !== undefined) {
        return replayExistingShortcutApplication(transaction, replay, shortcutId, input);
      }

      const detail = getMealShortcut(transaction, userId, shortcutId);
      if (detail.items.length === 0 || detail.items.some((item) => item.blockedReason !== null)) {
        throw new MealShortcutBlockedError();
      }
      const foodIds = detail.items.map((item) => item.foodId);
      const activeFoods = transaction.select().from(foods).where(and(
        eq(foods.userId, userId), isNull(foods.deletedAt), inArray(foods.id, foodIds)
      )).all();
      const foodsById = new Map(activeFoods.map((food) => [food.id, food]));
      const application = transaction.insert(mealShortcutApplications).values({
        userId,
        shortcutId,
        shortcutName: detail.name,
        clientMutationId: input.clientMutationId,
        diaryDate: input.diaryDate,
        mealSlot: input.mealSlot
      }).returning().get();
      const loggedAt = Date.now();
      const values = detail.items.map((item, index) => {
        const food = foodsById.get(item.foodId);
        if (food === undefined || food.amountUnit !== item.amountUnit) {
          throw new MealShortcutBlockedError();
        }
        const snapshot = item.defaultPortionKind === null ||
          item.defaultPortionLabel === null || item.defaultPortionAmount === null ||
          item.defaultPortionCountMilli === null
          ? canonicalPortion(item.amountUnit, item.defaultAmount)
          : {
              defaultPortionKind: item.defaultPortionKind,
              defaultPortionLabel: item.defaultPortionLabel,
              defaultPortionAmount: item.defaultPortionAmount,
              defaultPortionCountMilli: item.defaultPortionCountMilli
            };
        return buildDiaryLogValuesForExactAmount(food, {
          diaryDate: input.diaryDate,
          mealSlot: input.mealSlot,
          resolvedAmount: item.defaultAmount,
          portionKind: snapshot.defaultPortionKind,
          portionLabel: snapshot.defaultPortionLabel,
          portionAmount: snapshot.defaultPortionAmount,
          portionCountMilli: snapshot.defaultPortionCountMilli,
          sourceShortcutId: detail.id,
          shortcutBatchId: application.id,
          loggedAt: new Date(loggedAt + index)
        });
      });
      const entries = transaction.insert(diaryLogs).values(values).returning().all();
      return { application, entries, replayed: false };
    });
  } catch (caught) {
    if (isConstraintError(caught)) {
      const raced = findExistingShortcutApplicationByMutationId(
        db,
        userId,
        input.clientMutationId
      );
      if (raced !== undefined) {
        return replayExistingShortcutApplication(db, raced, shortcutId, input);
      }
    }
    throw caught;
  }
}

export function getMealShortcutApplicationFeedback(
  db: AppDatabase,
  userId: string,
  applicationId: string
) {
  const application = db.select().from(mealShortcutApplications).where(and(
    eq(mealShortcutApplications.id, applicationId),
    eq(mealShortcutApplications.userId, userId)
  )).get();
  if (application === undefined) throw new MealShortcutApplicationNotFoundError();
  const entries = db.select({ id: diaryLogs.id }).from(diaryLogs).where(and(
    eq(diaryLogs.userId, userId),
    eq(diaryLogs.shortcutBatchId, application.id)
  )).all();
  return {
    application,
    entryCount: entries.length,
    undone: application.undoneAt !== null
  };
}

export function undoMealShortcutApplication(
  db: AppDatabase,
  userId: string,
  applicationId: string
) {
  const application = db.select().from(mealShortcutApplications).where(and(
    eq(mealShortcutApplications.id, applicationId),
    eq(mealShortcutApplications.userId, userId)
  )).get();
  if (application === undefined) throw new MealShortcutApplicationNotFoundError();
  if (application.undoneAt === null) {
    const undoneAt = new Date();
    db.transaction((transaction) => {
      transaction.update(diaryLogs).set({ deletedAt: undoneAt, updatedAt: undoneAt }).where(and(
        eq(diaryLogs.userId, userId),
        eq(diaryLogs.shortcutBatchId, application.id),
        isNull(diaryLogs.deletedAt)
      )).run();
      transaction.update(mealShortcutApplications).set({ undoneAt }).where(and(
        eq(mealShortcutApplications.id, application.id),
        eq(mealShortcutApplications.userId, userId),
        isNull(mealShortcutApplications.undoneAt)
      )).run();
    });
  }
  return getMealShortcutApplicationFeedback(db, userId, application.id);
}
