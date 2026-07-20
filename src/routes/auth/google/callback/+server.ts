import { GOOGLE_OAUTH_COOKIE_OPTIONS, GOOGLE_OAUTH_STATE_COOKIE_NAME, GOOGLE_OAUTH_VERIFIER_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "$lib/server/auth/cookie";
import { createGoogleOAuthClient, getAllowedGoogleEmail } from "$lib/server/auth/google";
import { findOrCreateGoogleUser, GoogleEmailNotAllowedError } from "$lib/server/auth/google-user";
import { parseGoogleUserInfo } from "$lib/server/auth/google-user-info";
import { createSession } from "$lib/server/auth/session";
import { db } from "$lib/server/db";
import { error, redirect, type RequestHandler } from "@sveltejs/kit";

const GOOGLE_USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export const GET: RequestHandler = async ({
  cookies,
  fetch,
  locals,
  request,
  url
}) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const providerError = url.searchParams.get('error');
  const storedState = cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME);
  const codeVerifier = cookies.get(GOOGLE_OAUTH_VERIFIER_COOKIE_NAME);

  cookies.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME, {
    path: GOOGLE_OAUTH_COOKIE_OPTIONS.path
  });
  cookies.delete(GOOGLE_OAUTH_VERIFIER_COOKIE_NAME, {
    path: GOOGLE_OAUTH_COOKIE_OPTIONS.path
  });

  if (providerError !== null) {
    return redirect(303, '/sign-in?error=oauth');
  }

  if (
    code === null ||
    state === null ||
    storedState === undefined ||
    state !== storedState ||
    codeVerifier === undefined
  ) {
    return error(400, 'Invalid OAuth callback');
  }

  try {
    const tokens = await createGoogleOAuthClient()
      .validateAuthorizationCode(
        code,
        codeVerifier
      );

    const response = await fetch(GOOGLE_USER_INFO_URL, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(
        `Google user-info request failed with status ${response.status}`
      );
    }

    const identity = parseGoogleUserInfo(
      await response.json()
    );
    const user = findOrCreateGoogleUser(
      db,
      identity,
      getAllowedGoogleEmail()
    );
    const { token, session } = createSession(
      db,
      user.id,
      request.headers.get('user-agent')
    );

    locals.log.info('auth.signed_in', {
      userId: user.id,
      sessionId: session.id,
      provider: 'google'
    });

    cookies.set(
      SESSION_COOKIE_NAME,
      token,
      SESSION_COOKIE_OPTIONS
    );
  } catch (error) {
    if (error instanceof GoogleEmailNotAllowedError) {
      locals.log.info('auth.sign_in_denied', {
        provider: 'google',
        reason: 'email_not_allowed'
      });

      return redirect(
        303,
        '/sign-in?error=access_denied'
      );
    }

    locals.log.error('auth.sign_in_failed', error, {
      provider: 'google'
    });
    return redirect(303, '/sign-in?error=oauth');
  }

  return redirect(303, '/');
};
