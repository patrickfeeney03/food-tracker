import { resolve } from '$app/paths';
import { withHash, withQuery } from '$lib/navigation';
import {
  createMealShortcutInputSchema,
  mealShortcutDraftSourceSchema,
  readMealShortcutFormData
} from '$lib/nutrition/meal-shortcut-input';
import { contextSchema, readContext } from '$lib/nutrition/navigation-context';
import { formatStoredValue } from '$lib/nutrition/math';
import { requireUser } from '$lib/server/auth/require-user';
import {
  createMealShortcut,
  loadMealShortcutDraft,
  MealShortcutBlockedError,
  MealShortcutCreateConflictError,
  searchMealShortcutFoods
} from '$lib/server/nutrition/meal-shortcut';
import {
  submittedEditorItems,
  unavailableItemReason
} from '$lib/server/nutrition/meal-shortcut-form';
import { error, fail, redirect } from '@sveltejs/kit';
import * as z from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals);

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

  const draft = await loadMealShortcutDraft(
    locals.db,
    user.id,
    sourceResult.data.diaryDate,
    sourceResult.data.mealSlot
  );
  if (draft.items.length === 0 && draft.excludedEntries.length === 0) {
    return error(400, 'Log at least one food in this meal before creating a shortcut.');
  }
  const foods = await searchMealShortcutFoods(locals.db, user.id, '', 200);

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
          blockedReason: unavailableItemReason(item.reason)
        }))
      ].sort((left, right) => left.position - right.position)
    }
  };
};

export const actions = {
  save: async ({ locals, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const raw = readMealShortcutFormData(formData);
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    const foods = await searchMealShortcutFoods(locals.db, user.id, '', 200);
    const result = createMealShortcutInputSchema.safeParse(raw);
    const values = {
      clientMutationId: raw.clientMutationId,
      name: raw.name,
      items: submittedEditorItems(raw.items, foods)
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
      shortcut = await createMealShortcut(locals.db, user.id, result.data);

      locals.log.info('meal_shortcut.saved', {
        shortcutId: shortcut.id,
        clientMutationId: result.data.clientMutationId,
        itemCount: result.data.items.length,
        operation: 'create'
      });
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
      withHash(
        resolve(
          withQuery('/', {
            date: context.date,
            shortcutSaved: shortcut.id
          })
        ),
        context.mealSlot
      )
    );
  }
} satisfies Actions;
