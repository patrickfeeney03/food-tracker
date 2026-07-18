import { fail, redirect } from '@sveltejs/kit';
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
import {
  THEME_COOKIE_NAME,
  THEME_COOKIE_OPTIONS
} from '$lib/server/theme';
import packageJson from '../../../package.json';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

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
        eq(nutritionGoals.userId, locals.user.id),
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
        eq(sessions.userId, locals.user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .all()
    .length;

  return {
    user: {
      name: locals.user.name,
      email: locals.user.email
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
    if (locals.user === null) {
      return redirect(303, '/sign-in');
    }

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
          ...locals.user.settingsJson,
          theme
        },
        updatedAt: new Date()
      })
      .where(eq(users.id, locals.user.id))
      .run();

    locals.user.settingsJson = {
      ...locals.user.settingsJson,
      theme
    };
    locals.theme = theme;
    cookies.set(THEME_COOKIE_NAME, theme, THEME_COOKIE_OPTIONS);

    return {
      themeSaved: true
    };
  }
};
