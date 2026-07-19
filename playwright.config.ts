import { defineConfig, devices } from 'playwright/test';
import { resolve } from 'node:path';

const port = process.env.PORT || '4173';
const baseURL = `http://127.0.0.1:${port}`;
const databasePath = resolve(process.cwd(), `.playwright/e2e-${port}.db`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: '.playwright/test-results',
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node tests/e2e/start-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: port,
      DATABASE_URL: databasePath,
      GOOGLE_CLIENT_ID: 'e2e-unused-client',
      GOOGLE_CLIENT_SECRET: 'e2e-unused-secret',
      GOOGLE_REDIRECT_URI: `${baseURL}/auth/google/callback`,
      GOOGLE_ALLOWED_EMAIL: 'e2e@example.test'
    }
  }
});
