import { describe, expect, it } from 'vitest';
import { parseTheme } from './theme';

describe('parseTheme', () => {
  it.each(['light', 'dark', 'system'] as const)(
    'accepts the %s preference',
    (theme) => {
      expect(parseTheme(theme)).toBe(theme);
    }
  );

  it.each([undefined, null, '', 'midnight', 1])(
    'falls back to system for %j',
    (theme) => {
      expect(parseTheme(theme)).toBe('system');
    }
  );
});
