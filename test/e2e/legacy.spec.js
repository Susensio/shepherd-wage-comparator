// Data saved by the Spanish-era versions (before October 2026) still loads, from every place it can come from.

import { expect, loadOffers, sample, sampleEs, test } from './fixtures.js';

/** This browser, as a Spanish-era version of the page left it. */
function spanishStorage(saved) {
  const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  set('cj.ofertas', saved.ofertas);
  set('cj.cfg', saved.cfg);
  set('cj.active', saved.ofertas[1].id);
  set('cj.unidadCmp', 'mes');
  set('cj.tab', 'comparar');
  set('cj.secs', { tiempo: false, cuentas: true, roja: true });
  set('cj.copia', { fecha: Date.now(), firma: 'x' });
}

test('browser storage', async ({ openApp }) => {
  const page = await openApp({ init: spanishStorage, arg: sampleEs });
  const state = await page.evaluate(() => ({
    tab: document.querySelector('.tabs [aria-selected=true]').dataset.tab,
    unit: app.state.cmpUnit,
    offers: app.state.offers.map(({ id, name, contract, vacation, duration }) => ({
      id,
      name,
      contract,
      vacation,
      duration,
    })),
    fuelUse: app.state.config.fuelUse,
    folds: { time: app.state.folds.time, workings: app.state.folds.workings, owed: app.state.folds.owed },
    backup: document.querySelector('#backupStatus').textContent,
  }));
  expect(state.tab).toBe('compare');
  expect(state.unit).toBe('month');
  expect(state.offers).toEqual(
    sample.offers.map(({ id, name, contract, vacation, duration }) => ({ id, name, contract, vacation, duration })),
  );
  expect(state.fuelUse).toBe(sampleEs.cfg.consumo);
  expect(state.folds).toEqual({ time: false, workings: true, owed: true });
  expect(state.backup).toMatch(/^Última copia: hoy/);
});

test('the same figures as the same offers in today’s format', async ({ openApp, browser }) => {
  const old = await openApp({ init: spanishStorage, arg: sampleEs });
  await old.click('.tabs [data-tab=offers]');
  const today = await openApp({ ctx: await browser.newContext() });
  await loadOffers(today, sample, 0);
  for (const offer of sample.offers) {
    for (const page of [old, today])
      await page.evaluate((id) => {
        app.select(id);
        for (const d of document.querySelectorAll('#result details')) d.open = true;
      }, offer.id);
    expect(await old.innerText('#result'), offer.name).toBe(await today.innerText('#result'));
  }
});

test('a backup file', async ({ page }) => {
  const [ok, message, contracts] = await page.evaluate(async (text) => {
    const { loadBackup } = await import('./src/storage/backup.js');
    const msg = document.createElement('p');
    return [loadBackup(text, msg), msg.textContent, app.state.offers.map((o) => o.contract)];
  }, JSON.stringify(sampleEs));
  expect(ok).toBe(true);
  expect(message).toBe('Añadidas 8 ofertas.');
  for (const contract of contracts) expect(['temporary', 'seasonal', 'permanent', 'none']).toContain(contract);
});

test('the Claude account document is read, and saved back in today’s format', async ({ openApp }) => {
  // The claude.ai runtime, with an account document from the Spanish era
  const page = await openApp({
    arg: { ...sampleEs, ts: 9e12 },
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
  expect(await page.evaluate(() => app.state.offers.length)).toBe(8);
  await page.evaluate(async () => {
    app.active().name = 'Cambiada';
    (await import('./src/state.js')).saveOffers();
  });
  // saving waits for a pause in the changes
  await expect.poll(() => page.evaluate(() => window.saved), { timeout: 4000 }).not.toBeNull();
  const saved = await page.evaluate(() => window.saved);
  expect(saved).toHaveProperty('offers');
  expect(saved).not.toHaveProperty('ofertas');
  expect(saved.offers[0]).toHaveProperty('name');
  expect(saved.offers[0]).not.toHaveProperty('nombre');
});
