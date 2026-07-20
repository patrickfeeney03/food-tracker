import { resolve } from '$app/paths';
import { todayInDublin } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { editFoodSchema } from '$lib/nutrition/food-input';
import { readFoodFormValues, readText } from '$lib/nutrition/food-form';
import { contextSchema, readContext } from '$lib/nutrition/navigation-context';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  archiveFood,
  FoodAmountUnitConflictError,
  FoodBarcodeConflictError,
  FoodEditConflictError,
  FoodNotFoundError,
  formatFoodForEdit,
  getActiveFoodForEdit,
  updateFood
} from '$lib/server/nutrition/edit-food';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

function catalogueRedirect(
  context: { date: string; mealSlot: string; q: string },
  confirmation: 'saved' | 'archived'
) {
  return redirect(
    303,
    resolve(
      withQuery('/foods', {
        date: context.date,
        mealSlot: context.mealSlot,
        q: context.q || undefined,
        [confirmation]: 1
      })
    )
  );
}

export const load: PageServerLoad = ({ locals, params, url }) => {
  const user = requireUser(locals);

  const food = getActiveFoodForEdit(db, user.id, params.foodId);
  if (food === undefined) {
    return error(404, 'Food not found');
  }

  const context = readContext({
    date: url.searchParams.get('date') ?? todayInDublin(),
    mealSlot: url.searchParams.get('mealSlot') ?? 'snacks',
    q: url.searchParams.get('q') ?? ''
  });

  if (context === undefined) {
    return error(400, 'Invalid catalogue context');
  }

  return {
    context,
    values: formatFoodForEdit(food)
  };
};

export const actions = {
  save: async ({ locals, params, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const values = {
      ...readFoodFormValues(formData),
      expectedUpdatedAt: readText(formData, 'expectedUpdatedAt')
    };
    const contextResult = contextSchema.safeParse({
      date: readText(formData, 'date'),
      mealSlot: readText(formData, 'mealSlot'),
      q: readText(formData, 'q')
    });
    const result = editFoodSchema.safeParse(values);

    if (!result.success || !contextResult.success) {
      return fail(400, {
        values,
        context: contextResult.success ? contextResult.data : undefined,
        errors: {
          ...(result.success ? {} : z.flattenError(result.error).fieldErrors),
          ...(contextResult.success ? {} : { form: ['Invalid catalogue context'] })
        }
      });
    }

    try {
      const food = updateFood(db, user.id, params.foodId, result.data);

      locals.log.info('food.updated', {
        foodId: food.id
      });
    } catch (caught) {
      if (caught instanceof FoodNotFoundError) {
        return error(404, 'Food not found');
      }
      if (caught instanceof FoodBarcodeConflictError) {
        return fail(400, {
          values,
          context: contextResult.data,
          errors: { barcode: [caught.message] }
        });
      }
      if (caught instanceof FoodAmountUnitConflictError) {
        return fail(400, {
          values,
          context: contextResult.data,
          errors: { amountUnit: [caught.message] }
        });
      }
      if (caught instanceof FoodEditConflictError) {
        return fail(409, {
          values,
          context: contextResult.data,
          errors: { form: [caught.message] }
        });
      }
      if (caught instanceof RangeError) {
        return fail(400, {
          values,
          context: contextResult.data,
          errors: { form: [caught.message] }
        });
      }
      throw caught;
    }

    return catalogueRedirect(contextResult.data, 'saved');
  },

  archive: async ({ locals, params, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const expectedUpdatedAt = readText(formData, 'expectedUpdatedAt');
    const contextResult = contextSchema.safeParse({
      date: readText(formData, 'date'),
      mealSlot: readText(formData, 'mealSlot'),
      q: readText(formData, 'q')
    });

    if (!contextResult.success) {
      return fail(400, { archiveError: 'Invalid catalogue context' });
    }

    try {
      const food = archiveFood(db, user.id, params.foodId, expectedUpdatedAt);

      locals.log.info('food.archived', {
        foodId: food.id
      });
    } catch (caught) {
      if (caught instanceof FoodNotFoundError) {
        return error(404, 'Food not found');
      }
      if (caught instanceof FoodEditConflictError) {
        return fail(409, {
          context: contextResult.data,
          archiveError: caught.message
        });
      }
      throw caught;
    }

    return catalogueRedirect(contextResult.data, 'archived');
  }
} satisfies Actions;
