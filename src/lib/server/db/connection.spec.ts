import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from './connection';
import { foods, mealShortcutItems, mealShortcuts, nutritionGoals, users } from './schema';

function withMigratedDatabase(run: (connection: DatabaseConnection) => void): void {
	const directory = mkdtempSync(join(tmpdir(), 'calories-db-'));
	const connection = createDatabase(join(directory, 'test.db'));

	try {
		migrate(connection.db, { migrationsFolder: 'drizzle' });
		run(connection);
	} finally {
		connection.client.close();
		rmSync(directory, { recursive: true, force: true });
	}
}

function insertUser(connection: DatabaseConnection): string {
	return connection.db
		.insert(users)
		.values({ name: 'Patrick', email: 'patrick@example.com' })
		.returning({ id: users.id })
		.get().id;
}

function insertFood(
	connection: DatabaseConnection,
	userId: string,
	overrides: Partial<typeof foods.$inferInsert> = {}
): string {
	return connection.db
		.insert(foods)
		.values({
			userId,
			name: 'Greek yoghurt',
			barcode: '0001234567890',
			amountUnit: 'mg',
			basisAmount: 100_000,
			energyMkcalPerBasis: 65_000,
			proteinMgPerBasis: 10_000,
			carbsMgPerBasis: 3_500,
			fatMgPerBasis: 800,
			...overrides
		})
		.returning({ id: foods.id })
		.get().id;
}

describe('SQLite database', () => {
	it('enables WAL and foreign key enforcement and runs the complete migration', () => {
		withMigratedDatabase(({ client }) => {
			expect(client.pragma('journal_mode', { simple: true })).toBe('wal');
			expect(client.pragma('foreign_keys', { simple: true })).toBe(1);

			const tables = client
				.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
				.all()
				.map((row) => (row as { name: string }).name)
				.filter((name) => name !== '__drizzle_migrations')
				.sort();

			expect(tables).toEqual([
				'auth_accounts',
				'diary_logs',
				'foods',
				'meal_shortcut_items',
				'meal_shortcuts',
				'nutrition_goals',
				'sessions',
				'users'
			]);
		});
	});

	it('enforces positive food amounts and non-negative nutrition goals', () => {
		withMigratedDatabase((connection) => {
			const userId = insertUser(connection);

			expect(() => insertFood(connection, userId, { basisAmount: 0 })).toThrow(/CHECK constraint/);
			expect(() =>
				connection.db
					.insert(nutritionGoals)
					.values({
						userId,
						effectiveFrom: '2026-07-11',
						targetEnergyMkcal: -1,
						targetProteinMg: 200_000,
						targetCarbsMg: 300_000,
						targetFatMg: 90_000
					})
					.run()
			).toThrow(/CHECK constraint/);
		});
	});

	it('allows a barcode to be reused only after its previous food is archived', () => {
		withMigratedDatabase((connection) => {
			const userId = insertUser(connection);
			const originalFoodId = insertFood(connection, userId);

			expect(() => insertFood(connection, userId, { name: 'Duplicate' })).toThrow(/UNIQUE constraint/);

			connection.db
				.update(foods)
				.set({ deletedAt: new Date() })
				.where(eq(foods.id, originalFoodId))
				.run();

			expect(insertFood(connection, userId, { name: 'Replacement' })).toBeTypeOf('string');
		});
	});

	it('prevents hard deletion of a food referenced by a meal shortcut', () => {
		withMigratedDatabase((connection) => {
			const userId = insertUser(connection);
			const foodId = insertFood(connection, userId);
			const shortcutId = connection.db
				.insert(mealShortcuts)
				.values({ userId, name: 'Breakfast' })
				.returning({ id: mealShortcuts.id })
				.get().id;

			connection.db
				.insert(mealShortcutItems)
				.values({ shortcutId, foodId, position: 0, defaultAmount: 100_000 })
				.run();

			expect(() => connection.db.delete(foods).where(eq(foods.id, foodId)).run()).toThrow(
				/FOREIGN KEY constraint/
			);
		});
	});

	it('rejects partially populated meal shortcut portion snapshots', () => {
		withMigratedDatabase((connection) => {
			const userId = insertUser(connection);
			const foodId = insertFood(connection, userId);
			const shortcutId = connection.db
				.insert(mealShortcuts)
				.values({ userId, name: 'Breakfast' })
				.returning({ id: mealShortcuts.id })
				.get().id;

			expect(() =>
				connection.db
					.insert(mealShortcutItems)
					.values({
						shortcutId,
						foodId,
						position: 0,
						defaultAmount: 100_000,
						defaultPortionKind: 'unit',
						defaultPortionLabel: '1 g',
						defaultPortionAmount: null,
						defaultPortionCountMilli: 1_000
					})
					.run()
			).toThrow(/CHECK constraint/);
		});
	});
});
