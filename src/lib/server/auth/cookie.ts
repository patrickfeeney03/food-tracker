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
