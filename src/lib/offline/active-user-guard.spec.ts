import { describe, expect, it } from 'vitest';
import { isStaleOfflineUser } from './active-user-guard';

describe('isStaleOfflineUser', () => {
  it('is false when session user is unknown', () => {
    expect(isStaleOfflineUser(undefined, 'user-1')).toBe(false);
    expect(isStaleOfflineUser('', 'user-1')).toBe(false);
  });

  it('is false when there is no offline user', () => {
    expect(isStaleOfflineUser('user-1', null)).toBe(false);
    expect(isStaleOfflineUser('user-1', undefined)).toBe(false);
    expect(isStaleOfflineUser('user-1', '')).toBe(false);
  });

  it('is false when session and offline user match', () => {
    expect(isStaleOfflineUser('user-1', 'user-1')).toBe(false);
  });

  it('is true when session and offline user differ', () => {
    expect(isStaleOfflineUser('user-2', 'user-1')).toBe(true);
  });
});
