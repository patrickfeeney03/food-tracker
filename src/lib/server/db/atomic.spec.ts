import { describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { atomicBatch } from './atomic';
import { createDatabase } from './testing';
import { atomicGuards, users } from './schema';

async function expectCauseToMatch(rejection: Promise<unknown>, pattern: RegExp): Promise<void> {
  const error = await rejection.then(
    () => { throw new Error('Expected the database operation to reject'); },
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(Error);
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage = cause instanceof Error ? cause.message : String(cause);
  expect(causeMessage).toMatch(pattern);
}

describe('D1 atomic batches', () => {
  it('rolls back earlier writes when a later statement fails', async () => {
    const connection = await createDatabase();
    try {
      const id = crypto.randomUUID();
      await expect(atomicBatch(connection.db, [], [
        connection.db.insert(users).values({ id, name: 'First', email: 'first@example.test' }),
        connection.db.insert(users).values({ id, name: 'Duplicate', email: 'duplicate@example.test' })
      ])).rejects.toThrow();
      expect(await connection.db.select().from(users).all()).toEqual([]);
      expect(await connection.db.select().from(atomicGuards).all()).toEqual([]);
    } finally {
      await connection.client.close();
    }
  });

  it('rejects a stale snapshot inside the batch and commits a current snapshot', async () => {
    const connection = await createDatabase();
    try {
      const id = crypto.randomUUID();
      await connection.db.insert(users).values({ id, name: 'Original', email: 'person@example.test' });
      await connection.db.update(users).set({ name: 'Concurrent edit' }).where(eq(users.id, id));
      const write = () => connection.db.update(users).set({ name: 'Overwrite' }).where(eq(users.id, id));
      await expectCauseToMatch(atomicBatch(connection.db, [
        sql`exists(select 1 from users where id = ${id} and name = 'Original')`
      ], [write()]), /atomic_guard_valid/);
      expect((await connection.db.select().from(users).where(eq(users.id, id)).get())?.name).toBe('Concurrent edit');
      await atomicBatch(connection.db, [
        sql`exists(select 1 from users where id = ${id} and name = 'Concurrent edit')`
      ], [write()]);
      expect((await connection.db.select().from(users).where(eq(users.id, id)).get())?.name).toBe('Overwrite');
      expect(await connection.db.select().from(atomicGuards).all()).toEqual([]);
    } finally {
      await connection.client.close();
    }
  });
});
