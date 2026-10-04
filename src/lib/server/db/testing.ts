import type { D1Database } from '@cloudflare/workers-types';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { createDatabase as connect, type AppDatabase } from './connection';
export type { AppDatabase } from './connection';

export interface DatabaseConnection {
  db: AppDatabase;
  binding: D1Database;
  client: { close(): Promise<void> };
}

/** Tests use the same D1 API and workerd SQLite implementation as Workers. */
export async function createDatabase(_filename?: string): Promise<DatabaseConnection> {
  void _filename;
  const runtime = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("D1 test runtime"); } };',
    compatibilityDate: '2026-07-30',
    d1Databases: { DB: crypto.randomUUID() }
  });
  try {
    const binding = await runtime.getD1Database('DB');
    const directory = resolve('migrations');
    for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
      const statements = readFileSync(resolve(directory, file), 'utf8')
        .split('--> statement-breakpoint')
        .flatMap((part) => part.split(';'))
        .map((statement) => statement.trim())
        .filter(Boolean);
      await binding.batch(statements.map((statement) => binding.prepare(statement)));
    }
    return {
      db: connect(binding as unknown as D1Database).db,
      binding: binding as unknown as D1Database,
      client: { close: () => runtime.dispose() }
    };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}

/** Compatibility for existing test setup; the factory already applies migrations. */
export async function migrate(_db: AppDatabase, _options?: unknown): Promise<void> { void _db; void _options; }
