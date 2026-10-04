import { createHash } from 'node:crypto';

// Parent rows precede children; importing into a migrated empty D1 database
// preserves foreign keys, sessions, and offline mutation IDs.
export const tables = ['users', 'auth_accounts', 'sessions', 'nutrition_goals', 'foods',
  'meal_shortcuts', 'meal_shortcut_items', 'meal_shortcut_applications', 'diary_logs'];
/** @param {Array<Record<string, unknown>>} rows */
export function canonicalRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.keys(row).sort().map((key) => [key, row[key]])))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}
/** @param {Array<Record<string, unknown>>} rows */
export function summarize(rows) {
  return { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(canonicalRows(rows))).digest('hex') };
}
/** @param {unknown} value */
export function sqlValue(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('Migration encountered an unsafe integer');
    return String(value);
  }
  if (typeof value !== 'string') throw new Error('Migration encountered an unsupported SQLite value');
  return `'${value.replaceAll("'", "''")}'`;
}
