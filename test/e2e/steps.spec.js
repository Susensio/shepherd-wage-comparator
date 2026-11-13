// The guided entry and the ficha: the order of the steps, «Siguiente» that never blocks, changing one step, and the phone's Back button.

import {
  expect,
  goStep,
  leaveWelcome,
  loadOffers,
  openCondition,
  openStep,
  sample,
  saveStep,
  startOffer,
  test,
} from './fixtures.js';

const active = (page) => page.evaluate(() => app.active());
const counter = (page) => page.locator('#entryCounter');

test('a new offer goes through the steps in order, from the templates to the ficha', async ({ page }) => {
  await expect(page.locator('#welcomeTitle')).toHaveText('Cuentas claras de cada oferta'); // a first visit opens with the pitch
  await expect(page.locator('#entryTitle')).toBeHidden();
  await page.locator('#welcomeStart').click();
  await expect(page.locator('#entryTitle')).toHaveText('¿Se parece a alguna de estas?');
  await expect(page.locator('#entryNext')).toBeHidden(); // until a template is picked
  await leaveWelcome(page);
  await page.locator('.tcard').first().click();
  const titles = ['La oferta', 'Pago', 'El día a día', 'Coche y gastos'];
  for (const [i, title] of titles.entries()) {
    await expect(page.locator('#entryTitle')).toHaveText(title);
    await expect(counter(page)).toHaveText(`Paso ${i + 2} de 5`);
    await expect(page.locator('#entry .step:visible')).toHaveCount(1);
    await page.locator('#entryNext').click();
  }
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('.tabs')).toBeVisible();
});

test('the entry has no tab bar, and a strip with what is earned so far', async ({ page }) => {
  await startOffer(page, 'offer');
  await expect(page.locator('.tabs')).toBeHidden();
  await expect(page.locator('#stripFigure')).toHaveText('sin calcular'); // data missing
  await page.fill('#duration', '4');
  await goStep(page, 'pay');
  await page.fill('#payTotal', '70');
  await page.check('input[name=vacation][value=included]');
  await goStep(page, 'day');
  await page.fill('#hoursPerDay', '9');
  await expect(page.locator('#stripLabel')).toHaveText(/^Se gana (al día|al mes), por ahora$/);
  const expected = await page.evaluate(async () => {
    const { fUnit, inUnit, offerUnit } = await import('./src/units.js');
    const r = app.calcOffer(app.active());
    const unit = offerUnit(r, app.active().terms);
    return fUnit(inUnit(r.earnings.total, r, unit), unit);
  });
  await expect(page.locator('#stripFigure')).toHaveText(expected);
});

test('an answer that cannot be right says so on its step', async ({ page }) => {
  await startOffer(page, 'offer');
  await page.fill('#duration', '-5');
  await expect(page.locator('[data-required=duration]')).toHaveText('La duración tiene que ser mayor que cero.');
  await page.fill('#duration', '4');
  await expect(page.locator('[data-required=duration]')).toBeEmpty();
  await goStep(page, 'day');
  await page.fill('#hoursPerDay', '30');
  await expect(page.locator('[data-required=hoursPerDay]')).toHaveText('Un día tiene 24 horas: revisa la cifra.');
});

test('«Siguiente» goes on with a required answer empty, and the ficha shows what is missing', async ({ page }) => {
  await startOffer(page, 'offer');
  await page.locator('#entryNext').click();
  await expect(page.locator('#entryTitle')).toHaveText('Pago');
  expect((await active(page)).terms.duration).toBe(''); // nothing was asked
  await page.locator('#entryBack').click();
  await expect(page.locator('#entryTitle')).toHaveText('La oferta');
  await goStep(page, 'trip');
  await expect(page.locator('#entryNext')).toHaveText('Ver la ficha');
  await page.locator('#entryNext').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#result .empty')).toContainText('falta');
  await expect(page.locator('.crow.missing').first()).toContainText('Falta');
});

test('the entry has no «Luego» button, on any step', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Luego' })).toHaveCount(0);
  await startOffer(page, 'offer');
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('#entry').getByText('Luego', { exact: true })).toHaveCount(0);
    await page.locator('#entryNext').click();
  }
});

test('the hours warning shows under the question while it is empty, and goes when it is filled', async ({ page }) => {
  await startOffer(page, 'day');
  const warning = page.locator('[data-required=hoursPerDay]');
  await expect(warning).toHaveText('Sin las horas no se puede calcular cuánto se gana.');
  await expect(warning).toBeVisible();
  await page.fill('#hoursPerDay', '9');
  await expect(warning).toBeHidden();
  await page.fill('#hoursPerDay', '');
  await expect(warning).toBeVisible();
  await page.fill('#hoursPerDay', '9');
  await page.locator('#entryNext').click(); // not blocked, and no warning leaks into the next step
  await expect(page.locator('#entry [data-required]:visible')).toHaveCount(0);
});

test('the pay, vacation and duration warnings show only while their answer is missing', async ({ page }) => {
  await startOffer(page, 'pay');
  await expect(page.locator('[data-required=pay]')).toHaveText(/^Sin el pago/);
  await page.evaluate(() => {
    app.active().terms.vacation = ''; // a new offer starts with one chosen
  });
  await page.fill('#payTotal', '70');
  await page.fill('#payTotal', '71');
  await expect(page.locator('[data-required=vacation]')).toHaveText(/^Sin esto no se puede comprobar/);
  await page.check('input[name=vacation][value=paidAtEnd]'); // «included» is still ticked on screen
  await expect(page.locator('[data-required=pay]')).toBeHidden();
  await expect(page.locator('[data-required=vacation]')).toBeHidden();
  await goStep(page, 'offer');
  await expect(page.locator('[data-required=duration]')).toHaveText('Si no se sabe, marca «No se sabe».');
  await page.check('input[name=durationUnit][value=unknown]');
  await expect(page.locator('[data-required=duration]')).toBeHidden();
});

test('picking another template on coming back replaces the offer, it does not add one', async ({ page }) => {
  await leaveWelcome(page);
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
  // Short cards: name, figure, dates and herd; the facts that tell offers apart are in Comparar
  await expect(card.locator('.oc-detail')).toContainText('2026');
  await expect(page.locator('#cards')).not.toContainText('h/sem');
  // Not worked: muted, tagged (Puerto A is marked «solo oferta», Puerto A otra cuenta is worked)
  await expect(page.locator('#cards .ocard[data-id=o1]')).toHaveClass(/offer-only/);
  await expect(card).not.toHaveClass(/offer-only/);
  await expect(page.locator('#cards .offer-only-tag').first()).toHaveText('solo oferta');
  await card.click();
  await expect(page.locator('#fichaName')).toHaveText('Puerto A, otra cuenta');
  await expect(page.locator('.crow')).toHaveCount(4);
  // The job is over by now: Cuentas, not the offer's analysis (the modes are tested in record.spec.js)
  await expect(page.locator('#result h2.mode')).toHaveText(/Cuentas/);
});

test('a row of the ficha opens only its step, and «Guardar» keeps the change', async ({ loaded: page }) => {
  await openStep(page, 'day');
  await expect(counter(page)).toHaveText('Cambiar');
  await expect(page.locator('#entry .step:visible')).toHaveCount(1);
  await expect(page.locator('#entryClose')).toHaveText('Cancelar');
  await page.fill('#hoursPerDay', '7');
  await page.locator('#entryNext').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('.crow[data-step=day]')).toContainText('7 h/día');
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

/** What is in the browser's storage for the active offer: what a reload, the account or a sharing would see. */
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('cj.ofertas2')).find((o) => o.id === app.state.activeId));

test('a step changed is saved only on «Guardar»: until then nothing is stored, and «Cancelar» leaves it as it was', async ({
  loaded: page,
}) => {
  const before = (await stored(page)).terms.hoursPerDay;
  await openStep(page, 'day');
  await page.fill('#hoursPerDay', '3');
  expect((await active(page)).terms.hoursPerDay).toBe(3); // the page already shows it
  expect((await stored(page)).terms.hoursPerDay).toBe(before);
  await page.locator('#entryClose').click();
  expect((await stored(page)).terms.hoursPerDay).toBe(before);
  expect((await active(page)).terms.hoursPerDay).toBe(before);

  await openStep(page, 'day');
  await page.fill('#hoursPerDay', '4');
  expect((await stored(page)).terms.hoursPerDay).toBe(before);
  await saveStep(page);
  expect((await stored(page)).terms.hoursPerDay).toBe(4);
});

test('another template asks twice when something was typed, and not when nothing was', async ({ page }) => {
  await page.goto('/');
  await leaveWelcome(page);
  await page.locator('.tcard').first().click();
  await goStep(page, 'template');
  await leaveWelcome(page);
  await page.locator('.tcard').nth(1).click(); // nothing typed yet: changes at once
  await expect(page.locator('#tplWarn')).toBeHidden();
  await expect(counter(page)).toHaveText('Paso 2 de 5');
  await goStep(page, 'day');
  await page.fill('#hoursPerDay', '7');
  await goStep(page, 'template');
  await leaveWelcome(page);
  await page.locator('.tcard').first().click();
  await expect(page.locator('#tplWarn')).toBeVisible();
  await expect(counter(page)).toHaveText('Paso 1 de 5');
  expect((await active(page)).terms.hoursPerDay).toBe(7);
  await leaveWelcome(page);
  await page.locator('.tcard').first().click();
  await expect(counter(page)).toHaveText('Paso 2 de 5');
  expect((await active(page)).terms.hoursPerDay).not.toBe(7);
});

test('the phone Back button goes from the step to the ficha to the list, and restores a cancelled step', async ({
  loaded: page,
}) => {
  await page.click('[data-action=closeFicha]');
  await page.locator('#cards .ocard').nth(1).click();
  await expect(page.locator('#ficha')).toBeVisible();
  const before = await active(page);
  await openCondition(page, 'pay');
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
  await leaveWelcome(page);
  await page.locator('.tcard').first().click();
  await page.goBack();
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('#cards .ocard')).toHaveCount(1);
});

/** Where the tab is in its history: a stale entry left behind shows as one more. */
const historyIndex = (page) => page.evaluate(() => navigation.currentEntry?.index);
/** Deletes the offer shown in the ficha, through its «⋯» menu. */
async function deleteFromFicha(page) {
  await page.locator('#ficha .omenu:visible').click();
  await page.locator('#offerMenu [data-menu=delete]').click();
  await page.locator('#offerMenu [data-menu=delete]').click(); // «¿Seguro?»
}

test('deleting from the ficha drops its history entry: Back does not stop on a list that is already shown', async ({
  loaded: page,
}) => {
  await page.click('[data-action=closeFicha]');
  const list = await historyIndex(page);
  await page.locator('#cards .ocard').nth(1).click();
  await deleteFromFicha(page);
  await expect(page.locator('#cards')).toBeVisible();
  await expect.poll(() => historyIndex(page)).toBe(list);
});

test('deleting the last offer opens the templates in place of its ficha; Back goes to the list once', async ({
  page,
}) => {
  const entry = await historyIndex(page);
  await leaveWelcome(page);
  await page.locator('.tcard').first().click();
  for (let i = 0; i < 4; i++) await page.locator('#entryNext').click();
  await expect(page.locator('#ficha')).toBeVisible();
  await deleteFromFicha(page);
  await expect(page.locator('#entry .tcard').first()).toBeVisible();
  expect(await historyIndex(page)).toBe(entry);
  await page.goBack();
  await expect(page.locator('#entry')).toBeHidden();
  expect(await historyIndex(page)).toBe(entry - 1);
});

test('a new offer from the list opens the entry over it, and «Cerrar» goes back', async ({ loaded: page }) => {
  await page.click('[data-action=closeFicha]');
  await page.click('#btnAdd');
  await expect(page.locator('#entry')).toBeVisible();
  await expect(counter(page)).toHaveText('Paso 1 de 5');
  await page.locator('#entryClose').click();
  await expect(page.locator('#cards')).toBeVisible();
  await expect(page.locator('#cards .ocard')).toHaveCount(sample.offers.length);
});

test('every step uses the width of the screen: no rule of another block squeezes the form', async ({ page }) => {
  await loadOffers(page, sample, 0);
  for (const id of ['offer', 'pay', 'day', 'trip']) {
    await openStep(page, id);
    const widths = await page.evaluate((id) => {
      const step = document.querySelector(`#entry .step[data-step=${id}]`);
      const first = step.querySelector('fieldset');
      return { step: step.getBoundingClientRect().width, fieldset: first ? first.getBoundingClientRect().width : null };
    }, id);
    expect(widths.step).toBeGreaterThan(300);
    if (widths.fieldset !== null) expect(widths.fieldset).toBeGreaterThan(300);
    await page.locator('#entryClose').click();
  }
});

test('each step fits a phone: nothing wider than the screen', async ({ page }) => {
  await loadOffers(page, sample, 0);
  await openStep(page, 'pay');
  for (const id of ['pay', 'offer', 'day', 'trip']) {
    await page.evaluate(() => app.openFicha());
    if (!(await page.locator('#ficha').isVisible())) await page.locator('#entryClose').click();
    await openCondition(page, id);
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
