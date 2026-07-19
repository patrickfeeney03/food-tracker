import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const workspace = process.cwd();
const allowedDirectory = resolve(workspace, '.playwright');
const databasePath = resolve(process.env.DATABASE_URL ?? '');

if (dirname(databasePath) !== allowedDirectory || basename(databasePath) !== 'e2e.db') {
  throw new Error(`Refusing to prepare an E2E database outside ${allowedDirectory}`);
}

mkdirSync(allowedDirectory, { recursive: true });
for (const filename of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
  rmSync(filename, { force: true });
}

const sqlite = new Database(databasePath);
try {
  migrate(drizzle(sqlite), { migrationsFolder: resolve(workspace, 'drizzle') });
} finally {
  sqlite.close();
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(
  npmCommand,
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'],
  { env: process.env, stdio: 'inherit' }
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    if (!server.killed) server.kill(signal);
  });
}

server.once('exit', (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
