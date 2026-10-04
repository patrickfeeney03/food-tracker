import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

const tables = ['users', 'auth_accounts', 'sessions', 'nutrition_goals', 'foods',
  'meal_shortcuts', 'meal_shortcut_items', 'meal_shortcut_applications', 'diary_logs',
  'atomic_guards', 'd1_migrations'];
const quotedTables = tables.map((name) => `'${name}'`).join(',');

function sqlValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  throw new Error('Unsupported backup SQL value');
}

export async function backupDatabase(env: { DB: D1Database; BACKUPS: R2Bucket }, now = new Date()) {
  // One D1 batch snapshots both schema and every application table atomically.
  const results = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(`SELECT type, name, sql FROM sqlite_master WHERE tbl_name IN (${quotedTables}) AND type IN ('table','index') AND sql IS NOT NULL ORDER BY type DESC, name`),
    ...tables.map((name) => env.DB.prepare(`SELECT * FROM "${name}"`))
  ]);
  const sql = ['PRAGMA defer_foreign_keys = ON;'];
  const schema = results[0].results as { type: string; name: string; sql: string }[];
  for (const row of schema.filter((row) => row.type === 'table')) sql.push(`${row.sql};`);
  // Composite foreign keys need their parent UNIQUE indexes before any inserts.
  for (const row of schema.filter((row) => row.type === 'index')) sql.push(`${row.sql};`);
  const counts: Record<string, number> = {};
  tables.forEach((name, index) => {
    const rows = results[index + 1].results;
    if (name === 'atomic_guards' && rows.length > 0) throw new Error('Committed D1 guard rows detected');
    counts[name] = rows.length;
    for (const row of rows) {
      const columns = Object.keys(row);
      sql.push(`INSERT INTO "${name}" (${columns.map((key) => `"${key}"`).join(',')}) VALUES (${columns.map((key) => sqlValue(row[key])).join(',')});`);
    }
  });
  sql.push('PRAGMA defer_foreign_keys = OFF;');
  const content = `${sql.join('\n')}\n`;
  const bytes = new TextEncoder().encode(content);
  // This direct-binding backup is for this small app. Use the CLI full export
  // if its tables approach D1 query/result limits; fail visibly instead of truncating.
  if (bytes.length > 16 * 1024 * 1024) throw new Error('Use a CLI D1 export for backups larger than 16 MiB');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `production/${now.toISOString().replaceAll(':', '-')}.sql`;
  await env.BACKUPS.put(key, content, { httpMetadata: { contentType: 'application/sql' }, customMetadata: { sha256: checksum } });
  await env.BACKUPS.put(`${key}.manifest.json`, JSON.stringify({ createdAt: now.toISOString(), sha256: checksum, counts }), { httpMetadata: { contentType: 'application/json' } });
  console.log(JSON.stringify({ event: 'backup.completed', key, bytes: bytes.length, counts }));
  return { key, checksum, counts };
}

export default {
  async scheduled(_controller: unknown, env: { DB: D1Database; BACKUPS: R2Bucket }) {
    await backupDatabase(env);
  }
};
