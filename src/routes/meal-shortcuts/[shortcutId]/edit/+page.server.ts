import { resolve } from '$app/paths';
import { todayInDublin } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { mealSlots } from '$lib/nutrition/constants';
import { inputLimits } from '$lib/nutrition/input-limits';
import {
  readMealShortcutFormData,
  updateMealShortcutInputSchema
} from '$lib/nutrition/meal-shortcut-input';
import { calendarDateString } from '$lib/nutrition/portion-input';
import { formatStoredValue } from '$lib/nutrition/math';
import { db } from '$lib/server/db';
import {
  archiveMealShortcut,
  getMealShortcut,
  MealShortcutBlockedError,
  MealShortcutEditConflictError,
  MealShortcutNotFoundError,
  searchMealShortcutFoods,
  updateMealShortcut
} from '$lib/server/nutrition/meal-shortcut';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

const contextSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots),
  q: z.string().trim().max(inputLimits.catalogueQuery.maxLength)
});

type PickerFood = ReturnType<typeof searchMealShortcutFoods>[number];

function readContext(values: { date: string; mealSlot: string; q: string }) {
  const result = contextSchema.safeParse(values);
  return result.success ? result.data : undefined;
}

function unavailableReason(reason: 'food_archived' | 'amount_unit_changed') {
  return reason === 'food_archived'
    ? 'This food is archived. Replace or remove it.'
    : 'This food changed between g and ml. Replace it to choose a new exact amount.';
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

function catalogueDestination(
  context: { date: string; mealSlot: string; q: string }
) {
  return redirect(
    303,
    resolve(
      withQuery('/foods', {
        date: context.date,
        mealSlot: context.mealSlot,
        q: context.q || undefined,
        tab: 'shortcuts',
        shortcutArchived: '1'
      })
    )
  );
}

export const load: PageServerLoad = ({ locals, params, url }) => {
  if (locals.user === null) return redirect(303, '/sign-in');

  const context = readContext({
    date: url.searchParams.get('date') ?? todayInDublin(),
    mealSlot: url.searchParams.get('mealSlot') ?? 'snacks',
    q: url.searchParams.get('q') ?? ''
  });
  if (context === undefined) return error(400, 'Invalid catalogue context');

  try {
    const shortcut = getMealShortcut(db, locals.user.id, params.shortcutId);
    const foods = searchMealShortcutFoods(db, locals.user.id, '', 200);
    return {
      context,
      foods,
      values: {
        name: shortcut.name,
        expectedUpdatedAt: String(shortcut.updatedAt.getTime()),
        items: shortcut.items.map((item) => ({
          key: item.id,
          itemId: item.id,
          foodId: item.blockedReason === null ? item.foodId : null,
          foodName: item.foodName,
          foodBrand: item.foodBrand,
          amountUnit: item.blockedReason === null ? item.currentAmountUnit : null,
          amount: formatStoredValue(BigInt(item.defaultAmount), 3),
          blocked: item.blockedReason !== null,
          blockedReason:
            item.blockedReason === null ? undefined : unavailableReason(item.blockedReason)
        }))
      }
    };
  } catch (caught) {
    if (caught instanceof MealShortcutNotFoundError) return error(404, 'Meal shortcut not found');
    throw caught;
  }
};

export const actions = {
  save: async ({ locals, params, request }) => {
    if (locals.user === null) return redirect(303, '/sign-in');

    const formData = await request.formData();
    const raw = readMealShortcutFormData(formData);
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    const foods = searchMealShortcutFoods(db, locals.user.id, '', 200);
    const result = updateMealShortcutInputSchema.safeParse(raw);
    const values = {
      name: raw.name,
      expectedUpdatedAt: raw.expectedUpdatedAt,
      items: submittedItems(raw.items, foods)
    };

    if (!result.success || context === undefined) {
      return fail(400, {
        values,
        context,
        errors: {
          ...(result.success ? {} : z.flattenError(result.error).fieldErrors),
          ...(context === undefined ? { form: ['Invalid catalogue context'] } : {})
        }
      });
    }

    let shortcut;
    try {
      shortcut = updateMealShortcut(db, locals.user.id, params.shortcutId, result.data);
    } catch (caught) {
      if (caught instanceof MealShortcutNotFoundError) return error(404, 'Meal shortcut not found');
      if (
        caught instanceof MealShortcutEditConflictError ||
        caught instanceof MealShortcutBlockedError ||
        caught instanceof RangeError
      ) {
        return fail(409, { values, context, errors: { form: [caught.message] } });
      }
      throw caught;
    }

    return redirect(
      303,
      resolve(withQuery('/', { date: context.date, shortcutSaved: shortcut.id }))
    );
  },

  archive: async ({ locals, params, request }) => {
    if (locals.user === null) return redirect(303, '/sign-in');

    const formData = await request.formData();
    const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') ?? '');
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    if (context === undefined) return fail(400, { archiveError: 'Invalid catalogue context' });

    try {
      archiveMealShortcut(db, locals.user.id, params.shortcutId, expectedUpdatedAt);
    } catch (caught) {
      if (caught instanceof MealShortcutNotFoundError) return error(404, 'Meal shortcut not found');
      if (caught instanceof MealShortcutEditConflictError) {
        return fail(409, { context, archiveError: caught.message });
      }
      throw caught;
    }

    return catalogueDestination(context);
  }
} satisfies Actions;
