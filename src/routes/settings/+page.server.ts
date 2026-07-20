import { fail } from '@sveltejs/kit';
import { and, desc, eq, gt, isNull, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
  nutritionGoals,
  sessions,
  themes,
  users,
  type Theme
} from '$lib/server/db/schema';
import { todayInDublin } from '$lib/date';
import { requireUser } from '$lib/server/auth/require-user';
import {
  THEME_COOKIE_NAME,
  THEME_COOKIE_OPTIONS
} from '$lib/server/theme';
import packageJson from '../../../package.json';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  const user = requireUser(locals);

  const currentGoal = db
    .select({
      targetEnergyMkcal: nutritionGoals.targetEnergyMkcal,
      targetProteinMg: nutritionGoals.targetProteinMg,
      targetCarbsMg: nutritionGoals.targetCarbsMg,
      targetFatMg: nutritionGoals.targetFatMg
    })
    .from(nutritionGoals)
    .where(
      and(
        eq(nutritionGoals.userId, user.id),
        lte(nutritionGoals.effectiveFrom, todayInDublin())
      )
    )
    .orderBy(desc(nutritionGoals.effectiveFrom))
    .limit(1)
    .get();

  const activeSessionCount = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .all()
    .length;

  return {
    user: {
      name: user.name,
      email: user.email
    },
    currentGoal: currentGoal ?? null,
    targetsSaved: url.searchParams.get('targets') === 'saved',
    activeSessionCount,
    theme: locals.theme,
    version: packageJson.version
  };
};

function isTheme(value: FormDataEntryValue | null): value is Theme {
  return typeof value === 'string' && themes.some((theme) => theme === value);
}

export const actions: Actions = {
  theme: async ({ cookies, locals, request }) => {
    const user = requireUser(locals);

    const formData = await request.formData();
    const theme = formData.get('theme');

    if (!isTheme(theme)) {
      return fail(400, {
        themeError: 'Choose a valid appearance setting.'
      });
    }

    db.update(users)
      .set({
        settingsJson: {
          ...user.settingsJson,
          theme
        },
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))
      .run();

    user.settingsJson = {
      ...user.settingsJson,
      theme
    };
    locals.theme = theme;
    cookies.set(THEME_COOKIE_NAME, theme, THEME_COOKIE_OPTIONS);

    return {
      themeSaved: true
    };
  }
};
