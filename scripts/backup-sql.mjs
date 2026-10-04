import Database from 'better-sqlite3';
import { tables, sqlValue } from './migration-data.mjs';

// Wrangler's raw export interleaves CREATE and INSERT in alphabetical order.
// SQLite can load it with foreign keys disabled; D1 cannot disable them.
// Reorder one coherent export so all parent tables exist before any inserts.
/** @param {string} exportedSql */
export function prepareBackupSql(exportedSql) {
  const database = new Database(':memory:');
  try {
    database.pragma('foreign_keys = OFF');
    database.exec(exportedSql);
    const foreignKeyErrors = database.pragma('foreign_key_check');
    if (database.pragma('quick_check', { simple: true }) !== 'ok' || !Array.isArray(foreignKeyErrors) || foreignKeyErrors.length) {
      throw new Error('Exported backup failed integrity checks');
    }
    const schema = /** @type {Array<{type: string, name: string, sql: string}>} */ (database.prepare("SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name").all());
    const tableRows = schema.filter((row) => row.type === 'table');
    const order = [...tables, 'atomic_guards', 'd1_migrations'];
    tableRows.sort((left, right) => {
      /** @param {string} name */
      const rank = (name) => order.includes(name) ? order.indexOf(name) : order.length;
      return rank(left.name) - rank(right.name);
    });
    /** @param {string} name */
    const quote = (name) => `"${name.replaceAll('"', '""')}"`;
    const statements = ['PRAGMA defer_foreign_keys = ON;', ...tableRows.map((row) => `${row.sql};`)];
    statements.push(...schema.filter((row) => row.type === 'index').map((row) => `${row.sql};`));
    for (const table of tableRows) {
      for (const row of /** @type {Array<Record<string, unknown>>} */ (database.prepare(`SELECT * FROM ${quote(table.name)}`).all())) {
        const columns = Object.keys(row);
        statements.push(`INSERT INTO ${quote(table.name)} (${columns.map(quote).join(',')}) VALUES (${columns.map((column) => sqlValue(row[column])).join(',')});`);
      }
    }
    statements.push('PRAGMA defer_foreign_keys = OFF;');
    return `${statements.join('\n')}\n`;
  } finally { database.close(); }
}
