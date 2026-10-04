import { calendarDateString } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { loadDiaryEntryFeedback } from '$lib/server/tracker/initial-state';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireUser(locals);
  const date = calendarDateString.safeParse(url.searchParams.get('date'));

  if (!date.success) {
    error(400, 'Invalid diary date');
  }

  return json(
    await loadDiaryEntryFeedback(locals.db, user.id, url, date.data),
    {
      headers: {
        'Cache-Control': 'private, no-store'
      }
    }
  );
};
