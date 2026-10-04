import type { D1Database } from '@cloudflare/workers-types';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type AppDatabase = DrizzleD1Database<typeof schema>;
export type ReadDatabase = Pick<AppDatabase, 'select'>;
export interface DatabaseConnection { client: D1Database; db: AppDatabase; }

/** A database belongs to the current Worker request and its environment. */
export function createDatabase(binding: D1Database): DatabaseConnection {
  if (!binding) throw new Error('The Cloudflare DB binding is missing');
  return { client: binding, db: drizzle(binding, { schema }) };
}
