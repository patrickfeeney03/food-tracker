import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from '$lib/server/auth/cookie';
import { requireUser } from '$lib/server/auth/require-user';
import { revokeSession } from '$lib/server/auth/session';
import { db } from '$lib/server/db';

export const POST: RequestHandler = ({
  locals,
  cookies
}) => {
  const user = requireUser(locals);

  if (
    locals.session !== null
  ) {
    const sessionId = locals.session.id;

    revokeSession(
      db,
      user.id,
      sessionId
    );

    locals.log.info('auth.signed_out', {
      sessionId
    });
  }

  cookies.delete(SESSION_COOKIE_NAME, {
    path: SESSION_COOKIE_OPTIONS.path
  });

  return redirect(303, '/sign-in');
};
