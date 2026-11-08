import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '$lib/server/db/testing';
import {
  diaryLogs, foods, mealShortcutApplications, mealShortcutItems, mealShortcuts, users, type Food
} from '$lib/server/db/schema';
import {
  BatchFinishedError, BatchNotFoundError, BatchPortionCountTooLowError, createBatch, getBatch,
  listBatches, loadBatchDraft, updateBatch
} from './batch';
import {
  applyMealShortcut, archiveMealShortcut, createMealShortcut, listMealShortcuts,
  MealShortcutBlockedError, MealShortcutCreateConflictError, MealShortcutEditConflictError,
  MealShortcutNotFoundError, searchMealShortcutFoods, undoMealShortcutApplication, updateMealShortcut
} from './meal-shortcut';

interface Context {
  connection: DatabaseConnection;
  userId: string;
  mince: Food;
  penne: Food;
}

async function withContext(run: (context: Context) => Promise<void>): Promise<void> {
  const connection = await createDatabase();
  try {
    const userId = await insertUser(connection, 'cook@example.com');
    const mince = await insertFood(connection, userId, {
      name: 'Beef mince', energyMkcalPerBasis: 250000, proteinMgPerBasis: 26000, carbsMgPerBasis: 0, fatMgPerBasis: 15000
    });
    const penne = await insertFood(connection, userId, {
      name: 'Penne', energyMkcalPerBasis: 350000, proteinMgPerBasis: 12000, carbsMgPerBasis: 70000, fatMgPerBasis: 1500
    });
    await run({ connection, userId, mince, penne });
  } finally {
    await connection.client.close();
  }
}

async function insertUser(connection: DatabaseConnection, email: string): Promise<string> {
  return (await connection.db.insert(users).values({ name: email, email }).returning({ id: users.id }).get()).id;
}

async function insertFood(
  connection: DatabaseConnection, userId: string, overrides: Partial<typeof foods.$inferInsert> = {}
): Promise<Food> {
  return await connection.db.insert(foods).values({
    userId,
    name: 'Porridge',
    amountUnit: 'mg',
    basisAmount: 100000,
    servingAmount: 40000,
    energyMkcalPerBasis: 100000,
    proteinMgPerBasis: 10000,
    carbsMgPerBasis: 20000,
    fatMgPerBasis: 5000,
    ...overrides
  }).returning().get();
}

function standardItems({ mince, penne }: Context, minceAmount = '500', penneAmount = '300') {
  return [
    { foodId: mince.id, amount: minceAmount },
    { foodId: penne.id, amount: penneAmount }
  ];
}

function batchInput(
  context: Context,
  overrides: Record<string, unknown> = {}
) {
  return {
    clientMutationId: crypto.randomUUID(),
    name: 'Bolognese',
    portionCount: 2,
    items: standardItems(context),
    schedule: null,
    ...overrides
  };
}

function updateInput(
  context: Context,
  updatedAt: Date,
  overrides: Record<string, unknown> = {}
) {
  return {
    expectedUpdatedAt: String(updatedAt.getTime()),
    name: 'Bolognese',
    portionCount: 2,
    items: standardItems(context),
    schedule: null,
    ...overrides
  };
}

function schedule(startDate: string, mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snacks' = 'lunch') {
  return { startDate, mealSlot };
}

async function applicationsOf(connection: DatabaseConnection, batchId: string) {
  return await connection.db.select().from(mealShortcutApplications)
    .where(eq(mealShortcutApplications.shortcutId, batchId))
    .orderBy(asc(mealShortcutApplications.diaryDate), asc(mealShortcutApplications.createdAt)).all();
}

async function rowsOf(connection: DatabaseConnection, batchId: string, activeOnly = true) {
  return await connection.db.select().from(diaryLogs)
    .where(and(
      eq(diaryLogs.sourceShortcutId, batchId),
      activeOnly ? isNull(diaryLogs.deletedAt) : isNotNull(diaryLogs.deletedAt)
    ))
    .orderBy(asc(diaryLogs.diaryDate), asc(diaryLogs.loggedAt)).all();
}

async function activeRowsOfApplication(connection: DatabaseConnection, applicationId: string) {
  return await connection.db.select().from(diaryLogs)
    .where(and(eq(diaryLogs.shortcutBatchId, applicationId), isNull(diaryLogs.deletedAt)))
    .orderBy(asc(diaryLogs.loggedAt)).all();
}

function applyInput(diaryDate: string, mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snacks' = 'lunch') {
  return { clientMutationId: crypto.randomUUID(), diaryDate, mealSlot };
}

describe('createBatch', () => {
  it('logs every portion on consecutive days when a schedule is given', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const input = batchInput(context, { name: 'Bolognese', schedule: schedule('2026-11-09') });
      const created = await createBatch(connection.db, userId, input);
      expect(created.replayed).toBe(false);
      expect(created.applications).toHaveLength(2);

      const applications = await applicationsOf(connection, created.batch.id);
      expect(applications.map((application) => [application.diaryDate, application.mealSlot, application.shortcutName]))
        .toEqual([['2026-11-09', 'lunch', 'Bolognese'], ['2026-11-10', 'lunch', 'Bolognese']]);

      const rows = await rowsOf(connection, created.batch.id);
      expect(rows).toHaveLength(4);
      expect(rows.map((row) => row.resolvedAmount)).toEqual([250000, 150000, 250000, 150000]);
      expect(rows.map((row) => row.energyMkcal)).toEqual([625000, 525000, 625000, 525000]);
      for (const row of rows) {
        expect(row).toMatchObject({
          portionKind: 'unit',
          portionLabel: '1 g',
          portionAmount: 1000,
          sourceShortcutId: created.batch.id
        });
        expect(row.portionCountMilli).toBe(row.resolvedAmount);
      }
      expect(rows.map((row) => row.shortcutBatchId)).toEqual([
        applications[0]!.id, applications[0]!.id, applications[1]!.id, applications[1]!.id
      ]);

      const stored = await connection.db.select().from(mealShortcuts).where(eq(mealShortcuts.id, created.batch.id)).get();
      expect(stored).toMatchObject({ kind: 'batch', portionCount: 2 });
      const items = await connection.db.select().from(mealShortcutItems)
        .where(eq(mealShortcutItems.shortcutId, created.batch.id)).orderBy(asc(mealShortcutItems.position)).all();
      expect(items.map((item) => item.defaultAmount)).toEqual([500000, 300000]);
    });
  });

  it('replays the same request without creating anything and conflicts on changed details', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const input = batchInput(context, { schedule: schedule('2026-11-09') });
      const first = await createBatch(connection.db, userId, input);
      const replay = await createBatch(connection.db, userId, input);
      expect(replay.replayed).toBe(true);
      expect(replay.batch.id).toBe(first.batch.id);
      expect(replay.applications.map((application) => application.id).sort())
        .toEqual(first.applications.map((application) => application.id).sort());
      expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(2);
      expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(4);
      expect(await connection.db.select().from(mealShortcuts).all()).toHaveLength(1);

      await expect(createBatch(connection.db, userId, { ...input, name: 'Different' }))
        .rejects.toThrow(MealShortcutCreateConflictError);
    });
  });

  it('logs nothing when held', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const created = await createBatch(connection.db, userId, batchInput(context));
      expect(created.applications).toEqual([]);
      expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(0);
      expect(await connection.db.select().from(diaryLogs).all()).toHaveLength(0);

      const detail = await getBatch(connection.db, userId, created.batch.id);
      expect(detail).toMatchObject({
        kind: 'batch',
        portionCount: 2,
        loggedCount: 0,
        remainingCount: 2,
        portions: [],
        blocked: false,
        perPortion: { energyMkcal: 1150000, proteinMg: 83000, carbsMg: 105000, fatMg: 39750 }
      });
    });
  });

  it('blocks an inactive food', async () => {
    await withContext(async (context) => {
      const { connection, userId, penne } = context;
      await connection.db.update(foods).set({ deletedAt: new Date() }).where(eq(foods.id, penne.id)).run();
      await expect(createBatch(connection.db, userId, batchInput(context)))
        .rejects.toThrow(MealShortcutBlockedError);
      expect(await connection.db.select().from(mealShortcuts).all()).toHaveLength(0);
    });
  });
});

describe('applying batch portions', () => {
  it('logs one split portion per apply until the batch is finished', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const { batch } = await createBatch(connection.db, userId, batchInput(context, { portionCount: 3 }));
      const firstInput = applyInput('2026-11-09');
      const first = await applyMealShortcut(connection.db, userId, batch.id, firstInput);
      expect(first.entries).toHaveLength(2);
      const minceEntry = first.entries.find((entry) => entry.foodName === 'Beef mince');
      const penneEntry = first.entries.find((entry) => entry.foodName === 'Penne');
      expect(minceEntry).toMatchObject({ resolvedAmount: 166667, energyMkcal: 416668, portionKind: 'unit', portionLabel: '1 g' });
      expect(penneEntry).toMatchObject({ resolvedAmount: 100000, energyMkcal: 350000 });
      expect(await getBatch(connection.db, userId, batch.id)).toMatchObject({ loggedCount: 1, remainingCount: 2 });

      await applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-10'));
      await applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-11'));
      expect(await getBatch(connection.db, userId, batch.id)).toMatchObject({ loggedCount: 3, remainingCount: 0 });

      await expect(applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-12')))
        .rejects.toThrow(BatchFinishedError);
      const replay = await applyMealShortcut(connection.db, userId, batch.id, firstInput);
      expect(replay.replayed).toBe(true);
      expect(replay.application.id).toBe(first.application.id);
      expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(3);
    });
  });

  it('never exceeds the portion count under concurrent applies', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const { batch } = await createBatch(connection.db, userId, batchInput(context));
      const results = await Promise.allSettled([
        applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-09')),
        applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-10')),
        applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-11'))
      ]);
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BatchFinishedError);
      const applications = await applicationsOf(connection, batch.id);
      expect(applications.filter((application) => application.undoneAt === null)).toHaveLength(2);
    });
  });

  it('frees a portion when an application is undone', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const { batch } = await createBatch(connection.db, userId, batchInput(context));
      const applied = await applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-09'));
      expect(await getBatch(connection.db, userId, batch.id)).toMatchObject({ remainingCount: 1 });
      await undoMealShortcutApplication(connection.db, userId, applied.application.id);
      expect(await getBatch(connection.db, userId, batch.id)).toMatchObject({ loggedCount: 0, remainingCount: 2, portions: [] });
    });
  });

  it('does not count a portion whose diary rows were all deleted, nor recreate it on update', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const created = await createBatch(connection.db, userId, batchInput(context, { schedule: schedule('2026-11-09') }));
      const [first, second] = created.applications.slice().sort((a, b) => a.diaryDate.localeCompare(b.diaryDate));
      await connection.db.update(diaryLogs).set({ deletedAt: new Date() })
        .where(eq(diaryLogs.shortcutBatchId, first!.id)).run();
      const detail = await getBatch(connection.db, userId, created.batch.id);
      expect(detail).toMatchObject({ loggedCount: 1, remainingCount: 1 });
      expect(detail.portions.map((portion) => portion.applicationId)).toEqual([second!.id]);

      await updateBatch(connection.db, userId, created.batch.id, updateInput(context, detail.updatedAt, {
        items: standardItems(context, '600')
      }));
      expect(await activeRowsOfApplication(connection, first!.id)).toEqual([]);
      const resynced = await activeRowsOfApplication(connection, second!.id);
      expect(resynced.map((row) => row.resolvedAmount)).toEqual([300000, 150000]);
    });
  });
});

describe('updateBatch', () => {
  it('recalculates every logged portion in place', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const oil = await insertFood(connection, userId, {
        name: 'Olive oil', energyMkcalPerBasis: 900000, proteinMgPerBasis: 0, carbsMgPerBasis: 0, fatMgPerBasis: 100000
      });
      const created = await createBatch(connection.db, userId, batchInput(context, { schedule: schedule('2026-11-09') }));
      const other = await createBatch(connection.db, userId, batchInput(context, {
        name: 'Other batch', schedule: schedule('2026-11-20', 'dinner')
      }));
      const otherBefore = await rowsOf(connection, other.batch.id);
      const applicationsBefore = await applicationsOf(connection, created.batch.id);

      const detail = await getBatch(connection.db, userId, created.batch.id);
      const result = await updateBatch(connection.db, userId, created.batch.id, updateInput(context, detail.updatedAt, {
        items: [...standardItems(context, '400'), { foodId: oil.id, amount: '10' }]
      }));
      expect(result.scheduled).toEqual([]);

      const softDeleted = await rowsOf(connection, created.batch.id, false);
      expect(softDeleted).toHaveLength(4);
      for (const row of softDeleted) expect(row.deletedAt).not.toBeNull();

      const applicationsAfter = await applicationsOf(connection, created.batch.id);
      expect(applicationsAfter.map((application) => application.id)).toEqual(applicationsBefore.map((application) => application.id));
      for (const application of applicationsAfter) {
        const active = await activeRowsOfApplication(connection, application.id);
        expect(active.map((row) => row.resolvedAmount)).toEqual([200000, 150000, 5000]);
        expect(active.every((row) => row.shortcutBatchId === application.id && row.sourceShortcutId === created.batch.id)).toBe(true);
        expect(active.every((row) => row.diaryDate === application.diaryDate && row.mealSlot === application.mealSlot)).toBe(true);
      }
      expect(await rowsOf(connection, other.batch.id)).toEqual(otherBefore);
      expect(await rowsOf(connection, other.batch.id, false)).toEqual([]);
    });
  });

  it('schedules the remaining portions', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const { batch } = await createBatch(connection.db, userId, batchInput(context, { portionCount: 3 }));
      await applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-09'));
      const detail = await getBatch(connection.db, userId, batch.id);
      const result = await updateBatch(connection.db, userId, batch.id, updateInput(context, detail.updatedAt, {
        portionCount: 3,
        schedule: schedule('2026-11-12', 'dinner')
      }));
      expect(result.scheduled.map((application) => [application.diaryDate, application.mealSlot]))
        .toEqual([['2026-11-12', 'dinner'], ['2026-11-13', 'dinner']]);
      expect(await getBatch(connection.db, userId, batch.id)).toMatchObject({ loggedCount: 3, remainingCount: 0 });
    });
  });

  it('refuses to lower the count below the logged portions and recalculates when raising it', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const created = await createBatch(connection.db, userId, batchInput(context, { schedule: schedule('2026-11-09') }));
      const detail = await getBatch(connection.db, userId, created.batch.id);

      const attempt = updateBatch(connection.db, userId, created.batch.id, updateInput(context, detail.updatedAt, { portionCount: 1 }));
      await expect(attempt).rejects.toThrow(BatchPortionCountTooLowError);
      await expect(attempt).rejects.toThrow('2 portions are already logged. Remove one from the diary before lowering the count.');
      const unchanged = await getBatch(connection.db, userId, created.batch.id);
      expect(unchanged.portionCount).toBe(2);
      expect(unchanged.updatedAt).toEqual(detail.updatedAt);
      expect((await rowsOf(connection, created.batch.id)).map((row) => row.resolvedAmount)).toEqual([250000, 150000, 250000, 150000]);
      expect(await rowsOf(connection, created.batch.id, false)).toEqual([]);

      await updateBatch(connection.db, userId, created.batch.id, updateInput(context, detail.updatedAt, { portionCount: 3 }));
      expect((await rowsOf(connection, created.batch.id)).map((row) => row.resolvedAmount))
        .toEqual([166667, 100000, 166667, 100000]);
      expect(await getBatch(connection.db, userId, created.batch.id)).toMatchObject({ portionCount: 3, loggedCount: 2, remainingCount: 1 });
    });
  });

  it('rejects a stale version', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const { batch } = await createBatch(connection.db, userId, batchInput(context));
      const original = await getBatch(connection.db, userId, batch.id);
      await updateBatch(connection.db, userId, batch.id, updateInput(context, original.updatedAt, { name: 'First edit' }));
      await expect(updateBatch(connection.db, userId, batch.id, updateInput(context, original.updatedAt, { name: 'Stale edit' })))
        .rejects.toThrow(MealShortcutEditConflictError);
      expect((await getBatch(connection.db, userId, batch.id)).name).toBe('First edit');
    });
  });
});

describe('listing batches', () => {
  it('finishes a batch as soon as every portion is logged, even for future days', async () => {
    await withContext(async (context) => {
      const { connection, userId, mince } = context;
      const upcoming = await createBatch(connection.db, userId, batchInput(context, { name: 'Upcoming', schedule: schedule('2026-11-09') }));
      const past = await createBatch(connection.db, userId, batchInput(context, { name: 'Past', schedule: schedule('2026-11-01') }));
      const held = await createBatch(connection.db, userId, batchInput(context, { name: 'Held' }));
      const partly = await createBatch(connection.db, userId, batchInput(context, { name: 'Partly eaten' }));
      await applyMealShortcut(connection.db, userId, partly.batch.id, applyInput('2026-11-08'));
      const archived = await createBatch(connection.db, userId, batchInput(context, { name: 'Archived', schedule: schedule('2026-11-03') }));
      await archiveMealShortcut(connection.db, userId, archived.batch.id, String(archived.batch.updatedAt.getTime()));
      await createMealShortcut(connection.db, userId, {
        clientMutationId: crypto.randomUUID(), name: 'Plain shortcut', items: [{ foodId: mince.id, amount: '10' }]
      });
      // Past was edited most recently, but Cooked before is ordered by the last portion's day.
      await connection.db.update(mealShortcuts).set({ updatedAt: new Date(Date.now() + 60_000) })
        .where(eq(mealShortcuts.id, past.batch.id));

      const { active, recent } = await listBatches(connection.db, userId);
      expect(active.map((batch) => batch.name).sort()).toEqual(['Held', 'Partly eaten']);
      expect(recent.map((batch) => batch.name)).toEqual(['Upcoming', 'Past']);
      expect(active.find((batch) => batch.id === held.batch.id)).toEqual({
        id: held.batch.id,
        name: 'Held',
        portionCount: 2,
        loggedCount: 0,
        remainingCount: 2,
        itemCount: 2,
        blocked: false,
        perPortionEnergyMkcal: 1150000,
        lastPortionDate: null
      });
      expect(active.find((batch) => batch.id === partly.batch.id))
        .toMatchObject({ loggedCount: 1, remainingCount: 1, lastPortionDate: '2026-11-08' });
      expect(recent[0]).toMatchObject({ id: upcoming.batch.id, loggedCount: 2, remainingCount: 0, lastPortionDate: '2026-11-10' });
      expect(recent[1]).toMatchObject({ id: past.batch.id, lastPortionDate: '2026-11-02' });
    });
  });

  it('shows only the five most recently eaten finished batches', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      for (const day of ['01', '03', '05', '07', '09', '11']) {
        await createBatch(connection.db, userId, batchInput(context, { name: `Cook ${day}`, schedule: schedule(`2026-11-${day}`) }));
      }

      const { active, recent } = await listBatches(connection.db, userId);
      expect(active).toEqual([]);
      expect(recent.map((batch) => batch.name)).toEqual(['Cook 11', 'Cook 09', 'Cook 07', 'Cook 05', 'Cook 03']);
    });
  });

  it('returns a finished batch to the active list when one of its portions is undone', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const { batch } = await createBatch(connection.db, userId, batchInput(context));
      await applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-08', 'breakfast'));
      const lunch = await applyMealShortcut(connection.db, userId, batch.id, applyInput('2026-11-08'));
      expect((await listBatches(connection.db, userId)).recent.map((item) => item.id)).toEqual([batch.id]);

      await undoMealShortcutApplication(connection.db, userId, lunch.application.id);

      const { active, recent } = await listBatches(connection.db, userId);
      expect(active).toMatchObject([{ id: batch.id, loggedCount: 1, remainingCount: 1 }]);
      expect(recent).toEqual([]);
    });
  });

  it('keeps batches out of shortcut flows and keeps diary rows when archived', async () => {
    await withContext(async (context) => {
      const { connection, userId, mince } = context;
      const plain = await createMealShortcut(connection.db, userId, {
        clientMutationId: crypto.randomUUID(), name: 'Plain shortcut', items: [{ foodId: mince.id, amount: '10' }]
      });
      const { batch } = await createBatch(connection.db, userId, batchInput(context, { schedule: schedule('2026-11-09') }));

      expect((await listMealShortcuts(connection.db, userId, '')).map((shortcut) => shortcut.id)).toEqual([plain.id]);
      const detail = await getBatch(connection.db, userId, batch.id);
      await expect(updateMealShortcut(connection.db, userId, batch.id, {
        expectedUpdatedAt: String(detail.updatedAt.getTime()), name: 'Nope', items: [{ foodId: mince.id, amount: '10' }]
      })).rejects.toThrow(MealShortcutNotFoundError);

      await archiveMealShortcut(connection.db, userId, batch.id, String(detail.updatedAt.getTime()));
      expect(await rowsOf(connection, batch.id)).toHaveLength(4);
      await expect(getBatch(connection.db, userId, batch.id)).rejects.toThrow(BatchNotFoundError);
      await expect(getBatch(connection.db, userId, plain.id)).rejects.toThrow(BatchNotFoundError);
    });
  });
});

describe('loadBatchDraft', () => {
  it('starts empty without a source', async () => {
    await withContext(async ({ connection, userId }) => {
      const draft = await loadBatchDraft(connection.db, userId);
      expect(draft).toMatchObject({ name: '', portionCount: 2, items: [] });
      expect(draft.clientMutationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  it('copies a previous batch and skips archived foods', async () => {
    await withContext(async (context) => {
      const { connection, userId, mince, penne } = context;
      const mutationId = crypto.randomUUID();
      const { batch } = await createBatch(connection.db, userId, batchInput(context, {
        clientMutationId: mutationId, name: 'Chilli', portionCount: 4
      }));
      const draft = await loadBatchDraft(connection.db, userId, batch.id);
      expect(draft).toMatchObject({ name: 'Chilli', portionCount: 4 });
      expect(draft.clientMutationId).not.toBe(mutationId);
      expect(draft.items).toEqual([
        { foodId: mince.id, foodName: 'Beef mince', foodBrand: null, amountUnit: 'mg', defaultAmount: 500000 },
        { foodId: penne.id, foodName: 'Penne', foodBrand: null, amountUnit: 'mg', defaultAmount: 300000 }
      ]);

      await connection.db.update(foods).set({ deletedAt: new Date() }).where(eq(foods.id, penne.id)).run();
      const trimmed = await loadBatchDraft(connection.db, userId, batch.id);
      expect(trimmed.items.map((item) => item.foodId)).toEqual([mince.id]);
    });
  });
});

describe('batch editor foods', () => {
  it('returns the nutrition the per-portion preview needs', async () => {
    await withContext(async ({ connection, userId, mince }) => {
      const foodsForPicker = await searchMealShortcutFoods(connection.db, userId, '');
      expect(foodsForPicker.find((food) => food.id === mince.id)).toMatchObject({
        basisAmount: 100000,
        energyMkcalPerBasis: 250000,
        proteinMgPerBasis: 26000,
        carbsMgPerBasis: 0,
        fatMgPerBasis: 15000
      });
    });
  });
});

describe('batch storage constraints', () => {
  it('rejects rows that mix up shortcut and batch fields', async () => {
    await withContext(async ({ connection, userId }) => {
      const insert = (values: { kind?: 'shortcut' | 'batch'; portionCount?: number | null }) =>
        connection.db.insert(mealShortcuts).values({ userId, name: 'Row', ...values }).run();

      await expect(insert({ kind: 'batch', portionCount: null })).rejects.toThrow();
      await expect(insert({ kind: 'batch', portionCount: 0 })).rejects.toThrow();
      await expect(insert({ kind: 'batch', portionCount: 11 })).rejects.toThrow();
      await expect(insert({ kind: 'shortcut', portionCount: 2 })).rejects.toThrow();
      await expect(connection.db.insert(mealShortcuts)
        .values({ userId, name: 'Row', kind: 'other' as 'batch', portionCount: 2 }).run()).rejects.toThrow();

      await insert({ kind: 'batch', portionCount: 10 });
      await insert({});
      expect((await connection.db.select().from(mealShortcuts).all()).map((row) => [row.kind, row.portionCount]))
        .toEqual([['batch', 10], ['shortcut', null]]);
    });
  });
});

describe('batch ownership', () => {
  it('hides batches from other users', async () => {
    await withContext(async (context) => {
      const { connection, userId } = context;
      const otherId = await insertUser(connection, 'other@example.com');
      const { batch } = await createBatch(connection.db, userId, batchInput(context));
      const detail = await getBatch(connection.db, userId, batch.id);

      await expect(getBatch(connection.db, otherId, batch.id)).rejects.toThrow(BatchNotFoundError);
      await expect(updateBatch(connection.db, otherId, batch.id, updateInput(context, detail.updatedAt)))
        .rejects.toThrow(BatchNotFoundError);
      await expect(loadBatchDraft(connection.db, otherId, batch.id)).rejects.toThrow(BatchNotFoundError);
      await expect(applyMealShortcut(connection.db, otherId, batch.id, applyInput('2026-11-09')))
        .rejects.toThrow(MealShortcutNotFoundError);
      expect(await connection.db.select().from(mealShortcutApplications).all()).toHaveLength(0);
    });
  });
});

