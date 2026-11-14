// The questions at the turns of a job (ADR-0034): «¿Empezó el trabajo?» and «¿Cómo acabó?».

import { expect, loadOffers, sample, test } from './fixtures.js';

const PUERTO_A_OTRA = 1; // 21 June to 30 September 2026
const SOLO_OFERTA = 0;
const record = (page) => page.evaluate(() => app.active().mine.record);

test.describe('«¿Empezó el trabajo?»', () => {
  test.use({ today: '2026-08-12' });

  test('asked once a job under way has nothing recorded; «Sí» keeps the offer’s date and it is not asked again', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const card = page.getByRole('group', { name: '¿Empezó el trabajo?' });
    await expect(card.locator('h3')).toHaveText('¿Empezó el trabajo el 21 jun 2026?');
    await card.getByRole('button', { name: 'Sí', exact: true }).click();
    await expect(card).toHaveCount(0);
    expect((await record(page)).started).toEqual({ date: '2026-06-21' });
    await page.evaluate(() => app.select(app.active().id));
    await expect(card).toHaveCount(0);
  });

  test('«Otra fecha» moves the start and keeps the answer', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const card = page.getByRole('group', { name: '¿Empezó el trabajo?' });
    await card.getByRole('button', { name: 'Otra fecha' }).click();
    await card.locator('#startOther').fill('2026-06-25');
    await card.getByRole('button', { name: 'Guardar' }).click();
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(() => app.active().terms.start)).toBe('2026-06-25');
    expect((await record(page)).started).toEqual({ date: '2026-06-25' });
  });

  test('«No se cogió» leaves it as an offer only: no phase, no record', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.getByRole('button', { name: 'No se cogió: solo oferta' }).click();
    expect(await page.evaluate(() => app.active().terms.offerOnly)).toBe(true);
    await expect(page.locator('#fichaPhase')).toBeHidden();
    await expect(page.getByRole('group', { name: '¿Empezó el trabajo?' })).toHaveCount(0);
  });

  test('not asked of an offer only, nor once a cobro is recorded', async ({ page }) => {
    await loadOffers(page, sample, SOLO_OFERTA);
    await expect(page.getByRole('group', { name: '¿Empezó el trabajo?' })).toHaveCount(0);
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.addPayment(app.active(), { date: '2026-07-05', amount: 100, via: 'payroll' });
      app.select(app.active().id);
    });
    await expect(page.getByRole('group', { name: '¿Empezó el trabajo?' })).toHaveCount(0);
  });
});

test.describe('«¿Cómo acabó?»', () => {
  test.use({ today: '2026-11-12' });
  const card = (page) => page.getByRole('group', { name: '¿Cómo acabó?' });

  test('asked of a finished job; «Al final pactado» takes the last day of the job, and it is said on a line', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(card(page).locator('h3')).toHaveText('¿Cómo acabó?');
    for (const way of [
      'Al final pactado',
      'Lo despidió el ganadero o lo acabó antes',
      'Se dejó',
      'Baja médica o accidente',
      'Sigue, se alargó',
    ])
      await expect(card(page).getByRole('button', { name: way })).toBeVisible();
    await card(page).getByRole('button', { name: 'Al final pactado' }).click();
    await expect(card(page)).toHaveCount(0);
    expect((await record(page)).end).toEqual({ how: 'agreed', date: '2026-09-30' });
    await expect(page.locator('#result .real', { hasText: 'Acabó el 30 sept 2026' })).toContainText('al final pactado');
  });

  test('a dismissal asks the day, and the ladder shows its date', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await card(page).getByRole('button', { name: 'Lo despidió el ganadero o lo acabó antes' }).click();
    await expect(card(page).locator('h3')).toContainText('¿Qué día acabó?');
    await card(page).locator('#endDate').fill('2026-11-06');
    await card(page).getByRole('button', { name: 'Guardar' }).click();
    expect((await record(page)).end).toEqual({ how: 'dismissed', date: '2026-11-06' });
    await expect(page.locator('.dismissal')).toContainText('4 dic 2026 como muy tarde');
  });

  test('«Sigue, se alargó» goes to the next month’s calendar and the card is put off', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await card(page).getByRole('button', { name: 'Sigue, se alargó' }).click();
    await expect(page.locator('.cal h3')).toHaveText('Octubre 2026');
    expect((await record(page)).end).toBeUndefined();
  });
});

test.describe('«Acabó antes» in the «⋯» menu', () => {
  test.use({ today: '2026-08-12' });

  test('asks how, without «Al final pactado», and the job becomes Acabada', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page
      .getByRole('group', { name: '¿Empezó el trabajo?' })
      .getByRole('button', { name: 'Sí', exact: true })
      .click();
    await expect(page.locator('#fichaPhase')).toHaveText('En curso');
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=endedEarly]').click();
    const card = page.getByRole('group', { name: '¿Cómo acabó?' });
    await expect(card.getByRole('button', { name: 'Al final pactado' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Se dejó' }).click();
    await card.locator('#endDate').fill('2026-08-10');
    await card.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    expect((await record(page)).end).toEqual({ how: 'quit', date: '2026-08-10' });
    // The days after it are libre: September is not worked
    expect((await record(page)).months['2026-09'].days['15']).toBe('off');
  });

  test('not offered for an offer only', async ({ page }) => {
    await loadOffers(page, sample, SOLO_OFERTA);
    await page.locator('#fichaMenu').click();
    await expect(page.locator('#offerMenu [data-menu=endedEarly]')).toBeHidden();
  });
});
