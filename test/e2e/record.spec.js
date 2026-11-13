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
    await expect(page.locator('#result .tag .lbl').first()).toHaveText(/corresponde/i);
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
    const accrued = page.locator('.cal .row', { hasText: 'Corresponde' });
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

  test('En curso keeps the full analysis below, and its figures are net', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.locator('#result .analysis-title')).toHaveText('Análisis');
    await expect(page.locator('#secEmployer')).toBeVisible();
    await expect(page.locator('details[data-fold=analysis]')).toHaveCount(0);
    await expect(page.locator('#result')).toContainText('Cantidades netas: lo que llega, sin retenciones.');
    await expect(
      page.locator('#result .rows', { hasText: 'Corresponde' }).locator('.row', { hasText: /^Cobrado/ }),
    ).toContainText('1.000');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('a cobro: the sheet, the debt, the last two in Cobros and every one in place, each removable', async ({
    page,
  }) => {
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
    await expect(page.locator('.cobros .pr')).toHaveCount(2);
    await page.getByRole('button', { name: 'Ver todos los cobros' }).click();
    await expect(page.locator('.cobros .pr')).toHaveCount(2);
    const rm = page.locator('.cobros .rm').first();
    await rm.click();
    await expect(rm).toHaveText('¿Quitar?');
    await rm.click();
    await expect(page.locator('.cobros .pr')).toHaveCount(1);
    await expect(page.locator('details[data-fold=record]')).toHaveCount(0); // no Registro fold
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
    await expect(page.locator('#result')).toContainText('De lo cobrado, en mano');
    await expect(page.locator('#result')).toContainText('Cantidades netas: lo que llega, sin retenciones.');
    for (const gone of ['Plazo para reclamar', 'Meses por cerrar', 'Lo que debe el ganadero', 'Cantidades brutas'])
      await expect(page.locator('#result')).not.toContainText(gone);
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('one list by months: state, what is owed, deadline; «Repasar los meses» right under it', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const list = page.locator('#result .tocl');
    await expect(list.locator('> div')).toHaveCount(4);
    await expect(list.locator('> div').first()).toContainText('Junio');
    await expect(list.locator('> div').first()).toContainText('según la oferta');
    await expect(list).toContainText(/hasta el \d+ \w+ 2027 · quedan \d+ días/);
    await expect(page.locator('#result')).toContainText('ET art. 59.2');
    const after = await page.evaluate(() => {
      const list = document.querySelector('#result .tocl');
      const button = document.querySelector('[data-action=reviewStart]');
      return (
        !!(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        button.previousElementSibling === list
      );
    });
    expect(after).toBe(true);
  });

  test('one ledger in net: items add up to the accrued, minus what arrived is what is owed', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const ledger = page.locator('#result .block', { hasText: 'Por conceptos' });
    await expect(ledger.locator('.row')).toContainText([
      'Salario',
      'Plus de pernocta',
      'Vacaciones',
      'Corresponde',
      'Cobrado',
      'Debe el ganadero',
    ]);
    await expect(ledger.locator('.row', { hasText: /^Cobrado/ }).locator(':scope > :last-child')).toHaveText(
      /^−\s*1\.000\s€$/,
    );
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    // The big figure is the debt of the ledger
    const owed = amount(
      await ledger.locator('.row', { hasText: 'Debe el ganadero' }).locator(':scope > :last-child').textContent(),
    );
    expect(amount(await big(page).textContent())).toBe(owed);
    // The reason is given only where the minimum applies
    await expect(ledger).not.toContainText('El mínimo legal');
    await page.evaluate(() => {
      Object.assign(app.active().terms, { payAmount: 700, cashMode: 'amount', cashAmount: 0 }); // the cash agreed counts toward the minimum
      app.select(app.active().id);
    });
    await expect(ledger.locator('.row', { hasText: 'Salario' })).toContainText('El mínimo legal');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('what was agreed in hand is a line of the ledgers: Cuentas, Hasta hoy, the calendar; none without cash', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await page.locator('details[data-fold=days] > summary').click();
    const lines = page.locator('#result .block .rows .row, #result .cal .rows .row', { hasText: /^\+?\s*En negro/ });
    await expect(lines).toHaveCount(2); // Cuentas, and the month on the calendar
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    await at(page, '2026-08-12');
    await reselect(page);
    await expect(
      page.locator('#result .block .rows .row, #result .cal .rows .row', { hasText: /^\+?\s*En negro/ }),
    ).toHaveCount(2); // Hasta hoy, calendar
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    await at(page, '2026-11-12');
    await loadOffers(page, sample, 3); // Invernada C: no cash
    await expect(page.locator('#result')).not.toContainText('En negro');
  });

  test('more arrived than corresponds: the ledger reads once, with one row more and nothing extra at zero', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const ledger = page.locator('#result .block', { hasText: 'Por conceptos' });
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(ledger).not.toContainText('Cobrado de más');
    await addPayments(page, [{ date: '2026-07-06', amount: 20000, via: 'payroll' }]);
    await expect(ledger.locator('.row', { hasText: 'Corresponde' })).toHaveCount(1);
    await expect(ledger.locator('.row', { hasText: /^Cobrado de más/ })).toHaveCount(1);
    await expect(
      ledger
        .locator('.row', { hasText: /^= Debe el ganadero/ })
        .or(ledger.locator('.row', { hasText: /^Debe el ganadero/ })),
    ).toContainText('0 €');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });

  test('«¿Es legal?» is a row with its verdict after «Días»; the rest of the analysis is one closed fold', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const legal = page.locator('details[data-fold=legalRow]');
    await expect(legal.locator(':scope > summary')).toContainText(/¿Es legal\?\s*No cumple: /);
    await expect(legal).not.toHaveAttribute('open', '');
    const order = await page.evaluate(() => {
      const at = (sel) => document.querySelector(sel);
      const follows = (a, b) => !!(at(a).compareDocumentPosition(at(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return [
        follows('details[data-fold=days]', 'details[data-fold=legalRow]'),
        follows('details[data-fold=legalRow]', 'details[data-fold=analysis]'),
      ];
    });
    expect(order).toEqual([true, true]);
    await legal.locator(':scope > summary').click();
    await expect(legal.locator('.verdict')).toContainText('no cumple la ley');
    const fold = page.locator('details[data-fold=analysis]');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator(':scope > summary')).toHaveText('Análisis de la oferta');
    await expect(page.locator('#secEmployer')).toHaveCount(1); // «Para negociar», only inside the fold
    await expect(fold.locator('#secEmployer')).toHaveCount(1);
    await expect(fold.locator('[data-fold=breakdown2]')).toHaveCount(1);
    await expect(fold.locator('[data-fold=workings]')).toHaveCount(1);
    await expect(page.locator('#result .analysis-title')).toHaveCount(0);
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
    await expect(page.locator('#result')).toContainText('2 meses según la oferta');
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
      await page.getByRole('button', { name: 'Ver todos los cobros' }).click();
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
