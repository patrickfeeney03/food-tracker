import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tables, summarize } from './migration-data.mjs';

const [manifestPath, ...flags] = process.argv.slice(2);
if (!manifestPath || !flags.some((flag) => flag === '--local' || flag === '--remote')) {
  throw new Error('Usage: npm run db:verify -- backups/cutover.sql.manifest.json --remote --env staging');
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
function query(command) {
  const output = execFileSync(resolve('node_modules/.bin/wrangler'), ['d1', 'execute', 'DB', ...flags, '--command', command, '--json'], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
  const results = JSON.parse(output);
  if (results.some((result) => !result.success)) throw new Error('D1 verification query failed');
  return results.flatMap((result) => result.results ?? []);
}
for (const table of tables) {
  const summary = summarize(query(`SELECT * FROM "${table}" ORDER BY id`));
  const expected = manifest.tables[table];
  if (!expected || summary.count !== expected.count || summary.sha256 !== expected.sha256) {
    throw new Error(`Data mismatch in ${table}: expected ${expected?.count} rows, found ${summary.count}; content hash must also match`);
  }
  console.log(`${table}: ${summary.count} rows, contents verified`);
}
if (query('PRAGMA foreign_key_check').length) throw new Error('D1 foreign key check failed');
if (query('SELECT * FROM atomic_guards').length) throw new Error('D1 has unexpected committed assertion rows');
console.log('All rows verified, including nutrition values, relationships, sessions and offline mutation IDs.');
