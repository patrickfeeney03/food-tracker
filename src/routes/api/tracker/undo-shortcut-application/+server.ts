import { resolve } from '$app/paths';
import { withHash, withQuery } from '$lib/navigation';
import { readText } from '$lib/nutrition/food-form';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  MealShortcutApplicationNotFoundError,
  undoMealShortcutApplication
} from '$lib/server/nutrition/meal-shortcut';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

const inputSchema = z.object({
  applicationId: z.uuid()
});

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireUser(locals);
  const formData = await request.formData();
  const result = inputSchema.safeParse({
    applicationId: readText(formData, 'applicationId')
  });

  if (!result.success) {
    error(400, 'Invalid meal shortcut undo request');
  }

  try {
    const feedback = undoMealShortcutApplication(
      db,
      user.id,
      result.data.applicationId
    );

    locals.log.info('meal_shortcut.undone', {
      applicationId: feedback.application.id,
      shortcutId: feedback.application.shortcutId,
      diaryDate: feedback.application.diaryDate,
      mealSlot: feedback.application.mealSlot,
      entryCount: feedback.entryCount
    });

    redirect(303, withHash(resolve(withQuery('/', {
      date: feedback.application.diaryDate,
      shortcutUndone: feedback.application.id
    })), feedback.application.mealSlot));
  } catch (caught) {
    if (caught instanceof MealShortcutApplicationNotFoundError) {
      error(404, 'Meal shortcut application not found');
    }

    throw caught;
  }
};
