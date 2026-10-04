import { googleOAuthCookieOptions, GOOGLE_OAUTH_STATE_COOKIE_NAME, GOOGLE_OAUTH_VERIFIER_COOKIE_NAME } from "$lib/server/auth/cookie";
import { createGoogleOAuthClient } from "$lib/server/auth/google";
import { error, redirect, type RequestHandler } from "@sveltejs/kit";
import { generateCodeVerifier, generateState } from "arctic";

export const GET: RequestHandler = async ({
  cookies,
  locals,
  url,
  platform
}) => {
  if (locals.user !== null) {
    return redirect(303, '/');
  }
  if (platform === undefined) return error(503, 'Authentication configuration is unavailable');

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const cookieOptions = googleOAuthCookieOptions(url);

  const authorizationUrl =
    createGoogleOAuthClient(platform.env, url)
      .createAuthorizationURL(
        state,
        codeVerifier,
        ['openid', 'profile', 'email']
      );

  cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE_NAME,
    state,
    cookieOptions
  );

  cookies.set(
    GOOGLE_OAUTH_VERIFIER_COOKIE_NAME,
    codeVerifier,
    cookieOptions
  );

  return redirect(302, authorizationUrl);
}
