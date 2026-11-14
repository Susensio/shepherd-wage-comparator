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
  const strip = (page, month) => page.locator(`.monthstrip button[data-key="${month}"]`);

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
    await expect(page.locator('.monthstrip button')).toHaveCount(4);
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
      'Las retenciones reales de la nómina suelen diferir de las simuladas',
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

  test('every cobro is listed in Cobros and removable with two taps, with no «ver todos» to open', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 400, via: 'payroll' },
      { date: '2026-07-06', amount: 100, via: 'cash' },
      { date: '2026-07-07', amount: 50, via: 'cash' },
    ]);
    await expect(page.locator('.cobros .pr')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Ver todos/ })).toHaveCount(0);
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

test.describe('finished: Cuentas', () => {
  test.use({ today: '2026-11-12' });

  const tile = (page, name) => page.locator('.sofar > div', { hasText: name }).locator('b');
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

  test('the result first: the yellow block right after the conditions, then what the work left, the law, the claim and the chores', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 1000, via: 'payroll' },
      { date: '2026-08-20', amount: 300, via: 'cash' },
    ]);
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(page.locator('#result h2.mode')).toHaveText('Cuentas');
    await expect(page.locator('.conditions')).toBeVisible();
    // The yellow block is the first block after the conditions row, and on the first screen
    expect(await after(page, '.conditions', '#result .tag')).toBe(true);
    const first = await page.evaluate(() => document.querySelector('#result .block')?.classList.contains('result'));
    expect(first).toBe(true);
    const box = await page.locator('#result .tag').boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(500);
    // The order of the rest
    const order = [
      '#result .result',
      'h2:Balance del trabajo',
      'h2:¿Se cumplió la ley?',
      'h2:Reclamar',
      'details[data-autofold=registro]',
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

  test('Corresponde − Cobrado = Falta, in net, and the headline «Debe el ganadero» is Falta', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    const corresponde = amount(await tile(page, 'Corresponde').textContent());
    const cobrado = amount(await tile(page, 'Cobrado').textContent());
    const falta = amount(await tile(page, 'Falta').textContent());
    expect(cobrado).toBe(1000);
    expect(Math.round((corresponde - cobrado) * 100) / 100).toBe(falta);
    await expect(page.locator('.result .tag .lbl')).toHaveText('Debe el ganadero');
    expect(amount(await page.locator('.result .tag .big').textContent())).toBe(falta);
    await expect(page.locator('#result')).toContainText('Cantidades netas: lo que llega, sin retenciones.');
  });

  test('months not closed: one action, «Revisar los meses», and the line that the figure is not firm; none once all are closed', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.getByRole('button', { name: 'Revisar los meses' })).toHaveCount(1);
    await expect(page.locator('.result .tag .sub')).toContainText(
      '4 meses según la oferta: la cifra no es firme hasta cerrarlos',
    );
    await closeMonths(page, 'all');
    await expect(page.getByRole('button', { name: 'Revisar los meses' })).toHaveCount(0);
    await expect(page.locator('.result .tag .sub')).toHaveText('Todos los meses están cerrados.');
  });

  test('more cobrado than corresponds: Falta 0 €, one neutral line, nothing «de más», and nothing to claim', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 50000, via: 'payroll' }]);
    await expect(tile(page, 'Falta')).toHaveText(/^0\s€$/);
    await expect(page.locator('.result .tag .big')).toHaveText(/^0\s€$/);
    await expect(page.locator('#result')).toContainText(
      'Las retenciones reales de la nómina suelen diferir de las simuladas',
    );
    for (const gone of ['de más:', 'Cobrado de más', 'pagado de más'])
      await expect(page.locator('#result')).not.toContainText(gone);
    await expect(page.locator('.result .tag .sub')).not.toContainText('debe');
    await expect(page.getByRole('button', { name: 'Copiar texto de la reclamación' })).toHaveCount(0);
    await expect(page.locator('#result h2', { hasText: 'Reclamar' })).toHaveCount(0);
  });

  test('no cobros: Corresponde and a prompt, no debt, no claim and no deadline', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('.result .tag .lbl')).toHaveText('Corresponde');
    await expect(tile(page, 'Falta')).toHaveText('—');
    await expect(page.locator('#result')).not.toContainText('Plazo más cercano');
    await expect(page.locator('#result h2', { hasText: 'Reclamar' })).toHaveCount(0);
  });

  test('«Reclamar»: the copy icon, the nearest deadline, and the deadline of each month in a closed fold', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(page.locator('.due-line')).toContainText(
      /Plazo más cercano: lo de \w+, hasta el \d+ \w+ 2027 · quedan \d+ días/,
    );
    const fold = page.locator('details[data-fold=deadlines]');
    await expect(fold).not.toHaveAttribute('open', '');
    await fold.locator(':scope > summary').click();
    await expect(fold.locator('.row').first()).toContainText(/hasta el \d+ \w+ 2027/);
    await expect(fold).toContainText('ET art. 59.2');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    await page.getByRole('button', { name: 'Copiar texto de la reclamación' }).click();
    await expect(page.locator('#result .copy-msg[role=status]')).toHaveText('Texto copiado.');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/Cobrado: 1\.000\s€ netos en 1 cobro/);
    expect(text).toMatch(/Queda por pagar, bruto/);
  });

  test('«Balance del trabajo»: estimated while months follow the offer, firm once all are closed; the paro always from the offer', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [
      { date: '2026-07-05', amount: 1000, via: 'payroll' },
      { date: '2026-08-20', amount: 300, via: 'cash' },
    ]);
    const block = page.locator('#result .block', { hasText: 'Balance del trabajo' });
    await expect(block.locator('.row', { hasText: 'Corresponde en total' })).toContainText(
      'estimado: hay meses según la oferta',
    );
    await expect(block.locator('.row', { hasText: /^Cobrado/ })).toContainText('en nómina 1.000');
    await expect(block.locator('.row', { hasText: /^Cobrado/ })).toContainText('en mano 300');
    await expect(block.locator('.row', { hasText: 'Jornadas' })).toContainText('0 en meses cerrados');
    await expect(block.locator('.row', { hasText: 'Paro' })).toContainText('según la oferta');
    await expect(block).not.toContainText('Simulador de nóminas');
    await closeMonths(page, 'all');
    await expect(block.locator('.row', { hasText: 'Corresponde en total' })).toContainText(
      'con todos los meses cerrados',
    );
    await expect(block.locator('.row', { hasText: 'Corresponde en total' })).not.toContainText('estimado');
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
    await page.locator('details[data-fold=how] > summary').click();
    await expect(page.locator('details[data-fold=how]')).not.toContainText('En negro');
  });

  test('«Registro del trabajo» is open while something remains to record, closed when nothing does', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const fold = page.locator('details[data-autofold=registro]');
    await expect(fold).toHaveAttribute('open', ''); // months not closed, and no cobros
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await expect(fold).toHaveAttribute('open', ''); // months not closed
    await closeMonths(page, 'all');
    await expect(fold).not.toHaveAttribute('open', ''); // nothing remains
    await expect(fold.locator(':scope > summary')).toContainText('meses cerrados · 1 cobro');
    await fold.locator(':scope > summary').click(); // it can still be opened
    await expect(fold.locator('.monthrow')).toHaveCount(4);
    await expect(fold.locator('.cobros')).toBeVisible();
    // Closed months and no cobros: open again
    await page.evaluate(() => {
      app.active().mine.record.payments = [];
      app.select(app.active().id);
    });
    await expect(page.locator('details[data-autofold=registro]')).toHaveAttribute('open', '');
  });

  test('«Oferta original» is one closed fold at the end, without «Para negociar», with the simulator', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const fold = page.locator('details[data-fold=reference]');
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator(':scope > summary')).toHaveText('Oferta original');
    await expect(fold.locator('[data-fold=breakdown2]')).toHaveCount(1);
    await expect(fold.locator('#secLegal')).toHaveCount(1);
    await expect(fold.locator('[data-fold=payslips]')).toHaveCount(1);
    await expect(fold.locator('[data-fold=workings]')).toHaveCount(1);
    await expect(page.locator('#secEmployer')).toHaveCount(0);
    expect(await after(page, 'details[data-autofold=registro]', 'details[data-fold=reference]')).toBe(true);
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
    const block = page.locator('#result .block', { hasText: '¿Se cumplió la ley?' });
    await expect(block).toContainText('Cierra los meses para comprobarlo');
    await expect(block.locator('.lawcheck')).toHaveCount(0);
    await expect(block).not.toContainText('✘');
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
    await expect(rows.filter({ hasText: 'Plus de pernocta' })).toContainText('Se comprobará al cerrar todos los meses');
    await expect(rows.filter({ hasText: 'Salario mínimo en nómina' })).toContainText(
      'Se comprobará al cerrar todos los meses',
    );
    await expect(block).toContainText('No se puede comprobar con lo apuntado: festivos trabajados');
    await expect(page.locator('#result')).not.toContainText('La nómina declarada está');
    // Every month closed and a payroll cobro: the bonus and the minimum get their verdict
    await closeMonths(page, 'all');
    await expect(block).toContainText('sobre 4 de 4 meses cerrados');
    await expect(rows.filter({ hasText: 'Plus de pernocta' })).not.toContainText('Se comprobará');
    await expect(rows.filter({ hasText: 'Salario mínimo en nómina' }).locator('.m')).toHaveText(/[✔✘]/);
    await addPayments(page, [{ date: '2026-07-06', amount: 99999, via: 'payroll' }]);
    await expect(rows.filter({ hasText: 'Salario mínimo en nómina' }).locator('.m')).toHaveText('✔');
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
    await expect(page.locator('#result h2.mode')).toHaveText('Cuentas');
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
    await expect(page.locator('#result h2.mode')).toHaveText('Cuentas');
    await expect(page.locator('.result .tag .sub')).toContainText('2 meses según la oferta');
    await expect.poll(index).toBe(ficha);
  });

  test('a month tapped in the registro opens its calendar alone; a closed one keeps its days and is reopened, asking first', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
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
    await page.locator('details[data-autofold=registro] .monthrow', { hasText: 'Junio' }).click();
    await expect(page.locator('.review-progress')).toContainText('Junio, 1 de 1');
    await expect(page.locator('.cal .state')).toHaveText('Cerrado');
    await expect(page.locator('.cal .counts')).toHaveText(counts ?? '');
    await expect(page.locator('.cal .day[data-action]')).toHaveCount(0);
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
      await closeMonths(page, ['2026-06', '2026-07']);
      for (const fold of ['how', 'deadlines', 'reference'])
        await page.locator(`details[data-fold=${fold}] > summary`).click();
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
      app.active().mine.record = { months: {}, payments: [] };
      app.select(app.active().id);
    });
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    const sofar = amount(await tile(page, 'Corresponde').textContent());
    expect(sofar).toBeGreaterThan(0);
    await expect(page.locator('#result')).toContainText('Agosto, el mes en curso, se cuenta hasta hoy');
    await expect(page.locator('#result')).not.toContainText('Aparte, aún sin pagar');
    // A day off marked among the days elapsed is one day less
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
    await expect(page.locator('.cal .day.away')).toHaveCount(17); // 15 to 31 August
    await expect(page.locator('.cal .day.away').first()).toContainText('fuera');
    await expect(page.locator('.cal .day.away').first()).toHaveAttribute('aria-label', /fuera del trabajo/);
    const counts = (await page.locator('.cal .counts').textContent()) ?? '';
    const [jornadas, libranzas] = counts.match(/\d+/g).map(Number);
    expect(jornadas + libranzas).toBe(14); // 1 to 14 August
    await expect(page.locator('.real')).toHaveCount(0);
    await page.locator('.cal .day.away', { hasText: '20' }).first().click();
    await expect(page.locator('.real')).toContainText('al 20 ago 2026');
    await expect(page.locator('.cal .day.away')).toHaveCount(11); // 21 to 31 August
  });

  const MOLINOS = {
    start: '2026-09-18',
    contract: 'temporary',
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
    await at(page, '2026-11-14');
    await page.evaluate(async (terms) => {
      const { makeOffer } = await import('./src/offer.js');
      const o = makeOffer(terms, { name: 'Molinos otoño' });
      app.state.offers.push(o);
      app.select(o.id);
    }, MOLINOS);
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
    await expect(page.locator('.real')).toHaveCount(0);
    await page.getByRole('button', { name: '+ Añadir octubre' }).click();
    await expect(page.locator('.review-progress')).toContainText('Octubre, 1 de 1');
    await expect(page.locator('.cal')).toContainText('Se suma al trabajo al marcar un día');
    await expect(page.locator('.cal .day.work')).toHaveCount(0); // every day libre
    await expect(page.locator('[data-action=closeMonth], [data-action=reviewClose]')).toHaveCount(0);
    await page.locator('.cal .day[data-day="01"]').click();
    await page.locator('.cal .day[data-day="02"]').click();
    await page.locator('[data-action=reviewEnd]').first().click();
    await expect(page.locator('.real')).toHaveText(
      /^Trabajo real: del 21 jun 2026 al 2 oct 2026 \(oferta: 30 sept 2026\)\.$/,
    );
    expect(amount(await tile(page, 'Corresponde').textContent())).toBeGreaterThan(before);
    await expect(page.locator('.tocl')).toContainText('Octubre');
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    // The phase ends on the last day worked, not on the offer's end
    await at(page, '2026-10-02');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await expect(page.locator('#result h2.mode')).toHaveText(/Registro/);
    await expect(page.locator('.monthstrip button[data-key="2026-10"]')).toContainText('en curso');
    await at(page, '2026-10-03');
    await reselect(page);
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
  });

  test('a month added and left with nothing marked is not part of the job', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.getByRole('button', { name: '+ Añadir octubre' }).click();
    await page.locator('.cal .day[data-day="01"]').click();
    await page.locator('.cal .day[data-day="01"]').click(); // marked and unmarked again
    await page.locator('[data-action=reviewEnd]').first().click();
    await expect(page.locator('.real')).toHaveCount(0);
    await expect(page.locator('.tocl')).not.toContainText('Octubre');
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
  });

  test('a job that ended early: the closed month trims its libre days after the last day worked', async ({ page }) => {
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
    await expect(page.locator('.real')).toHaveText(/al 10 sept 2026 \(oferta: 30 sept 2026\)/);
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
    await expect(page.locator('.monthstrip button')).toHaveCount(5);
    await expect(page.locator('.monthstrip button[data-key="2026-10"]')).toContainText('en curso');
    await expect(page.locator('.real')).toContainText('al 5 oct 2026');
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
