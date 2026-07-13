import { describe, expect, it } from 'vitest';
import { parseGoogleUserInfo } from './google-user-info';

describe('parseGoogleUserInfo', () => {
  it('maps verified Google user information', () => {
    expect(
      parseGoogleUserInfo({
        sub: 'google-subject',
        email: 'patrick@example.com',
        email_verified: true,
        name: 'Patrick'
      })
    ).toEqual({
      subject: 'google-subject',
      email: 'patrick@example.com',
      name: 'Patrick'
    });
  });

  it('uses the email when the name is absent', () => {
    expect(
      parseGoogleUserInfo({
        sub: 'google-subject',
        email: 'patrick@example.com',
        email_verified: true
      })
    ).toEqual({
      subject: 'google-subject',
      email: 'patrick@example.com',
      name: 'patrick@example.com'
    });
  });

  it('rejects an unverified email', () => {
    expect(() =>
      parseGoogleUserInfo({
        sub: 'google-subject',
        email: 'patrick@example.com',
        email_verified: false,
        name: 'Patrick'
      })
    ).toThrow();
  });

  it('rejects malformed identity information', () => {
    expect(() =>
      parseGoogleUserInfo({
        sub: '',
        email: 'not-an-email',
        email_verified: true
      })
    ).toThrow();
  });
});
