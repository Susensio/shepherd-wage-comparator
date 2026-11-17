// The job as one thing with two sides (ADR-0035, phase C): the screens for what happened, whatever the terms say.

import { addJob, closeRegistro, expect, loadOffers, openRegistro, sample, test, tileOf } from './fixtures.js';

test.describe('thin terms', () => {
  test.use({ today: '2026-11-15' });

  test('a job that began with no hours and no pay still shows its record, and asks nothing it cannot judge', async ({
    page,
  }) => {
    await addJob(page, { terms: { start: '2026-06-01', duration: 92, durationUnit: 'days' } });
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(page.getByRole('group', { name: '¿Se cobró este trabajo?' })).toBeVisible();
    await expect(page.locator('#result')).not.toContainText('Falta lo que se paga');
    await expect(page.locator('#result')).not.toContainText('las horas por día');
  });

  test('an offer not yet started still asks for hours and pay', async ({ page }) => {
    await addJob(page, { terms: { start: '2026-12-01', duration: 3, durationUnit: 'months' } });
    await expect(page.locator('#result .empty')).toContainText('las horas por día');
  });
});

test.describe('the tab', () => {
  test.use({ today: '2026-05-01' });

  test('the first tab and the ficha’s way back are «Trabajos»; an offer not started waits under «Por decidir»', async ({
    loaded: page,
  }) => {
    await expect(page.locator('.tabs [data-tab=offers]')).toHaveText('Trabajos');
    await expect(page.locator('[data-action=closeFicha]')).toHaveText('Trabajos');
    await page.click('[data-action=closeFicha]');
    await expect(page.locator('#offersList')).toHaveAttribute('aria-label', 'Los trabajos');
    await expect(page.locator('#cards .year-head').first()).toContainText('Por decidir');
  });
});

test.describe('the ficha of a job finished with nothing recorded', () => {
  test.use({ today: '2026-11-15' });
  const FINISHED = {
    start: '2026-06-01',
    duration: 3,
    durationUnit: 'months',
    hoursPerDay: 8,
    payAmount: 1500,
    payType: 'gross',
    payUnit: 'month',
    vacation: 'taken',
    contract: 'temporary',
  };
  const question = (page) => page.getByRole('group', { name: '¿Se cobró este trabajo?' });
  const tile = tileOf;
  const recordOf = (page) => page.evaluate(() => app.active().mine.record);

  test('leads with the analysis and asks only whether it was paid: no accounts, no debt', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(question(page).locator('h3')).toContainText('¿Se cobró este trabajo?');
    for (const name of ['Lo pactado', 'Otra cantidad', 'Nada'])
      await expect(question(page).getByRole('button', { name })).toBeVisible();
    await expect(page.locator('#result h2.analysis-title')).toBeVisible();
    // Nothing left to negotiate on a finished job
    await expect(page.locator('#result')).not.toContainText('Para negociar');
    await expect(page.locator('#result h2.mode')).toHaveCount(0);
    await expect(page.locator('#result .block.result')).toHaveCount(0);
    await expect(page.locator('#result')).not.toContainText('Aún no hay cobros apuntados');
  });

  test('«Lo pactado» takes what was agreed as received; «Cambiar» brings the question back', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'Lo pactado' }).click();
    expect((await recordOf(page)).paid).toBe('asAgreed');
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(question(page)).toHaveCount(0);
    // No empty block of cobros: one line says it
    await expect(page.locator('#result .cobros')).toHaveCount(0);
    await expect(page.locator('#result')).not.toContainText('Apuntar un cobro');
    await expect(page.locator('#result .paidline')).toContainText('Se cobró todo lo pactado.');
    await page.locator('#result .paidline').getByRole('button', { name: 'Cambiar' }).click();
    await expect(question(page)).toBeVisible();
    expect((await recordOf(page)).paid).toBeUndefined();
  });

  test('«Lo pactado» still shows a shortfall below the legal minimum, and calls it that', async ({ page }) => {
    await addJob(page, { terms: { ...FINISHED, payAmount: 700, payType: 'net' } });
    await question(page).getByRole('button', { name: 'Lo pactado' }).click();
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta hasta el mínimo legal');
    await expect(page.locator('#result .paidline')).toContainText('Se cobró todo lo pactado.');
    await expect(page.locator('#result .legal-items')).toContainText('Falta lo que la ley exige y no se pactó:');
    const falta = Number.parseFloat((await tile(page, 'Falta').textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
    expect(falta).toBeGreaterThan(0);
  });

  test('«Lo pactado» at the minimum wage: the severance shows as an item, and «También se cobró» turns the answer into a cobro', async ({
    page,
  }) => {
    await addJob(page, {
      terms: { ...FINISHED, payrollMin: true, payAmount: '', contract: 'temporary', vacation: 'taken' },
    });
    await question(page).getByRole('button', { name: 'Lo pactado' }).click();
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta hasta el mínimo legal');
    const items = page.locator('#result .legal-items li');
    await expect(items.filter({ hasText: 'Indemnización por fin de contrato' })).toHaveCount(1);
    const money = async (li) =>
      Number.parseFloat((await li.locator('b').textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
    let sum = 0;
    for (const li of await items.all()) sum += await money(li);
    const falta = Number.parseFloat((await tile(page, 'Falta').textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
    expect(sum).toBe(falta);
    const corresponde = await tile(page, 'Corresponde').textContent();
    await page.getByRole('button', { name: 'También se cobró' }).click();
    const record = await recordOf(page);
    expect(record.paid).toBeUndefined();
    expect(record.payments).toHaveLength(1);
    expect(record.payments[0]).toMatchObject({ via: 'payroll', date: '2026-08-31' });
    await expect(tile(page, 'Falta')).toHaveText('0 €');
    await expect(tile(page, 'Cobrado')).toHaveText(corresponde);
    await expect(page.locator('#result .cobros')).toContainText('Nómina');
    await expect(page.locator('#result .legal-items')).toHaveCount(0);
  });

  test('cobros above the pay agreed and below the legal minimum: the headline says so, with the minimum sentence under it', async ({
    page,
  }) => {
    await addJob(page, { terms: { ...FINISHED, payAmount: 700, payType: 'net' } });
    await question(page).getByRole('button', { name: 'Lo pactado' }).click();
    const whole = async (name) =>
      Number.parseFloat((await tile(page, name).textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
    const [corresponde, falta] = [await whole('Corresponde'), await whole('Falta')];
    await page.locator('#result .paidline').getByRole('button', { name: 'Cambiar' }).click();
    // More than agreed, less than the law requires: half of the shortfall is covered
    await page.evaluate(
      async (amount) => {
        const { offers } = await import('./src/offers.js');
        offers.addPayment(app.active(), { date: '2026-09-05', amount, via: 'payroll' });
        app.select(app.active().id);
      },
      corresponde - falta / 2,
    );
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta hasta el mínimo legal');
    await expect(page.locator('.block.result .tag .sub')).toHaveText(
      'Se cobró más de lo pactado, pero menos de lo que exige la ley.',
    );
    // The minimum sentence sits in the block, right under the headline
    await expect(page.locator('.block.result > .hint').first()).toContainText('mínimo');
    expect(await whole('Falta')).toBeGreaterThan(0);
  });

  test('«Otra cantidad» opens the cobro right there; several can be added in a row and each edited or removed', async ({
    page,
  }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'Otra cantidad', exact: true }).click();
    await expect(page.locator('#paySheet')).toBeVisible();
    await expect(page.locator('#payDate')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
    // «Guardar y apuntar otro» keeps the sheet for the next one
    await page.locator('#payAmount').fill('1000');
    await page.locator('#paySheet [data-via=cash]').click();
    await page.locator('#payMore').click();
    await expect(page.locator('#paySheet')).toBeVisible();
    await expect(page.locator('#payDone')).toContainText('Apuntado: 1.000,00 €');
    await expect(page.locator('#payCancel')).toHaveText('Hecho');
    await expect(page.locator('#payAmount')).toHaveValue('');
    await page.locator('#payAmount').fill('500');
    await page.locator('#payApprox').check();
    await page.locator('#payForm .btns .pri').click();
    await expect(page.locator('#paySheet')).toBeHidden();
    // The cobros are listed on the ficha, with «+ Otro cobro»
    const cobros = page.locator('#result .cobros');
    await expect(cobros.locator('.pr')).toHaveCount(2);
    await expect(cobros.getByRole('button', { name: '+ Otro cobro' })).toBeVisible();
    await expect(cobros).toContainText('≈');
    expect((await recordOf(page)).payments.map((p) => [p.amount, p.via, Boolean(p.approx)])).toEqual([
      [1000, 'cash', false],
      [500, 'cash', true],
    ]);
    // Edit one
    await cobros.locator('.pr', { hasText: 'cifra aproximada' }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#payAmount')).toHaveValue('500');
    await expect(page.locator('#payApprox')).toBeChecked();
    await expect(page.locator('#payMore')).toBeHidden();
    await page.locator('#payAmount').fill('600');
    await page.locator('#payApprox').uncheck();
    await page.locator('#payForm .btns .pri').click();
    expect((await recordOf(page)).payments.map((p) => [p.amount, Boolean(p.approx)])).toEqual([
      [1000, false],
      [600, false],
    ]);
    // Remove one: two taps
    await cobros.locator('.pr', { hasText: '600' }).getByRole('button', { name: 'Quitar' }).click();
    await cobros.getByRole('button', { name: '¿Quitar?' }).click();
    await expect(cobros.locator('.pr')).toHaveCount(1);
    expect((await recordOf(page)).paid).toBeUndefined();
  });

  test('the sheet «Otra cantidad» opens can be left: the accounts stay open, asking for the cobro', async ({
    page,
  }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'Otra cantidad', exact: true }).click();
    await page.locator('#paySheet [data-action=payCancel]').click();
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(page.locator('#result .cobros').getByRole('button', { name: 'Apuntar un cobro' })).toBeVisible();
    expect((await recordOf(page)).paid).toBeUndefined();
  });

  test('a cobro is one tap from the ficha of a job finished or under way, with cobros already', async ({ page }) => {
    await addJob(page, {
      terms: FINISHED,
      record: { payments: [{ id: 'p1', date: '2026-08-31', amount: 900, via: 'payroll' }] },
    });
    await expect(page.locator('#result .cobros').getByRole('button', { name: '+ Otro cobro' })).toBeVisible();
    await page.locator('#result .cobros').getByRole('button', { name: '+ Otro cobro' }).click();
    await expect(page.locator('#paySheet')).toBeVisible();
  });

  test('«No se cobró nada» asks first, and then everything that corresponds is owed', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'Nada', exact: true }).click();
    await expect(question(page).locator('h3')).toContainText('¿No se cobró nada?');
    expect((await recordOf(page)).paid).toBeUndefined();
    await question(page).getByRole('button', { name: 'Volver' }).click();
    await expect(question(page).getByRole('button', { name: 'Lo pactado' })).toBeVisible();
    await question(page).getByRole('button', { name: 'Nada', exact: true }).click();
    await question(page).getByRole('button', { name: 'Sí, nada' }).click();
    expect((await recordOf(page)).paid).toBe('none');
    await expect(tile(page, 'Falta')).toHaveText(await tile(page, 'Corresponde').textContent());
  });
});

test.describe('the Registro page', () => {
  test.use({ today: '2026-08-12' });
  const PUERTO_A_OTRA = 1; // 21 June to 30 September 2026

  test('is reached from a row of the ficha, has its history entry, and Back and «Volver» return to the ficha', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page
      .getByRole('group', { name: '¿Empezó el trabajo?' })
      .getByRole('button', { name: 'Sí', exact: true })
      .click();
    await expect(page.locator('#registroPage')).toBeHidden();
    // The ficha keeps «Hasta hoy» and the way in; the days are in the page
    await expect(page.locator('#result .registro-link')).toContainText('Días');
    await expect(page.locator('#result .monthstrip')).toHaveCount(0);
    await openRegistro(page);
    expect(await page.evaluate(() => history.state?.registro)).toBe(true);
    await expect(page.locator('#registroPage .monthstrip button')).toHaveCount(4);
    await page.goBack();
    await expect(page.locator('#registroPage')).toBeHidden();
    await expect(page.locator('#ficha')).toBeVisible();
    await openRegistro(page);
    await closeRegistro(page);
    expect(await page.evaluate(() => history.state?.registro)).toBeUndefined();
    await expect(page.locator('#ficha')).toBeVisible();
  });

  test('a day tapped in the page changes the figures of the ficha beneath it', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    // A wage per day: each day worked counts
    await page.evaluate(() => {
      Object.assign(app.active().terms, { payUnit: 'day', payAmount: 80, cashMode: 'amount', cashAmount: 0 });
      app.select(app.active().id);
    });
    const tile = page.locator('#result .sofar > div', { hasText: 'Corresponde' }).locator('b');
    const before = await tile.textContent();
    await openRegistro(page);
    await page.locator('#registroPage .cal .day.work:not(.ahead)').first().click();
    await closeRegistro(page);
    expect(await tile.textContent()).not.toBe(before);
  });
});

test.describe('«Trabajo ya hecho»', () => {
  test.use({ today: '2026-11-15' });
  const recordOf = (page) => page.evaluate(() => app.active().mine.record);
  const termsOf = (page) => page.evaluate(() => app.active().terms);

  /** Opens the screen from the list. */
  async function open(page) {
    await loadOffers(page, sample, 1);
    await page.click('[data-action=closeFicha]');
    await page.getByRole('button', { name: 'Trabajo ya hecho' }).click();
    await expect(page.locator('#pastPage')).toBeVisible();
  }
  const dates = async (page, from, to) => {
    await page.locator('#pastStart').fill(from);
    await page.locator('#pastEnd').fill(to);
  };

  test('only the dates are required, and what is wrong is said', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#pastPage [role=alert]')).toContainText('Escribe el primer y el último día.');
    await dates(page, '2026-08-31', '2026-06-01');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#pastPage [role=alert]')).toContainText('no puede ser anterior al primero');
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastDays').fill('200');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#pastPage [role=alert]')).toContainText('entre 0 y 92');
    await page.goBack();
    await expect(page.locator('#pastPage')).toBeHidden();
    await expect(page.locator('#offersList')).toBeVisible();
  });

  test('by conditions only: the job is taken as agreed, its record closed', async ({ page }) => {
    await open(page);
    await page.locator('#pastName').fill('Verano en Yebra');
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastPay').fill('1500');
    await page.locator('#pastType').selectOption('gross');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#pastPage')).toBeHidden();
    await expect(page.locator('#fichaName')).toHaveText('Verano en Yebra');
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    const record = await recordOf(page);
    expect(record.paid).toBe('asAgreed');
    expect(record.complete).toBeTruthy();
    expect(await termsOf(page)).toMatchObject({ start: '2026-06-01', duration: 92, payAmount: 1500, payType: 'gross' });
    await expect(page.locator('#result')).not.toContainText('¿Se cobró este trabajo?');
    await page.goBack(); // the ficha took the page's entry: Back is the list
    await expect(page.locator('#offersList')).toBeVisible();
  });

  /** What the payslips of the minimum bring in net (salary and vacation), plus the severance of the temporary contract, for the job below. */
  const minimumNet = (page) =>
    page.evaluate(async () => {
      const { makeOffer } = await import('./src/offer.js');
      const job = makeOffer(
        { start: '2026-06-01', duration: 92, durationUnit: 'days', payrollMin: true },
        { id: 'probe' },
      );
      app.state.offers.push(job);
      const r = app.calcOffer(job);
      app.state.offers.pop();
      return Math.round((r.pay.net + r.employer.severance) * 100) / 100;
    });

  test('the agreed pay is the minimum: cobros that add up show nothing short', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastMin').check();
    await expect(page.locator('#pastPay')).toBeDisabled();
    const net = await minimumNet(page);
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.locator('.pastAmount').fill(String(net).replace('.', ','));
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    expect(await termsOf(page)).toMatchObject({ payrollMin: true, cashMode: 'amount', cashAmount: '' });
    const tile = (name) => tileOf(page, name);
    await expect(tile('Falta')).not.toHaveText('—');
    const short = await tile('Falta').textContent();
    expect(Number.parseFloat(short.replace(/\./g, '').replace(',', '.'))).toBeLessThan(1);
  });

  test('the agreed pay is the minimum: cobros that fall short show what is missing', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastMin').check();
    const net = await minimumNet(page);
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.locator('.pastAmount').fill(String(Math.round(net - 300)));
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    const tile = (name) => tileOf(page, name);
    const short = await tile('Falta').textContent();
    const missing = Number.parseFloat(short.replace(/\./g, '').replace(',', '.'));
    expect(missing).toBeGreaterThan(250);
    expect(missing).toBeLessThan(350);
  });

  test('the agreed pay is the minimum, and everything was paid: taken as agreed with no amount typed', async ({
    page,
  }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastMin').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    expect((await recordOf(page)).paid).toBe('asAgreed');
  });

  test('by what happened only: a days total and a total cobrado, approximate, with no pay agreed', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastDays').fill('60');
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.locator('.pastAmount').fill('4000');
    await page.locator('.pastApprox').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    const record = await recordOf(page);
    expect(Object.values(record.months).map((m) => m.count.work)).toEqual([20, 20, 20]);
    expect(record.payments).toHaveLength(1);
    expect(record.payments[0]).toMatchObject({ amount: 4000, approx: true, date: '2026-08-31' });
    expect(record.paid).toBeUndefined();
    expect(record.complete).toBeTruthy();
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
  });

  test('counted months are counts, not days; the weekly rest says it cannot be judged; approximate cobros carry «≈»', async ({
    page,
  }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastDays').fill('60');
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.locator('.pastAmount').fill('4000');
    await page.locator('.pastApprox').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    const tile = (name) => tileOf(page, name);
    await expect(tile('Cobrado')).toContainText('≈');
    // No pay agreed: nothing to compare the cobros with
    await expect(tile('Falta')).toHaveText('—');
    await expect(tile('Corresponde')).toHaveText('—');
    await expect(page.locator('#result .block.result .lbl')).toHaveText('Cobrado');
    await expect(page.locator('#result .block.result .sub')).toContainText('No se apuntó lo pactado');
    const rest = page.locator('#result .lawcheck > div', { hasText: 'Descanso semanal' });
    await expect(rest).toContainText('No se puede juzgar en 3 meses apuntados por totales');
    await expect(page.locator('#result .cobros .pr .a')).toContainText('≈');
    await expect(page.locator('#result .cobros .pr')).toContainText('cifra aproximada');
    await expect(page.locator('#result .cobros .bh .n')).toContainText('≈');
    await openRegistro(page);
    await page.locator('#registroPage .monthrow').first().click();
    const cal = page.locator('#registroPage .cal');
    await expect(cal).toHaveClass(/counted/);
    await expect(cal.locator('.grid')).toHaveCount(0);
    await expect(cal.locator('.day')).toHaveCount(0);
    await expect(cal.locator('.counts')).toContainText('20 jornadas');
    await expect(cal).toContainText('Se apuntó el total del mes, no cada día');
  });

  test('both: the pay agreed and what happened', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastPay').fill('1500');
    await page.locator('#pastDays').fill('80');
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.locator('.pastAmount').fill('3000');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    const record = await recordOf(page);
    expect(record.payments[0]).toMatchObject({ amount: 3000 });
    expect(record.payments[0].approx).toBeUndefined();
    expect(record.paid).toBeUndefined();
    expect(Object.values(record.months).reduce((t, m) => t + m.count.work, 0)).toBe(80);
    await expect(page.locator('#result .sofar > div', { hasText: 'Cobrado' }).locator('b')).toContainText('3.000');
  });

  test('«Otra cantidad»: several cobros before saving, each with its date and its own «aproximada»; «Quitar» keeps the rest', async ({
    page,
  }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastPay').fill('1500');
    await expect(page.locator('.past-cobro')).toHaveCount(0);
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await expect(page.locator('.past-cobro')).toHaveCount(1);
    await page.locator('.pastAmount').nth(0).fill('1000');
    await page.locator('.pastWhen').nth(0).fill('2026-07-05');
    await page.getByRole('button', { name: '+ Otro cobro' }).click();
    await page.locator('.pastAmount').nth(1).fill('700');
    await page.locator('.pastApprox').nth(1).check();
    await page.getByRole('button', { name: '+ Otro cobro' }).click();
    await page.locator('.pastAmount').nth(2).fill('300');
    await page.locator('.pastVia').nth(2).selectOption('cash');
    // Removing the first leaves the others as typed
    await page.locator('.past-cobro').nth(0).getByRole('button', { name: 'Quitar' }).click();
    await expect(page.locator('.past-cobro')).toHaveCount(2);
    await expect(page.locator('.pastAmount').nth(0)).toHaveValue('700');
    await expect(page.locator('.pastApprox').nth(0)).toBeChecked();
    await expect(page.locator('.pastAmount').nth(1)).toHaveValue('300');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    const record = await recordOf(page);
    expect(record.payments.map((p) => [p.amount, p.date, Boolean(p.approx), p.via])).toEqual([
      [700, '2026-08-31', true, 'payroll'],
      [300, '2026-08-31', false, 'cash'],
    ]);
    // It ended as agreed: the ficha does not ask how
    expect(record.end).toEqual({ how: 'agreed', date: '2026-08-31' });
    await expect(page.getByRole('group', { name: '¿Cómo acabó?' })).toHaveCount(0);
    await expect(page.locator('#result .cobros .via.cash')).toHaveCount(1);
    expect(record.paid).toBeUndefined();
    // Falta is above 0 and «¿Se espera algún pago más?» was not answered: Por confirmar
    expect(record.complete).toBeUndefined();
    expect(record.expecting).toBeUndefined();
    await expect(page.locator('#result .cobros .pr')).toHaveCount(2);
  });

  test('«Lo pactado» and «Nada» record the answer; «Lo pactado» needs the pay, «Otra cantidad» an amount', async ({
    page,
  }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastForm input[name=pastHow][value=all]').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#pastForm [role=alert]')).toContainText('escribe el pago');
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#pastForm [role=alert]')).toContainText('al menos un cobro');
    await page.locator('#pastForm input[name=pastHow][value=none]').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    const record = await recordOf(page);
    expect(record.paid).toBe('none');
    expect(record.payments ?? []).toEqual([]);
    expect(record.complete).toBeUndefined();
    expect(record.expecting).toBeUndefined();
  });

  const question = (page) => page.getByRole('radiogroup', { name: '¿Se espera algún pago más?' });
  const how = (page, value) => page.locator(`#pastForm input[name=pastHow][value=${value}]`).check();
  const saveWith = async (page, setUp) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastPay').fill('1500');
    await setUp();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    return recordOf(page);
  };

  test('«Lo pactado» asks nothing; «Nada» and «Otra cantidad» ask «¿Se espera algún pago más?», its day only after «Sí»', async ({
    page,
  }) => {
    await open(page);
    await how(page, 'all');
    await expect(question(page)).toHaveCount(0);
    await how(page, 'none');
    await expect(question(page)).toBeVisible();
    await expect(page.locator('#pastExpectBy')).toHaveCount(0);
    await question(page).getByLabel('Sí, quedó en pagarlo').check();
    await expect(page.locator('#pastExpectBy')).toBeVisible();
  });

  test('«Nada» and «Sí» with a day: expecting, up to that day', async ({ page }) => {
    const record = await saveWith(page, async () => {
      await how(page, 'none');
      await question(page).getByLabel('Sí, quedó en pagarlo').check();
      await page.locator('#pastExpectBy').fill('2026-12-15');
    });
    expect(record.expecting).toEqual({ by: '2026-12-15' });
    expect(record.complete).toBeUndefined();
    await expect(page.locator('#result .expect-line')).toContainText('Se espera un pago para el 15 dic.');
  });

  test('«Nada» and «Sí» without a day: expecting, with no day', async ({ page }) => {
    const record = await saveWith(page, async () => {
      await how(page, 'none');
      await question(page).getByLabel('Sí, quedó en pagarlo').check();
    });
    expect(record.expecting).toEqual({});
  });

  test('«Nada» and «No»: no more cobro is expected', async ({ page }) => {
    const record = await saveWith(page, async () => {
      await how(page, 'none');
      await question(page).getByLabel('No', { exact: true }).check();
    });
    expect(record.complete).toBeTruthy();
    expect(record.expecting).toBeUndefined();
    await expect(page.locator('#result .expect-line')).toContainText('No se espera más pago.');
  });

  test('«Otra cantidad» and «Sí»: expecting', async ({ page }) => {
    const record = await saveWith(page, async () => {
      await how(page, 'part');
      await page.locator('.pastAmount').fill('100');
      await question(page).getByLabel('Sí, quedó en pagarlo').check();
    });
    expect(record.expecting).toEqual({});
  });

  test('the answer is ignored where the cobros leave nothing missing: the job is simply complete', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastMin').check();
    const net = await minimumNet(page);
    await page.locator('#pastForm input[name=pastHow][value=part]').check();
    await page.locator('.pastAmount').fill(String(net).replace('.', ','));
    await page
      .getByRole('radiogroup', { name: '¿Se espera algún pago más?' })
      .getByLabel('Sí, quedó en pagarlo')
      .check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    const record = await recordOf(page);
    expect(record.complete).toBeTruthy();
    expect(record.expecting).toBeUndefined();
  });

  test('with only the dates, the job is saved bare and asks whether it was paid', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.getByRole('group', { name: '¿Se cobró este trabajo?' })).toBeVisible();
  });
});
