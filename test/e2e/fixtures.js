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
      const { ingestSaved } = await import('./src/schema.js');
      const { DEF_CFG } = await import('./src/offer.js');
      const { saveConfig } = await import('./src/state.js');
      app.closeEntry();
      const loaded = ingestSaved(data, { fallbackCfg: DEF_CFG });
      app.state.offers = loaded.offers;
      app.state.config = loaded.cfg;
      app.state.placeholderId = null; // offers were loaded: not a first visit
      saveConfig();
      app.select(app.state.offers[show].id);
      if (!document.body.classList.contains('on-page')) app.openFicha();
    },
    { data, show },
  );
}

/** On a first visit, leaves the welcome for the templates; nothing to do anywhere else. */
export async function leaveWelcome(page) {
  const start = page.locator('#welcomeStart');
  if (await start.isVisible()) await start.click();
}

/** The steps in the order of the entry. */
const STEP_IDS = ['template', 'offer', 'pay', 'day', 'trip'];

/** In the entry of a new offer, picks a template (the first by default, or `template`) and goes on to step `id`. */
export async function startOffer(page, id = 'offer', template = null) {
  await leaveWelcome(page);
  await page
    .locator(template ? `.tcard[data-template=${template}]` : '.tcard')
    .first()
    .click();
  for (let i = 1; i < STEP_IDS.indexOf(id); i++) await page.locator('#entryNext').click();
  await expect(page.locator(`#entry .step[data-step=${id}]`)).toBeVisible();
}

/** In the entry of a new offer, goes forward or back to step `id`. */
export async function goStep(page, id) {
  const shown = async () => STEP_IDS.indexOf(await page.locator('#entry .step:visible').getAttribute('data-step'));
  for (let at = await shown(); at !== STEP_IDS.indexOf(id); at = await shown())
    await page.locator(at < STEP_IDS.indexOf(id) ? '#entryNext' : '#entryBack').click();
}

/** On the ficha, opens «Condiciones» if it is closed and taps the row of step `id`. */
export async function openCondition(page, id) {
  if (!(await page.locator('.conditions').evaluate((d) => d.open))) await page.locator('.conditions > summary').click();
  await page.locator(`.crow[data-step=${id}]`).click();
}

/** Opens one step of the active offer to change it, from its ficha. */
export async function openStep(page, id) {
  await page.evaluate(() => app.openFicha());
  await openCondition(page, id);
  await expect(page.locator(`#entry .step[data-step=${id}]`)).toBeVisible();
}

/** Closes the step being edited, keeping what was typed. */
export const saveStep = (page) => page.locator('#entryNext').click();

export const test = base.extend({
  /** The date the page believes it is, `YYYY-MM-DD`; by default the real one. A job's phase depends on it (ADR-0032). */
  today: [null, { option: true }],

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

  /**
   * Opens the app in a new tab of `ctx` (the test's own by default); `init(arg)` runs in the page before the app
   * starts, and `beforeLoad(page)` before it is loaded (to add routes).
   */
  openApp: async ({ context, baseURL, pageErrors, today }, use) => {
    const offline = new Set();
    await use(async ({ init, arg, beforeLoad, ctx = context } = {}) => {
      // No network but the page itself: it must work without its web fonts
      if (!offline.has(ctx)) {
        await ctx.route('**/*', (route) =>
          route.request().url().startsWith(baseURL) ? route.continue() : route.abort(),
        );
        offline.add(ctx);
      }
      const page = await ctx.newPage();
      page.on('pageerror', (e) => pageErrors.push(e.message));
      if (today) await page.clock.setFixedTime(new Date(`${today}T12:00:00`));
      if (init) await page.addInitScript(init, arg);
      await beforeLoad?.(page);
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
