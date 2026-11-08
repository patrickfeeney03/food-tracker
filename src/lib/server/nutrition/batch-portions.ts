import type { MealSlot } from '$lib/nutrition/constants';
import { portionAmount } from '$lib/nutrition/batch';
import type { ReadDatabase } from '$lib/server/db/connection';
import {
  foods,
  mealShortcutApplications,
  type Food,
  type MealShortcutApplication,
  type NewDiaryLog
} from '$lib/server/db/schema';
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { buildDiaryLogValuesForExactAmount } from './diary-entry';

export class BatchFinishedError extends Error {
  constructor() {
    super('Every portion of this batch is already logged.');
    this.name = 'BatchFinishedError';
  }
}

/**
 * A logged portion is an application that is not undone and still has at least
 * one active diary row. Counting, the apply guard and resync all use this.
 */
const isLoggedPortion = sql`${mealShortcutApplications.undoneAt} is null and exists (select 1 from diary_logs where diary_logs.user_id = meal_shortcut_applications.user_id and diary_logs.shortcut_batch_id = meal_shortcut_applications.id and diary_logs.deleted_at is null)`;

export function loggedPortionCondition(userId: string, batchId: string): SQL {
  return and(
    eq(mealShortcutApplications.userId, userId),
    eq(mealShortcutApplications.shortcutId, batchId),
    isLoggedPortion
  )!;
}

/** Logged portions ordered by diary date, then creation time. */
export async function listLoggedPortions(
  db: ReadDatabase,
  userId: string,
  batchId: string
): Promise<MealShortcutApplication[]> {
  return db.select().from(mealShortcutApplications)
    .where(loggedPortionCondition(userId, batchId))
    .orderBy(asc(mealShortcutApplications.diaryDate), asc(mealShortcutApplications.createdAt),
      asc(mealShortcutApplications.id)).all();
}

/** SQL scalar subquery for use inside atomic guards. */
export function loggedPortionCountSql(userId: string, batchId: string): SQL {
  return sql`(select count(*) from meal_shortcut_applications where user_id = ${userId} and shortcut_id = ${batchId} and ${isLoggedPortion})`;
}

/**
 * Correlated subqueries over the logged portions of the outer `meal_shortcuts` row,
 * so a list query can classify every batch without loading each one.
 */
export function loggedPortionStatsSql(userId: string, batchIdColumn: AnySQLiteColumn) {
  const from = sql`from meal_shortcut_applications where meal_shortcut_applications.user_id = ${userId} and meal_shortcut_applications.shortcut_id = ${batchIdColumn} and ${isLoggedPortion}`;
  return {
    loggedCount: sql<number>`(select count(*) ${from})`,
    lastPortionDate: sql<string | null>`(select max(meal_shortcut_applications.diary_date) ${from})`
  };
}

export async function loadActiveFoodsById(
  db: ReadDatabase,
  userId: string,
  foodIds: readonly string[]
): Promise<Map<string, Food>> {
  if (foodIds.length === 0) return new Map();
  const rows = await db.select().from(foods).where(and(
    eq(foods.userId, userId),
    isNull(foods.deletedAt),
    inArray(foods.id, sql`(select value from json_each(${JSON.stringify(foodIds)}))`)
  )).all();
  return new Map(rows.map((food) => [food.id, food]));
}

/** Guard that a food is still active, in the same unit, and unchanged since it was read. */
export function foodSnapshotGuard(userId: string, food: Food): SQL {
  return sql`exists (select 1 from foods where id = ${food.id} and user_id = ${userId} and updated_at = ${food.updatedAt.getTime()} and amount_unit = ${food.amountUnit} and deleted_at is null)`;
}

export interface BatchPortionItem {
  foodId: string;
  amountUnit: 'mg' | 'ul';
  defaultAmount: number;
}

/**
 * Diary rows for ONE portion: every item's total split by the portion count, using
 * the canonical unit portion and current food nutrition. Callers validate foods first.
 */
export function buildBatchPortionRows(
  items: readonly BatchPortionItem[],
  foodsById: ReadonlyMap<string, Food>,
  portionCount: number,
  target: {
    batchId: string;
    applicationId: string;
    diaryDate: string;
    mealSlot: MealSlot;
    createdAt: Date;
  }
): Array<NewDiaryLog & { id: string }> {
  return items.map((item, index) => {
    const food = foodsById.get(item.foodId);
    if (food === undefined || food.amountUnit !== item.amountUnit) {
      throw new RangeError('Batch food is unavailable');
    }
    const amount = Number(portionAmount(BigInt(item.defaultAmount), BigInt(portionCount)));
    return {
      ...buildDiaryLogValuesForExactAmount(food, {
        diaryDate: target.diaryDate,
        mealSlot: target.mealSlot,
        resolvedAmount: amount,
        portionKind: 'unit',
        portionLabel: `1 ${item.amountUnit === 'mg' ? 'g' : 'ml'}`,
        portionAmount: 1_000,
        portionCountMilli: amount,
        sourceShortcutId: target.batchId,
        shortcutBatchId: target.applicationId,
        loggedAt: new Date(target.createdAt.getTime() + index)
      }),
      id: crypto.randomUUID()
    };
  });
}
