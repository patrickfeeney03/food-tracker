import { defineConfig } from 'drizzle-kit';

// Generate schema changes; Wrangler exclusively applies D1 migrations.
export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true
});
