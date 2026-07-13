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

export function getAllowedGoogleEmail(): string {
  return requireEnvironmentVariable(
    'GOOGLE_ALLOWED_EMAIL',
    env.GOOGLE_ALLOWED_EMAIL
  )
    .trim()
    .toLowerCase();
}
