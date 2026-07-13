import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from '$lib/server/auth/cookie';
import { revokeSession } from '$lib/server/auth/session';
import { db } from '$lib/server/db';

export const POST: RequestHandler = ({
  locals,
  cookies
}) => {
  if (
    locals.user !== null &&
    locals.session !== null
  ) {
    revokeSession(
      db,
      locals.user.id,
      locals.session.id
    );
  }

  cookies.delete(SESSION_COOKIE_NAME, {
    path: SESSION_COOKIE_OPTIONS.path
  });

  return redirect(303, '/sign-in');
};
