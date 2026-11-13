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

test.describe('under way: Registro', () => {
  test.use({ today: '2026-08-12' });

  const tile = (page, name) => page.locator('.sofar > div', { hasText: name }).locator('b');
  const strip = (page, month) => page.locator(`.strip button[data-key="${month}"]`);

  test('the phase comes from the date: Registro under way, the offer before, and the offer’s headline back', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await expect(page.locator('#result h2.mode')).toContainText('Registro');
    await expect(page.locator('.conditions')).toBeVisible(); // every mode starts with the agreed conditions
    await at(page, '2026-05-01');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('Por decidir');
    await expect(page.locator('#result .tag .lbl').first()).toContainText('Se gana');
    await expect(page.locator('#result h2.mode')).toHaveCount(0);
  });

  test('an offer marked «solo oferta» has no phase and keeps the headline', async ({ page }) => {
    await loadOffers(page, sample, SOLO_OFERTA);
    await expect(page.locator('#fichaPhase')).toBeHidden();
    await expect(page.locator('#result .tag .lbl').first()).toContainText('Se gana');
  });

  test('the strip of months: closed, to close, in progress and to come; the one tapped opens below', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    await expect(page.locator('.strip button')).toHaveCount(4);
    await expect(strip(page, '2026-06')).toContainText('por cerrar');
    await expect(strip(page, '2026-08')).toContainText('en curso');
    await expect(strip(page, '2026-09')).toContainText('por venir');
    await expect(strip(page, '2026-09')).toBeDisabled();
    await expect(strip(page, '2026-08')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.days h3')).toHaveText('Agosto 2026');
    await expect(page.locator('.nudge')).toContainText('Junio, por cerrar');
    await page.locator('.nudge [data-action=selectMonth]').click();
    await expect(page.locator('.days h3')).toHaveText('Junio 2026');
    // The month that ended can be closed, from its calendar; the current one cannot yet
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await expect(strip(page, '2026-06')).toContainText('cerrado');
    await expect(page.locator('.days .state')).toHaveText('Cerrado');
    await strip(page, '2026-08').click();
    await expect(page.locator('[data-action=closeMonth]')).toHaveCount(0);
    await expect(page.locator('.days')).toContainText('Se podrá cerrar cuando acabe el mes');
  });

  test('with no cobros nothing is claimed: Corresponde and a prompt, no Falta and no accusation', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(tile(page, 'Falta')).toHaveText('—');
    await expect(page.locator('#result')).toContainText('Aún no hay cobros apuntados');
    await expect(page.locator('#result')).not.toContainText('mínimo legal');
    await expect(page.locator('#result')).not.toContainText('Debe el ganadero');
  });

  test('Corresponde − Cobrado = Falta, in net; a cobro lowers Falta; the neutral line when it is exceeded', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    const figures = async () => ({
      corresponde: amount(await tile(page, 'Corresponde').textContent()),
      cobrado: amount(await tile(page, 'Cobrado').textContent()),
      falta: amount(await tile(page, 'Falta').textContent()),
    });
    const before = await figures();
    expect(before.cobrado).toBe(400);
    expect(Math.round((before.corresponde - before.cobrado) * 100) / 100).toBe(before.falta);
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
    const after = await figures();
    expect(after.cobrado).toBe(700);
    expect(after.falta).toBeLessThan(before.falta);
    await expect(tile(page, 'Cobrado').locator('..').locator('small')).toContainText('de ello, en mano');
    // More than corresponds: Falta 0 and one neutral line, never «de más»
    await addPayments(page, [{ date: '2026-07-06', amount: 20000, via: 'payroll' }]);
    await expect(tile(page, 'Falta')).toHaveText(/^0\s€$/);
    await expect(page.locator('#result')).toContainText(
      'las retenciones reales de la nómina suelen diferir de las simuladas',
    );
    for (const gone of ['de más', 'adelantado', 'Debe el ganadero'])
      await expect(page.locator('#result .block').first()).not.toContainText(gone);
  });

  test('«Sin cobros en mano apuntados» when cash was agreed and none was cobrado en mano', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    await expect(page.locator('#result')).toContainText('Sin cobros en mano apuntados');
    await addPayments(page, [{ date: '2026-07-06', amount: 100, via: 'cash' }]);
    await expect(page.locator('#result')).not.toContainText('Sin cobros en mano apuntados');
  });

  test('tapping a day of a month that ended changes the counts and Corresponde; tapping it back leaves the offer’s own', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => {
      Object.assign(app.active().terms, { payUnit: 'day', payAmount: 80, cashMode: 'amount', cashAmount: 0 });
      app.select(app.active().id);
    });
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    await strip(page, '2026-07').click();
    const counts = page.locator('.cal .counts');
    const month = page.locator('.cal .row', { hasText: 'Corresponde de julio' }).locator(':scope > :last-child');
    const first = await counts.textContent();
    const monthMoney = amount(await month.textContent());
    const total = amount(await tile(page, 'Corresponde').textContent());
    await page.locator('.cal .day.work').first().click();
    await expect(counts).not.toHaveText(first);
    await expect(page.locator('.cal')).toContainText('1 jornada menos que la oferta');
    expect(amount(await month.textContent())).toBeLessThan(monthMoney);
    expect(amount(await tile(page, 'Corresponde').textContent())).toBeLessThan(total);
    await page.locator('.cal .day.off').first().click();
    await page.locator('.cal .day.off').first().click();
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('the rest of the offer’s analysis is one closed fold below, with «Para negociar» inside', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const fold = page.locator('details[data-fold=analysis]');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator(':scope > summary')).toHaveText('Análisis de la oferta');
    await expect(fold.locator('#secEmployer')).toHaveCount(1);
    await expect(page.locator('#result .analysis-title')).toHaveCount(0);
  });

  test('every cobro is listed in place and removable with two taps; the last two stay in Cobros', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 400, via: 'payroll' },
      { date: '2026-07-06', amount: 100, via: 'cash' },
      { date: '2026-07-07', amount: 50, via: 'cash' },
    ]);
    await expect(page.locator('.cobros .pr')).toHaveCount(2);
    await page.getByRole('button', { name: 'Ver todos los cobros' }).click();
    await expect(page.locator('.cobros .pr')).toHaveCount(3);
    const rm = page.locator('.cobros .rm').first();
    await rm.click();
    await expect(rm).toHaveText('¿Quitar?');
    await rm.click();
    await expect(page.locator('.cobros .pr')).toHaveCount(2);
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
