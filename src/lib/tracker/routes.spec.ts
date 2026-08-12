import { describe, expect, it } from 'vitest';
import { isFoodLogPath, isLocalTrackerPath } from './routes';

describe('local tracker route policy', () => {
  it.each([
    '/',
    '/offline',
    '/foods',
    '/foods/food-id/log',
    '/foods/food-id/log/'
  ])('keeps %s local', (pathname) => {
    expect(isLocalTrackerPath(pathname)).toBe(true);
  });

  it.each([
    '/settings',
    '/foods/new',
    '/foods/food-id/edit',
    '/meal-shortcuts/new'
  ])('keeps %s server-backed', (pathname) => {
    expect(isLocalTrackerPath(pathname)).toBe(false);
  });

  it('identifies amount-adjuster log routes', () => {
    expect(isFoodLogPath('/foods/food-id/log')).toBe(true);
    expect(isFoodLogPath('/foods')).toBe(false);
  });
});
