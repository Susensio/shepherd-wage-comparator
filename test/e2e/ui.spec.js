// The main flows, clicked through as a person would.

import { readFileSync } from 'node:fs';
import { withoutProject } from './fake-account.js';
import { expect, goStep, openStep, startOffer, test } from './fixtures.js';

/** Starts an offer from the first template and fills what the figures need, ending on the ficha. */
async function newOffer(page, { duration = '4', hours = '11', pay = '70', template = null } = {}) {
  await startOffer(page, 'offer', template);
  await page.fill('#duration', duration);
  await goStep(page, 'pay');
  await page.fill('#payTotal', pay);
  await page.check('input[name=vacation][value=included]');
  await goStep(page, 'day');
  await page.fill('#hoursPerDay', hours);
  await goStep(page, 'trip');
  await page.locator('#entryNext').click();
  await expect(page.locator('#ficha')).toBeVisible();
}

const offerNames = (page) => page.evaluate(() => app.state.offers.map((o) => o.mine.name));

test('a new offer from a template, through every step', async ({ page }) => {
  await expect(page.locator('#entryCounter')).toHaveText('Paso 1 de 5');
  await newOffer(page);
  await expect(page.locator('#result .tag .big')).toContainText('€');
  await expect(page.locator('.crow')).toHaveCount(4);
  // Changing the unit converts the duration: 4 months are 122 days
  await openStep(page, 'offer');
  await page.check('input[name=durationUnit][value=days]');
  await expect(page.locator('#duration')).toHaveValue('122');
});

test('each field is written to its own side of the offer', async ({ page }) => {
  await newOffer(page);
  await openStep(page, 'offer');
  await page.fill('#name', 'Mía');
  await page.locator('#entryNext').click();
  await openStep(page, 'trip');
  await page.fill('#kmHome', '30');
  await page.locator('#entryNext').click();
  await openStep(page, 'day');
  await page.check('input[name=housing][value=yes]');
  const offer = await page.evaluate(() => app.active());
  expect(offer.mine).toMatchObject({ name: 'Mía', kmHome: 30 });
  expect(offer.terms).toMatchObject({ duration: 4, payAmount: 70, housing: 'yes' });
  expect(offer.terms).not.toHaveProperty('kmHome');
  expect(offer.mine).not.toHaveProperty('payAmount');
});

test('the end date sets the duration', async ({ page }) => {
  await startOffer(page, 'offer');
  await page.fill('#start', '2026-06-21');
  await page.fill('#end', '2026-09-30');
  await expect(page.locator('#duration')).toHaveValue('102');
  await expect(page.locator('input[name=durationUnit][value=days]')).toBeChecked();
});

const MENU = '#offerMenu';

test('the ficha menu duplicates and deletes, asking twice before deleting', async ({ page }) => {
  await newOffer(page);
  const trigger = page.locator('#fichaMenu');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(MENU)).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(MENU)).toBeVisible();
  await expect(page.locator(`${MENU} [role=menuitem]:visible`)).toHaveText([
    'Duplicar',
    'Copiar ficha',
    'Copiar reclamación',
    'Borrar',
  ]);
  await expect(page.locator(`${MENU} [role=menuitem]`).first()).toBeFocused();
  await page.locator(`${MENU} [data-menu=duplicate]`).click();
  await expect(page.locator(MENU)).toBeHidden();
  const names = await offerNames(page);
  expect(names).toHaveLength(2);
  expect(names[1]).toMatch(/\(copia\)$/);
  // Deleting asks for a second tap, and the menu stays open meanwhile
  await trigger.click();
  await page.locator(`${MENU} [data-menu=delete]`).click();
  await expect(page.locator(`${MENU} [data-menu=delete]`)).toHaveText('¿Seguro?');
  await expect(page.locator(MENU)).toBeVisible();
  await page.locator(`${MENU} [data-menu=delete]`).click();
  expect(await offerNames(page)).toHaveLength(1);
  await expect(page.locator('#cards .ocard')).toHaveCount(1);
  await expect(page.locator('#ficha')).toBeHidden();
});

test('Escape closes the menu and gives the focus back to its button; so does tapping outside', async ({
  loaded: page,
}) => {
  const trigger = page.locator('#fichaMenu');
  await trigger.click();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(`${MENU} [role=menuitem]:visible`).nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator(MENU)).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.locator('#fichaName').click();
  await expect(page.locator(MENU)).toBeHidden();
  // A second tap on the button closes it too
  await trigger.click();
  await trigger.click();
  await expect(page.locator(MENU)).toBeHidden();
});

test('the delete confirmation goes back to «Borrar» when the menu closes', async ({ loaded: page }) => {
  await page.locator('#fichaMenu').click();
  await page.locator(`${MENU} [data-menu=delete]`).click();
  await expect(page.locator(`${MENU} [data-menu=delete]`)).toHaveText('¿Seguro?');
  await page.keyboard.press('Escape');
  await page.locator('#fichaMenu').click();
  await expect(page.locator(`${MENU} [data-menu=delete]`)).toHaveText('Borrar');
});

test('compare, and go to an offer from there', async ({ page }) => {
  await newOffer(page);
  await page.click('[data-action=closeFicha]');
  await page.click('#btnAdd');
  await newOffer(page, { duration: '15', hours: '10', pay: '80', template: 'harvest' });
  await page.click('.tabs [data-tab=compare]');
  const rows = page.locator('#cmpBlk .lr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.v')).toContainText(/\/día/); // per day by default
  await page.click("#cmpView label:has-text('total')");
  expect(await page.evaluate(() => app.state.cmpUnit)).toBe('total');
  await expect(rows.first().locator('.v')).not.toContainText('/día');
  await page.locator('#cmpBlk [data-action=openOffer]').nth(1).click();
  await expect(page.locator('.tabs [aria-selected=true]')).toHaveAttribute('data-tab', 'offers');
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#fichaName')).not.toBeEmpty();
});

test('head to head, in the unit Comparar is in', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  await page.click('[data-action=startPair]');
  // Puerto A lasts 102 days, Campaña B 11: under a month, and too different for totals
  await page.click('.lr[data-id=o1]');
  await page.click('.lr[data-id=o3]');
  const pair = page.locator('#pairBlk');
  await expect(pair).toContainText('Cara a cara');
  for (const label of ['Total por hora', 'Total por día', 'Para el ganadero', 'Dinero que pone por día'])
    await expect(pair).toContainText(label);
  await expect(pair).not.toContainText('Total al mes');
  await page.click("#cmpView label:has-text('mes')");
  // What the employer pays a month is the model's own figure, at that rate for the short one; «Le cuesta» appears
  // only with housing or food given
  const check = await page.evaluate(async () => {
    const { fE } = await import('./src/format.js');
    const ids = [...document.querySelectorAll('#pairBlk thead [data-id]')].map((b) => b.dataset.id);
    const results = ids.map((id) => app.calcOffer(app.state.offers.find((o) => o.id === id)));
    const cells = (label) =>
      [...(document.querySelectorAll('#pairBlk tbody tr') ?? [])]
        .find((tr) => tr.querySelector('th')?.textContent === label)
        ?.querySelectorAll('td');
    const text = (td) => td.textContent.trim();
    const [first, second] = [...cells('Dinero que pone al mes')].map(text);
    return {
      shown: [first, second],
      expected: results.map((r, n) => `${fE((r.employer.cost - r.inKind.total) / r.time.months)}${n === 1 ? '*' : ''}`),
      costRow: cells('Le cuesta al mes') !== undefined,
      inKind: results.some((x) => x.inKind.total > 0.5),
    };
  });
  expect(check.shown).toEqual(check.expected);
  expect(check.costRow).toBe(check.inKind);
  await expect(pair).toContainText('* Menos de un mes');
  await page.click("#cmpView label:has-text('total')");
  await expect(pair).not.toContainText('en total');
  await expect(pair).toContainText('Duran distinto, así que los totales no se comparan.');
  await expect(pair).toContainText('Duración');
  await page.click('#pairBlk [data-action=closePair]');
  await expect(pair).toHaveCount(0);
});

test('head to head shows totals when both last about the same', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  await page.click("#cmpView label:has-text('total')");
  await page.click('[data-action=startPair]');
  await page.click('.lr[data-id=o4]');
  await page.click('.lr[data-id=o6]');
  await expect(page.locator('#pairBlk').getByText('Total', { exact: true })).toBeVisible();
  await expect(page.locator('#pairBlk')).not.toContainText('Duran distinto');
});

test('Comparar can show the terms alone, without your travel and expenses', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  const rows = () => page.locator('#cmpBlk .lr .v').allTextContents();
  const full = await rows();
  await page.check('input[name=termsOnly]');
  await expect(page.locator('#cmpBlk .cmp-opts + .hint')).toContainText('IRPF');
  expect(await page.evaluate(() => app.state.termsOnly)).toBe(true);
  expect(await rows()).not.toEqual(full);
  await page.uncheck('input[name=termsOnly]');
  expect(await rows()).toEqual(full);
});

test('settings apply to every offer', async ({ page }) => {
  await page.click('[data-action=openSettingsPage]');
  await page.fill('#cfg_wear', '0.1');
  expect(await page.evaluate(() => app.state.config.wear)).toBe(0.1);
});

test('law figures are not settings: «Cómo se cuenta» has only the in-kind choice', async ({ page }) => {
  await page.click('[data-action=openSettingsPage]');
  await expect(page.locator('#assumptions summary')).toHaveText('Cómo se cuenta');
  await expect(page.locator('#assumptions input[type=text]')).toHaveCount(0);
  await expect(page.locator('#assumptions input[type=radio]')).toHaveCount(2);
  await expect(page.locator('#assumptions .hint')).toContainText('no se cambian aquí');
});

test('the page never calls the settings «Supuestos del cálculo»', async ({ loaded: page }) => {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details')) d.open = true;
  });
  const text = await page.evaluate(() => document.body.textContent);
  expect(text).not.toContain('Supuestos del cálculo');
  expect(text).toContain('Cómo se cuenta');
  // The tips are not in the text until they are tapped
  const tips = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tip]')].map((e) => e.dataset.tip).join(' '),
  );
  expect(tips).not.toContain('Supuestos del cálculo');
});

test('a ficha with data missing marks its row and opens that step', async ({ page }) => {
  await startOffer(page, 'trip', 'season');
  await page.locator('#entryNext').click();
  await expect(page.locator('#result .empty')).toContainText('falta');
  await expect(page.locator('#analysis-none, .analysis-title')).toHaveCount(0);
  await expect(page.locator('.crow.missing .miss').first()).toContainText('Falta');
  await expect(page.locator('#cards .ocard')).toContainText('Faltan datos');
  await page.locator('.conditions > summary').click();
  await page.locator('.crow.missing').first().click();
  await expect(page.locator('.fld.missing .warn').first()).toBeVisible();
  await expect(page.locator('.fld.missing').first()).toBeVisible();
});

test('copy the claim, from the menu', async ({ loaded: page }) => {
  await page.locator('#fichaMenu').click();
  await page.locator(`${MENU} [data-menu=copyClaim]`).click();
  await expect(page.locator(`${MENU} .menu-msg`)).not.toBeEmpty();
  const text = await page.evaluate(() => app.claimText(app.active(), app.calcOffer(app.active())));
  expect(text).toContain('SALARIO');
  expect(text).toContain('Zurrón sindical');
});

// With accounts the reminder gives way to the account button and its tooltip (account.spec.js)
test('without accounts, a backup, downloaded and loaded in another browser', async ({ openApp, browser }) => {
  const page = await openApp({ beforeLoad: withoutProject });
  await newOffer(page, { hours: '10', pay: '60' });
  await page.click('[data-action=closeFicha]');
  await expect(page.locator('#backupNotice')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#backupNotice [data-action=download]'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const data = readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(data)).toHaveProperty('offers');

  const other = await openApp({ ctx: await browser.newContext() });
  const backup = { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(data) };
  await other.setInputFiles('#backupFile', backup);
  await expect(other.locator('#backupResult')).toHaveText(/^Añadida 1 oferta/);
  await other.setInputFiles('#backupFile', backup);
  await expect(other.locator('#backupResult')).toContainText('ya estaba');
});

test('opening a card in «¿Es legal?» does not shrink its title while it animates', async ({ loaded: page }) => {
  // Before the job: a job that is over shows its Cuentas, not the offer's analysis
  await page.clock.setFixedTime(new Date('2025-01-01T12:00:00'));
  await page.evaluate(() => app.select(app.active().id));
  const card = page.locator('details.owed[data-fold]:not([open])').first();
  await expect(card).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  const heights = await card.evaluate(
    (d) =>
      new Promise((resolve) => {
        const summary = d.querySelector(':scope > summary');
        const seen = [];
        const t0 = performance.now();
        const tick = () => {
          seen.push(Math.round(summary.getBoundingClientRect().height));
          if (performance.now() - t0 < 500) requestAnimationFrame(tick);
          else resolve(seen);
        };
        summary.click();
        requestAnimationFrame(tick);
      }),
  );
  expect(new Set(heights).size, `summary heights: ${heights.join(', ')}`).toBe(1);
});

test('«Solo oferta» is always shown: ticked and locked without a start date', async ({ page }) => {
  await startOffer(page, 'offer');
  const box = page.locator('#f [name=offerOnly]');
  await page.fill('#start', '');
  await page.locator('#start').dispatchEvent('input');
  await expect(box).toBeVisible();
  await expect(box).toBeChecked();
  await expect(box).toBeDisabled();
  await expect(page.locator('#offerOnlyHint')).toContainText('cuenta como solo oferta');
  await page.fill('#start', '2026-06-01');
  await page.locator('#start').dispatchEvent('input');
  await expect(box).toBeEnabled();
  await expect(box).not.toBeChecked();
  await expect(page.locator('#offerOnlyHint')).toBeEmpty();
  await box.check();
  expect(await page.evaluate(() => app.active().terms.offerOnly)).toBe(true);
});

test('the chart over time shows only worked offers', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  const names = page.locator('#trend text.nm');
  await expect(names.first()).toBeVisible();
  const shown = await names.allTextContents();
  // Puerto A and Temporada F are marked «solo oferta»
  expect(shown).toContain('Puerto A, otra cuenta');
  expect(shown).not.toContain('Puerto A');
  expect(shown).not.toContain('Temporada F');
});

test('«Quitar» empties the start date, and hides itself', async ({ page }) => {
  await startOffer(page, 'offer');
  const clear = page.getByRole('button', { name: 'Quitar la fecha de inicio' });
  await expect(clear).toBeHidden();
  await page.fill('#start', '2026-06-01');
  await page.locator('#start').dispatchEvent('input');
  await expect(clear).toBeVisible();
  await clear.click();
  expect(await page.evaluate(() => app.active().terms.start)).toBe('');
  await expect(page.locator('#start')).toHaveValue('');
  await expect(page.locator('#end')).toHaveValue('');
  await expect(clear).toBeHidden();
  await expect(page.locator('#f [name=offerOnly]')).toBeChecked();
});

test('Comparar shows the offers that were only offers apart, and can hide them', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  const rows = page.locator('#cmpBlk .lr');
  // Puerto A and Temporada F are marked «solo oferta»
  await expect(rows).toHaveCount(8);
  await expect(page.locator('#cmpBlk .lr.offer-only')).toHaveCount(2);
  await expect(page.locator('#cmpBlk .lr.offer-only[data-id=o1] .offer-only-tag')).toHaveText('solo oferta');
  const toggle = page.locator('input[name=showOfferOnly]');
  await toggle.uncheck();
  await expect(rows).toHaveCount(6);
  await expect(page.locator('#cmpBlk')).toContainText('Se ocultan 2 de solo oferta.');
  await expect(page.locator('#cmpBlk .lr[data-id=o1]')).toHaveCount(0);
  await toggle.check();
  await expect(rows).toHaveCount(8);
});

test('clearing the end date leaves the duration unknown', async ({ loaded: page }) => {
  await page.evaluate(() => app.select('o4'));
  await openStep(page, 'offer');
  const clear = page.locator('[data-action=clearEnd]');
  await expect(clear).toBeVisible();
  await clear.click();
  const terms = await page.evaluate(() => app.active().terms);
  expect(terms.durationUnit).toBe('unknown');
  await expect(page.locator('#end')).toHaveValue('');
  await expect(page.locator('#f [name=durationUnit][value=unknown]')).toBeChecked();
  await expect(clear).toBeHidden();
});
