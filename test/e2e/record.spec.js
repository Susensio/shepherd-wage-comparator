// What happened (ADR-0032): the ficha by phase, the calendar, the cobros and the review. The date is set, not the real one.

import { expect, loadOffers, sample, test } from './fixtures.js';
import { ledgerProblems } from './ledger.js';

const PUERTO_A_OTRA = 1; // 21 June to 30 September 2026
const SOLO_OFERTA = 0;
const at = (page, day) => page.clock.setFixedTime(new Date(`${day}T12:00:00`));
const reselect = (page) => page.evaluate(() => app.select(app.active().id));
const addPayments = (page, list) =>
  page.evaluate(async (list) => {
    const { offers } = await import('./src/offers.js');
    for (const p of list) offers.addPayment(app.active(), p);
    app.select(app.active().id);
  }, list);
const amount = (text) => Number.parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
const big = (page) => page.locator('#result .tag .big').first();

test.describe('under way', () => {
  test.use({ today: '2026-08-12' });

  test('the phase comes from the date: a pill, and the top of the ficha changes with it', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await expect(page.locator('#result .tag .lbl').first()).toContainText('Hasta hoy');
    await expect(page.locator('#result')).toContainText('Análisis');

    await at(page, '2026-05-01');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('Por decidir');
    await expect(page.locator('#result .tag .lbl').first()).toContainText('Se gana');

    await at(page, '2026-11-12');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(page.locator('#result .tag .lbl').first()).toContainText('Cuentas');
  });

  test('an offer marked «solo oferta» has no phase and keeps the headline', async ({ page }) => {
    await loadOffers(page, sample, SOLO_OFERTA);
    await expect(page.locator('#fichaPhase')).toBeHidden();
    await expect(page.locator('#result .tag .lbl').first()).toContainText('Se gana');
  });

  test('with no cobros nothing is claimed: the accrued figure, and no accusation', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('#result .tag .lbl').first()).toHaveText(/devengado/i);
    await expect(page.locator('#result')).not.toContainText('Debe el ganadero');
    await expect(page.locator('#result')).not.toContainText('mínimo legal');
  });

  test('tapping a day changes the counts and the money; tapping it back leaves the offer’s own', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => {
      Object.assign(app.active().terms, { payUnit: 'day', payAmount: 80 });
      app.select(app.active().id);
    });
    await page.locator('details[data-fold=days] > summary').click();
    const counts = page.locator('.cal .counts');
    const accrued = page.locator('.cal .row', { hasText: 'Devengado' });
    const first = await counts.textContent();
    const money = amount(await accrued.locator(':scope > :last-child').textContent());
    await page.locator('.cal .day.work').first().click();
    await expect(counts).not.toHaveText(first);
    await expect(page.locator('.cal')).toContainText('1 jornada menos que la oferta');
    expect(amount(await accrued.locator(':scope > :last-child').textContent())).toBeLessThan(money);
    await page.locator('.cal .day.off').first().click();
    await page.locator('.cal .day.off').first().click();
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('the calendar only reaches months that have started, and the current one cannot be closed yet', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.locator('details[data-fold=days] > summary').click();
    await expect(page.locator('.cal h3')).toHaveText('Agosto 2026');
    await expect(page.locator('.cal .nav[aria-label="Mes siguiente"]')).toBeDisabled();
    await expect(page.locator('.cal')).toContainText('Se podrá cerrar cuando acabe el mes');
    await page.locator('.cal .nav[aria-label="Mes anterior"]').click();
    await expect(page.locator('.cal h3')).toHaveText('Julio 2026');
    await expect(page.locator('[data-action=closeMonth]')).toHaveText('Cerrar julio');
  });

  test('a cobro: the sheet, the debt, the last two in Cobros and every one in Registro', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    const owed = amount(await big(page).textContent());
    await page.locator('[data-action=openPaySheet]').click();
    await expect(page.locator('#paySheet')).toBeVisible();
    await expect(page.locator('#payDate')).toHaveValue('2026-08-12');
    await page.locator('#payForm button[type=submit]').click();
    await expect(page.locator('#payError')).toContainText('cantidad');
    await page.locator('#payAmount').fill('300');
    await page.locator('#paySheet [data-via=cash]').click();
    await page.locator('#payNote').fill('adelanto');
    await page.locator('#payForm button[type=submit]').click();
    await expect(page.locator('#paySheet')).toBeHidden();
    expect(amount(await big(page).textContent())).toBeLessThan(owed);
    await expect(page.locator('.cobros .pr').first()).toContainText('En mano');
    await expect(page.locator('.cobros .pr').first()).toContainText('adelanto');
    // The way is remembered
    await page.locator('[data-action=openPaySheet]').click();
    await expect(page.locator('#paySheet [data-via=cash]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-action=payCancel]').click();
    await page.locator('details[data-fold=record] > summary').click();
    await expect(page.locator('details[data-fold=record] .pr')).toHaveCount(2);
    const rm = page.locator('details[data-fold=record] .rm').first();
    await rm.click();
    await expect(rm).toHaveText('¿Quitar?');
    await rm.click();
    await expect(page.locator('details[data-fold=record] .pr')).toHaveCount(1);
  });

  test('the record is saved with the offer', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cj.ofertas2'))[1].mine.record.payments);
    expect(saved).toHaveLength(1);
  });
});

test.describe('finished', () => {
  test.use({ today: '2026-11-12' });

  test('«Cuentas»: what is owed by item and reason, the cash apart and a deadline per month', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 1000, via: 'payroll' },
      { date: '2026-08-20', amount: 300, via: 'cash' },
    ]);
    await expect(page.locator('#result .tag .lbl').first()).toContainText('debe el ganadero');
    await expect(page.locator('#result')).toContainText('Lo pactado');
    await expect(page.locator('#result')).toContainText('De lo cobrado, en mano');
    await expect(page.locator('#result')).toContainText('Plazo para reclamar');
    await expect(page.locator('#result')).toContainText('Meses por cerrar');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('Back leaves «Repasar los meses» for the ficha, and finishing it leaves no stale entry', async ({ page }) => {
    const index = () => page.evaluate(() => navigation.currentEntry?.index);
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const ficha = await index();
    await page.locator('[data-action=reviewStart]').click();
    await expect(page.locator('.review-progress')).toBeVisible();
    expect(await index()).toBe(ficha + 1);
    await page.goBack();
    await expect(page.locator('.review-progress')).toHaveCount(0);
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('[data-action=reviewStart]')).toBeVisible();
    expect(await index()).toBe(ficha);
    // Through to the end and out by its own button: the entry is dropped
    await page.locator('[data-action=reviewStart]').click();
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.locator('#result')).toContainText('Repaso hecho');
    await page.getByRole('button', { name: 'Volver a las cuentas' }).click();
    await expect(page.locator('[data-action=reviewStart]')).toBeVisible();
    await expect.poll(index).toBe(ficha);
    // The calendar is a fold: opening it pushes nothing
    await page.locator('details[data-fold=days] > summary').click();
    expect(await index()).toBe(ficha);
  });

  test('the claim is copied from what the record shows', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await page.getByRole('button', { name: 'Copiar texto de la reclamación' }).click();
    await expect(page.locator('#result .copy-msg[role=status]')).toHaveText('Texto copiado.');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/Cobrado: 1\.000\s€ netos en 1 cobro/);
    expect(text).toMatch(/Queda por pagar, bruto/);
  });

  test('«Repasar los meses» goes month by month; nothing is closed without its calendar', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.locator('.tocl button')).toHaveCount(0);
    await page.locator('[data-action=reviewStart]').click();
    await expect(page.locator('.review-progress')).toContainText('Junio, 1 de 4');
    await expect(page.locator('.cal .grid .day').first()).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await expect(page.locator('.review-progress')).toContainText('Julio, 2 de 4');
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.locator('.review-progress')).toContainText('Agosto, 3 de 4');
    // A day can be changed in the review
    await page.locator('.cal .day.work').first().click();
    await page.getByRole('button', { name: 'Cerrar agosto' }).click();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.locator('#result')).toContainText('Repaso hecho');
    await expect(page.locator('#result')).toContainText('2 meses cerrados');
    await expect(page.locator('#result')).toContainText('Siguen según la oferta: julio, septiembre');
    await page.getByRole('button', { name: 'Volver a las cuentas' }).click();
    await expect(page.locator('#result')).toContainText('Con 2 meses según la oferta');
  });

  test('a closed month stays as it was when the offer’s days off change; reopening asks first', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.locator('details[data-fold=days] > summary').click();
    await expect(page.locator('.cal h3')).toHaveText('Junio 2026');
    const counts = await page.locator('.cal .counts').textContent();
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await expect(page.locator('.cal .state')).toHaveText('Cerrado');
    await expect(page.locator('.cal .day[data-action]')).toHaveCount(0);
    await page.evaluate(() => {
      app.active().terms.daysOff = 12;
      app.select(app.active().id);
    });
    await expect(page.locator('.cal .counts')).toHaveText(counts ?? '');
    await page.locator('.cal .nav[aria-label="Mes siguiente"]').click();
    await expect(page.locator('.cal .counts')).not.toHaveText(counts ?? '');
    await page.locator('.cal .nav[aria-label="Mes anterior"]').click();
    await page.getByRole('button', { name: 'Reabrir' }).click();
    await expect(page.locator('.cal .confirm')).toContainText('¿Reabrir junio?');
    await page.locator('[data-action=reopenNo]').click();
    await expect(page.locator('.cal .state')).toHaveText('Cerrado');
    await page.getByRole('button', { name: 'Reabrir' }).click();
    await page.locator('[data-action=reopenYes]').click();
    await expect(page.locator('.cal .state')).toHaveText('Según la oferta');
  });

  for (const scheme of ['light', 'dark']) {
    test(`nothing is wider than 375 px (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await loadOffers(page, sample, PUERTO_A_OTRA);
      await addPayments(page, [
        { date: '2026-07-05', amount: 1000, via: 'payroll', note: 'una nota bastante larga para ver cómo se parte' },
      ]);
      await page.locator('details[data-fold=days] > summary').click();
      await page.locator('details[data-fold=record] > summary').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      const wide = await page.evaluate(
        () => [...document.querySelectorAll('#result *')].filter((e) => e.getBoundingClientRect().right > 376).length,
      );
      expect(wide).toBe(0);
    });
  }
});

test.describe('the cards', () => {
  test.use({ today: '2026-11-12' });

  const card = (page, name) => page.locator('#cards .ocard', { hasText: name }).first();

  test('a pill for the phase, none for an offer only offered; a line for a job worked', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => app.showTab('offers'));
    await expect(card(page, 'Puerto A, otra cuenta').locator('.phase')).toHaveText('Acabada');
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-rec')).toContainText('Sin cobros apuntados');
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-rec')).toContainText('4 meses sin cerrar');
    await expect(card(page, 'Campaña B').locator('.phase')).toHaveText('Acabada');
    await expect(card(page, 'Temporada F').locator('.phase')).toHaveCount(0);
    await expect(card(page, 'Puerto A').first().locator('.oc-name .phase')).toHaveCount(0); // solo oferta
    await expect(card(page, 'Puerto A').first().locator('.oc-rec')).toHaveCount(0);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await page.evaluate(() => app.showTab('offers'));
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-rec')).toContainText(/Debe el ganadero [\d.,]+\s€/);
  });

  test('a job under way, and one not decided yet', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await at(page, '2026-08-12');
    await page.evaluate(() => app.showTab('offers'));
    await expect(card(page, 'Puerto A, otra cuenta').locator('.phase')).toHaveText('En curso');
    await at(page, '2026-05-01');
    await reselect(page);
    await page.evaluate(() => app.showTab('offers'));
    await expect(card(page, 'Puerto A, otra cuenta').locator('.phase')).toHaveText('Por decidir');
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-rec')).toHaveCount(0);
  });
});
