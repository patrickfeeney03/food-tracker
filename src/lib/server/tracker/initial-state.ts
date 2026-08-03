import { todayInDublin } from '$lib/date';
import { inputLimits } from '$lib/nutrition/input-limits';
import {
  contextSchema,
  destinationSchema
} from '$lib/nutrition/navigation-context';
import { calendarDateString } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import { nutritionGoals } from '$lib/server/db/schema';
import {
  getActiveDiaryEntry,
  getDeletedDiaryEntry
} from '$lib/server/nutrition/diary-entry-query';
import { buildTrackerSnapshot } from '$lib/server/tracker/snapshot';
import type { DiaryEntryFeedback } from '$lib/tracker/types';
import type { TrackerSnapshot } from '$lib/offline/types';
import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const entryIdSchema = z.uuid();
const searchSchema = z.string().trim().max(inputLimits.catalogueQuery.maxLength);
const barcodeSchema = z.string().trim().min(1).max(inputLimits.food.barcode.maxLength);
const tabSchema = z.enum(['foods', 'shortcuts']);
const foodLogPathPattern = /^\/foods\/([^/]+)\/log\/?$/;

export interface InitialTrackerState {
  snapshot: TrackerSnapshot | null;
  entryFeedback: DiaryEntryFeedback | null;
}

export function loadDiaryEntryFeedback(
  userId: string,
  url: URL,
  date: string
): DiaryEntryFeedback | null {
  const deletedEntryId = entryIdSchema.safeParse(
    url.searchParams.get('entryDeleted')
  );
  if (deletedEntryId.success) {
    const entry = getDeletedDiaryEntry(db, userId, deletedEntryId.data);
    if (entry !== undefined && entry.diaryDate === date && entry.deletedAt !== null) {
      return {
        kind: 'deleted',
        entryId: entry.id,
        foodName: entry.foodName,
        deletedAt: entry.deletedAt.getTime()
      };
    }
  }

  const restoredEntryId = entryIdSchema.safeParse(
    url.searchParams.get('entryRestored')
  );
  if (restoredEntryId.success) {
    const entry = getActiveDiaryEntry(db, userId, restoredEntryId.data);
    if (entry !== undefined && entry.diaryDate === date) {
      return {
        kind: 'restored',
        foodName: entry.foodName
      };
    }
  }

  return null;
}

function requireDiaryGoal(userId: string): void {
  const hasGoal = db
    .select({ id: nutritionGoals.id })
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, userId))
    .get() !== undefined;

  if (!hasGoal) {
    redirect(303, '/goals/setup');
  }
}

export function loadInitialTrackerState(
  locals: App.Locals,
  url: URL
): InitialTrackerState {
  const logMatch = foodLogPathPattern.exec(url.pathname);
  const isDiary = url.pathname === '/';
  const isFoods = url.pathname === '/foods';

  if (!isDiary && !isFoods && logMatch === null) {
    return { snapshot: null, entryFeedback: null };
  }

  const user = requireUser(locals);
  let date: string;

  if (isDiary) {
    requireDiaryGoal(user.id);
    const result = calendarDateString.safeParse(
      url.searchParams.get('date') ?? todayInDublin()
    );
    if (!result.success) {
      error(400, 'Invalid diary date');
    }
    date = result.data;
  } else if (isFoods) {
    const destination = destinationSchema.safeParse({
      date: url.searchParams.get('date'),
      mealSlot: url.searchParams.get('mealSlot')
    });
    if (!destination.success) {
      error(400, 'Invalid diary destination');
    }
    if (!searchSchema.safeParse(url.searchParams.get('q') ?? '').success) {
      error(400, 'Invalid catalogue search');
    }
    if (!tabSchema.safeParse(url.searchParams.get('tab') ?? 'foods').success) {
      error(400, 'Invalid catalogue tab');
    }
    const barcode = url.searchParams.get('barcode');
    if (barcode !== null && !barcodeSchema.safeParse(barcode).success) {
      error(400, 'Invalid barcode');
    }
    date = destination.data.date;
  } else {
    const context = contextSchema.safeParse({
      date: url.searchParams.get('date'),
      mealSlot: url.searchParams.get('mealSlot'),
      q: url.searchParams.get('q') ?? ''
    });
    if (!context.success) {
      error(400, 'Invalid diary destination');
    }
    date = context.data.date;
  }

  const snapshot = buildTrackerSnapshot(db, user, date);

  if (logMatch !== null) {
    const foodId = decodeURIComponent(logMatch[1]);
    if (!snapshot.foods.some((food) => food.id === foodId)) {
      error(404, 'Food not found');
    }
  }

  return {
    snapshot,
    entryFeedback: isDiary
      ? loadDiaryEntryFeedback(user.id, url, date)
      : null
  };
}
