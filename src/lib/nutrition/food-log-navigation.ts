const pendingFoodLogReturnKey = 'calorie-tracker.pending-food-log-return';
const diaryScrollKey = 'calorie-tracker.diary-scroll';
const foodsPopToDiaryKey = 'calorie-tracker.foods-pop-to-diary';

/**
 * Carry the q-free catalogue URL across history.back().
 * The amount route is destroyed before the catalogue can replace its old
 * search entry, so the target lives briefly in per-tab session storage.
 */
export function rememberPendingFoodLogReturn(target: string): void {
  if (typeof sessionStorage === 'undefined') return;

  sessionStorage.setItem(pendingFoodLogReturnKey, target);
}

export function consumePendingFoodLogReturn(): string | null {
  if (typeof sessionStorage === 'undefined') return null;

  const target = sessionStorage.getItem(pendingFoodLogReturnKey);
  sessionStorage.removeItem(pendingFoodLogReturnKey);
  return target;
}

type DiaryScroll = {
  date: string;
  y: number;
};

/** Remember where the diary was scrolled before a real page swap. */
export function rememberDiaryScroll(date: string, scrollY: number): void {
  if (typeof sessionStorage === 'undefined') return;

  const payload: DiaryScroll = { date, y: scrollY };
  sessionStorage.setItem(diaryScrollKey, JSON.stringify(payload));
}

/** Take the saved diary offset once, only when it belongs to this date. */
export function consumeDiaryScroll(date: string): number | null {
  if (typeof sessionStorage === 'undefined') return null;

  const raw = sessionStorage.getItem(diaryScrollKey);
  sessionStorage.removeItem(diaryScrollKey);
  if (raw === null) return null;

  try {
    const saved = JSON.parse(raw) as DiaryScroll;
    if (saved.date !== date || typeof saved.y !== 'number' || !Number.isFinite(saved.y)) {
      return null;
    }

    return saved.y;
  } catch {
    return null;
  }
}

/** Remember that this foods session can pop back to the originating diary. */
export function rememberFoodsCanPopToDiary(canPop: boolean): void {
  if (typeof sessionStorage === 'undefined') return;

  if (canPop) {
    sessionStorage.setItem(foodsPopToDiaryKey, '1');
    return;
  }

  sessionStorage.removeItem(foodsPopToDiaryKey);
}

export function readFoodsCanPopToDiary(): boolean {
  if (typeof sessionStorage === 'undefined') return false;

  return sessionStorage.getItem(foodsPopToDiaryKey) === '1';
}
