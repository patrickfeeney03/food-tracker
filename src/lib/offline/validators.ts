import type {
  OfflineDiaryDay,
  TrackerSnapshot
} from './types';

function isDiaryDay(value: unknown, date: string): value is OfflineDiaryDay {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<OfflineDiaryDay>;

  return candidate.date === date &&
    typeof candidate.meals === 'object' &&
    candidate.meals !== null &&
    typeof candidate.totals === 'object' &&
    candidate.totals !== null;
}

export function isTrackerSnapshot(value: unknown): value is TrackerSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<TrackerSnapshot>;

  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.savedAt !== 'number' ||
    typeof candidate.user?.id !== 'string' ||
    typeof candidate.user.name !== 'string' ||
    typeof candidate.diaryDays !== 'object' ||
    candidate.diaryDays === null ||
    !Array.isArray(candidate.foods)
  ) {
    return false;
  }

  const entries = Object.entries(candidate.diaryDays);

  return entries.length === 11 &&
    entries.every(([date, diary]) => isDiaryDay(diary, date));
}
