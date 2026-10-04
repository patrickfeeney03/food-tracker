import { eq, sql, type SQL } from 'drizzle-orm';
import type { BatchItem, BatchResponse } from 'drizzle-orm/batch';
import type { AppDatabase } from './connection';
import { atomicGuards } from './schema';

/** Revalidate snapshots inside the same transaction as their writes.
 * A failed CHECK rolls back the entire D1 batch. Successful assertion rows
 * are removed before commit.
 */
export async function atomicBatch<T extends [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]>(
  db: AppDatabase,
  guards: SQL[],
  writes: T
): Promise<BatchResponse<T>> {
  const operationId = crypto.randomUUID();
  const checks = guards.map((predicate) => db.insert(atomicGuards).values({
    operationId,
    valid: sql`case when (${predicate}) then 1 else 0 end`
  }));
  const queries = [
    ...checks,
    ...writes,
    db.delete(atomicGuards).where(eq(atomicGuards.operationId, operationId))
  ];
  const results = await db.batch([queries[0]!, ...queries.slice(1)]);
  return results.slice(checks.length, checks.length + writes.length) as BatchResponse<T>;
}

export function isAtomicGuardError(error: unknown): boolean {
  return error instanceof Error && /atomic_guard_valid/.test(error.message + String(error.cause));
}

export function isConstraintError(error: unknown): boolean {
  return error instanceof Error && /(?:SQLITE_CONSTRAINT|constraint failed)/i.test(
    error.message + String(error.cause)
  );
}
