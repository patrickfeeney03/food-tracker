import { SESSION_DURATION_MS } from './session';

export const SESSION_COOKIE_NAME = 'session';

export const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  maxAge: SESSION_DURATION_MS / 1000
};

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state';
export const GOOGLE_OAUTH_VERIFIER_COOKIE_NAME = 'google_oauth_code_verifier';
export const GOOGLE_OAUTH_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  maxAge: 10 * 60
};

/** Secure cookies on the actual HTTPS origin, including local production builds. */
export function sessionCookieOptions(requestUrl: URL) {
  return { ...SESSION_COOKIE_OPTIONS, secure: requestUrl.protocol === 'https:' };
}

export function googleOAuthCookieOptions(requestUrl: URL) {
  return { ...GOOGLE_OAUTH_COOKIE_OPTIONS, secure: requestUrl.protocol === 'https:' };
}
