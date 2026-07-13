import { dev } from '$app/environment';
import { SESSION_DURATION_MS } from './session';

export const SESSION_COOKIE_NAME = 'session';

export const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: !dev,
  maxAge: SESSION_DURATION_MS / 1000
};

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state';
export const GOOGLE_OAUTH_VERIFIER_COOKIE_NAME = 'google_oauth_code_verifier';
export const GOOGLE_OAUTH_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: !dev,
  maxAge: 10 * 60
};

