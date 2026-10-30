// Shared fixtures: the page opened offline (no web fonts), its errors, and the sample offers.

import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';

const read = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
/** Eight offers covering the main cases (seasonal, casual, no contract, cash, overnight…), in today's format. */
export const sample = read('offers.json');

/** Loads offers and settings into the app, and shows the offer at `show`. */
export async function loadOffers(page, data, show = 1) {
  await page.evaluate(
    async ({ data, show }) => {
      const { normalizeOffer } = await import('./src/legacy.js');
      const { DEF_CFG } = await import('./src/offer.js');
      const { saveConfig } = await import('./src/state.js');
      app.closeTemplates();
      app.state.offers = data.offers.map(normalizeOffer);
      app.state.config = { ...DEF_CFG, ...data.cfg };
      saveConfig();
      app.select(app.state.offers[show].id);
    },
    { data, show },
  );
}

export const test = base.extend({
  /** Every error the page throws, in any of the test's tabs. The test fails if there is one. */
  pageErrors: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures take their dependencies by destructuring
    async ({}, use) => {
      const errors = [];
      await use(errors);
      expect(errors, 'errors in the page').toEqual([]);
    },
    { auto: true },
  ],

  /** Opens the app in a new tab of `ctx` (the test's own by default); `init(arg)` runs before the app starts. */
  openApp: async ({ context, baseURL, pageErrors }, use) => {
    const offline = new Set();
    await use(async ({ init, arg, ctx = context } = {}) => {
      // No network but the page itself: it must work without its web fonts
      if (!offline.has(ctx)) {
        await ctx.route('**/*', (route) =>
          route.request().url().startsWith(baseURL) ? route.continue() : route.abort(),
        );
        offline.add(ctx);
      }
      const page = await ctx.newPage();
      page.on('pageerror', (e) => pageErrors.push(e.message));
      if (init) await page.addInitScript(init, arg);
      await page.goto('/');
      await page.waitForFunction(() => window.app);
      return page;
    });
  },

  page: async ({ openApp }, use) => {
    await use(await openApp());
  },

  /** The app with the sample offers loaded. */
  loaded: async ({ page }, use) => {
    await loadOffers(page, sample);
    await use(page);
  },
});

export { expect };
