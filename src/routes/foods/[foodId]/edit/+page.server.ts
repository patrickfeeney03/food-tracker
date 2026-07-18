import { resolve } from '$app/paths';
import { todayInDublin } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { mealSlots } from '$lib/nutrition/constants';
import { editFoodSchema } from '$lib/nutrition/food-input';
import { readFoodFormValues, readText } from '$lib/nutrition/food-form';
import { calendarDateString } from '$lib/nutrition/portion-input';
import { db } from '$lib/server/db';
import {
  archiveFood,
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

const contextSchema = z.object({
  date: calendarDateString,
  mealSlot: z.enum(mealSlots),
  q: z.string().trim().max(200)
});

function readContext(url: URL) {
  const result = contextSchema.safeParse({
    date: url.searchParams.get('date') ?? todayInDublin(),
    mealSlot: url.searchParams.get('mealSlot') ?? 'snacks',
    q: url.searchParams.get('q') ?? ''
  });

  if (!result.success) {
    return error(400, 'Invalid catalogue context');
  }

  return result.data;
}

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
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  const food = getActiveFoodForEdit(db, locals.user.id, params.foodId);
  if (food === undefined) {
    return error(404, 'Food not found');
  }

  return {
    context: readContext(url),
    values: formatFoodForEdit(food)
  };
};

export const actions = {
  save: async ({ locals, params, request }) => {
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

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
      updateFood(db, locals.user.id, params.foodId, result.data);
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
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

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
      archiveFood(db, locals.user.id, params.foodId, expectedUpdatedAt);
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
