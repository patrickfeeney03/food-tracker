import { resolve } from '$app/paths';
import { withQuery } from '$lib/navigation';
import { readText } from '$lib/nutrition/food-form';
import { logFoodInputSchema } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  ExistingFoodLogConflictError,
  ExistingFoodNotFoundError,
  logExistingFood
} from '$lib/server/nutrition/log-existing-food';
import { error, json, redirect, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

function expectsHtml(request: Request): boolean {
  return request.headers.get('accept')?.includes('text/html') === true;
}

function failureResponse(
  request: Request,
  status: number,
  data: unknown,
  message: string
) {
  return expectsHtml(request)
    ? error(status, message)
    : json({
        type: 'failure',
        status,
        data: JSON.stringify(data)
      });
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  if (params.foodId === undefined) {
    error(404, 'Food not found');
  }
  const formData = await request.formData();
  const values = {
    clientMutationId: readText(formData, 'clientMutationId'),
    portionKind: readText(formData, 'portionKind'),
    portionCount: readText(formData, 'portionCount'),
    diaryDate: readText(formData, 'diaryDate'),
    mealSlot: readText(formData, 'mealSlot')
  };
  const result = logFoodInputSchema.safeParse(values);

  if (!result.success) {
    const errors = z.flattenError(result.error).fieldErrors;
    return failureResponse(request, 400, { values, errors }, 'Invalid food log');
  }

  try {
    const entry = logExistingFood(db, user.id, params.foodId, result.data);

    locals.log.info('diary_entry.logged', {
      diaryEntryId: entry.id,
      foodId: params.foodId,
      diaryDate: entry.diaryDate,
      mealSlot: entry.mealSlot,
      clientMutationId: result.data.clientMutationId,
      source: 'existing_food'
    });
  } catch (caught) {
    if (caught instanceof ExistingFoodNotFoundError) {
      error(404, 'Food not found');
    }

    if (caught instanceof ExistingFoodLogConflictError) {
      return failureResponse(
        request,
        409,
        { values, errors: { form: [caught.message] } },
        caught.message
      );
    }

    if (caught instanceof RangeError) {
      return failureResponse(
        request,
        400,
        { values, errors: { portionKind: [caught.message] } },
        caught.message
      );
    }

    throw caught;
  }

  const location = resolve(withQuery('/foods', {
    date: result.data.diaryDate,
    mealSlot: result.data.mealSlot
  }));

  return expectsHtml(request)
    ? redirect(303, location)
    : json({ type: 'redirect', status: 303, location });
};
