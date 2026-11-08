import { resolve } from '$app/paths';
import { shiftDate } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { createBatchInputSchema, readBatchFormData, submittedSchedule } from '$lib/nutrition/batch-input';
import { formatStoredValue } from '$lib/nutrition/math';
import { readContext } from '$lib/nutrition/navigation-context';
import { requireUser } from '$lib/server/auth/require-user';
import {
  BatchNotFoundError,
  createBatch,
  loadBatchDraft
} from '$lib/server/nutrition/batch';
import {
  MealShortcutBlockedError,
  MealShortcutCreateConflictError,
  searchMealShortcutFoods
} from '$lib/server/nutrition/meal-shortcut';
import {
  submittedEditorItems
} from '$lib/server/nutrition/meal-shortcut-form';
import { error, fail, redirect } from '@sveltejs/kit';
import * as z from 'zod';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals);

  const context = readContext({
    date: url.searchParams.get('date'),
    mealSlot: url.searchParams.get('mealSlot'),
    q: url.searchParams.get('q')
  });
  if (context === undefined) return error(400, 'Invalid diary destination');

  let draft;
  try {
    draft = await loadBatchDraft(locals.db, user.id, url.searchParams.get('from') ?? undefined);
  } catch (caught) {
    if (caught instanceof BatchNotFoundError) return error(404, 'Batch not found');
    throw caught;
  }
  const foods = await searchMealShortcutFoods(locals.db, user.id, '', 200);

  return {
    context,
    foods,
    values: {
      clientMutationId: draft.clientMutationId,
      name: draft.name,
      portionCount: draft.portionCount,
      logMode: 'next-days' as const,
      startDate: shiftDate(context.date, 1),
      scheduleMealSlot: 'lunch',
      items: draft.items.map((item, index) => ({
        key: `draft-${index}`,
        foodId: item.foodId,
        foodName: item.foodName,
        foodBrand: item.foodBrand,
        amountUnit: item.amountUnit,
        amount: formatStoredValue(BigInt(item.defaultAmount), 3),
        blocked: false
      }))
    }
  };
};

export const actions = {
  save: async ({ locals, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const raw = readBatchFormData(formData);
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    const foods = await searchMealShortcutFoods(locals.db, user.id, '', 200);
    const result = createBatchInputSchema.safeParse(raw);
    const values = {
      clientMutationId: raw.clientMutationId,
      name: raw.name,
      portionCount: Number(raw.portionCount) || 2,
      ...submittedSchedule(raw, {
        startDate: context === undefined ? '' : shiftDate(context.date, 1),
        mealSlot: 'lunch'
      }),
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

    let batch;
    try {
      ({ batch } = await createBatch(locals.db, user.id, result.data));

      locals.log.info('batch.saved', {
        batchId: batch.id,
        clientMutationId: result.data.clientMutationId,
        itemCount: result.data.items.length,
        portionCount: result.data.portionCount,
        operation: 'create'
      });
    } catch (caught) {
      if (
        caught instanceof MealShortcutCreateConflictError ||
        caught instanceof MealShortcutBlockedError ||
        caught instanceof RangeError
      ) {
        return fail(409, { values, context, errors: { form: [caught.message] } });
      }
      throw caught;
    }

    return redirect(
      303,
      resolve(
        withQuery(`/batches/${batch.id}/edit`, {
          date: context.date,
          mealSlot: context.mealSlot,
          q: context.q || undefined,
          saved: '1'
        })
      )
    );
  }
} satisfies Actions;
