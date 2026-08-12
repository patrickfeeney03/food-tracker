import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeDiaryScroll,
  readFoodsCanPopToDiary,
  rememberDiaryScroll,
  rememberFoodsCanPopToDiary
} from './food-log-navigation';

function stubSessionStorage() {
  const store = new Map<string, string>();

  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  });

  return store;
}

describe('diary scroll memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the saved offset for the matching date once', () => {
    stubSessionStorage();
    rememberDiaryScroll('2026-07-18', 640);

    expect(consumeDiaryScroll('2026-07-18')).toBe(640);
    expect(consumeDiaryScroll('2026-07-18')).toBeNull();
  });

  it('ignores a saved offset for a different date', () => {
    stubSessionStorage();
    rememberDiaryScroll('2026-07-18', 640);

    expect(consumeDiaryScroll('2026-07-19')).toBeNull();
    expect(consumeDiaryScroll('2026-07-18')).toBeNull();
  });

  it('ignores a corrupt payload', () => {
    const store = stubSessionStorage();
    store.set('calorie-tracker.diary-scroll', '{not-json');

    expect(consumeDiaryScroll('2026-07-18')).toBeNull();
  });

  it('remembers whether foods can pop back to the diary', () => {
    stubSessionStorage();

    expect(readFoodsCanPopToDiary()).toBe(false);
    rememberFoodsCanPopToDiary(true);
    expect(readFoodsCanPopToDiary()).toBe(true);
    rememberFoodsCanPopToDiary(false);
    expect(readFoodsCanPopToDiary()).toBe(false);
  });
});
