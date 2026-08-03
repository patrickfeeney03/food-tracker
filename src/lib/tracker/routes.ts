const foodLogPath = /^\/foods\/[^/]+\/log\/?$/;

/**
  * Can this pathname run locally from the client bundle and IndexedDB?
  */
export function isLocalTrackerPath(pathname: string): boolean {
  return pathname === '/' ||
    pathname === '/offline' ||
    pathname === '/foods' ||
    foodLogPath.test(pathname);
}
