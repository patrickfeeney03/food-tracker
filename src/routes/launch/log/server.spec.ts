import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

function invokeLauncher(mealSlot: string) {
  return GET({
    url: new URL(`https://calories.test/launch/log?mealSlot=${mealSlot}`)
  } as Parameters<typeof GET>[0]);
}

describe('launcher log shortcut', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['breakfast', 'lunch', 'dinner', 'snacks'])(
    'redirects %s to today\'s Add Food flow',
    (mealSlot) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));

      expect(() => invokeLauncher(mealSlot)).toThrowError(
        expect.objectContaining({
          status: 303,
          location: `/foods?date=2026-07-23&mealSlot=${mealSlot}`
        })
      );
    }
  );

  it('rejects an invalid meal slot', () => {
    expect(() => invokeLauncher('invalid')).toThrowError(
      expect.objectContaining({
        status: 400,
        body: {
          message: 'Invalid launcher destination'
        }
      })
    );
  });
});
