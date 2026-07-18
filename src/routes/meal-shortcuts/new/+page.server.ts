import { resolve } from '$app/paths';
import { withQuery } from '$lib/navigation';
import { mealSlots } from '$lib/nutrition/constants';
import {
  createMealShortcutInputSchema,
  mealShortcutDraftSourceSchema,
  readMealShortcutFormData
} from '$lib/nutrition/meal-shortcut-input';
import { calendarDateString } from '$lib/nutrition/portion-input';
import { formatStoredValue } from '$lib/nutrition/math';
import { db } from '$lib/server/db';
import {
  createMealShortcut,
  loadMealShortcutDraft,
  MealShortcutBlockedError,
  MealShortcutCreateConflictError,
  searchMealShortcutFoods
} from '$lib/server/nutrition/meal-shortcut';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const contextSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots),
  q: z.string().trim().max(200)
});

type PickerFood = ReturnType<typeof searchMealShortcutFoods>[number];

function blockedReason(reason: 'food_missing' | 'food_archived' | 'amount_unit_changed') {
  if (reason === 'amount_unit_changed') {
    return 'This food changed between g and ml. Replace it to choose a new exact amount.';
  }
  if (reason === 'food_archived') {
    return 'This food is archived. Replace or remove it.';
  }
  return 'This diary food is no longer available. Replace or remove it.';
}

function submittedItems(rawItems: unknown, foods: readonly PickerFood[]) {
  if (!Array.isArray(rawItems)) return [];
  const foodsById = new Map(foods.map((food) => [food.id, food]));

  return rawItems.map((rawItem, index) => {
    const item = typeof rawItem === 'object' && rawItem !== null
      ? rawItem as Record<string, unknown>
      : {};
    const foodId = typeof item.foodId === 'string' ? item.foodId : null;
    const food = foodId === null ? undefined : foodsById.get(foodId);
    return {
      key:
        (typeof item.itemId === 'string' && item.itemId) ||
        (typeof item.sourceEntryId === 'string' && item.sourceEntryId) ||
        `submitted-${index}`,
      itemId: typeof item.itemId === 'string' ? item.itemId : undefined,
      sourceEntryId: typeof item.sourceEntryId === 'string' ? item.sourceEntryId : undefined,
      foodId: food === undefined ? null : foodId,
      foodName: food?.name ?? 'Unavailable food',
      foodBrand: food?.brand ?? null,
      amountUnit: food?.amountUnit ?? null,
      amount: typeof item.amount === 'string' ? item.amount : '',
      blocked: food === undefined,
      blockedReason: food === undefined
        ? 'This food is unavailable. Replace or remove it.'
        : undefined
    };
  });
}

function readContext(values: { date: string; mealSlot: string; q: string }) {
  const result = contextSchema.safeParse(values);
  return result.success ? result.data : undefined;
}

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user === null) return redirect(303, '/sign-in');

  const sourceResult = mealShortcutDraftSourceSchema.safeParse({
    diaryDate: url.searchParams.get('date'),
    mealSlot: url.searchParams.get('mealSlot')
  });
  const contextResult = contextSchema.safeParse({
    date: url.searchParams.get('date'),
    mealSlot: url.searchParams.get('mealSlot'),
    q: url.searchParams.get('q') ?? ''
  });
  if (!sourceResult.success || !contextResult.success) {
    return error(400, 'Invalid diary destination');
  }

  const draft = loadMealShortcutDraft(
    db,
    locals.user.id,
    sourceResult.data.diaryDate,
    sourceResult.data.mealSlot
  );
  if (draft.items.length === 0 && draft.excludedEntries.length === 0) {
    return error(400, 'Log at least one food in this meal before creating a shortcut.');
  }
  const foods = searchMealShortcutFoods(db, locals.user.id, '', 200);

  return {
    context: contextResult.data,
    foods,
    values: {
      clientMutationId: draft.clientMutationId,
      name: draft.name,
      items: [
        ...draft.items.map((item) => ({
          position: item.position,
          key: item.sourceEntryId,
          sourceEntryId: item.sourceEntryId,
          foodId: item.foodId,
          foodName: item.foodName,
          foodBrand: item.foodBrand,
          amountUnit: item.amountUnit,
          amount: formatStoredValue(BigInt(item.defaultAmount), 3),
          blocked: false
        })),
        ...draft.excludedEntries.map((item) => ({
          position: item.position,
          key: item.entryId,
          sourceEntryId: item.entryId,
          foodId: null,
          foodName: item.foodName,
          foodBrand: null,
          amountUnit: null,
          amount: '',
          blocked: true,
          blockedReason: blockedReason(item.reason)
        }))
      ].sort((left, right) => left.position - right.position)
    }
  };
};

export const actions = {
  save: async ({ locals, request }) => {
    if (locals.user === null) return redirect(303, '/sign-in');

    const formData = await request.formData();
    const raw = readMealShortcutFormData(formData);
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    const foods = searchMealShortcutFoods(db, locals.user.id, '', 200);
    const result = createMealShortcutInputSchema.safeParse(raw);
    const values = {
      clientMutationId: raw.clientMutationId,
      name: raw.name,
      items: submittedItems(raw.items, foods)
    };

    if (!result.success || context === undefined) {
      return fail(400, {
        values,
        context,
        errors: {
          ...(result.success ? {} : z.flattenError(result.error).fieldErrors),
          ...(context === undefined ? { form: ['Invalid diary destination'] } : {})
        }
      });
    }

    let shortcut;
    try {
      shortcut = createMealShortcut(db, locals.user.id, result.data);
    } catch (caught) {
      if (
        caught instanceof MealShortcutCreateConflictError ||
        caught instanceof MealShortcutBlockedError ||
        caught instanceof RangeError
      ) {
        return fail(409, {
          values,
          context,
          errors: { form: [caught.message] }
        });
      }
      throw caught;
    }

    return redirect(
      303,
      resolve(
        withQuery('/', {
          date: context.date,
          shortcutSaved: shortcut.id
        })
      )
    );
  }
} satisfies Actions;
