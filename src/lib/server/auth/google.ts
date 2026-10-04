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

export interface GoogleAuthConfig {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_ALLOWED_EMAILS: string;
}

export function getGoogleRedirectUri(config: GoogleAuthConfig, requestUrl?: URL): string {
  if (config.GOOGLE_REDIRECT_URI.trim() === '' && requestUrl !== undefined) {
    return new URL(GOOGLE_CALLBACK_PATH, requestUrl).toString();
  }
  return requireEnvironmentVariable(
    'GOOGLE_REDIRECT_URI',
    config.GOOGLE_REDIRECT_URI
  );
}

export function createGoogleOAuthClient(config: GoogleAuthConfig, requestUrl?: URL): Google {
  return new Google(
    requireEnvironmentVariable(
      'GOOGLE_CLIENT_ID',
      config.GOOGLE_CLIENT_ID
    ),
    requireEnvironmentVariable(
      'GOOGLE_CLIENT_SECRET',
      config.GOOGLE_CLIENT_SECRET
    ),
    getGoogleRedirectUri(config, requestUrl)
  );
}

export function getAllowedGoogleEmails(config: GoogleAuthConfig): string[] {
  const allowedEmails = requireEnvironmentVariable(
    'GOOGLE_ALLOWED_EMAILS',
    config.GOOGLE_ALLOWED_EMAILS
  )
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== '');

  if (allowedEmails.length === 0) {
    throw new Error('GOOGLE_ALLOWED_EMAILS must contain at least one email');
  }

  return allowedEmails;
}
