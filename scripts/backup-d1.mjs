import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareBackupSql } from './backup-sql.mjs';
import Database from 'better-sqlite3';
import { tables, summarize } from './migration-data.mjs';

const [environment = 'production', bucket = process.env.R2_BACKUP_BUCKET] = process.argv.slice(2);
if (!['staging', 'production'].includes(environment) || !bucket) throw new Error('Usage: npm run backup -- production private-r2-bucket');
const date = new Date().toISOString().replaceAll(':', '-');
const path = resolve('backups', `${environment}-${date}.sql`);
mkdirSync(resolve('backups'), { recursive: true, mode: 0o700 });
const wrangler = resolve('node_modules/.bin/wrangler');
execFileSync(wrangler, ['d1', 'export', 'DB', '--remote', '--env', environment, '--output', path], { stdio: 'inherit' });
chmodSync(path, 0o600);
writeFileSync(path, prepareBackupSql(readFileSync(path, 'utf8')), { mode: 0o600 });
const checksum = createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync(`${path}.sha256`, `${checksum}\n`, { mode: 0o600 });
const snapshot = new Database(':memory:');
try {
  snapshot.exec(readFileSync(path, 'utf8'));
  const manifest = { formatVersion: 1, exportedAt: new Date().toISOString(), sha256: checksum, tables: {} };
  for (const table of tables) manifest.tables[table] = summarize(snapshot.prepare(`SELECT * FROM "${table}"`).all());
  writeFileSync(`${path}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
} finally { snapshot.close(); }
for (const suffix of ['', '.sha256', '.manifest.json']) {
  execFileSync(wrangler, ['r2', 'object', 'put', `${bucket}/${environment}/${date}.sql${suffix}`, '--file', `${path}${suffix}`, '--remote'], { stdio: 'inherit' });
}
console.log('Uploaded SQL backup, SHA-256 checksum and row verification manifest to private R2 storage.');
