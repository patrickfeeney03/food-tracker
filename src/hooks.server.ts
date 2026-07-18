import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from '$lib/server/auth/cookie';
import { validateSessionToken } from '$lib/server/auth/session';
import { db } from '$lib/server/db';
import type { Theme } from '$lib/server/db/schema';
import type { Handle } from '@sveltejs/kit';

function getThemePreference(theme: Theme | undefined): Theme {
  return theme === 'light' || theme === 'dark' ? theme : 'system';
}

export const handle: Handle = async ({
  event,
  resolve
}) => {
  event.locals.user = null;
  event.locals.session = null;

  const token = event.cookies.get(
    SESSION_COOKIE_NAME
  );

  if (token !== undefined) {
    const result = validateSessionToken(
      db,
      token
    );

    event.locals.user = result.user;
    event.locals.session = result.session;

    if (result.session === null) {
      event.cookies.delete(SESSION_COOKIE_NAME, {
        path: '/'
      });
    } else {
      event.cookies.set(
        SESSION_COOKIE_NAME,
        token,
        SESSION_COOKIE_OPTIONS
      );
    }

  }
  const theme = getThemePreference(event.locals.user?.settingsJson.theme);
  const themeAttributes =
    theme === 'dark' ? 'data-theme="dark" class="dark"' : `data-theme="${theme}"`;

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('data-theme="system"', themeAttributes)
  });
};
