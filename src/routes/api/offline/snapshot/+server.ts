import { calendarDateString } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import { buildTrackerSnapshot } from '$lib/server/tracker/snapshot';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({
  locals,
  url
}) => {
  const user = requireUser(locals);
  const date = calendarDateString.safeParse(
    url.searchParams.get('date')
  );

  if (!date.success) {
    return error(400, 'Invalid diary date');
  }

  return json(
    buildTrackerSnapshot(
      db,
      user,
      date.data
    ),
    {
      headers: {
        'Cache-Control': 'private, no-store'
      }
    }
  );
};
