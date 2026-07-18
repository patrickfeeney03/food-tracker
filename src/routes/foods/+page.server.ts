import { mealSlots } from "$lib/nutrition/constants";
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

const destinationSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots)
});

const searchSchema = z.string().trim().max(200);
const barcodeSchema = z.string().trim().min(1).max(200);
const tabSchema = z.enum(['foods', 'shortcuts']);
const shortcutIdSchema = z.uuid();

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
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
      foods: [matchingFood],
      shortcuts: [],
      shortcutSourceAvailable
    };
  }

  const foods = tab === 'foods'
    ? listActiveFoods(db, locals.user.id, query)
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
    shortcutSourceAvailable
  };
};

export const actions = {
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
