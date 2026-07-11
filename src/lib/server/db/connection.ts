import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export interface DatabaseConnection {
	client: Database.Database;
	db: ReturnType<typeof drizzle<typeof schema>>;
}

export function configureSqlite(client: Database.Database): void {
	client.pragma('busy_timeout = 5000');
	client.pragma('foreign_keys = ON');

	const journalMode = client.pragma('journal_mode = WAL', { simple: true });
	const foreignKeysEnabled = client.pragma('foreign_keys', { simple: true });

	if (journalMode !== 'wal') {
		throw new Error(`SQLite WAL mode could not be enabled (received ${String(journalMode)})`);
	}

	if (foreignKeysEnabled !== 1) {
		throw new Error('SQLite foreign key enforcement could not be enabled');
	}
}

export function createDatabase(filename: string): DatabaseConnection {
	const client = new Database(filename);

	try {
		configureSqlite(client);
		return { client, db: drizzle(client, { schema }) };
	} catch (error) {
		client.close();
		throw error;
	}
}
