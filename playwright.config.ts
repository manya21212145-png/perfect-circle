// End-to-end tests: real browsers against the real server (started in test mode on port 3100
// with its own empty database, so your real data/perfect-circle.db is never touched).
//
//   npx playwright install      (once: downloads the test browsers)
//   npm run build               (the server serves the built game)
//   npm run e2e

import { defineConfig, devices } from '@playwright/test';
import { rmSync } from 'node:fs';

const DB = 'data/e2e.db';
for (const f of [DB, DB + '-wal', DB + '-shm']) rmSync(f, { force: true });

const executablePath = process.env.PW_CHROMIUM_PATH || undefined; // optional: use an installed Chromium

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx tsx server/index.ts --test',
    url: 'http://localhost:3100/api/config',
    env: { PORT: '3100', DB_FILE: DB },
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'laptop-chrome', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'android-phone', testMatch: /solo\.spec/, use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    // Safari engine (iPhone, MacBook). Needs "npx playwright install webkit".
    { name: 'iphone-safari', testMatch: /solo\.spec/, use: { ...devices['iPhone 14'] } },
  ],
});
