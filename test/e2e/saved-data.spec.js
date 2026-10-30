// Saved data in today's format loads, from every place it can come from.

import { expect, sample, test } from './fixtures.js';

const names = (offers) => offers.map(({ id, name, contract, duration }) => ({ id, name, contract, duration }));

test('browser storage', async ({ openApp }) => {
  const page = await openApp({
    arg: sample,
    init: (saved) => {
      const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
      set('cj.ofertas', saved.offers);
      set('cj.cfg', saved.cfg);
      set('cj.active', saved.offers[1].id);
      set('cj.unidadCmp', 'month');
      set('cj.tab', 'compare');
    },
  });
  const state = await page.evaluate(() => ({
    tab: document.querySelector('.tabs [aria-selected=true]').dataset.tab,
    unit: app.state.cmpUnit,
    offers: app.state.offers,
    activeId: app.state.activeId,
    fuelUse: app.state.config.fuelUse,
  }));
  expect(state.tab).toBe('compare');
  expect(state.unit).toBe('month');
  expect(state.activeId).toBe(sample.offers[1].id);
  expect(names(state.offers)).toEqual(names(sample.offers));
  expect(state.fuelUse).toBe(sample.cfg.fuelUse);
});

test('a backup file', async ({ page }) => {
  const [ok, message, loaded] = await page.evaluate(async (text) => {
    const { loadBackup } = await import('./src/storage/backup.js');
    const msg = document.createElement('p');
    return [loadBackup(text, msg), msg.textContent, app.state.offers];
  }, JSON.stringify(sample));
  expect(ok).toBe(true);
  expect(message).toBe('Añadidas 8 ofertas.');
  expect(names(loaded)).toEqual(names(sample.offers));
});

test('the Claude account document is read and saved back', async ({ openApp }) => {
  const page = await openApp({
    arg: { ...sample, ts: 9e12 },
    init: (doc) => {
      window.saved = null;
      const db = {
        doc: () => ({
          get: async () => ({ exists: true, data: () => doc }),
          set: async (d) => {
            window.saved = d;
          },
        }),
      };
      const user = { id: async () => 'u1' };
      window.claude = { use: async (name) => ({ user, db })[name] ?? null };
    },
  });
  await expect.poll(() => page.evaluate(() => app.state.inCloud)).toBe(true);
  expect(names(await page.evaluate(() => app.state.offers))).toEqual(names(sample.offers));
  await page.evaluate(async () => {
    app.active().name = 'Cambiada';
    (await import('./src/state.js')).saveOffers();
  });
  // saving waits for a pause in the changes
  await expect.poll(() => page.evaluate(() => window.saved), { timeout: 4000 }).not.toBeNull();
  const saved = await page.evaluate(() => window.saved);
  expect(saved.offers.map((o) => o.name)).toContain('Cambiada');
});
