import { defineConfig } from 'drizzle-kit';
import { loadEnvFile } from 'node:process';
import { SHARED_ENV_FILE } from './shared-local.ts';

try {
	loadEnvFile(SHARED_ENV_FILE);
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
