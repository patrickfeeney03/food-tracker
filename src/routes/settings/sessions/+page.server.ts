import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from '$lib/server/auth/cookie';
import { requireUser } from '$lib/server/auth/require-user';
import { revokeSession } from '$lib/server/auth/session';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  const user = requireUser(locals);
  const now = new Date();

  const activeSessions = db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt))
    .all();

  return {
    sessions: activeSessions.map((session) => ({
      ...session,
      isCurrent: locals.session?.id === session.id
    })),
    revoked: url.searchParams.get('revoked') === 'true'
  };
};

export const actions: Actions = {
  revoke: async ({ cookies, locals, request }) => {
    const user = requireUser(locals);
    const formData = await request.formData();
    const sessionId = formData.get('sessionId');

    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return fail(400, {
        revokeError: 'Choose a session to sign out.'
      });
    }

    const revoked = revokeSession(db, user.id, sessionId);

    if (!revoked) {
      return fail(404, {
        revokeError: 'That session is no longer active.'
      });
    }

    if (locals.session?.id === sessionId) {
      cookies.delete(SESSION_COOKIE_NAME, {
        path: SESSION_COOKIE_OPTIONS.path
      });

      return redirect(303, '/sign-in');
    }

    return redirect(303, '/settings/sessions?revoked=true');
  }
};
