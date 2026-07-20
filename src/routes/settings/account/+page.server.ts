import { redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { authAccounts } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  const authAccount = db
    .select({
      provider: authAccounts.provider,
      emailAtLink: authAccounts.emailAtLink,
      createdAt: authAccounts.createdAt
    })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, locals.user.id),
        eq(authAccounts.provider, 'google')
      )
    )
    .limit(1)
    .get();

  return {
    user: {
      name: locals.user.name,
      email: locals.user.email,
      createdAt: locals.user.createdAt
    },
    authAccount: authAccount ?? null,
    currentSession:
      locals.session === null
        ? null
        : {
            createdAt: locals.session.createdAt,
            lastSeenAt: locals.session.lastSeenAt,
            expiresAt: locals.session.expiresAt,
            userAgent: locals.session.userAgent
          }
  };
};
