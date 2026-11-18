// What happened (ADR-0032): the ficha by phase, the calendar, the cobros and the review. The date is set, not the real one.

import {
  closeRegistro,
  expect,
  loadOffers,
  openAccounts,
  openLegalPage,
  openRegistro,
  sample,
  test,
  tileOf,
} from './fixtures.js';
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
  const strip = (page, month) => page.locator(`.monthstrip button[data-key="${month}"]`);

  test('the phase comes from the date: Registro under way, the offer before, and the offer’s headline back', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    // A job is taken as started on its date: nothing to confirm
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await expect(page.locator('#result h2.mode')).toContainText('Hasta hoy');
    await expect(page.locator('.conditions')).toBeVisible(); // every mode starts with the agreed conditions
    // Under way, the figures come first: the title and its tiles, then the days
    expect(
      await page
        .locator('#result > :not(.conditions)')
        .first()
        .evaluate((e) => e.matches('h2.mode')),
    ).toBe(true);
    expect(await page.locator('#result > .block').first().locator('.sofar').count()).toBe(1);
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
    await openRegistro(page);
    await expect(page.locator('.monthstrip button')).toHaveCount(4);
    await expect(strip(page, '2026-06')).toContainText('por cerrar');
    await expect(strip(page, '2026-08')).toContainText('en curso');
    await expect(strip(page, '2026-09')).toContainText('por venir');
    await expect(strip(page, '2026-09')).toBeDisabled();
    await expect(strip(page, '2026-08')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.days h3')).toHaveText('Agosto 2026');
    await expect(page.locator('.nudge')).toContainText('Junio y julio, por cerrar');
    await closeRegistro(page);
    await page.locator('.nudge [data-action=openRegistro]').click();
    await expect(page.locator('#registroPage')).toBeVisible();
    await expect(page.locator('.days h3')).toHaveText('Junio 2026');
    // The month that ended can be closed, from its calendar; the current one cannot yet
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await expect(strip(page, '2026-06')).toContainText('cerrado');
    await expect(page.locator('.days .state')).toHaveText('Cerrado');
    await strip(page, '2026-08').click();
    await expect(page.locator('[data-action=closeMonth]')).toHaveCount(0);
    await expect(page.locator('.days')).toContainText('Se podrá cerrar cuando acabe el mes');
  });

  test('the calendar marks the holidays of the offer’s place, with their names; nothing elsewhere', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const place = (terms) =>
      page.evaluate((terms) => {
        Object.assign(app.active().terms, terms);
        app.select(app.active().id);
      }, terms);
    await place({ municipality: '22252', province: 'HU' });
    await openRegistro(page);
    await expect(page.locator('.days h3')).toHaveText('Agosto 2026');
    const fests = page.locator('.days .day.fest');
    await expect(fests).toHaveCount(2);
    await expect(fests.first()).toHaveAttribute('title', 'San Lorenzo');
    await expect(fests.first()).toHaveAttribute('aria-label', /^10 de agosto: .*; festivo: San Lorenzo$/);
    await expect(page.locator('.days .fests')).toHaveText(
      'Festivos: día 10, San Lorenzo · día 15, Asunción de la Virgen.',
    );
    await strip(page, '2026-06').click();
    await expect(page.locator('.days .day.fest')).toHaveCount(1);
    await expect(page.locator('.days .fests')).toHaveText('Festivo: día 25, Santa Orosia.');
    // A holiday is only marked: the day is still a jornada, a tap still turns it libre
    const day = page.locator('.days .day.fest');
    await expect(day).toHaveClass(/work/);
    // Without data for the province nothing is marked
    await place({ municipality: '', province: 'M' });
    await expect(page.locator('.days .day.fest')).toHaveCount(0);
    await expect(page.locator('.days .fests')).toHaveCount(0);
  });

  test('an offer that takes the holidays off has them libre on the calendar', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => {
      Object.assign(app.active().terms, { municipality: '22252', province: 'HU', holidays: 'yes' });
      app.select(app.active().id);
    });
    await openRegistro(page);
    const fests = page.locator('.days .day.fest');
    await expect(fests).toHaveCount(2);
    await expect(fests.first()).toHaveClass(/off/);
    await expect(fests.first()).toHaveAttribute('aria-label', /libre; festivo: San Lorenzo/);
  });

  test('with no cobros nothing is claimed: Corresponde and a prompt, no Falta and no accusation', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(tile(page, 'Falta')).toHaveText('—');
    await expect(page.locator('#result')).toContainText('Aún no hay cobros apuntados');
    await expect(page.locator('#result')).not.toContainText('mínimo legal');
    await expect(page.locator('#result')).not.toContainText('Debe');
  });

  test('Cobrado names a way only where the money came by two: all in hand is one plain figure', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'cash' }]);
    await expect(tile(page, 'Cobrado')).toContainText('400');
    await expect(page.locator('.sofar > div', { hasText: 'Cobrado' })).not.toContainText('en mano');
    await addPayments(page, [{ date: '2026-07-20', amount: 300, via: 'payroll' }]);
    await expect(page.locator('.sofar > div', { hasText: 'Cobrado' })).toContainText('de ello, en mano 400');
  });

  test('«Final de campaña» says «En nómina y en negro» only where the pay comes both ways', async ({ page }) => {
    const title = page.locator('#secSeason .figcard .t b');
    const legend = page.locator('#secSeason .rc-legend');
    await loadOffers(page, sample, 1); // payroll and en negro
    await expect(title).toHaveText('En nómina y en negro');
    await expect(legend).toHaveCount(1);
    await loadOffers(page, sample, 5); // payroll only
    await expect(title).toHaveText('En nómina');
    await expect(legend).toHaveCount(0);
    await loadOffers(page, sample, 4); // no contract: all en negro
    await expect(title).toHaveText('En negro');
    await expect(legend).toHaveCount(0);
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
    await page.locator('#result [data-action=openPaySheet]').click();
    await expect(page.locator('#paySheet')).toBeVisible();
    await expect(page.locator('#payDate')).toHaveValue('2026-08-12');
    await page.locator('#payForm .btns .pri').click();
    await expect(page.locator('#payError')).toContainText('cantidad');
    await page.locator('#payAmount').fill('300');
    await page.locator('#paySheet [data-via=cash]').click();
    await page.locator('#payExtra > summary').click();
    await page.locator('#payNote').fill('adelanto');
    await page.locator('#payForm .btns .pri').click();
    await expect(page.locator('#paySheet')).toBeHidden();
    const after = await figures();
    expect(after.cobrado).toBe(700);
    expect(after.falta).toBeLessThan(before.falta);
    await expect(tile(page, 'Cobrado').locator('..').locator('small')).toContainText('de ello, en mano');
    // More than corresponds: Falta 0 and one neutral line, never «de más»
    await addPayments(page, [{ date: '2026-07-06', amount: 20000, via: 'payroll' }]);
    await expect(tile(page, 'Falta')).toHaveText(/^0\s€$/);
    await expect(page.locator('#result')).toContainText(
      'más de lo que corresponde hasta hoy: puede ser un plus que no se pactó (transporte, dietas) o una retención menor que la calculada.',
    );
    for (const gone of ['de más', 'adelantado', 'Debe'])
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
    await openRegistro(page);
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
    // The headline card, with its pills, opens the fold, as in «Por decidir»
    await fold.locator(':scope > summary').click();
    await expect(fold.locator(':scope > .tag .lbl')).toContainText('Se gana');
    await expect(fold.locator(':scope > .pills .pill').first()).toBeVisible();
    expect(await fold.evaluate((d) => d.querySelector('summary').nextElementSibling.matches('.q'))).toBe(true);
  });

  test('every cobro is listed in Cobros and removable with two taps, with no «ver todos» to open', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 400, via: 'payroll' },
      { date: '2026-07-06', amount: 100, via: 'cash' },
      { date: '2026-07-07', amount: 50, via: 'cash' },
    ]);
    await expect(page.locator('#result .cobros .pr')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Ver todos/ })).toHaveCount(0);
    const rm = page.locator('#result .cobros .pr .rm:has-text("Quitar")').first();
    await rm.click();
    await expect(rm).toHaveText('¿Quitar?');
    await rm.click();
    await expect(page.locator('#result .cobros .pr')).toHaveCount(2);
  });

  test('the record is saved with the offer', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cj.ofertas2'))[1].mine.record.payments);
    expect(saved).toHaveLength(1);
  });
});

test.describe('finished: Cuentas', () => {
  test.use({ today: '2026-11-12' });

  test('«Días: como lo pactado · Cerrar los meses»: the months with their counts, and one tap closes them all as shown', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const block = page.getByRole('group', { name: 'Cerrar los meses' });
    await expect(block.locator('.ck')).toHaveText('Días: como lo pactado');
    // The summary of the months comes before the button: junio to septiembre, with their counts
    const months = block.locator('.closeall-months li');
    await expect(months).toHaveCount(4);
    await expect(months.first()).toContainText('Junio');
    await expect(months.first()).toContainText(/\d+ jornadas? · \d+ libres?/);
    // The law checks wait for closed months
    await expect(page.locator('#result .lawcheck')).not.toContainText('Descanso semanal');
    const before = await page.evaluate(() => Object.keys(app.active().mine.record.months));
    expect(before).toEqual([]);
    await block.getByRole('button', { name: 'Cerrar los meses' }).click();
    await expect(block).toHaveCount(0);
    const record = await page.evaluate(() => app.active().mine.record.months);
    expect(Object.keys(record)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
    for (const month of Object.values(record)) expect(month.closed).toBe(true);
    await expect(page.locator('#result .registro-link')).toContainText('4 meses cerrados');
    await expect(page.locator('#result .lawcheck')).toContainText('Descanso semanal');
  });

  const tile = tileOf;
  /** Whether the first element matching `a` comes before the first matching `b`; `h2:text` picks a heading by its text. */
  const after = (page, a, b) =>
    page.evaluate(
      ([a, b]) => {
        const find = (sel) =>
          sel.startsWith('h2:')
            ? [...document.querySelectorAll('#result h2')].find((h) => h.textContent.trim() === sel.slice(3))
            : document.querySelector(sel);
        return !!(find(a).compareDocumentPosition(find(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      },
      [a, b],
    );

  test('the result first: the yellow block right after the conditions, then the cobros, what the work left, the law, the claim and the chores', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 1000, via: 'payroll' },
      { date: '2026-08-20', amount: 300, via: 'cash' },
    ]);
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(page.locator('.conditions')).toBeVisible();
    // The result block is the first thing after the conditions, then the questions, the cobros and the days
    const first = await page.evaluate(() => document.querySelector('#result .block')?.classList.contains('result'));
    expect(first).toBe(true);
    expect(await after(page, '.conditions', '#result .block.result')).toBe(true);
    expect(await after(page, '#result .block.result', '#result .block.cobros')).toBe(true);
    expect(await after(page, '#result .block.result', '#result .tcard-q')).toBe(true); // ¿Cómo acabó?
    expect(await after(page, '#result .block.cobros', '.registro-link')).toBe(true);
    // The order of the rest
    const order = [
      '#result .result',
      '.registro-link',
      'h2:Balance del trabajo',
      'h2:¿Se cumplió la ley?',
      'h2:Pedir lo que falta',
      'details[data-fold=reference]',
    ];
    for (let i = 0; i < order.length - 1; i++)
      expect(await after(page, order[i], order[i + 1]), `${order[i]} before ${order[i + 1]}`).toBe(true);
    // Gone: the numbered steps, the old names and the second path to the review
    for (const gone of [
      'Regularizar',
      'Registrar lo que falta',
      'Repasar los meses',
      'Cuánto se debe',
      'Por conceptos',
      'Abrir',
      'Para negociar',
    ])
      await expect(page.locator('#result')).not.toContainText(gone);
    await expect(page.locator('.regstep')).toHaveCount(0);
    await expect(page.locator('#secEmployer')).toHaveCount(0);
  });

  test('«Debe» says Falta once: no stamp and no Falta tile beside it; nothing recorded has no headline', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('.block.result .tag')).toHaveCount(0); // no cobro yet: only the tiles
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta'); // nothing is known to be owed yet
    await expect(page.locator('.block.result .tag')).not.toHaveClass(/owed/); // yellow, not red
    await page
      .getByRole('group', { name: '¿Se espera algún pago más?' })
      .getByRole('button', { name: 'No', exact: true })
      .click();
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Debe');
    await expect(page.locator('.block.result .tag')).toHaveClass(/owed/);
    // red, the colour of the claim: not the yellow of the other states
    await expect(page.locator('.block.result .tag')).toHaveCSS('background-color', 'rgb(176, 67, 45)');
    await expect(page.locator('.block.result .stamp')).toHaveCount(0);
    await expect(page.locator('.block.result .sofar > div')).toHaveCount(2);
    await addPayments(page, [{ date: '2026-07-06', amount: 50000, via: 'payroll' }]);
    await expect(page.locator('.block.result .sofar > div')).toHaveCount(3); // all cobrado: calm, with its green tile
    await expect(page.locator('.sofar .f')).toHaveClass(/ok/);
  });

  test('Corresponde − Cobrado = Falta, in net, and the headline is Falta', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const corresponde = amount(await tile(page, 'Corresponde').textContent());
    const cobrado = amount(await tile(page, 'Cobrado').textContent());
    const falta = amount(await tile(page, 'Falta').textContent());
    expect(cobrado).toBe(1000);
    expect(Math.round((corresponde - cobrado) * 100) / 100).toBe(falta);
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta');
    expect(amount(await page.locator('.block.result .tag .big').textContent())).toBe(falta);
    // «en neto» once, beside the title, and not repeated in each block
    await expect(page.locator('#result h2.mode .net')).toHaveText('en neto');
    await expect(page.locator('#result')).not.toContainText('Cantidades netas');
  });

  test('months not closed: one action, «Revisar los meses», and the line that the figure is not firm; none once all are closed', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.getByRole('button', { name: 'Revisar los meses' })).toHaveCount(1);
    await expect(page.locator('.block.result .tag .sub')).toContainText(
      '4 meses según la oferta: la cifra no es firme hasta cerrarlos',
    );
    await closeMonths(page, 'all');
    await expect(page.getByRole('button', { name: 'Revisar los meses' })).toHaveCount(0);
    await expect(page.locator('.block.result .tag .sub')).toHaveCount(0);
    // The months are closed; whether a cobro is missing is still to say
    await expect(page.getByRole('group', { name: '¿Se espera algún pago más?' })).toBeVisible();
  });

  test('a temporary contract owes severance at its end: in Corresponde and Falta, and no «Saldado» until it is paid', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await at(page, '2026-11-14');
    await page.evaluate(async () => {
      const { makeOffer } = await import('./src/offer.js');
      const o = makeOffer(
        {
          start: '2026-09-18',
          contract: 'temporary',
          duration: 52,
          durationUnit: 'days',
          hoursPerDay: 8,
          daysOff: 2,
          daysOffUnit: 'week',
          holidays: 'no',
          payType: 'gross',
          payAmount: 1600,
          payUnit: 'month',
          vacation: 'taken',
          overnight: 'no',
        },
        { name: 'Temporal' },
      );
      app.state.offers.push(o);
      app.select(o.id);
    });
    // Paid exactly what the pay comes to: only the severance is missing
    const severance = await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      const { settleOffer, calcOffer } = await import('./src/state.js');
      const o = app.active();
      const x = settleOffer(o);
      const net = calcOffer(o).netFactor;
      const pay = x.totals.due - x.totals.items.severance.due;
      offers.addPayment(o, { date: '2026-11-01', amount: Math.round(pay * net * 100) / 100, via: 'payroll' });
      app.select(o.id);
      return Math.round(x.totals.items.severance.due); // the severance is the same net and gross
    });
    expect(severance).toBeGreaterThan(50);
    // (the headline says what is missing: the severance, not «hasta el mínimo legal»)
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Indemnización por fin de contrato');
    expect(amount(await page.locator('.block.result .tag .big').textContent())).toBeCloseTo(severance, 0);
    await expect(page.locator('#result')).toContainText('Indemnización');
    await expect(page.locator('.block.result .tag .lbl')).not.toHaveText('Saldado');
  });

  test('more cobrado than corresponds: «Saldado» with «Cobrado de más», Falta 0 €, the explanation, and nothing to claim', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 50000, via: 'payroll' }]);
    await expect(tile(page, 'Falta')).toHaveText(/^0\s€$/);
    // Calm: a green «Saldado», no yellow «Debe», no red tile, no prompt for cash, no «no es firme»
    await expect(page.locator('.block.result .tag')).toHaveClass(/saldadas/);
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Saldado');
    await expect(page.locator('.block.result .tag .big')).toHaveCount(0); // no giant tick, no figure
    await expect(page.locator('.block.result .tag .sub')).toContainText(/^Cobrado de más: [\d.]+\s€$/);
    await expect(page.locator('.sofar .f')).toHaveClass(/ok/);
    await expect(page.locator('#result')).not.toContainText('Sin cobros en mano apuntados');
    await expect(page.locator('#result')).not.toContainText('no es firme');
    await expect(page.locator('#result')).toContainText(
      'más de lo que corresponde: puede ser un plus que no se pactó (transporte, dietas) o una retención menor que la calculada.',
    );
    for (const gone of ['pagado de más']) await expect(page.locator('#result')).not.toContainText(gone);
    await expect(page.locator('.block.result .tag .sub')).not.toContainText('debe');
    await expect(page.locator('#result h2', { hasText: 'Pedir lo que falta' })).toHaveCount(0);
    await expect(page.locator('#result h2.mode small')).toHaveCount(0); // no subtitle above «Saldado»
  });

  test('no cobros: Corresponde and a prompt, no debt, the first step only and no deadline', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    await expect(page.locator('.block.result .tag')).toHaveCount(0);
    await expect(tile(page, 'Falta')).toHaveText('—');
    await expect(page.locator('#result')).not.toContainText('Plazo más cercano');
    const ask = page.locator('#result .ask');
    await expect(ask.locator('details.step')).toHaveCount(1);
    await expect(page.locator('#result .cobros').getByRole('button', { name: 'Apuntar un cobro' })).toBeVisible();
    await expect(ask.locator('.claim-text')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vía legal' })).toHaveCount(0);
  });

  test('«Pedir lo que falta»: the message a closed fold, one line with the deadline and the button to the legal page, which holds the one-year deadline and the months', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.locator('#result .ask h2')).toHaveText('Pedir lo que falta');
    await expect(page.locator('details.step[data-step=talk]')).not.toHaveAttribute('open', '');
    await expect(page.locator('#result .ask .due-line')).toContainText(/hasta el \d+ \w+ 2027 \(quedan \d+ días\)/);
    await openLegalPage(page);
    const legal = page.locator('#legalPage');
    await expect(legal.locator('details.step[data-step=request]')).toHaveAttribute('open', '');
    await expect(legal).toContainText(/hasta el \d+ \w+ 2027 · quedan \d+ días/);
    await expect(legal).toContainText('Estatuto, art. 59.2');
    const months = legal.locator('details[data-fold=deadlines]');
    await months.locator(':scope > summary').click();
    await expect(months.locator('.row').first()).toContainText(/hasta el \d+ \w+ 2027/);
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    await expect(legal.locator('.disclaimer')).toContainText('no es asesoramiento legal');
  });

  test('«Balance del trabajo»: estimated while months follow the offer, firm once all are closed; the paro always from the offer', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    await addPayments(page, [
      { date: '2026-07-05', amount: 1000, via: 'payroll' },
      { date: '2026-08-20', amount: 300, via: 'cash' },
    ]);
    const block = page.locator('#result .block', { hasText: 'Balance del trabajo' });
    // What the tiles say is not repeated here; the yellow block says the figure is not firm
    await expect(block).not.toContainText('Corresponde en total');
    await expect(page.locator('.block.result .tag .sub')).toContainText('según la oferta: la cifra no es firme');
    await expect(page.locator('.sofar > div', { hasText: 'Cobrado' })).toContainText('de ello, en mano');
    await expect(block.locator('.row', { hasText: 'Jornadas' })).toContainText('0 en meses cerrados');
    await expect(block.locator('.row', { hasText: 'Paro' })).toContainText('según la oferta');
    // «37 días · 1.427 €»: no «unos», the line already says it follows the offer
    await expect(block.locator('.row', { hasText: 'Paro' })).toContainText(/\d+ días · [\d.]+\s€/);
    await expect(block.locator('.row', { hasText: 'Paro' })).not.toContainText('unos');
    // No rule between the rows of the balance and the fold that splits Corresponde
    await expect(block.locator('details[data-fold=how]')).toHaveCSS('border-top-width', '0px');
    await expect(block).not.toContainText('Simulador de nóminas');
    await closeMonths(page, 'all');
    await expect(page.locator('.block.result .tag .sub')).toHaveCount(0); // the record, not the months, is what is left
    // How it adds up: a closed fold, with En negro only when cash was agreed
    const fold = block.locator('details[data-fold=how]');
    await expect(fold).not.toHaveAttribute('open', '');
    await fold.locator(':scope > summary').click();
    await expect(fold.locator('.row')).toContainText([
      'Salario',
      'Plus de pernocta',
      'Vacaciones',
      'En negro',
      'Corresponde',
    ]);
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    await loadOffers(page, sample, 3); // Invernada C: no cash
    await openAccounts(page);
    await page.locator('details[data-fold=how] > summary').click();
    await expect(page.locator('details[data-fold=how]')).not.toContainText('En negro');
  });

  test('the row «Días» says the months closed or still to close and opens the page with the months', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    const link = page.locator('#result .registro-link');
    await expect(link).toHaveText(/Días\s*4 meses por cerrar/);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(link).toHaveText(/Días\s*4 meses por cerrar/);
    await closeMonths(page, 'all');
    await expect(link).toHaveText(/Días\s*4 meses cerrados/);
    await openRegistro(page);
    await expect(page.locator('#registroPage h1')).toHaveText('Días trabajados');
    await expect(page.locator('#registroPage .monthrow')).toHaveCount(4);
    await expect(page.locator('#registroPage .cobros')).toHaveCount(0);
    await expect(page.locator('#result .cobros')).toHaveCount(1);
  });

  test('«Oferta original» is one closed fold at the end, without «Para negociar», with the simulator', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    const fold = page.locator('details[data-fold=reference]');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator(':scope > summary')).toHaveText('Oferta original');
    await fold.locator(':scope > summary').click();
    await expect(fold.locator(':scope > .tag .lbl')).toContainText('Se gana');
    await expect(fold.locator('[data-fold=breakdown2]')).toHaveCount(1);
    await expect(fold.locator('#secLegal')).toHaveCount(1);
    await expect(fold.locator('[data-fold=payslips]')).toHaveCount(1);
    await expect(fold.locator('[data-fold=workings]')).toHaveCount(1);
    await expect(page.locator('#secEmployer')).toHaveCount(0);
    expect(await after(page, '.registro-link', 'details[data-fold=reference]')).toBe(true);
  });

  /** Closes months of the active offer from the page, as the review would. */
  const closeMonths = (page, months) =>
    page.evaluate(async (months) => {
      const { offers } = await import('./src/offers.js');
      const { settleOffer } = await import('./src/state.js');
      const o = app.active();
      for (const row of settleOffer(o).rows)
        if (months === 'all' || months.includes(row.month))
          offers.closeMonth(o, { key: row.month, from: row.calendarFrom, to: row.calendarTo });
      app.select(o.id);
    }, months);

  test('«¿Se cumplió la ley?» judges facts only: nothing to say with no month closed', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    const block = page.locator('#result .block', { hasText: '¿Se cumplió la ley?' });
    await expect(block).toContainText('Cierra los meses para comprobar el descanso semanal');
    await expect(block).not.toContainText('Descanso semanal');
    // The facts of the terms need no month closed: cash agreed is pay off the payslip
    await expect(block.locator('.lawcheck > div', { hasText: 'Parte en negro' }).locator('.m')).toHaveText('✘');
  });

  test('with some months closed, the rest and the days are judged on those; the bonus and the minimum wait for all of them', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await closeMonths(page, ['2026-06', '2026-07']);
    const block = page.locator('#result .block', { hasText: '¿Se cumplió la ley?' });
    await expect(block).toContainText('sobre 2 de 4 meses cerrados');
    const rows = block.locator('.lawcheck > div');
    await expect(rows.filter({ hasText: 'Descanso semanal' })).toContainText('periodos de 4 semanas');
    await expect(rows.filter({ hasText: 'Jornadas de más' })).toBeVisible();
    // Only rows that can be judged: the minimum on payroll waits for the record to be closed, and says so once
    await expect(rows.filter({ hasText: 'Salario mínimo en nómina' })).toHaveCount(0);
    await expect(block).toContainText(
      'Con todos los cobros apuntados y los meses cerrados se comprueba también el salario mínimo en nómina',
    );
    await expect(block).not.toContainText('festivos trabajados');
    await expect(block).not.toContainText('Se comprobará cuando');
    await expect(page.locator('#result')).not.toContainText('La nómina declarada está');
    // Every month closed, the record still open: still no verdict, which waits for every cobro to be known
    await closeMonths(page, 'all');
    await expect(block).toContainText('sobre 4 de 4 meses cerrados');
    await expect(rows.filter({ hasText: 'Salario mínimo en nómina' })).toHaveCount(0);
  });

  test('«Festivos trabajados» only where the place has holidays: its closed months, the dates and the agreement; no row elsewhere', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const place = (terms) =>
      page.evaluate((terms) => {
        Object.assign(app.active().terms, terms);
        app.select(app.active().id);
      }, terms);
    const block = page.locator('#result .block', { hasText: '¿Se cumplió la ley?' });
    const row = block.locator('.lawcheck > div', { hasText: 'Festivos trabajados' });
    await place({ municipality: '22252', province: 'HU' });
    // Nothing closed, nothing to judge
    await expect(row).toHaveCount(0);
    await closeMonths(page, ['2026-07']);
    await expect(row.locator('.m')).toHaveText('✔');
    await expect(row).toContainText('Ningún festivo trabajado en los meses cerrados');
    // Yebra de Basa: 25 Jun, 10 Aug and 15 Aug fall in the job, all worked as the offer says
    await closeMonths(page, 'all');
    await expect(row.locator('.m')).toHaveText('?');
    await expect(row).toContainText('3 festivos trabajados en meses cerrados: 25 jun, 10 ago, 15 ago');
    await expect(row).toContainText('retribuidos y no recuperables (Estatuto, art. 37.2)');
    await expect(row).toContainText('Convenio colectivo del sector agrícola de la provincia de Huesca, art. 35');
    await expect(row).not.toContainText('Faltan los festivos locales');
    // Another community's agreement is not known: no article. A province with no data: no row at all
    await place({ municipality: '', province: 'Z' });
    await expect(row).toContainText('1 festivo trabajado en meses cerrados: 15 ago');
    await expect(row).not.toContainText('Convenio');
    await expect(row).toContainText('Faltan los festivos locales del municipio, que no constan');
    await place({ municipality: '', province: 'M' });
    await expect(row).toHaveCount(0);
    await expect(block).toContainText('Descanso semanal');
  });

  test('«¿Se espera algún pago más?»: «No» says it, dated, and the line keeps it with «Cambiar»; the minimum is judged once the months are closed as well', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const question = page.getByRole('group', { name: '¿Se espera algún pago más?' });
    // Nothing to ask while no cobro is recorded; nothing to close the record with
    await expect(question).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cerrar el registro' })).toHaveCount(0);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(question).toBeVisible();
    await question.getByRole('button', { name: 'No', exact: true }).click();
    await expect(question).toHaveCount(0);
    expect(await page.evaluate(() => app.active().mine.record.complete)).toEqual({ date: '2026-11-12' });
    const line = page.locator('#result .expect-line');
    await expect(line).toContainText('No se espera más pago.');
    await line.getByRole('button', { name: 'Cambiar' }).click();
    await expect(line).toHaveCount(0);
    await expect(question).toBeVisible();
    expect(await page.evaluate(() => 'complete' in app.active().mine.record)).toBe(false);
    await question.getByRole('button', { name: 'No', exact: true }).click();
    await expect(page.locator('.closed-record')).toHaveCount(0);
    // The months are open: the days and the minimum wait for them
    const block = page.locator('#result .block', { hasText: '¿Se cumplió la ley?' });
    await expect(block).toContainText('Con todos los cobros apuntados y los meses cerrados se comprueba también');
    await closeMonths(page, 'all');
    await expect(page.locator('.block.result .tag .sub')).toHaveCount(0);
    await expect(page.locator('#result')).not.toContainText('no es firme');
    const minimum = block.locator('.lawcheck > div', { hasText: 'Salario mínimo en nómina' });
    await expect(minimum).toContainText('En nómina se cobraron');
    await expect(minimum.locator('.m')).toHaveText(/[✔✘]/);
    await expect(block).not.toContainText('Con todos los cobros apuntados');
  });

  test('«¿Se espera algún pago más?» «Sí, quedó en pagarlo» asks for the day, which can be left out; the line says what is expected', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const question = page.getByRole('group', { name: '¿Se espera algún pago más?' });
    const line = page.locator('#result .expect-line');
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta');
    await question.getByRole('button', { name: 'Sí, quedó en pagarlo' }).click();
    await expect(question.getByLabel('¿Para cuándo?')).toBeVisible();
    expect(await page.evaluate(() => 'expecting' in app.active().mine.record)).toBe(false);
    await question.getByRole('button', { name: 'Sin fecha' }).click();
    expect(await page.evaluate(() => app.active().mine.record.expecting)).toEqual({});
    await expect(line).toContainText('Se espera un pago.');
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Esperando cobro');
    // While a cobro is expected the talk leads, open
    await expect(page.locator('details.step[data-step=talk]')).toHaveAttribute('open', '');
    await line.getByRole('button', { name: 'Cambiar' }).click();
    await question.getByRole('button', { name: 'Sí, quedó en pagarlo' }).click();
    await question.getByLabel('¿Para cuándo?').fill('2026-12-15');
    expect(await page.evaluate(() => app.active().mine.record.expecting)).toEqual({ by: '2026-12-15' });
    await expect(line).toContainText('Se espera un pago para el 15 dic.');
    await expect(question).toHaveCount(0);
  });

  test('when the day promised passes the line says it did not arrive and the job is owed; a later cobro that covers Falta settles it', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await page.evaluate(() => {
      app.active().mine.record.expecting = { by: '2026-11-10' };
      app.select(app.active().id);
    });
    await expect(page.locator('#result .expect-line')).toContainText('Quedó en pagar el 10 nov y no ha llegado.');
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Debe');
    await page.evaluate(() => app.showTab('offers'));
    await expect(page.locator('#cards .ocard', { hasText: 'Puerto A, otra cuenta' })).toHaveClass(/st-red/);
    await page.evaluate(() => app.select(app.active().id));
    const falta = await page.evaluate(async () => {
      const { standingOf } = await import('./src/model/accounts.js');
      const { settleOffer, calcOffer } = await import('./src/state.js');
      const o = app.active();
      return standingOf(settleOffer(o), '2026-11-12', 'finished', o.mine.record.payments, calcOffer(o).netFactor).falta;
    });
    await addPayments(page, [{ date: '2026-11-12', amount: Math.ceil(falta), via: 'payroll' }]);
    await expect(page.locator('#result .block.result .tag')).toHaveClass(/saldadas/);
    await expect(page.locator('#result .expect-line')).toHaveCount(0);
    await closeMonths(page, 'all');
    await page.evaluate(() => app.showTab('offers'));
    await expect(page.locator('#cards .ocard', { hasText: 'Puerto A, otra cuenta' })).toHaveClass(/st-green/);
  });

  test('«No» keeps a cobro added later: it only recalculates; the last cobro removed takes the answer back', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const question = page.getByRole('group', { name: '¿Se espera algún pago más?' });
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await question.getByRole('button', { name: 'No', exact: true }).click();
    // Said on 20 October; a cobro dated after that day was added after: kept, and told
    await page.evaluate(() => {
      app.active().mine.record.complete = { date: '2026-10-20' };
    });
    await addPayments(page, [{ date: '2026-11-05', amount: 100, via: 'payroll' }]);
    expect(await page.evaluate(() => app.active().mine.record.complete)).toEqual({ date: '2026-10-20' });
    await expect(question).toHaveCount(0);
    await expect(page.locator('#result .cobros .pr')).toHaveCount(2);
    await expect(page.locator('#result .cobros')).toContainText('después de dar los cobros por completos');
    await page.evaluate(() => {
      app.active().mine.record.complete = undefined;
      app.active().mine.record.expecting = {};
    });
    // Removing every cobro: nothing is said of the cobros to come any more, and the paid question is back
    for (let i = 0; i < 2; i++) {
      const rm = page.locator('#result .cobros .pr').first();
      await rm.getByRole('button', { name: 'Quitar' }).click();
      await rm.getByRole('button', { name: '¿Quitar?' }).click();
    }
    expect(await page.evaluate(() => 'expecting' in app.active().mine.record)).toBe(false);
    expect(await page.evaluate(() => 'complete' in app.active().mine.record)).toBe(false);
    await expect(page.getByRole('group', { name: '¿Se cobró este trabajo?' })).toBeVisible();
  });

  test('reopening a month keeps the cobros as complete: the days are one thing, the cobros another', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await closeMonths(page, 'all');
    await page
      .getByRole('group', { name: '¿Se espera algún pago más?' })
      .getByRole('button', { name: 'No', exact: true })
      .click();
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.reopenMonth(app.active(), '2026-08');
      app.select(app.active().id);
    });
    expect(await page.evaluate(() => 'complete' in app.active().mine.record)).toBe(true);
    await expect(page.getByRole('group', { name: '¿Se espera algún pago más?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Revisar los meses' })).toBeVisible();
  });

  test('«Revisar los meses» goes month by month, its calendar first; Back leaves it for the ficha without a stale entry', async ({
    page,
  }) => {
    const index = () => page.evaluate(() => navigation.currentEntry?.index);
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const ficha = await index();
    await page.getByRole('button', { name: 'Revisar los meses' }).click();
    await expect(page.locator('.review-progress')).toContainText('Junio, 1 de 4');
    await expect(page.locator('.cal .grid .day').first()).toBeVisible();
    expect(await index()).toBe(ficha + 1);
    await page.goBack();
    await expect(page.locator('.review-progress')).toHaveCount(0);
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    expect(await index()).toBe(ficha);
    await page.getByRole('button', { name: 'Revisar los meses' }).click();
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await expect(page.locator('.review-progress')).toContainText('Julio, 2 de 4');
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.locator('.cal .day.work').first().click(); // a day can be changed in the review
    await page.getByRole('button', { name: 'Cerrar agosto' }).click();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.locator('#result')).toContainText('Revisión hecha');
    await expect(page.locator('#result')).toContainText('2 meses cerrados');
    await expect(page.locator('#result')).toContainText('Siguen según la oferta: julio, septiembre');
    await page.getByRole('button', { name: 'Ver las cuentas' }).click();
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(page.locator('.block.result .tag .sub')).toContainText('2 meses según la oferta');
    await expect.poll(index).toBe(ficha);
  });

  test('a month tapped in the registro opens its calendar alone; a closed one keeps its days and is reopened, asking first', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    await page.getByRole('button', { name: 'Revisar los meses' }).click();
    const counts = await page.locator('.cal .counts').textContent();
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.getByRole('button', { name: 'Ver las cuentas' }).click();
    await page.evaluate(() => {
      app.active().terms.daysOff = 12;
      app.select(app.active().id);
    });
    await openRegistro(page);
    const junio = page.locator('#registroPage .monthrow', { hasText: 'Junio' });
    await junio.click();
    // In place: no separate view, no history entry, the row open and its calendar right below
    await expect(page.locator('.review-progress')).toHaveCount(0);
    await expect(junio).toHaveAttribute('aria-expanded', 'true');
    const body = page.locator('.monthbody');
    await expect(body.locator('.cal .state')).toHaveText('Cerrado');
    await expect(body.locator('.cal .counts')).toHaveText(counts ?? '');
    await expect(body.locator('.cal .day[data-action=toggleDay]')).toHaveCount(0);
    // Tapping a day says the month is closed, under the title, and offers to reopen it
    await body.locator('.cal .day.work').first().click();
    await expect(body.locator('.cal .mh + .confirm')).toContainText(
      'Junio está cerrado. ¿Reabrir junio para cambiar los días?',
    );
    await body.getByRole('button', { name: 'Reabrir junio' }).click();
    await expect(body.locator('.cal .state')).toHaveText('Según la oferta');
    await expect(body.locator('.cal .mh + .hint')).toContainText('Toca un día');
    await body
      .locator('.cal')
      .getByRole('button', { name: /^Cerrar junio$/ })
      .click();
    await page.getByRole('button', { name: 'Reabrir' }).click();
    await expect(body.locator('.cal .confirm')).toContainText('¿Reabrir junio?');
    await page.locator('[data-action=reopenNo]').click();
    await expect(body.locator('.cal .state')).toHaveText('Cerrado');
    await page.getByRole('button', { name: 'Reabrir' }).click();
    await page.locator('[data-action=reopenYes]').click();
    await expect(body.locator('.cal .state')).toHaveText('Según la oferta');
  });

  test('the registro’s months are rows that open in place, one at a time, with the scroll where it was', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await openRegistro(page);
    const rows = page.locator('#registroPage .monthrow');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('.monthbody')).toHaveCount(0);
    const scrolled = () => page.evaluate(() => document.querySelector('#registroPage').scrollTop);
    await page.evaluate(() => document.querySelector('#registroPage').scrollBy(0, 120));
    const before = await scrolled();
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.monthbody')).toHaveCount(1);
    await expect(page.locator('.monthbody .cal h3')).toHaveText('Julio 2026');
    expect(Math.abs((await scrolled()) - before)).toBeLessThan(2);
    // Its calendar sits right under its row, and the other month's row stays below it
    expect(
      await page.evaluate(() => {
        const row = document.querySelector('.monthrow[aria-expanded=true]');
        return row?.nextElementSibling?.classList.contains('monthbody');
      }),
    ).toBe(true);
    // Another month closes the first: one open at a time
    await rows.nth(2).click();
    await expect(page.locator('.monthbody')).toHaveCount(1);
    await expect(page.locator('.monthbody .cal h3')).toHaveText('Agosto 2026');
    await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'false');
    // A day can be changed there, and the month stays open
    await page.locator('.monthbody .cal .day.work').first().click();
    await expect(page.locator('.monthbody .cal h3')).toHaveText('Agosto 2026');
    // A month that has ended closes from its calendar, and the fold does not fold itself shut
    await rows.first().click();
    await page.getByRole('button', { name: 'Cerrar junio' }).click();
    await expect(rows.first()).toContainText('cerrado');
    await expect(rows.first()).toHaveAttribute('aria-expanded', 'true');
    // A second tap folds it
    await rows.first().click();
    await expect(page.locator('.monthbody')).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark']) {
    test(`nothing is wider than 375 px (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await loadOffers(page, sample, PUERTO_A_OTRA);
      await addPayments(page, [
        { date: '2026-07-05', amount: 1000, via: 'payroll', note: 'una nota bastante larga para ver cómo se parte' },
      ]);
      await closeMonths(page, ['2026-06', '2026-07']);
      for (const fold of ['how', 'reference']) await page.locator(`details[data-fold=${fold}] > summary`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      const wide = await page.evaluate(
        () => [...document.querySelectorAll('#result *')].filter((e) => e.getBoundingClientRect().right > 376).length,
      );
      expect(wide).toBe(0);
    });
  }
});

test.describe('the month in progress, the days outside the job and what the minimum adds', () => {
  test.use({ today: '2026-08-12' });

  const tile = (page, name) => page.locator('.sofar > div', { hasText: name }).locator('b');

  test('Hasta hoy counts the month in progress up to today: Corresponde above 0 from the first days worked', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => {
      Object.assign(app.active().terms, {
        start: '2026-08-01',
        duration: 90,
        payUnit: 'day',
        payAmount: 80,
        cashMode: 'amount',
        cashAmount: 0,
      });
      app.active().mine.record = { months: {}, payments: [], started: { date: '2026-08-01' } };
      app.select(app.active().id);
    });
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    const sofar = amount(await tile(page, 'Corresponde').textContent());
    expect(sofar).toBeGreaterThan(0);
    await expect(page.locator('#result')).not.toContainText('el mes en curso, se cuenta hasta hoy');
    await expect(page.locator('#result')).not.toContainText('Aparte, aún sin pagar');
    // A day off marked among the days elapsed is one day less
    await openRegistro(page);
    await page.locator('.cal .day.work').first().click();
    expect(amount(await tile(page, 'Corresponde').textContent())).toBeLessThan(sofar);
  });

  test('the days after the end are «fuera», not libranzas: out of the counts, and a tap on one extends the job', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => {
      app.active().terms.duration = 55; // ends on 14 August
      app.select(app.active().id);
    });
    await openRegistro(page);
    await expect(page.locator('.cal .day.away')).toHaveCount(17); // 15 to 31 August
    await expect(page.locator('.cal .day.away').first()).toContainText('fuera');
    await expect(page.locator('.cal .day.away').first()).toHaveAttribute('aria-label', /fuera del trabajo/);
    const counts = (await page.locator('.cal .counts').textContent()) ?? '';
    const [jornadas, libranzas] = counts.match(/\d+/g).map(Number);
    expect(jornadas + libranzas).toBe(12); // 1 to 12 August: up to today, the 14th is still to come
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toHaveCount(0);
    await page.locator('.cal .day.away', { hasText: '20' }).first().click();
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toContainText('al 20 ago 2026');
    await expect(page.locator('.cal .day.away')).toHaveCount(11); // 21 to 31 August
  });

  const MOLINOS = {
    start: '2026-09-18',
    contract: 'permanent', // no severance on top of the 70 €
    duration: 52,
    durationUnit: 'days',
    hoursPerDay: 8,
    daysOff: 0,
    daysOffUnit: 'week',
    holidays: 'no',
    payrollMin: true,
    cashMode: 'total',
    totalAmount: 70,
    totalUnit: 'day',
    payUnit: 'day',
    vacation: 'included',
    overnight: 'no',
  };

  test('an agreement of 70 € net a day reads 70: the month panel, its difference line, and no word about the minimum', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    await at(page, '2026-11-14');
    await page.evaluate(async (terms) => {
      const { makeOffer } = await import('./src/offer.js');
      const o = makeOffer(terms, { name: 'Molinos otoño' });
      app.state.offers.push(o);
      app.select(o.id);
    }, MOLINOS);
    await openAccounts(page);
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await page.getByRole('button', { name: 'Revisar los meses' }).click();
    await page.locator('.review-progress').waitFor();
    // Walk to November, the last month: 8 jornadas
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.locator('.review-progress')).toContainText('Noviembre');
    await expect(page.locator('.cal .counts')).toContainText('8 jornadas');
    const panel = page.locator('.cal .row', { hasText: 'Corresponde de noviembre' }).locator(':scope > :last-child');
    expect(amount(await panel.textContent())).toBeCloseTo(560, 0);
    await page.locator('.cal .day.away').first().click();
    await expect(page.locator('.cal')).toContainText('1 jornada más que la oferta');
    expect(amount(await page.locator('.cal .row.sub > :last-child').textContent())).toBeCloseTo(70, 0);
    await page.locator('[data-action=reviewEnd]').first().click();
    await expect(page.locator('#result')).not.toContainText('mínimo exigible');
    await expect(page.locator('#result')).not.toContainText('El mínimo legal');
  });

  test('where the minimum exceeds the pay agreed, one line says what it is made of, net, in one unit', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => {
      Object.assign(app.active().terms, {
        payUnit: 'month',
        payAmount: 900,
        cashMode: 'amount',
        cashAmount: 0,
        overnight: 'yes',
        province: 'HU',
      });
      app.select(app.active().id);
    });
    const line = page.locator('#result .hint', { hasText: 'El mínimo exigible supera lo pactado' }).first();
    await expect(line).toContainText(/salario mínimo [\d.,]+\s€ \+ plus de pernocta \(convenio\) [\d.,]+\s€/);
    await expect(line).toContainText(/€\/mes netos; pactado: [\d.,]+\s€\/mes\./);
    await page.evaluate(() => {
      app.active().terms.overnight = 'no';
      app.select(app.active().id);
    });
    await expect(page.locator('#result .hint', { hasText: 'plus de pernocta (convenio)' })).toHaveCount(0);
  });
});

test.describe('the real period of the work', () => {
  test.use({ today: '2026-11-12' });

  const tile = (page, name) => page.locator('.sofar > div', { hasText: name }).locator('b');

  test('a month added after the offer’s end joins the job with a day worked: Corresponde rises, the line says so, the phase follows it', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA); // the offer ends on 30 September
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const before = amount(await tile(page, 'Corresponde').textContent());
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toHaveCount(0);
    await openRegistro(page);
    await page.getByRole('button', { name: '+ Añadir octubre' }).click();
    await expect(page.locator('.monthbody .cal h3')).toContainText('Octubre 2026');
    await expect(page.locator('.cal')).toContainText('Se suma al trabajo al marcar un día');
    await expect(page.locator('.cal .day.work')).toHaveCount(0); // every day libre
    await expect(page.locator('[data-action=closeMonth], [data-action=reviewClose]')).toHaveCount(0);
    await page.locator('.cal .day[data-day="01"]').click();
    await page.locator('.cal .day[data-day="02"]').click();
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toHaveText(
      /^Trabajo real: del 21 jun 2026 al 2 oct 2026 \(oferta: 30 sept 2026\)\.$/,
    );
    expect(amount(await tile(page, 'Corresponde').textContent())).toBeGreaterThan(before);
    await expect(page.locator('.tocl')).toContainText('Octubre');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    // The phase ends on the last day worked, not on the offer's end
    await at(page, '2026-10-02');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await expect(page.locator('#result h2.mode')).toHaveText(/Hasta hoy/);
    await expect(page.locator('.monthstrip button[data-key="2026-10"]')).toContainText('en curso');
    await at(page, '2026-10-03');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
  });

  test('a month added and left with nothing marked is not part of the job', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    await openRegistro(page);
    await page.getByRole('button', { name: '+ Añadir octubre' }).click();
    await page.locator('.cal .day[data-day="01"]').click();
    await page.locator('.cal .day[data-day="01"]').click(); // marked and unmarked again
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toHaveCount(0);
    await expect(page.locator('.tocl')).not.toContainText('Octubre');
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
  });

  test('libre days after the last day worked in a closed month do not end the job; the end said does', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const before = amount(await tile(page, 'Corresponde').textContent());
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      const o = app.active();
      const days = Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [String(i + 1).padStart(2, '0'), i < 10 ? 'work' : 'off']),
      );
      o.mine.record.months['2026-09'] = { closed: false, days };
      offers.closeMonth(o, { key: '2026-09', from: '2026-09-01', to: '2026-09-30' });
      app.select(o.id);
    });
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toHaveCount(0);
    expect(amount(await tile(page, 'Corresponde').textContent())).toBe(before);
    await page.evaluate(() => {
      app.active().mine.record.end = { how: 'agreed', date: '2026-09-10' };
      app.select(app.active().id);
    });
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toHaveText(
      /al 10 sept 2026 \(oferta: 30 sept 2026\)/,
    );
    expect(amount(await tile(page, 'Corresponde').textContent())).toBeLessThan(before);
  });

  test('worked past the end while the offer is under way: the month strip includes the extension and the phase stays En curso', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await at(page, '2026-10-03');
    await page.evaluate(() => {
      app.active().mine.record.months['2026-10'] = {
        closed: false,
        days: Object.fromEntries(
          Array.from({ length: 31 }, (_, i) => [String(i + 1).padStart(2, '0'), i < 5 ? 'work' : 'off']),
        ),
      };
      app.select(app.active().id);
    });
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await openRegistro(page);
    await expect(page.locator('.monthstrip button')).toHaveCount(5);
    await expect(page.locator('.monthstrip button[data-key="2026-10"]')).toContainText('en curso');
    await expect(page.locator('.real', { hasText: 'Trabajo real' })).toContainText('al 5 oct 2026');
  });
});

test.describe('the cards', () => {
  test.use({ today: '2026-11-12' });

  const card = (page, name) => page.locator('#cards .ocard', { hasText: name }).first();
  const named = (page, name) =>
    page.locator('#cards .ocard', { has: page.locator('.oc-name', { hasText: new RegExp(`^${name}$`) }) });

  test('a pill for the phase, none for an offer only offered; a line for a job worked', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => app.showTab('offers'));
    await expect(card(page, 'Puerto A, otra cuenta').locator('.phase')).toHaveText('Acabada');
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-status')).toHaveText('Sin registro');
    await expect(card(page, 'Campaña B').locator('.phase')).toHaveText('Acabada');
    await expect(card(page, 'Temporada F').locator('.phase')).toHaveCount(0);
    await expect(named(page, 'Puerto A').locator('.phase')).toHaveCount(0); // solo oferta
    await expect(named(page, 'Puerto A').locator('.oc-status')).toHaveCount(0);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await page.evaluate(() => app.showTab('offers'));
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-status')).toContainText(/Por confirmar [\d.,]+\s€/);
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
    await expect(card(page, 'Puerto A, otra cuenta').locator('.oc-status')).toHaveCount(0);
  });
});
