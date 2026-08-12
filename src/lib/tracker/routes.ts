const foodLogPath = /^\/foods\/[^/]+\/log\/?$/;

export function isFoodLogPath(pathname: string): boolean {
  return foodLogPath.test(pathname);
}

/**
  * Can this pathname run locally from the client bundle and IndexedDB?
  */
export function isLocalTrackerPath(pathname: string): boolean {
  return pathname === '/' ||
    pathname === '/offline' ||
    pathname === '/foods' ||
    isFoodLogPath(pathname);
}
