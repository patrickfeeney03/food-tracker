import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/require-user';
import { authAccounts } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireUser(locals);

  const authAccount = await locals.db
    .select({
      provider: authAccounts.provider,
      emailAtLink: authAccounts.emailAtLink,
      createdAt: authAccounts.createdAt
    })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, user.id),
        eq(authAccounts.provider, 'google')
      )
    )
    .limit(1)
    .get();

  return {
    user: {
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
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
