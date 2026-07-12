import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS
} from '$lib/server/auth/cookie';
import { validateSessionToken } from "$lib/server/auth/session";
import { db } from "$lib/server/db";
import type { Handle } from "@sveltejs/kit";

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
  return resolve(event);
};
