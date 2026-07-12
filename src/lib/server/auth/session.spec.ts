import { describe, expect, it } from 'vitest';
import { hashSessionToken } from './session';

describe('hashSessionToken', () => {
  it('returns the same hash for the same token', () => {
    expect(hashSessionToken('secret-token')).toBe(
      hashSessionToken('secret-token')
    );
  });

  it('returns different hashes for different tokens', () => {
    expect(hashSessionToken('first-token')).not.toBe(
      hashSessionToken('second-token')
    );
  });

  it('returns a hexadecimal SHA-256 hash', () => {
    expect(hashSessionToken('secret-token')).toMatch(
      /^[a-f0-9]{64}$/
    );
  });
});
