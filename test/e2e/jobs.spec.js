// The job as one thing with two sides (ADR-0035, phase C): the screens for what happened, whatever the terms say.

import { addJob, closeRegistro, expect, loadOffers, openRegistro, sample, test } from './fixtures.js';

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
  const tile = (page, name) => page.locator('.sofar > div', { hasText: name }).locator('b');
  const recordOf = (page) => page.evaluate(() => app.active().mine.record);

  test('leads with the analysis and asks only whether it was paid: no accounts, no debt', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(question(page).locator('h3')).toContainText('¿Se cobró este trabajo?');
    for (const name of ['Sí, todo', 'No todo', 'No se cobró nada'])
      await expect(question(page).getByRole('button', { name })).toBeVisible();
    await expect(page.locator('#result h2.analysis-title')).toBeVisible();
    await expect(page.locator('#result h2.mode')).toHaveCount(0);
    await expect(page.locator('#result .block.result')).toHaveCount(0);
    await expect(page.locator('#result')).not.toContainText('Aún no hay cobros apuntados');
  });

  test('«Sí, todo» takes what was agreed as received; «Quitar» brings the question back', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'Sí, todo' }).click();
    expect((await recordOf(page)).paid).toBe('asAgreed');
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(question(page)).toHaveCount(0);
    await openRegistro(page);
    await expect(page.locator('.cobros')).toContainText('Se apuntó que se cobró todo lo pactado.');
    await page.locator('.cobros').getByRole('button', { name: 'Quitar' }).click();
    await closeRegistro(page);
    await expect(question(page)).toBeVisible();
    expect((await recordOf(page)).paid).toBeUndefined();
  });

  test('«Sí, todo» still shows a shortfall below the legal minimum, and calls it that', async ({ page }) => {
    await addJob(page, { terms: { ...FINISHED, payAmount: 700, payType: 'net' } });
    await question(page).getByRole('button', { name: 'Sí, todo' }).click();
    await expect(page.locator('.block.result .tag .lbl')).toHaveText('Falta hasta el mínimo legal');
    await expect(page.locator('#result')).toContainText(
      'Se cobró todo lo pactado. Falta lo que la ley exige y no se pactó: el mínimo legal.',
    );
    const falta = Number.parseFloat((await tile(page, 'Falta').textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
    expect(falta).toBeGreaterThan(0);
  });

  test('«No todo» opens the accounts to record the cobros', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'No todo' }).click();
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(page.locator('.nocobros')).toContainText('Aún no hay cobros apuntados');
    await expect(page.locator('.nocobros').getByRole('button', { name: '+ Apuntar cobro' })).toBeVisible();
    expect((await recordOf(page)).paid).toBeUndefined();
  });

  test('«No se cobró nada» asks first, and then everything that corresponds is owed', async ({ page }) => {
    await addJob(page, { terms: FINISHED });
    await question(page).getByRole('button', { name: 'No se cobró nada' }).click();
    await expect(question(page).locator('h3')).toContainText('¿No se cobró nada?');
    expect((await recordOf(page)).paid).toBeUndefined();
    await question(page).getByRole('button', { name: 'Volver' }).click();
    await expect(question(page).getByRole('button', { name: 'Sí, todo' })).toBeVisible();
    await question(page).getByRole('button', { name: 'No se cobró nada' }).click();
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
    // The ficha keeps «Hasta hoy» and the way in; the days and the cobros are in the page
    await expect(page.locator('#result .registro-link')).toContainText('Registro');
    await expect(page.locator('#result .monthstrip')).toHaveCount(0);
    await openRegistro(page);
    expect(await page.evaluate(() => history.state?.registro)).toBe(true);
    await expect(page.locator('#registroPage .monthstrip button')).toHaveCount(4);
    await expect(page.locator('#registroPage .cobros')).toBeVisible();
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

  test('by what happened only: a days total and a total cobrado, approximate, with no pay agreed', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.locator('#pastDays').fill('60');
    await page.locator('#pastPaid').fill('4000');
    await page.locator('#pastApprox').check();
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
    await page.locator('#pastPaid').fill('4000');
    await page.locator('#pastApprox').check();
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    const tile = (name) => page.locator('#result .sofar > div', { hasText: name }).locator('b');
    await expect(tile('Cobrado')).toContainText('≈');
    // No pay agreed: nothing to compare the cobros with
    await expect(tile('Falta')).toHaveText('—');
    await expect(tile('Corresponde')).toHaveText('—');
    await expect(page.locator('#result .block.result .lbl')).toHaveText('Cobrado');
    await expect(page.locator('#result .block.result .sub')).toContainText('No se apuntó lo pactado');
    const rest = page.locator('#result .lawcheck > div', { hasText: 'Descanso semanal' });
    await expect(rest).toContainText('No se puede juzgar en 3 meses apuntados por totales');
    await openRegistro(page);
    await expect(page.locator('#registroPage .cobros .pr .a')).toContainText('≈');
    await expect(page.locator('#registroPage .cobros .pr')).toContainText('cifra aproximada');
    await expect(page.locator('#registroPage .cobros .bh .n')).toContainText('≈');
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
    await page.locator('#pastPaid').fill('3000');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    const record = await recordOf(page);
    expect(record.payments[0]).toMatchObject({ amount: 3000 });
    expect(record.payments[0].approx).toBeUndefined();
    expect(record.paid).toBeUndefined();
    expect(Object.values(record.months).reduce((t, m) => t + m.count.work, 0)).toBe(80);
    await expect(page.locator('#result .sofar > div', { hasText: 'Cobrado' }).locator('b')).toContainText('3.000');
  });

  test('with only the dates, the job is saved bare and asks whether it was paid', async ({ page }) => {
    await open(page);
    await dates(page, '2026-06-01', '2026-08-31');
    await page.getByRole('button', { name: 'Guardar el trabajo' }).click();
    await expect(page.getByRole('group', { name: '¿Se cobró este trabajo?' })).toBeVisible();
  });
});
