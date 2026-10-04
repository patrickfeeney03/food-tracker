import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions
} from '$lib/server/auth/cookie';
import { validateSessionToken } from '$lib/server/auth/session';
import { createDatabase } from '$lib/server/db/connection';
import { createRequestLogger } from '$lib/server/logging';
import {
  parseTheme,
  THEME_COOKIE_NAME,
  THEME_COOKIE_OPTIONS
} from '$lib/server/theme';
import { building } from '$app/environment';
import { isHttpError, isRedirect, redirect, type Handle } from '@sveltejs/kit';

const PUBLIC_ROUTES = new Set([
  '/sign-in',
  '/offline',
  '/auth/google',
  '/auth/google/callback',
  '/robots.txt'
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/_app/');
}

function readCorrelationId(request: Request): string {
  const value = request.headers.get('x-correlation-id');

  return value !== null && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
    ? value
    : crypto.randomUUID();
}

function actionName(request: Request): string | null {
  const url = new URL(request.url);
  const key = [...url.searchParams.keys()].find((name) => name.startsWith('/'));
  return key?.slice(1) || null;
}

const handleRequest: Handle = async ({
  event,
  resolve
}) => {
  event.locals.user = null;
  event.locals.session = null;
  event.locals.correlationId = readCorrelationId(event.request);
  event.locals.log = createRequestLogger(
    event.locals.correlationId,
    () => ({ userId: event.locals.user?.id ?? null })
  );
  event.setHeaders({
    'x-correlation-id': event.locals.correlationId
  });

  const offlinePrerender = building && event.url.pathname === '/offline';
  if (!offlinePrerender) {
    if (!event.platform?.env?.DB) throw new Error('Cloudflare D1 binding DB is unavailable');
    event.locals.db = createDatabase(event.platform.env.DB).db;
  }

  const token = event.cookies.get(
    SESSION_COOKIE_NAME
  );

  if (!offlinePrerender && token !== undefined) {
    const result = await validateSessionToken(
      event.locals.db,
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
        sessionCookieOptions(event.url)
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

  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('data-theme="system"', themeAttributes)
  });
  if (event.locals.user !== null || event.url.pathname.startsWith('/auth/') || event.url.pathname === '/sign-in') {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
};

export const handle: Handle = async ({ event, resolve }) => {
  const startedAt = performance.now();
  const request = {
    method: event.request.method,
    path: event.url.pathname,
    route: event.route.id,
    action: actionName(event.request),
    foodId: event.params.foodId,
    diaryEntryId: event.params.entryId,
    shortcutId: event.params.shortcutId
  };

  try {
    const response = await handleRequest({ event, resolve });
    response.headers.set('x-correlation-id', event.locals.correlationId);

    event.locals.log.info('request.completed', {
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      ...request
    });

    return response;
  } catch (error) {
    if (isRedirect(error)) {
      event.locals.log.info('request.completed', {
        status: error.status,
        durationMs: Math.round(performance.now() - startedAt),
        ...request
      });

      return new Response(null, {
        status: error.status,
        headers: {
          location: error.location,
          'x-correlation-id': event.locals.correlationId,
          'Cache-Control': 'private, no-store'
        }
      });
    }

    if (isHttpError(error)) {
      event.locals.log.info('request.completed', {
        status: error.status,
        durationMs: Math.round(performance.now() - startedAt),
        ...request
      });
    } else {
      event.locals.log.error('request.failed', error, {
        durationMs: Math.round(performance.now() - startedAt),
        ...request
      });
    }

    throw error;
  }
};
