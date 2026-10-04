import { resolve } from '$app/paths';
import { withHash, withQuery } from '$lib/navigation';
import { readText } from '$lib/nutrition/food-form';
import { requireUser } from '$lib/server/auth/require-user';
import {
  DiaryEntryDeletionNotFoundError,
  restoreDeletedDiaryEntry
} from '$lib/server/nutrition/delete-diary-entry';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

const inputSchema = z.object({
  entryId: z.uuid(),
  deletedAt: z.coerce.number().int().nonnegative()
});

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireUser(locals);
  const formData = await request.formData();
  const result = inputSchema.safeParse({
    entryId: readText(formData, 'entryId'),
    deletedAt: readText(formData, 'deletedAt')
  });

  if (!result.success) {
    error(400, 'Invalid diary entry undo request');
  }

  try {
    const entry = await restoreDeletedDiaryEntry(
      locals.db,
      user.id,
      result.data.entryId,
      new Date(result.data.deletedAt)
    );

    locals.log.info('diary_entry.restored', {
      diaryEntryId: entry.id,
      foodId: entry.foodId,
      diaryDate: entry.diaryDate,
      mealSlot: entry.mealSlot
    });

    redirect(303, withHash(resolve(withQuery('/', {
      date: entry.diaryDate,
      entryRestored: entry.id
    })), entry.mealSlot));
  } catch (caught) {
    if (caught instanceof DiaryEntryDeletionNotFoundError) {
      error(404, 'Deleted diary entry not found');
    }

    throw caught;
  }
};
