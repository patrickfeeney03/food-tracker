import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { tables, summarize } from './migration-data.mjs';

const [key, bucket = 'food-tracker-backups'] = process.argv.slice(2);
if (!key || !key.endsWith('.sql') || key.includes('..')) throw new Error('Usage: npm run backup:verify -- production/backup-date.sql [bucket]');
const wrangler = resolve('node_modules/.bin/wrangler');
const run = (args, capture = false) => execFileSync(wrangler, args, capture ? { encoding: 'utf8' } : { stdio: 'inherit' });
const directory = resolve('backups', `restore-${Date.now()}`);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const sqlPath = resolve(directory, 'backup.sql');
const manifestPath = `${sqlPath}.manifest.json`;
for (const suffix of ['', '.manifest.json']) {
  run(['r2', 'object', 'get', `${bucket}/${key}${suffix}`, '--remote', '--file', `${sqlPath}${suffix}`]);
  chmodSync(`${sqlPath}${suffix}`, 0o600);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (createHash('sha256').update(readFileSync(sqlPath)).digest('hex') !== manifest.sha256) throw new Error('R2 SQL checksum does not match manifest');
const verificationPath = `${manifestPath}.verification.json`;
if (!manifest.tables) {
  // Scheduled exports store counts. Derive exact row hashes from the checksum-
  // verified SQL so restoring also checks every column, beyond the row count.
  const snapshot = new Database(':memory:');
  try {
    snapshot.exec(readFileSync(sqlPath, 'utf8'));
    manifest.tables = {};
    for (const table of tables) {
      const summary = summarize(snapshot.prepare(`SELECT * FROM "${table}"`).all());
      if (summary.count !== manifest.counts?.[table]) throw new Error(`Backup count mismatch in ${table}`);
      manifest.tables[table] = summary;
    }
  } finally { snapshot.close(); }
}
writeFileSync(verificationPath, JSON.stringify(manifest), { mode: 0o600 });
const name = `food-tracker-restore-${Date.now()}`;
const creation = run(['d1', 'create', name, '--location', 'weur'], true);
const id = /"database_id": "([^"]+)"/.exec(creation)?.[1];
if (!id) throw new Error(`Could not read disposable database ID for ${name}`);
try {
  const config = resolve(directory, 'wrangler.json');
  writeFileSync(config, JSON.stringify({ name, d1_databases: [{ binding: 'DB', database_name: name, database_id: id }] }), { mode: 0o600 });
  run(['d1', 'execute', 'DB', '--remote', '--config', config, '--file', sqlPath]);
  execFileSync(process.execPath, ['scripts/verify-d1.mjs', verificationPath, '--remote', '--config', config], { stdio: 'inherit' });
  console.log('Private R2 backup restored into disposable D1; every application row and foreign key verified.');
} finally { run(['d1', 'delete', name, '--skip-confirmation']); }
