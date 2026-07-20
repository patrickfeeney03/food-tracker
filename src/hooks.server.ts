import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from '$lib/server/auth/cookie';
import { validateSessionToken } from '$lib/server/auth/session';
import { db } from '$lib/server/db';
import {
  parseTheme,
  THEME_COOKIE_NAME,
  THEME_COOKIE_OPTIONS
} from '$lib/server/theme';
import { redirect, type Handle } from '@sveltejs/kit';

const PUBLIC_ROUTES = new Set([
  '/sign-in',
  '/auth/google',
  '/auth/google/callback',
  '/robots.txt'
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/_app/');
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
  const cookieTheme = parseTheme(event.cookies.get(THEME_COOKIE_NAME));
  const theme =
    event.locals.user === null
      ? cookieTheme
      : parseTheme(event.locals.user.settingsJson.theme);

  event.locals.theme = theme;

  if (event.locals.user !== null && cookieTheme !== theme) {
    event.cookies.set(THEME_COOKIE_NAME, theme, THEME_COOKIE_OPTIONS);
  }

  if (event.locals.user === null && !isPublicPath(event.url.pathname)) {
    return redirect(303, '/sign-in');
  }

  const themeAttributes =
    theme === 'dark' ? 'data-theme="dark" class="dark"' : `data-theme="${theme}"`;

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('data-theme="system"', themeAttributes)
  });
};
