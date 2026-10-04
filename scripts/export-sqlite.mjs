import Database from 'better-sqlite3';
import { mkdir, writeFile, chmod, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tables, summarize, sqlValue } from './migration-data.mjs';

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error('Usage: npm run db:export:sqlite -- /path/prod.db backups/cutover.sql');
const output = resolve(outputPath);
const snapshotPath = `${output}.snapshot.db`;
await mkdir(dirname(output), { recursive: true });
const snapshotFile = await open(snapshotPath, 'wx', 0o600);
await snapshotFile.close();
const source = new Database(resolve(sourcePath), { readonly: true, fileMustExist: true });
try {
  // The SQLite backup API includes committed WAL data and gives a coherent snapshot.
  await source.backup(snapshotPath);
  await chmod(snapshotPath, 0o600);
} finally { source.close(); }
const snapshot = new Database(snapshotPath, { readonly: true });
try {
  if (snapshot.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('SQLite integrity check failed');
  if (snapshot.pragma('foreign_key_check').length) throw new Error('SQLite contains invalid foreign keys');
  const manifest = { formatVersion: 1, exportedAt: new Date().toISOString(), tables: {} };
  const statements = ['-- Data only. Apply migrations to an EMPTY D1 database before importing.', 'PRAGMA defer_foreign_keys = ON;'];
  for (const table of tables) {
    const rows = snapshot.prepare(`SELECT * FROM "${table}" ORDER BY id`).all();
    manifest.tables[table] = summarize(rows);
    for (const row of rows) {
      const columns = Object.keys(row);
      statements.push(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map((column) => sqlValue(row[column])).join(',')});`);
    }
  }
  statements.push('PRAGMA defer_foreign_keys = OFF;');
  await writeFile(output, `${statements.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
  await writeFile(`${output}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`Consistent snapshot: ${snapshotPath}\nD1 import: ${output}\nVerification manifest: ${output}.manifest.json`);
} finally { snapshot.close(); }
