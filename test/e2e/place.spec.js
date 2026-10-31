// Where the job is and which herd: the «Pueblo» field, the place list loading, and what the summaries show.

import { expect, test } from './fixtures.js';

const PLACES_FILE = /\/data\/places-[\d.-]+\.json$/;

/** Collects the requests for the place list into `requests`. */
const watchPlacesRequests = (page, requests) =>
  page.on('request', (request) => {
    if (PLACES_FILE.test(request.url())) requests.push(request.url());
  });

/** A new offer from the first template, with «Dónde y qué ganado» open. */
async function startOffer(page) {
  await page.locator('.tcard').first().click();
  await page.locator('[data-fold=place] > summary').click();
}

const pick = async (page, query, option) => {
  await page.fill('#place', query);
  await page.getByRole('option', { name: option }).click();
};

test('the section is in the form, with the field and three head counts', async ({ page }) => {
  await startOffer(page);
  await expect(page.locator('[data-fold=place] > summary .st')).toHaveText('Dónde y qué ganado');
  await expect(page.getByRole('combobox', { name: 'Pueblo' })).toBeVisible();
  for (const name of ['Ovejas', 'Cabras', 'Vacas']) await expect(page.getByLabel(name)).toBeVisible();
});

test('the list is requested when the form opens, not on a plain page load', async ({ openApp }) => {
  const requests = [];
  const page = await openApp({ beforeLoad: (p) => watchPlacesRequests(p, requests) });
  await expect(page.locator('.tcard').first()).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.locator('.tcard').first().click(); // a new offer opens the form
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.locator('#placeHint')).toHaveText('');
  expect(await page.evaluate(() => caches.keys())).toEqual([expect.stringMatching(/^places-/)]);
});

test('the list is downloaded once: a later visit reads it from Cache Storage', async ({ openApp }) => {
  const requests = [];
  const page = await openApp({ beforeLoad: (p) => watchPlacesRequests(p, requests) });
  await startOffer(page);
  await pick(page, 'yebra de basa', /^Yebra de Basa/);
  await page.reload();
  await page.waitForFunction(() => window.app);
  await page.locator('#editBtn').click();
  await expect(page.locator('#editInfo')).toContainText('Municipio de Yebra de Basa · Huesca');
  expect(requests).toHaveLength(1);
});

test('until the list is in, the field says so', async ({ openApp }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const page = await openApp({
    beforeLoad: (p) =>
      p.route(PLACES_FILE, async (route) => {
        await gate;
        await route.continue();
      }),
  });
  await startOffer(page);
  await expect(page.locator('#placeHint')).toHaveText('Cargando pueblos…');
  await page.fill('#place', 'yebra de basa');
  await expect(page.getByRole('option')).toHaveCount(0);
  release();
  await expect(page.locator('#placeHint')).toHaveText('');
  await expect(page.getByRole('option').first()).toContainText('Yebra de Basa'); // fills in as it lands
});

test('offline with no copy, it says so and the field still takes text', async ({ openApp }) => {
  const page = await openApp({ beforeLoad: (p) => p.route(PLACES_FILE, (route) => route.abort()) });
  await startOffer(page);
  await expect(page.locator('#placeHint')).toContainText('No se pudo cargar la lista de pueblos');
  await page.fill('#place', 'Mi majada');
  const { mine, terms } = await page.evaluate(() => app.active());
  expect(mine.place).toBe('Mi majada');
  expect(terms.municipality).toBe('');
});

test('picking a village fills in its municipality and province', async ({ page }) => {
  await startOffer(page);
  await page.fill('#place', 'yebra de b');
  const options = page.getByRole('option');
  await expect(options.first()).toContainText('Yebra de Basa');
  await expect(options.first()).toContainText('Municipio · Huesca');
  expect(await options.count()).toBeLessThanOrEqual(8);
  await options.first().click();
  await expect(page.locator('#place')).toHaveValue('Yebra de Basa');
  await expect(page.locator('#placePickedText')).toHaveText('Municipio de Yebra de Basa · Huesca');
  await expect(page.getByRole('listbox')).toBeHidden();
  const { mine, terms } = await page.evaluate(() => app.active());
  expect(terms).toMatchObject({ municipality: '22252', province: 'HU' });
  expect(mine.place).toBe('Yebra de Basa');
  expect(terms).not.toHaveProperty('place');
});

test('a village inside a municipality names both', async ({ page }) => {
  await startOffer(page);
  await page.fill('#place', 'sarvise');
  const option = page.getByRole('option', { name: /^Sarvisé/ });
  await expect(option).toContainText('Municipio de Broto · Huesca'); // accents do not matter
  await option.click();
  await expect(page.locator('#sum-place')).toHaveText('Sarvisé · Municipio de Broto · Huesca');
});

test('keyboard: arrows move, Enter picks, Escape closes', async ({ page }) => {
  await startOffer(page);
  const field = page.locator('#place');
  await field.fill('yebra');
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  await field.press('ArrowDown');
  await field.press('ArrowDown');
  await field.press('ArrowUp');
  const first = page.getByRole('option').first();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(field).toHaveAttribute('aria-activedescendant', await first.getAttribute('id'));
  await field.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(field).toHaveAttribute('aria-expanded', 'false');
  await field.press('ArrowDown');
  await field.press('Enter');
  expect((await page.evaluate(() => app.active())).terms.municipality).toMatch(/^\d{5}$/);
  await expect(page.getByRole('listbox')).toBeHidden();
});

test('typing without picking keeps the text and leaves the codes empty', async ({ page }) => {
  await startOffer(page);
  await page.fill('#place', 'Mi aldea');
  let offer = await page.evaluate(() => app.active());
  expect(offer.mine.place).toBe('Mi aldea');
  expect(offer.terms).toMatchObject({ municipality: '', province: '' });
  await expect(page.locator('#sum-place')).toHaveText('Mi aldea');

  await pick(page, 'yebra de basa', /^Yebra de Basa/);
  await page.fill('#place', 'Yebra de Basa, a mano'); // editing what was picked drops its codes
  offer = await page.evaluate(() => app.active());
  expect(offer.terms).toMatchObject({ municipality: '', province: '' });
  await expect(page.locator('#placePicked')).toBeHidden();
});

test('«Cambiar» drops the codes and selects the village to type over', async ({ page }) => {
  await startOffer(page);
  await pick(page, 'yebra de basa', /^Yebra de Basa/);
  await page.getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.locator('#place')).toBeFocused();
  expect((await page.evaluate(() => app.active())).terms.municipality).toBe('');
  await page.keyboard.type('Aínsa');
  await expect(page.getByRole('option').first()).toContainText('Aínsa');
});

test('head counts go to the terms, empty stays empty, and the summaries show them', async ({ page }) => {
  await startOffer(page);
  await pick(page, 'yebra de basa', /^Yebra de Basa/);
  await page.fill('#sheep', '600');
  await page.fill('#cattle', '1');
  let offer = await page.evaluate(() => app.active());
  expect(offer.terms).toMatchObject({ sheep: 600, goats: '', cattle: 1 });
  expect(offer.mine).not.toHaveProperty('sheep');
  await expect(page.locator('#sum-place')).toHaveText('Municipio de Yebra de Basa · Huesca · 600 ovejas · 1 vaca');

  await page.fill('#cattle', '');
  offer = await page.evaluate(() => app.active());
  expect(offer.terms.cattle).toBe('');

  const info = page.locator('#editInfo');
  await expect(info).toContainText('Dónde');
  await expect(info).toContainText('Municipio de Yebra de Basa · Huesca');
  await expect(info).toContainText('Ganado');
  await expect(info).toContainText('600 ovejas');
});

test('an offer with neither place nor herd has no such rows', async ({ page }) => {
  await startOffer(page);
  await expect(page.locator('#sum-place')).toHaveText('Sin poner');
  await expect(page.locator('#editInfo')).not.toContainText('Dónde');
  await expect(page.locator('#editInfo')).not.toContainText('Ganado');
});

test('a saved offer is named once the list arrives, with the page not waiting for it', async ({ openApp }) => {
  const page = await openApp({
    init: () => {
      localStorage.setItem(
        'cj.ofertas2',
        JSON.stringify([
          {
            id: 'a',
            cmp: true,
            terms: { municipality: '22252', province: 'HU', goats: 40 },
            mine: { name: 'Mía', place: 'Sarvisé' },
          },
        ]),
      );
    },
  });
  await expect(page.locator('#editInfo')).toContainText('Sarvisé · Municipio de Yebra de Basa · Huesca');
  await expect(page.locator('#editInfo')).toContainText('40 cabras');
});

test.describe('data saving', () => {
  for (const connection of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
    test(`${JSON.stringify(connection)} holds the list back until the field is focused`, async ({ openApp }) => {
      const requests = [];
      const page = await openApp({
        init: (value) => Object.defineProperty(navigator, 'connection', { value }),
        arg: connection,
        beforeLoad: (p) => watchPlacesRequests(p, requests),
      });
      await startOffer(page);
      await page.waitForTimeout(300);
      expect(requests).toHaveLength(0);
      await page.locator('#place').focus();
      await expect.poll(() => requests.length).toBe(1);
      await page.fill('#place', 'yebra de basa');
      await expect(page.getByRole('option').first()).toContainText('Yebra de Basa');
    });
  }

  test('a fast connection is not held back', async ({ openApp }) => {
    const requests = [];
    const page = await openApp({
      init: () => Object.defineProperty(navigator, 'connection', { value: { saveData: false, effectiveType: '4g' } }),
      beforeLoad: (p) => watchPlacesRequests(p, requests),
    });
    await startOffer(page);
    await expect.poll(() => requests.length).toBe(1);
  });
});

test('«Leyes» credits GeoNames for the place list', async ({ page }) => {
  await page.evaluate(() => app.showTab('laws'));
  const credit = page.locator('[data-panel=laws] li', { hasText: 'GeoNames' });
  await expect(credit).toContainText('CC BY 4.0');
  await expect(credit.getByRole('link', { name: 'GeoNames' })).toHaveAttribute('href', 'https://www.geonames.org/');
});
