import { resolve } from '$app/paths';
import { shiftDate, todayInDublin } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { readBatchFormData, submittedSchedule, updateBatchInputSchema } from '$lib/nutrition/batch-input';
import { formatStoredValue } from '$lib/nutrition/math';
import { readContext } from '$lib/nutrition/navigation-context';
import { requireUser } from '$lib/server/auth/require-user';
import {
  BatchNotFoundError,
  BatchPortionCountTooLowError,
  getBatch,
  updateBatch
} from '$lib/server/nutrition/batch';
import {
  archiveMealShortcut,
  MealShortcutBlockedError,
  MealShortcutEditConflictError,
  MealShortcutNotFoundError,
  searchMealShortcutFoods
} from '$lib/server/nutrition/meal-shortcut';
import {
  submittedEditorItems,
  unavailableItemReason
} from '$lib/server/nutrition/meal-shortcut-form';
import { error, fail, redirect } from '@sveltejs/kit';
import * as z from 'zod';
import type { Actions, PageServerLoad } from './$types';

function readUrlContext(url: URL) {
  return readContext({
    date: url.searchParams.get('date') ?? todayInDublin(),
    mealSlot: url.searchParams.get('mealSlot') ?? 'snacks',
    q: url.searchParams.get('q')
  });
}

function scheduleDefaults(
  portions: readonly { diaryDate: string; mealSlot: string }[],
  contextDate: string
) {
  const last = portions.at(-1);
  return {
    startDate: shiftDate(last?.diaryDate ?? contextDate, 1),
    mealSlot: last?.mealSlot ?? 'lunch'
  };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const user = requireUser(locals);

  const context = readUrlContext(url);
  if (context === undefined) return error(400, 'Invalid catalogue context');

  try {
    const batch = await getBatch(locals.db, user.id, params.batchId);
    const foods = await searchMealShortcutFoods(locals.db, user.id, '', 200);
    const defaults = scheduleDefaults(batch.portions, context.date);
    return {
      context,
      foods,
      saved: url.searchParams.get('saved') === '1',
      loggedPortions: batch.portions.map(({ diaryDate, mealSlot }) => ({ diaryDate, mealSlot })),
      loggedCount: batch.loggedCount,
      values: {
        name: batch.name,
        expectedUpdatedAt: String(batch.updatedAt.getTime()),
        portionCount: batch.portionCount,
        logMode: 'hold' as const,
        startDate: defaults.startDate,
        scheduleMealSlot: defaults.mealSlot,
        items: batch.items.map((item) => ({
          key: item.id,
          itemId: item.id,
          foodId: item.blockedReason === null ? item.foodId : null,
          foodName: item.foodName,
          foodBrand: item.foodBrand,
          amountUnit: item.blockedReason === null ? item.currentAmountUnit : null,
          amount: formatStoredValue(BigInt(item.defaultAmount), 3),
          blocked: item.blockedReason !== null,
          blockedReason:
            item.blockedReason === null ? undefined : unavailableItemReason(item.blockedReason)
        }))
      }
    };
  } catch (caught) {
    if (caught instanceof BatchNotFoundError) return error(404, 'Batch not found');
    throw caught;
  }
};

export const actions = {
  save: async ({ locals, params, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const raw = readBatchFormData(formData);
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    const foods = await searchMealShortcutFoods(locals.db, user.id, '', 200);
    const result = updateBatchInputSchema.safeParse(raw);
    const values = {
      name: raw.name,
      expectedUpdatedAt: raw.expectedUpdatedAt,
      portionCount: Number(raw.portionCount) || 2,
      ...submittedSchedule(raw, { startDate: '', mealSlot: 'lunch' }),
      items: submittedEditorItems(raw.items, foods)
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

    try {
      const { batch } = await updateBatch(locals.db, user.id, params.batchId, result.data);

      locals.log.info('batch.saved', {
        batchId: batch.id,
        itemCount: result.data.items.length,
        portionCount: result.data.portionCount,
        operation: 'update'
      });
    } catch (caught) {
      if (caught instanceof BatchNotFoundError) return error(404, 'Batch not found');
      if (
        caught instanceof MealShortcutEditConflictError ||
        caught instanceof MealShortcutBlockedError ||
        caught instanceof BatchPortionCountTooLowError ||
        caught instanceof RangeError
      ) {
        return fail(409, { values, context, errors: { form: [caught.message] } });
      }
      throw caught;
    }

    return redirect(
      303,
      resolve(
        withQuery(`/batches/${params.batchId}/edit`, {
          date: context.date,
          mealSlot: context.mealSlot,
          q: context.q || undefined,
          saved: '1'
        })
      )
    );
  },

  archive: async ({ locals, params, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') ?? '');
    const context = readContext({
      date: String(formData.get('date') ?? ''),
      mealSlot: String(formData.get('mealSlot') ?? ''),
      q: String(formData.get('q') ?? '')
    });
    if (context === undefined) return fail(400, { archiveError: 'Invalid catalogue context' });

    try {
      const batch = await archiveMealShortcut(locals.db, user.id, params.batchId, expectedUpdatedAt);
      locals.log.info('batch.archived', { batchId: batch.id });
    } catch (caught) {
      if (caught instanceof MealShortcutNotFoundError) return error(404, 'Batch not found');
      if (caught instanceof MealShortcutEditConflictError) {
        return fail(409, { context, archiveError: caught.message });
      }
      throw caught;
    }

    return redirect(
      303,
      resolve(
        withQuery('/foods', {
          date: context.date,
          mealSlot: context.mealSlot,
          q: context.q || undefined,
          tab: 'shortcuts',
          batchArchived: '1'
        })
      )
    );
  }
} satisfies Actions;
