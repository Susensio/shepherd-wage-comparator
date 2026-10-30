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
