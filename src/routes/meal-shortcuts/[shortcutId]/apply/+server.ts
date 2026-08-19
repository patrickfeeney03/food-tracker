import { resolve } from '$app/paths';
import { withHash, withQuery } from '$lib/navigation';
import { readText } from '$lib/nutrition/food-form';
import { applyMealShortcutInputSchema } from '$lib/nutrition/meal-shortcut-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  applyMealShortcut,
  MealShortcutApplicationConflictError,
  MealShortcutBlockedError,
  MealShortcutNotFoundError
} from '$lib/server/nutrition/meal-shortcut';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = requireUser(locals);
  if (params.shortcutId === undefined) {
    error(404, 'Meal shortcut not found');
  }

  const formData = await request.formData();
  const mutationId = readText(formData, 'clientMutationId');
  const result = applyMealShortcutInputSchema.safeParse({
    clientMutationId: z.uuid().safeParse(mutationId).success
      ? mutationId
      : crypto.randomUUID(),
    diaryDate: readText(formData, 'diaryDate'),
    mealSlot: readText(formData, 'mealSlot')
  });

  if (!result.success) {
    error(400, 'Invalid meal shortcut application');
  }

  try {
    const applied = applyMealShortcut(
      db,
      user.id,
      params.shortcutId,
      result.data
    );

    locals.log.info('meal_shortcut.applied', {
      shortcutId: params.shortcutId,
      applicationId: applied.application.id,
      diaryDate: applied.application.diaryDate,
      mealSlot: applied.application.mealSlot,
      entryCount: applied.entries.length,
      replayed: applied.replayed
    });

    redirect(303, withHash(resolve(withQuery('/', {
      date: applied.application.diaryDate,
      shortcutApplied: applied.application.id
    })), applied.application.mealSlot));
  } catch (caught) {
    if (caught instanceof MealShortcutNotFoundError) {
      error(404, 'Meal shortcut not found');
    }

    if (
      caught instanceof MealShortcutBlockedError ||
      caught instanceof MealShortcutApplicationConflictError
    ) {
      error(409, caught.message);
    }

    throw caught;
  }
};
