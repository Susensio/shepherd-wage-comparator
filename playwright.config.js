// Browser tests: the page in headless Chromium, at phone width, served by test/serve.js.

import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'chromium',
    viewport: { width: 390, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node test/serve.js`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
