const pendingFoodLogReturnKey = 'calorie-tracker.pending-food-log-return';

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
