import { env } from '$env/dynamic/private';
import { Google } from 'arctic';

function requireEnvironmentVariable(
  name: string,
  value: string | undefined
): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function createGoogleOAuthClient(): Google {
  return new Google(
    requireEnvironmentVariable(
      'GOOGLE_CLIENT_ID',
      env.GOOGLE_CLIENT_ID
    ),
    requireEnvironmentVariable(
      'GOOGLE_CLIENT_SECRET',
      env.GOOGLE_CLIENT_SECRET
    ),
    requireEnvironmentVariable(
      'GOOGLE_REDIRECT_URI',
      env.GOOGLE_REDIRECT_URI
    )
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
