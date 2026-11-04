// Browser tests: the page in headless Chromium, at phone width, served by test/serve.js.

import { createServer } from 'node:net';
import { defineConfig } from '@playwright/test';

/** A port nobody is listening on, chosen by the system. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer().listen(0, () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });

// Each run serves its own tree on its own port: with a fixed one, a second run (another worktree, the pre-push hook
// while an agent tests) attached to the first run's server and tested the other tree's files. The workers load this
// file again, and inherit the variable, so they agree with the runner.
process.env.TEST_PORT ||= String(await freePort());
const PORT = Number(process.env.TEST_PORT);

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
    reuseExistingServer: false,
  },
});
