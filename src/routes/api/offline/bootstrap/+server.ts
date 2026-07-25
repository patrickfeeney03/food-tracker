import { calendarDateString } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import { buildOfflineBootstrap } from '$lib/server/offline/bootstrap';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({
  locals,
  url
}) => {
  const user = requireUser(locals);
  const dateResult = calendarDateString.safeParse(
    url.searchParams.get('date')
  );

  if (!dateResult.success) {
    return error(400, 'Invalid diary date');
  }

  return json(
    buildOfflineBootstrap(
      db,
      user,
      dateResult.data
    ),
    {
      headers: {
        'Cache-Control': 'private, no-store'
      }
    }
  );
};
