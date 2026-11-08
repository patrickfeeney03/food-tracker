import { batchPortionTotals, portionAmount, scheduleDates } from '$lib/nutrition/batch';
import {
  createBatchInputSchema,
  updateBatchInputSchema,
} from '$lib/nutrition/batch-input';
import type { MealSlot } from '$lib/nutrition/constants';
import { toSafeInteger } from '$lib/nutrition/math';
import { atomicBatch, isAtomicGuardError } from '$lib/server/db/atomic';
import type { AppDatabase, ReadDatabase } from '$lib/server/db/connection';
import {
  diaryLogs,
  mealShortcutApplications,
  mealShortcutItems,
  mealShortcuts,
  type MealShortcut,
  type MealShortcutApplication
} from '$lib/server/db/schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  BatchFinishedError,
  buildBatchPortionRows,
  foodSnapshotGuard,
  listLoggedPortions,
  loadActiveFoodsById,
  loggedPortionCountSql,
  loggedPortionStatsSql
} from './batch-portions';
import {
  canonicalPortion,
  findCreationReplay,
  getMealShortcut,
  isMatchingShortcutCreationReplay,
  MealShortcutBlockedError,
  MealShortcutCreateConflictError,
  MealShortcutEditConflictError,
  MealShortcutNotFoundError,
  normalizeItems,
  type MealShortcutDetail,
  type NormalizedItem
} from './meal-shortcut';

export {
  BatchFinishedError,
  MealShortcutBlockedError,
  MealShortcutCreateConflictError,
  MealShortcutEditConflictError
};

export class BatchNotFoundError extends Error {
  constructor() {
    super('Batch not found');
    this.name = 'BatchNotFoundError';
  }
}

export class BatchPortionCountTooLowError extends Error {
  constructor(loggedCount: number) {
    super(
      `${loggedCount} ${loggedCount === 1 ? 'portion is' : 'portions are'} already logged. Remove one from the diary before lowering the count.`
    );
    this.name = 'BatchPortionCountTooLowError';
  }
}

export interface BatchPortion {
  applicationId: string;
  diaryDate: string;
  mealSlot: MealSlot;
}

export interface BatchPerPortion {
  energyMkcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
}

export interface BatchDetail extends MealShortcutDetail {
  kind: 'batch';
  portionCount: number;
  portions: BatchPortion[];
  loggedCount: number;
  remainingCount: number;
  blocked: boolean;
  perPortion: BatchPerPortion | null;
}

export interface BatchSummary {
  id: string;
  name: string;
  portionCount: number;
  loggedCount: number;
  remainingCount: number;
  itemCount: number;
  blocked: boolean;
  perPortionEnergyMkcal: number | null;
  /** Diary day of the latest logged portion, or null when none are logged. */
  lastPortionDate: string | null;
}

/** Batch items store the TOTAL amount with the canonical unit portion. */
function canonicalItem({ snapshotGuard, ...item }: NormalizedItem) {
  return { item: { ...item, ...canonicalPortion(item.amountUnit, item.defaultAmount) }, snapshotGuard };
}

async function normalizeBatchItems(
  db: ReadDatabase,
  userId: string,
  inputs: Parameters<typeof normalizeItems>[2],
  batchId: string | null,
  portionCount: number
) {
  const normalized = (await normalizeItems(db, userId, inputs, batchId)).map(canonicalItem);
  // Throws RangeError when an ingredient is too small to split.
  for (const { item } of normalized) portionAmount(BigInt(item.defaultAmount), BigInt(portionCount));
  const foodsById = await loadActiveFoodsById(db, userId, normalized.map(({ item }) => item.foodId));
  const guards = normalized.flatMap(({ snapshotGuard }) => snapshotGuard ? [snapshotGuard] : []);
  for (const { item } of normalized) {
    const food = foodsById.get(item.foodId);
    if (food === undefined || food.amountUnit !== item.amountUnit) throw new MealShortcutBlockedError();
    guards.push(foodSnapshotGuard(userId, food));
  }
  return { items: normalized.map(({ item }) => item), foodsById, guards };
}

/** Applications (and their per-portion rows) for consecutive days. */
function buildScheduledPortions(
  userId: string,
  batch: { id: string; name: string },
  items: readonly NormalizedItem[],
  foodsById: Parameters<typeof buildBatchPortionRows>[1],
  portionCount: number,
  dates: readonly string[],
  mealSlot: MealSlot
) {
  const createdAt = new Date();
  return dates.map((diaryDate) => {
    const application: MealShortcutApplication = {
      id: crypto.randomUUID(),
      userId,
      shortcutId: batch.id,
      shortcutName: batch.name,
      clientMutationId: crypto.randomUUID(),
      diaryDate,
      mealSlot,
      createdAt,
      undoneAt: null
    };
    return {
      application,
      rows: buildBatchPortionRows(items, foodsById, portionCount, {
        batchId: batch.id, applicationId: application.id, diaryDate, mealSlot, createdAt
      })
    };
  });
}

export async function createBatch(db: AppDatabase, userId: string, rawInput: unknown) {
  const input = createBatchInputSchema.parse(rawInput);
  const replayOf = async (existing: MealShortcut) => {
    if (
      existing.kind !== 'batch' || existing.portionCount !== input.portionCount ||
      !(await isMatchingShortcutCreationReplay(db, existing, input))
    ) throw new MealShortcutCreateConflictError();
    return { batch: existing, applications: await listLoggedPortions(db, userId, existing.id), replayed: true };
  };
  const replay = await findCreationReplay(db, userId, input.clientMutationId);
  if (replay) return replayOf(replay);

  const { items, foodsById, guards: itemGuards } = await normalizeBatchItems(db, userId, input.items, null, input.portionCount);
  const batchId = crypto.randomUUID();
  const createdAt = new Date();
  const scheduled = buildScheduledPortions(
    userId, { id: batchId, name: input.name }, items, foodsById, input.portionCount,
    input.schedule === null ? [] : scheduleDates(input.schedule.startDate, input.portionCount),
    input.schedule?.mealSlot ?? 'lunch'
  );
  const guards = [
    sql`not exists (select 1 from meal_shortcuts where user_id = ${userId} and client_mutation_id = ${input.clientMutationId})`,
    ...itemGuards
  ];
  try {
    const [created] = await atomicBatch(db, guards, [
      db.insert(mealShortcuts).values({
        id: batchId, userId, name: input.name, kind: 'batch', portionCount: input.portionCount,
        clientMutationId: input.clientMutationId, createdAt, updatedAt: createdAt, deletedAt: null
      }).returning(),
      ...items.map((item, position) =>
        db.insert(mealShortcutItems).values({ ...item, id: crypto.randomUUID(), shortcutId: batchId, position })),
      ...scheduled.flatMap(({ application, rows }) => [
        db.insert(mealShortcutApplications).values(application),
        ...rows.map((row) => db.insert(diaryLogs).values(row))
      ])
    ]);
    return { batch: created[0]!, applications: scheduled.map(({ application }) => application), replayed: false };
  } catch (error) {
    const raced = await findCreationReplay(db, userId, input.clientMutationId);
    if (raced) return replayOf(raced);
    if (isAtomicGuardError(error)) throw new MealShortcutBlockedError();
    throw error;
  }
}

export async function getBatch(db: ReadDatabase, userId: string, batchId: string): Promise<BatchDetail> {
  let detail: MealShortcutDetail;
  try {
    detail = await getMealShortcut(db, userId, batchId);
  } catch (error) {
    throw error instanceof MealShortcutNotFoundError ? new BatchNotFoundError() : error;
  }
  if (detail.kind !== 'batch' || detail.portionCount === null) throw new BatchNotFoundError();

  const logged = await listLoggedPortions(db, userId, batchId);
  const blocked = detail.items.length === 0 || detail.items.some((item) => item.blockedReason !== null);
  let perPortion: BatchPerPortion | null = null;
  if (!blocked) {
    const foodsById = await loadActiveFoodsById(db, userId, detail.items.map((item) => item.foodId));
    const totals = batchPortionTotals(
      detail.items.map((item) => ({ totalAmount: BigInt(item.defaultAmount), food: foodsById.get(item.foodId)! })),
      detail.portionCount
    );
    perPortion = {
      energyMkcal: toSafeInteger(totals.energyMkcal),
      proteinMg: toSafeInteger(totals.proteinMg),
      carbsMg: toSafeInteger(totals.carbsMg),
      fatMg: toSafeInteger(totals.fatMg)
    };
  }
  return {
    ...detail,
    kind: 'batch',
    portionCount: detail.portionCount,
    portions: logged.map((application) => ({
      applicationId: application.id, diaryDate: application.diaryDate, mealSlot: application.mealSlot
    })),
    loggedCount: logged.length,
    remainingCount: Math.max(0, detail.portionCount - logged.length),
    blocked,
    perPortion
  };
}

export async function listBatches(
  db: ReadDatabase,
  userId: string
): Promise<{ active: BatchSummary[]; recent: BatchSummary[] }> {
  // Batches accumulate with every cook, so classify them all in one query and load
  // details only for the active ones and the few most recent finished ones.
  const rows = await db.select({
    id: mealShortcuts.id,
    portionCount: mealShortcuts.portionCount,
    ...loggedPortionStatsSql(userId, mealShortcuts.id)
  }).from(mealShortcuts).where(and(
    eq(mealShortcuts.userId, userId),
    eq(mealShortcuts.kind, 'batch'),
    isNull(mealShortcuts.deletedAt)
  )).orderBy(desc(mealShortcuts.updatedAt), asc(mealShortcuts.id)).all();
  // A batch is finished once every portion is logged, even when those days are still ahead.
  const isActive = (row: (typeof rows)[number]) => row.loggedCount < (row.portionCount ?? 0);
  const finished = rows.filter((row) => !isActive(row))
    .sort((a, b) => (b.lastPortionDate ?? '').localeCompare(a.lastPortionDate ?? ''));
  const summarize = async ({ id, lastPortionDate }: (typeof rows)[number]): Promise<BatchSummary> => {
    const batch = await getBatch(db, userId, id);
    return {
      id: batch.id,
      name: batch.name,
      portionCount: batch.portionCount,
      loggedCount: batch.loggedCount,
      remainingCount: batch.remainingCount,
      itemCount: batch.items.length,
      blocked: batch.blocked,
      perPortionEnergyMkcal: batch.perPortion?.energyMkcal ?? null,
      lastPortionDate
    };
  };
  return {
    active: await Promise.all(rows.filter(isActive).map(summarize)),
    recent: await Promise.all(finished.slice(0, 5).map(summarize))
  };
}

export async function updateBatch(db: AppDatabase, userId: string, batchId: string, rawInput: unknown) {
  const input = updateBatchInputSchema.parse(rawInput);
  const expectedUpdatedAt = Number(input.expectedUpdatedAt);
  if (!Number.isSafeInteger(expectedUpdatedAt)) throw new MealShortcutEditConflictError();
  const updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt + 1));
  const current = await db.select().from(mealShortcuts).where(and(
    eq(mealShortcuts.id, batchId),
    eq(mealShortcuts.userId, userId),
    eq(mealShortcuts.kind, 'batch'),
    isNull(mealShortcuts.deletedAt)
  )).get();
  if (!current) throw new BatchNotFoundError();
  if (current.updatedAt.getTime() !== expectedUpdatedAt) throw new MealShortcutEditConflictError();

  const logged = await listLoggedPortions(db, userId, batchId);
  if (input.portionCount < logged.length) throw new BatchPortionCountTooLowError(logged.length);
  const { items, foodsById, guards: itemGuards } =
    await normalizeBatchItems(db, userId, input.items, batchId, input.portionCount);

  const resynced = logged.map((application) => buildBatchPortionRows(items, foodsById, input.portionCount, {
    batchId, applicationId: application.id, diaryDate: application.diaryDate,
    mealSlot: application.mealSlot, createdAt: application.createdAt
  }));
  const remaining = input.portionCount - logged.length;
  const scheduled = input.schedule === null || remaining <= 0 ? [] : buildScheduledPortions(
    userId, { id: batchId, name: input.name }, items, foodsById, input.portionCount,
    scheduleDates(input.schedule.startDate, remaining), input.schedule.mealSlot
  );
  const guards = [
    sql`exists (select 1 from meal_shortcuts where id = ${batchId} and user_id = ${userId} and updated_at = ${expectedUpdatedAt} and kind = 'batch' and deleted_at is null)`,
    sql`${loggedPortionCountSql(userId, batchId)} = ${logged.length}`,
    ...itemGuards
  ];
  try {
    const [updatedRows] = await atomicBatch(db, guards, [
      db.update(mealShortcuts).set({ name: input.name, portionCount: input.portionCount, updatedAt })
        .where(and(
          eq(mealShortcuts.id, batchId), eq(mealShortcuts.userId, userId),
          eq(mealShortcuts.updatedAt, current.updatedAt), isNull(mealShortcuts.deletedAt)
        )).returning(),
      db.delete(mealShortcutItems).where(and(
        eq(mealShortcutItems.shortcutId, batchId), eq(mealShortcutItems.userId, userId)
      )),
      ...items.map((item, position) =>
        db.insert(mealShortcutItems).values({ ...item, id: crypto.randomUUID(), shortcutId: batchId, position })),
      // Soft-delete, never hard-delete, the superseded rows of every logged portion.
      db.update(diaryLogs).set({ deletedAt: updatedAt, updatedAt }).where(and(
        eq(diaryLogs.userId, userId),
        inArray(diaryLogs.shortcutBatchId, logged.length === 0 ? [''] : logged.map((application) => application.id)),
        isNull(diaryLogs.deletedAt)
      )),
      ...resynced.flat().map((row) => db.insert(diaryLogs).values(row)),
      ...scheduled.flatMap(({ application, rows }) => [
        db.insert(mealShortcutApplications).values(application),
        ...rows.map((row) => db.insert(diaryLogs).values(row))
      ])
    ]);
    if (!updatedRows[0]) throw new MealShortcutEditConflictError();
    return { batch: updatedRows[0], scheduled: scheduled.map(({ application }) => application) };
  } catch (error) {
    if (isAtomicGuardError(error)) {
      const exists = await db.select({ id: mealShortcuts.id }).from(mealShortcuts).where(and(
        eq(mealShortcuts.id, batchId), eq(mealShortcuts.userId, userId),
        eq(mealShortcuts.kind, 'batch'), isNull(mealShortcuts.deletedAt)
      )).get();
      if (!exists) throw new BatchNotFoundError();
      throw new MealShortcutEditConflictError();
    }
    throw error;
  }
}

/** Starting point for the new-batch form, optionally copied from a previous batch ("Cook again"). */
export async function loadBatchDraft(db: ReadDatabase, userId: string, fromBatchId?: string) {
  const clientMutationId = crypto.randomUUID();
  if (fromBatchId === undefined) return { clientMutationId, name: '', portionCount: 2, items: [] };

  const source = await db.select().from(mealShortcuts).where(and(
    eq(mealShortcuts.id, fromBatchId), eq(mealShortcuts.userId, userId), eq(mealShortcuts.kind, 'batch')
  )).get();
  if (source === undefined) throw new BatchNotFoundError();

  const sourceItems = await db.select().from(mealShortcutItems).where(and(
    eq(mealShortcutItems.shortcutId, source.id), eq(mealShortcutItems.userId, userId)
  )).orderBy(asc(mealShortcutItems.position)).all();
  const foodsById = await loadActiveFoodsById(db, userId, sourceItems.map((item) => item.foodId));
  return {
    clientMutationId,
    name: source.name,
    portionCount: source.portionCount ?? 2,
    items: sourceItems.flatMap((item) => {
      const food = foodsById.get(item.foodId);
      return food === undefined || food.amountUnit !== item.amountUnit ? [] : [{
        foodId: food.id,
        foodName: food.name,
        foodBrand: food.brand,
        amountUnit: food.amountUnit,
        defaultAmount: item.defaultAmount
      }];
    })
  };
}
