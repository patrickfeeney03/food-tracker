import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { Google } from 'arctic';

const GOOGLE_CALLBACK_PATH = '/auth/google/callback';

function requireEnvironmentVariable(
  name: string,
  value: string | undefined
): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function getGoogleRedirectUri(requestUrl?: URL): string {
  if (dev) {
    if (requestUrl === undefined) {
      throw new Error('A request URL is required during development');
    }

    return new URL(GOOGLE_CALLBACK_PATH, requestUrl).toString();
  }

  return requireEnvironmentVariable(
    'GOOGLE_REDIRECT_URI',
    env.GOOGLE_REDIRECT_URI
  );
}

export function createGoogleOAuthClient(requestUrl?: URL): Google {
  return new Google(
    requireEnvironmentVariable(
      'GOOGLE_CLIENT_ID',
      env.GOOGLE_CLIENT_ID
    ),
    requireEnvironmentVariable(
      'GOOGLE_CLIENT_SECRET',
      env.GOOGLE_CLIENT_SECRET
    ),
    getGoogleRedirectUri(requestUrl)
  );
}

export function getAllowedGoogleEmails(): string[] {
  const allowedEmails = requireEnvironmentVariable(
    'GOOGLE_ALLOWED_EMAILS',
    env.GOOGLE_ALLOWED_EMAILS
  )
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== '');

  if (allowedEmails.length === 0) {
    throw new Error('GOOGLE_ALLOWED_EMAILS must contain at least one email');
  }

  return allowedEmails;
}
