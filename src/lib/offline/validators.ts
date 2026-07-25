import type { OfflineBootstrap } from './types';

export function isOfflineBootstrap(value: unknown): value is OfflineBootstrap {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<OfflineBootstrap>;

  return candidate.schemaVersion === 1 &&
    typeof candidate.savedAt === 'number' &&
    typeof candidate.user?.id === 'string' &&
    typeof candidate.user.name === 'string' &&
    typeof candidate.diary?.date === 'string' &&
    Array.isArray(candidate.foods);
}
