import { GOOGLE_OAUTH_COOKIE_OPTIONS, GOOGLE_OAUTH_STATE_COOKIE_NAME, GOOGLE_OAUTH_VERIFIER_COOKIE_NAME } from "$lib/server/auth/cookie";
import { createGoogleOAuthClient } from "$lib/server/auth/google";
import { redirect, type RequestHandler } from "@sveltejs/kit";
import { generateCodeVerifier, generateState } from "arctic";

export const GET: RequestHandler = ({
  cookies,
  locals
}) => {
  if (locals.user !== null) {
    return redirect(303, '/');
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const authorizationUrl =
    createGoogleOAuthClient()
      .createAuthorizationURL(
        state,
        codeVerifier,
        ['openid', 'profile', 'email']
      );

  cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE_NAME,
    state,
    GOOGLE_OAUTH_COOKIE_OPTIONS
  );

  cookies.set(
    GOOGLE_OAUTH_VERIFIER_COOKIE_NAME,
    codeVerifier,
    GOOGLE_OAUTH_COOKIE_OPTIONS
  );

  return redirect(302, authorizationUrl);
}
