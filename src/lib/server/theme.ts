import { dev } from '$app/environment';
import { themes, type Theme } from '$lib/server/db/schema';

export const THEME_COOKIE_NAME = 'theme';
export const THEME_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: !dev,
  maxAge: 365 * 24 * 60 * 60
};

export function parseTheme(value: unknown): Theme {
  return typeof value === 'string' && themes.some((theme) => theme === value)
    ? (value as Theme)
    : 'system';
}
