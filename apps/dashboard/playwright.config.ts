import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.DASHBOARD_TEST_PORT || 3102);
const BASE_URL = process.env.DASHBOARD_BASE_URL || `http://localhost:${PORT}`;

// Env vars disponíveis pros testes (não só pro webServer)
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5433/agenda_facil_test';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum-ok';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm build && PORT=${PORT} pnpm start`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-32-chars-minimum-ok',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgres://test:test@localhost:5433/agenda_facil_test',
      BOT_API_URL: process.env.BOT_API_URL || 'http://localhost:3001',
      NODE_ENV: 'production',
    },
  },
});
