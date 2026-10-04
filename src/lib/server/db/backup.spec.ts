import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Miniflare } from 'miniflare';
import type { R2Bucket } from '@cloudflare/workers-types';
import { backupDatabase } from '../../../../workers/backup';
import { createDatabase } from './testing';
import { users, foods } from './schema';
import { createMealShortcut } from '../nutrition/meal-shortcut';
import { prepareBackupSql } from '../../../../scripts/backup-sql.mjs';

// Exercise real D1/R2 bindings and restore the exported SQL into empty SQLite.
describe('scheduled backups', () => {
  it('keeps schema, migration baseline and exact rows in a restorable private R2 object', async () => {
    const connection = await createDatabase();
    const storage = new Miniflare({ modules: true, script: 'export default {}', compatibilityDate: '2026-07-30', r2Buckets: { BACKUPS: 'test-backups' } });
    const restored = new Database(':memory:');
    try {
      await connection.binding.prepare('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT)').run();
      await connection.binding.prepare("INSERT INTO d1_migrations VALUES (1, '0000_baseline.sql', '2026-09-30')").run();
      await connection.db.insert(users).values({ id: 'backup-user', name: "O'Brien; Example", email: 'person@example.test' });
      const food = await connection.db.insert(foods).values({
        userId: 'backup-user', name: 'Food', amountUnit: 'mg', basisAmount: 100000,
        energyMkcalPerBasis: 100000, proteinMgPerBasis: 1000, carbsMgPerBasis: 1000, fatMgPerBasis: 1000
      }).returning().get();
      await createMealShortcut(connection.db, 'backup-user', {
        clientMutationId: crypto.randomUUID(), name: 'Saved meal', items: [{ foodId: food.id, amount: '10' }]
      });
      const bucket = await storage.getR2Bucket('BACKUPS');
      const result = await backupDatabase({ DB: connection.binding, BACKUPS: bucket as unknown as R2Bucket }, new Date('2026-09-30T03:17:00Z'));
      const object = await bucket.get(result.key);
      expect(object).not.toBeNull();
      const sql = await object!.text();
      restored.exec('PRAGMA foreign_keys = ON');
      restored.exec(sql);
      expect(restored.prepare('SELECT id, name, email FROM users').all()).toEqual([{ id: 'backup-user', name: "O'Brien; Example", email: 'person@example.test' }]);
      expect(restored.prepare('SELECT name FROM d1_migrations').get()).toEqual({ name: '0000_baseline.sql' });
      expect(restored.pragma('foreign_key_check')).toEqual([]);
      expect(restored.prepare('SELECT count(*) AS count FROM meal_shortcut_items').get()).toEqual({ count: 1 });
      const manifest = await bucket.get(`${result.key}.manifest.json`);
      expect(JSON.parse(await manifest!.text())).toMatchObject({ sha256: result.checksum, counts: { users: 1, atomic_guards: 0 } });
    } finally {
      restored.close();
      await connection.client.close();
      await storage.dispose();
    }
  });
});

describe('CLI backup restoration', () => {
  it('reorders a coherent export while preserving quoted semicolons and foreign keys', () => {
    const exported = `PRAGMA defer_foreign_keys = ON;
CREATE TABLE auth_accounts (id TEXT PRIMARY KEY, user_id TEXT, email TEXT, FOREIGN KEY(user_id,email) REFERENCES users(id,email));
INSERT INTO auth_accounts VALUES ('account', 'owner', 'owner@example.test');
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT);
INSERT INTO users VALUES ('owner', 'O''Brien; Example', 'owner@example.test');
CREATE UNIQUE INDEX users_identity ON users(id,email);`;
    const original = new Database(':memory:');
    const restored = new Database(':memory:');
    try {
      original.pragma('foreign_keys = ON');
      expect(() => original.exec(exported)).toThrow('no such table');
      restored.pragma('foreign_keys = ON');
      restored.exec(prepareBackupSql(exported));
      expect(restored.prepare('SELECT name FROM users').get()).toEqual({ name: "O'Brien; Example" });
      expect(restored.prepare('SELECT user_id FROM auth_accounts').get()).toEqual({ user_id: 'owner' });
      expect(restored.pragma('foreign_key_check')).toEqual([]);
      expect(() => restored.exec("INSERT INTO auth_accounts VALUES ('invalid', 'missing', 'missing@example.test')")).toThrow('FOREIGN KEY');
    } finally { original.close(); restored.close(); }
  });
});
