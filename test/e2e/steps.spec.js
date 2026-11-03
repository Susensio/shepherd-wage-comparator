// The guided entry and the ficha: the order of the steps, «Luego», changing one step, and the phone's Back button.

import { expect, goStep, loadOffers, openStep, sample, startOffer, test } from './fixtures.js';

const active = (page) => page.evaluate(() => app.active());
const counter = (page) => page.locator('#entryCounter');

test('a new offer goes through the steps in order, from the templates to the ficha', async ({ page }) => {
  await expect(page.locator('#entryTitle')).toHaveText('¿Se parece a alguna de estas?');
  await expect(page.locator('#entrySkip')).toBeHidden(); // nothing to skip on the first step
  await expect(page.locator('#entryNext')).toBeHidden(); // until a template is picked
  await page.locator('.tcard').first().click();
  const titles = [
    '¿Dónde es?',
    '¿Cuándo y cuánto tiempo?',
    '¿Cuánto te pagan?',
    'Jornada y libranzas',
    'Casa y comida',
    '¿Cómo llegas?',
    'Tus gastos y el IRPF',
  ];
  for (const [i, title] of titles.entries()) {
    await expect(page.locator('#entryTitle')).toHaveText(title);
    await expect(counter(page)).toHaveText(`Paso ${i + 2} de 8`);
    await expect(page.locator('#entry .step:visible')).toHaveCount(1);
    await page.locator('#entryNext').click();
  }
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('.tabs')).toBeVisible();
});

test('the entry has no tab bar, and a strip with what is earned so far', async ({ page }) => {
  await startOffer(page, 'when');
  await expect(page.locator('.tabs')).toBeHidden();
  await expect(page.locator('#stripFigure')).toHaveText('—'); // data missing
  await page.fill('#duration', '4');
  await goStep(page, 'pay');
  await page.fill('#payTotal', '70');
  await page.check('input[name=vacation][value=included]');
  await goStep(page, 'workday');
  await page.fill('#hoursPerDay', '9');
  await expect(page.locator('#stripLabel')).toHaveText(/^Ganas (al día|al mes), por ahora$/);
  const expected = await page.evaluate(async () => {
    const { fUnit, inUnit, offerUnit } = await import('./src/units.js');
    const r = app.calcOffer(app.active());
    const unit = offerUnit(r);
    return fUnit(inUnit(r.earnings.total, r, unit), unit);
  });
  await expect(page.locator('#stripFigure')).toHaveText(expected);
});

test('«Luego» goes on without answering', async ({ page }) => {
  await startOffer(page, 'when');
  await page.locator('#entrySkip').click();
  await expect(page.locator('#entryTitle')).toHaveText('¿Cuánto te pagan?');
  expect((await active(page)).terms.duration).toBe(''); // nothing was asked
  await page.locator('#entryBack').click();
  await expect(page.locator('#entryTitle')).toHaveText('¿Cuándo y cuánto tiempo?');
  await goStep(page, 'expenses');
  await expect(page.locator('#entryNext')).toHaveText('Ver la ficha');
  await page.locator('#entrySkip').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#result .empty')).toContainText('falta');
});

test('picking another template on coming back replaces the offer, it does not add one', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await goStep(page, 'template');
  await expect(page.locator('.tcard[aria-pressed=true]')).toHaveCount(1);
  await page.locator('.tcard[data-template=harvest]').click();
  const names = await page.evaluate(() => app.state.offers.map((o) => o.mine.name));
  expect(names).toEqual(['Campaña o jornales']);
});

test('the list shows each offer as a card, and a card opens its ficha', async ({ loaded: page }) => {
  await page.click('[data-action=closeFicha]');
  await expect(page.locator('#cards .ocard')).toHaveCount(8);
  const card = page.locator('#cards .ocard', { hasText: 'Puerto A, otra cuenta' });
  await expect(card.locator('.oc-fig')).toContainText('€');
  // The facts that tell offers apart, not «No cumple», which almost every card would say
  await expect(card.locator('.oc-facts')).toContainText('h/sem');
  await expect(card.locator('.oc-facts')).toContainText('% en negro');
  await expect(page.locator('#cards')).not.toContainText('No cumple');
  await card.click();
  await expect(page.locator('#fichaName')).toHaveText('Puerto A, otra cuenta');
  await expect(page.locator('.crow')).toHaveCount(7);
  await expect(page.locator('#result .analysis-title')).toHaveText('Análisis');
});

test('a row of the ficha opens only its step, and «Guardar» keeps the change', async ({ loaded: page }) => {
  await openStep(page, 'workday');
  await expect(counter(page)).toHaveText('Cambiar');
  await expect(page.locator('#entry .step:visible')).toHaveCount(1);
  await expect(page.locator('#entrySkip')).toBeHidden();
  await expect(page.locator('#entryClose')).toHaveText('Cancelar');
  await page.fill('#hoursPerDay', '7');
  await page.locator('#entryNext').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('.crow[data-step=workday]')).toContainText('7 h/día');
  expect((await active(page)).terms.hoursPerDay).toBe(7);
});

test('«Cancelar» puts the offer back as it was', async ({ loaded: page }) => {
  const before = await active(page);
  await openStep(page, 'pay');
  await page.fill('#payTotal', '999');
  await page.check('input[name=payroll][value=none]');
  expect((await active(page)).terms).not.toEqual(before.terms);
  await page.locator('#entryClose').click();
  await expect(page.locator('#ficha')).toBeVisible();
  expect(await active(page)).toEqual(before);
  await expect(page.locator('.crow[data-step=pay]')).not.toContainText('999');
});

test('the phone Back button goes from the step to the ficha to the list, and restores a cancelled step', async ({
  loaded: page,
}) => {
  await page.click('[data-action=closeFicha]');
  await page.locator('#cards .ocard').nth(1).click();
  await expect(page.locator('#ficha')).toBeVisible();
  const before = await active(page);
  await page.locator('.crow[data-step=pay]').click();
  await page.fill('#payTotal', '999');
  await page.goBack();
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('#ficha')).toBeVisible();
  expect(await active(page)).toEqual(before);
  await page.goBack();
  await expect(page.locator('#ficha')).toBeHidden();
  await expect(page.locator('#cards')).toBeVisible();
});

test('the «Ofertas» link and the page Back stay in step', async ({ loaded: page }) => {
  await page.click('[data-action=closeFicha]');
  await page.locator('#cards .ocard').first().click();
  await page.click('[data-action=closeFicha]');
  await expect(page.locator('#cards')).toBeVisible();
  await page.goBack(); // one history entry was left from before the first ficha: nothing more to close
  await expect(page.locator('#cards')).toBeVisible();
});

test('Back from a new offer closes the entry and keeps the offer', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await page.goBack();
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('#cards .ocard')).toHaveCount(1);
});

test('a new offer from the list opens the entry over it, and «Cerrar» goes back', async ({ loaded: page }) => {
  await page.click('[data-action=closeFicha]');
  await page.click('#btnAdd');
  await expect(page.locator('#entry')).toBeVisible();
  await expect(counter(page)).toHaveText('Paso 1 de 8');
  await page.locator('#entryClose').click();
  await expect(page.locator('#cards')).toBeVisible();
  await expect(page.locator('#cards .ocard')).toHaveCount(sample.offers.length);
});

test('each step fits a phone: nothing wider than the screen', async ({ page }) => {
  await loadOffers(page, sample, 0);
  await openStep(page, 'pay');
  for (const id of ['pay', 'when', 'workday', 'home', 'trip', 'expenses', 'place']) {
    await page.evaluate(() => app.openFicha());
    if (!(await page.locator('#ficha').isVisible())) await page.locator('#entryClose').click();
    await page.locator(`.crow[data-step=${id}]`).click();
    const problems = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const visible = [...document.querySelectorAll('#entry :is(input, label, button)')].filter(
        (e) => e.getClientRects().length && getComputedStyle(e).opacity !== '0',
      );
      return visible
        .filter((e) => e.getBoundingClientRect().right > width + 0.5)
        .map((e) => `${e.tagName}#${e.id} ${e.getBoundingClientRect().right}`);
    });
    expect(problems, id).toEqual([]);
    await page.locator('#entryClose').click();
  }
});
