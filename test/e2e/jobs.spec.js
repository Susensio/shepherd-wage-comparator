// The job as one thing with two sides (ADR-0035, phase C): the screens for what happened, whatever the terms say.

import { addJob, expect, test } from './fixtures.js';

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
    await expect(page.locator('.cobros')).toContainText('Se apuntó que se cobró todo lo pactado.');
    await page.locator('.cobros').getByRole('button', { name: 'Quitar' }).click();
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
