import { mealSlots } from "$lib/nutrition/constants";
import { inputLimits } from "$lib/nutrition/input-limits";
import { calendarDateString } from "$lib/nutrition/portion-input";
import z from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { todayInDublin } from "$lib/date";
import {
  findActiveFoodByBarcode,
  listActiveFoods
} from "$lib/server/nutrition/food-catalogue";
import { resolve } from "$app/paths";
import { withQuery } from "$lib/navigation";
import {
  applyMealShortcut,
  listMealShortcuts,
  loadMealShortcutDraft,
  MealShortcutApplicationConflictError,
  MealShortcutBlockedError,
  MealShortcutNotFoundError
} from "$lib/server/nutrition/meal-shortcut";
import {
  ExistingFoodLogConflictError,
  ExistingFoodNotFoundError,
  quickAddExistingFood,
  QuickAddUnavailableError
} from "$lib/server/nutrition/log-existing-food";
import { replayLatestFoodPortion } from "$lib/server/nutrition/latest-food-portion";
import {
  deleteDiaryEntry,
  DiaryEntryDeletionNotFoundError
} from "$lib/server/nutrition/delete-diary-entry";
import {
  getActiveDiaryEntry,
  getDeletedDiaryEntry
} from "$lib/server/nutrition/diary-entry-query";

const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

const searchSchema = z.string().trim().max(inputLimits.catalogueQuery.maxLength);
const barcodeSchema = z.string().trim().min(1).max(inputLimits.food.barcode.maxLength);
const tabSchema = z.enum(['foods', 'shortcuts']);
const shortcutIdSchema = z.uuid();
const foodIdSchema = z.uuid();
const entryIdSchema = z.uuid();

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function withQuickAddState<T extends {
  amountUnit: 'mg' | 'ul';
  servingAmount: number | null;
  containerAmount: number | null;
  latestUse: {
    amountUnit: 'mg' | 'ul';
    portionKind: 'unit' | 'hundred' | 'serving' | 'container';
    portionAmount: number;
    portionCountMilli: number;
    resolvedAmount: number;
  } | null;
}>(food: T) {
  const replay = food.latestUse === null
    ? null
    : replayLatestFoodPortion(food, food.latestUse);

  return {
    ...food,
    quickAddMutationId: replay === null ? null : crypto.randomUUID()
  };
}

export const load: PageServerLoad = ({
  locals,
  url
}) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  const destinationResult =
    destinationSchema.safeParse({
      date: url.searchParams.get('date'),
      mealSlot: url.searchParams.get('mealSlot')
    });

  if (!destinationResult.success) {
    return error(400, 'Invalid diary destination');
  }

  const searchResult = searchSchema.safeParse(
    url.searchParams.get('q') ?? ''
  );

  if (!searchResult.success) {
    return error(400, 'Invalid catalogue search');
  }

  const query = searchResult.data;
  const tabResult = tabSchema.safeParse(
    url.searchParams.get('tab') ?? 'foods'
  );

  if (!tabResult.success) {
    return error(400, 'Invalid catalogue tab');
  }

  const tab = tabResult.data;
  const quickAddedId = entryIdSchema.safeParse(url.searchParams.get('quickAdded'));
  const quickAddUndoneId = entryIdSchema.safeParse(url.searchParams.get('quickAddUndone'));
  let quickAddFeedback:
    | {
      kind: 'added';
      entryId: string;
      foodName: string;
      amountUnit: 'mg' | 'ul';
      resolvedAmount: number;
    }
    | { kind: 'undone'; foodName: string }
    | null = null;

  if (quickAddedId.success) {
    const entry = getActiveDiaryEntry(db, locals.user.id, quickAddedId.data);
    if (
      entry !== undefined &&
      entry.diaryDate === destinationResult.data.date &&
      entry.mealSlot === destinationResult.data.mealSlot
    ) {
      quickAddFeedback = {
        kind: 'added',
        entryId: entry.id,
        foodName: entry.foodName,
        amountUnit: entry.amountUnit,
        resolvedAmount: entry.resolvedAmount
      };
    }
  } else if (quickAddUndoneId.success) {
    const entry = getDeletedDiaryEntry(db, locals.user.id, quickAddUndoneId.data);
    if (
      entry !== undefined &&
      entry.diaryDate === destinationResult.data.date &&
      entry.mealSlot === destinationResult.data.mealSlot
    ) {
      quickAddFeedback = {
        kind: 'undone',
        foodName: entry.foodName
      };
    }
  }
  const shortcutSourceAvailable = tab === 'shortcuts'
    ? (() => {
      const draft = loadMealShortcutDraft(
        db,
        locals.user.id,
        destinationResult.data.date,
        destinationResult.data.mealSlot
      );

      return draft.items.length > 0 || draft.excludedEntries.length > 0;
    })()
    : false;
  const rawBarcode = url.searchParams.get('barcode');
  const barcodeResult = rawBarcode === null
    ? null
    : barcodeSchema.safeParse(rawBarcode);

  if (barcodeResult !== null && !barcodeResult.success) {
    return error(400, 'Invalid barcode');
  }

  const scannedBarcode = barcodeResult?.data ?? null;

  if (scannedBarcode !== null && tab === 'foods') {
    const matchingFood = findActiveFoodByBarcode(
      db,
      locals.user.id,
      scannedBarcode
    );

    if (matchingFood === null) {
      return redirect(
        303,
        resolve(
          withQuery('/foods/new', {
            date: destinationResult.data.date,
            mealSlot: destinationResult.data.mealSlot,
            barcode: scannedBarcode
          })
        )
      );
    }

    return {
      destination: destinationResult.data,
      tab: 'foods' as const,
      added: false,
      created: false,
      saved: false,
      archived: false,
      shortcutArchived: false,
      isToday: destinationResult.data.date === todayInDublin(),
      query: scannedBarcode,
      scannedBarcode,
      foods: [withQuickAddState(matchingFood)],
      shortcuts: [],
      shortcutSourceAvailable,
      quickAddFeedback
    };
  }

  const foods = tab === 'foods'
    ? listActiveFoods(db, locals.user.id, query).map(withQuickAddState)
    : [];
  const shortcuts = tab === 'shortcuts'
    ? listMealShortcuts(db, locals.user.id, query).map((shortcut) => ({
      ...shortcut,
      clientMutationId: crypto.randomUUID()
    }))
    : [];

  return {
    destination: destinationResult.data,
    tab,
    added: tab === 'foods' && url.searchParams.get('added') === '1',
    created: tab === 'foods' && url.searchParams.get('created') === '1',
    saved: tab === 'foods' && url.searchParams.get('saved') === '1',
    archived: tab === 'foods' && url.searchParams.get('archived') === '1',
    shortcutArchived: tab === 'shortcuts' && url.searchParams.get('shortcutArchived') === '1',
    isToday: destinationResult.data.date === todayInDublin(),
    query,
    scannedBarcode: null,
    foods,
    shortcuts,
    shortcutSourceAvailable,
    quickAddFeedback
  };
};

export const actions = {
  quickAdd: async ({ locals, request }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

    const formData = await request.formData();
    const foodIdResult = foodIdSchema.safeParse(readText(formData, 'foodId'));
    const destinationResult = destinationSchema.safeParse({
      date: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    });
    const mutationIdResult = z.uuid().safeParse(readText(formData, 'clientMutationId'));
    const queryResult = searchSchema.safeParse(readText(formData, 'q'));

    if (
      !foodIdResult.success ||
      !destinationResult.success ||
      !mutationIdResult.success ||
      !queryResult.success
    ) {
      return fail(400, { quickAddError: 'Invalid Quick Add request.' });
    }

    try {
      const entry = quickAddExistingFood(
        db,
        locals.user.id,
        foodIdResult.data,
        {
          clientMutationId: mutationIdResult.data,
          diaryDate: destinationResult.data.date,
          mealSlot: destinationResult.data.mealSlot
        }
      );

      return redirect(
        303,
        resolve(
          withQuery('/foods', {
            date: destinationResult.data.date,
            mealSlot: destinationResult.data.mealSlot,
            q: queryResult.data || undefined,
            quickAdded: entry.id
          })
        )
      );
    } catch (caught) {
      if (caught instanceof ExistingFoodNotFoundError) {
        return error(404, 'Food not found');
      }
      if (
        caught instanceof ExistingFoodLogConflictError ||
        caught instanceof QuickAddUnavailableError
      ) {
        return fail(409, { quickAddError: caught.message });
      }
      if (caught instanceof RangeError) {
        return fail(400, { quickAddError: caught.message });
      }
      throw caught;
    }
  },

  undoQuickAdd: async ({ locals, request }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

    const formData = await request.formData();
    const entryIdResult = entryIdSchema.safeParse(readText(formData, 'entryId'));
    const destinationResult = destinationSchema.safeParse({
      date: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    });
    const queryResult = searchSchema.safeParse(readText(formData, 'q'));

    if (!entryIdResult.success || !destinationResult.success || !queryResult.success) {
      return fail(400, { quickAddError: 'Invalid Quick Add undo request.' });
    }

    try {
      const entry = deleteDiaryEntry(db, locals.user.id, entryIdResult.data);

      return redirect(
        303,
        resolve(
          withQuery('/foods', {
            date: destinationResult.data.date,
            mealSlot: destinationResult.data.mealSlot,
            q: queryResult.data || undefined,
            quickAddUndone: entry.id
          })
        )
      );
    } catch (caught) {
      if (caught instanceof DiaryEntryDeletionNotFoundError) {
        return error(404, 'Diary entry not found');
      }
      throw caught;
    }
  },

  applyShortcut: async ({ locals, request }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

    const formData = await request.formData();
    const shortcutIdResult = shortcutIdSchema.safeParse(readText(formData, 'shortcutId'));
    const destinationResult = destinationSchema.safeParse({
      date: readText(formData, 'diaryDate'),
      mealSlot: readText(formData, 'mealSlot')
    });
    const clientMutationIdResult = z.uuid().safeParse(
      readText(formData, 'clientMutationId')
    );

    if (
      !shortcutIdResult.success ||
      !destinationResult.success ||
      !clientMutationIdResult.success
    ) {
      return fail(400, { applyError: 'Invalid meal shortcut request.' });
    }

    try {
      const result = applyMealShortcut(
        db,
        locals.user.id,
        shortcutIdResult.data,
        {
          clientMutationId: clientMutationIdResult.data,
          diaryDate: destinationResult.data.date,
          mealSlot: destinationResult.data.mealSlot
        }
      );

      return redirect(
        303,
        resolve(
          withQuery('/', {
            date: destinationResult.data.date,
            shortcutApplied: result.application.id
          })
        )
      );
    } catch (caught) {
      if (caught instanceof MealShortcutNotFoundError) {
        return error(404, 'Meal shortcut not found');
      }

      if (caught instanceof MealShortcutBlockedError) {
        return fail(409, { applyError: caught.message });
      }

      if (caught instanceof MealShortcutApplicationConflictError) {
        return fail(409, { applyError: caught.message });
      }

      if (caught instanceof RangeError) {
        return fail(400, { applyError: caught.message });
      }

      throw caught;
    }
  }
} satisfies Actions;
