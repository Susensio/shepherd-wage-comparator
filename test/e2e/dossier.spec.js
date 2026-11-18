// The «Expediente» (ADR-0034): a printable page with its own history entry; its totals are the tiles'.

import { closeRegistro, expect, loadOffers, openLegalPage, openRegistro, sample, test, tileOf } from './fixtures.js';

const PUERTO_A_OTRA = 1; // 21 June to 30 September 2026
const amount = (text) => Number.parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
const tile = tileOf;
const addPayments = (page, list) =>
  page.evaluate(async (list) => {
    const { offers } = await import('./src/offers.js');
    for (const p of list) offers.addPayment(app.active(), p);
    app.select(app.active().id);
  }, list);

test.describe('the dossier', () => {
  test.use({ today: '2026-11-12' });

  test.beforeEach(async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 1000, via: 'payroll' },
      { date: '2026-08-20', amount: 300, via: 'cash', note: 'adelanto' },
    ]);
  });

  test('opens from «Vía legal» over it, with a history entry: Back leaves it', async ({ page }) => {
    await expect(page.locator('#dossier')).toBeHidden();
    await openLegalPage(page);
    await page.getByRole('button', { name: 'Ver el expediente' }).click();
    await expect(page.locator('#dossier')).toBeVisible();
    await expect(page.locator('#dossier h1')).toHaveText('Expediente');
    await page.goBack();
    await expect(page.locator('#dossier')).toBeHidden();
    await expect(page.locator('#legalPage')).toBeVisible(); // back to what was below
    await page.getByRole('button', { name: 'Ver el expediente' }).click();
    await page.locator('#dossier').getByRole('button', { name: 'Volver' }).click();
    await expect(page.locator('#dossier')).toBeHidden();
    await expect(page.locator('#legalPage')).toBeVisible();
  });

  test('opens from the «⋯» menu', async ({ page }) => {
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=dossier]').click();
    await expect(page.locator('#dossier')).toBeVisible();
  });

  test('its totals are the Cuentas tiles, and its tables add up', async ({ page }) => {
    const tiles = {};
    for (const name of ['Corresponde', 'Cobrado', 'Falta']) tiles[name] = amount(await tile(page, name).textContent());
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=dossier]').click();
    const doc = page.locator('#dossier .dossier-doc');
    for (const name of ['Corresponde', 'Cobrado', 'Falta'])
      expect(amount(await doc.locator('.dtiles > div', { hasText: name }).locator('b').textContent())).toBe(
        tiles[name],
      );
    // The net table by months: its rows add up to its total row, column by column
    const table = doc.locator('h3', { hasText: 'En neto, por meses' }).locator('+ table');
    const rows = await table
      .locator('tr')
      .evaluateAll((trs) =>
        trs
          .slice(1)
          .map((tr) =>
            [...tr.querySelectorAll('td')].map((td) =>
              Number.parseFloat(td.textContent.replace(/[^\d,]/g, '').replace(',', '.')),
            ),
          ),
      );
    const total = rows.pop();
    for (let i = 0; i < 3; i++) expect(Math.round(rows.reduce((t, r) => t + r[i], 0) * 100) / 100).toBe(total[i]);
  });

  test('holds every section: parties, conditions, the calendar of each month, cobros, deadlines, what it cannot prove, steps, disclaimer', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.setParties(app.active(), { employerName: 'Casa Pérez', employerId: 'B123', workerName: 'Ana Gil' });
      offers.markStep(app.active(), 'talk', { done: '2026-11-10' });
      offers.closeMonth(app.active(), { key: '2026-06', from: '2026-06-01', to: '2026-06-30' });
      app.select(app.active().id);
    });
    await openLegalPage(page);
    await page.locator('#legalPage [data-action=openDossier]').click();
    const doc = page.locator('#dossier .dossier-doc');
    for (const heading of [
      'Partes',
      'Condiciones',
      'Calendario',
      'Cobros',
      'Cuentas a 12 nov 2026',
      'Plazos',
      'Lo que el registro no puede probar',
      'Pasos hechos',
    ])
      await expect(doc.locator('h2', { hasText: heading })).toBeVisible();
    await expect(doc).toContainText('Casa Pérez (B123)');
    await expect(doc).toContainText('Ana Gil');
    await expect(doc.locator('.dmonth')).toHaveCount(4);
    await expect(doc.locator('.dmonth', { hasText: 'Junio 2026' })).toContainText('cerrado el 12 nov 2026');
    await expect(doc.locator('.dmonth', { hasText: 'Julio 2026' })).toContainText('sin cerrar');
    await expect(doc.locator('.dmonth .dd b').first()).toHaveText(/^[JLB·]$/);
    await expect(doc.locator('.dcount', { hasText: ' 1 libre' }).first()).not.toContainText('1 libres');
    await expect(doc.locator('h2', { hasText: 'Cobros' }).locator('+ table')).toContainText('adelanto');
    await expect(doc).toContainText('Hablar con el ganadero: 10 nov 2026');
    await expect(doc).toContainText('Meses sin cerrar');
    await expect(doc).toContainText('no asesoramiento legal');
  });

  test('a cobro dated after «No» was answered is told in Cuentas', async ({ page }) => {
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.completeRecord(app.active());
      app.active().mine.record.complete = { date: '2026-08-25' };
      offers.addPayment(app.active(), { date: '2026-11-05', amount: 100, via: 'payroll' });
    });
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=dossier]').click();
    const accounts = page.locator('#dossier .dsum');
    await expect(accounts).toContainText('Se respondió «No» a «¿Se espera algún pago más?» el 25 ago 2026.');
    await expect(accounts).toContainText('Cobros fechados después: 5 nov 2026.');
  });

  test('without a cobro after «No», Cuentas tells nothing of it', async ({ page }) => {
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.completeRecord(app.active());
    });
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=dossier]').click();
    await expect(page.locator('#dossier .dsum')).not.toContainText('Se respondió');
  });

  test('notes added in Registro appear in the dossier, dated', async ({ page }) => {
    await openRegistro(page);
    await page.locator('#noteText').fill('El ganadero dijo que pagaba en diciembre');
    await page.getByRole('button', { name: 'Añadir apunte' }).click();
    await expect(page.locator('.apuntes')).toContainText('El ganadero dijo que pagaba en diciembre');
    await closeRegistro(page);
    await openLegalPage(page);
    await page.locator('#legalPage [data-action=openDossier]').click();
    await expect(page.locator('#dossier')).toContainText('12 nov 2026: El ganadero dijo que pagaba en diciembre');
  });

  test('printed, it is alone: no app chrome, a white page, the calendar in black and white', async ({ page }) => {
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=dossier]').click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.appbar')).toBeHidden();
    await expect(page.locator('.tabs')).toBeHidden();
    await expect(page.locator('#ficha')).toBeHidden();
    await expect(page.locator('.dossier-bar')).toBeHidden();
    await expect(page.locator('#dossier h1')).toBeVisible();
    const colours = await page.evaluate(() => {
      const css = (el) => getComputedStyle(el);
      return [
        css(document.body).backgroundColor,
        css(document.querySelector('.dossier-doc')).color,
        css(document.querySelector('.dmonth .dd b')).color,
        css(document.querySelector('.dgrid > span')).borderTopColor,
      ];
    });
    expect(colours).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)']);
    await page.screenshot({ path: 'test-results/dossier-print.png', fullPage: true });
  });

  for (const scheme of ['light', 'dark']) {
    test(`at 375 px it fits the width (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator('#fichaMenu').click();
      await page.locator('#offerMenu [data-menu=dossier]').click();
      const over = await page.evaluate(
        () => [...document.querySelectorAll('#dossier *')].filter((e) => e.getBoundingClientRect().right > 376).length,
      );
      expect(over).toBe(0);
      await page.screenshot({ path: `test-results/dossier-${scheme}.png` });
    });
  }
});

test.describe('the dossier of a job answered «Lo pactado»', () => {
  test.use({ today: '2026-11-12' });

  test('says everything agreed was cobrado, not that no cobro was noted', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.setPaid(app.active(), 'asAgreed');
      app.select(app.active().id);
    });
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=dossier]').click();
    const doc = page.locator('#dossier .dossier-doc');
    await expect(doc.locator('section', { has: page.getByRole('heading', { name: 'Cobros' }) })).toContainText(
      'Se cobró todo lo pactado.',
    );
    await expect(doc).not.toContainText('No hay cobros apuntados');
  });
});
