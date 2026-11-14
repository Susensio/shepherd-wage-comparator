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

  test('asked of a finished job (a fijo discontinuo says «Fin de campaña»); it takes the last day of the job, and it is said on a line', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(card(page).locator('h3')).toHaveText('¿Cómo acabó?');
    for (const way of [
      'Fin de campaña',
      'Despido, o el ganadero lo acabó antes',
      'Lo dejó el pastor o la pastora',
      'Baja médica o accidente',
      'Sigue, se alargó',
    ])
      await expect(card(page).getByRole('button', { name: way })).toBeVisible();
    await card(page).getByRole('button', { name: 'Fin de campaña' }).click();
    await expect(card(page)).toHaveCount(0);
    expect((await record(page)).end).toEqual({ how: 'agreed', date: '2026-09-30' });
    await expect(page.locator('#result .real', { hasText: 'Acabó el 30 sept 2026' })).toContainText('al final pactado');
  });

  test('a dismissal asks the day, and the ladder shows its date', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await card(page).getByRole('button', { name: 'Despido, o el ganadero lo acabó antes' }).click();
    await expect(card(page).locator('h3')).toContainText('¿Qué día acabó?');
    // The day starts empty and is required, between the job's start and today
    await expect(card(page).locator('#endDate')).toHaveValue('');
    await card(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(card(page).getByRole('alert')).toContainText('Escribe el día, entre el 21 jun 2026 y hoy.');
    await card(page).locator('#endDate').fill('2026-05-01');
    await card(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(card(page).getByRole('alert')).toContainText('El día tiene que estar entre el 21 jun 2026 y hoy.');
    expect((await record(page)).end).toBeUndefined();
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
    await expect(card.getByRole('button', { name: 'Fin de campaña' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Lo dejó el pastor o la pastora' }).click();
    await card.locator('#endDate').fill('2026-08-10');
    await card.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    expect((await record(page)).end).toEqual({ how: 'quit', date: '2026-08-10' });
    // The job stops there: the real period says so, and the months after it are not part of it
    await expect(page.locator('#result .real', { hasText: 'Trabajo real' })).toContainText(
      'Trabajo real: del 21 jun 2026 al 10 ago 2026',
    );
    await expect(page.locator('.monthstrip button[data-key="2026-09"]')).toHaveCount(0);
  });

  test('not offered for an offer only', async ({ page }) => {
    await loadOffers(page, sample, SOLO_OFERTA);
    await page.locator('#fichaMenu').click();
    await expect(page.locator('#offerMenu [data-menu=endedEarly]')).toBeHidden();
  });
});

test.describe('baja médica: a status, not an end', () => {
  test.use({ today: '2026-11-12' });
  const card = (page) => page.getByRole('group', { name: '¿Cómo acabó?' });

  test('marks the days sick from the day said, keeps the job going, and says what a dismissal during it is', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await card(page).getByRole('button', { name: 'Baja médica o accidente' }).click();
    await card(page).locator('#endDate').fill('2026-09-20');
    await card(page).getByRole('button', { name: 'Guardar' }).click();
    const rec = await record(page);
    expect(rec.end).toBeUndefined();
    expect(rec.sick).toEqual({ from: '2026-09-20' });
    expect(rec.months['2026-09'].days['25']).toBe('sick');
    expect(rec.months['2026-09'].days['19']).toBeUndefined();
    const line = page.locator('#result .real', { hasText: 'De baja desde el 20 sept 2026' });
    await expect(line).toContainText('se contesta como «Despido»');
    await expect(card(page)).toHaveCount(0);
    // The job can still end later, and the leave can be closed
    await line.getByRole('button', { name: 'Volver al trabajo' }).click();
    await expect(card(page)).toHaveCount(1); // the question comes back once the leave is closed
    expect((await record(page)).sick).toEqual({ from: '2026-09-20', to: '2026-11-11' });
    await expect(page.locator('#result .real', { hasText: 'De baja del 20 sept 2026 al 11 nov 2026' })).toBeVisible();
  });
});

test.describe('fijo discontinuo: called back for the next season', () => {
  test.use({ today: '2027-06-22' }); // the offer starts on 21 June 2026: its next season, a year on
  const recall = (page) => page.getByRole('group', { name: '¿Se llamó para la campaña?' });

  test.beforeEach(async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.getByRole('group', { name: '¿Cómo acabó?' }).getByRole('button', { name: 'Fin de campaña' }).click();
  });

  test('asked from the season’s expected start; «Sí» is the end of the question', async ({ page }) => {
    await expect(recall(page).locator('h3')).toContainText('¿Se llamó para la campaña de 2027?');
    await recall(page).getByRole('button', { name: 'Sí' }).click();
    await expect(recall(page)).toHaveCount(0);
    expect((await record(page)).recall).toEqual({ 2027: 'yes' });
    expect((await record(page)).end.how).toBe('agreed');
  });

  test('«No» is a dismissal from the day it was known, asked and validated', async ({ page }) => {
    await recall(page).getByRole('button', { name: 'No' }).click();
    await recall(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(recall(page).getByRole('alert')).toBeVisible();
    await recall(page).locator('#recallDate').fill('2027-06-20');
    await recall(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(recall(page)).toHaveCount(0);
    const rec = await record(page);
    expect(rec.end).toEqual({ how: 'dismissed', date: '2027-06-20' });
    expect(rec.recall).toEqual({ 2027: 'no' });
    await expect(page.locator('.dismissal')).toContainText('16 jul 2027 como muy tarde');
  });

  test('not asked before that day', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-06-10T12:00:00'));
    await page.evaluate(() => app.select(app.active().id));
    await expect(recall(page)).toHaveCount(0);
  });
});
