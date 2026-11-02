// The main flows, clicked through as a person would.

import { readFileSync } from 'node:fs';
import { withoutProject } from './fake-account.js';
import { expect, test } from './fixtures.js';

async function fillOffer(page, { duration = '4', hours = '11', pay = '70' } = {}) {
  await page.fill('#duration', duration);
  await page.fill('#hoursPerDay', hours);
  await page.check('input[name=vacation][value=included]');
  await page.fill('#payAmount', pay);
}

const offerNames = (page) => page.evaluate(() => app.state.offers.map((o) => o.mine.name));

test('a new offer from a template', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await expect(page.locator('#result .tag .big')).toContainText('€');
  // Changing the unit converts the duration: 4 months are 122 days
  await page.check('input[name=durationUnit][value=days]');
  await expect(page.locator('#duration')).toHaveValue('122');
});

test('each field is written to its own side of the offer', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await page.fill('#name', 'Mía');
  await page.locator('[data-fold=car] > summary').click();
  await page.fill('#kmHome', '30');
  await page.locator('[data-fold=housing] > summary').click();
  await page.check('input[name=housing][value=yes]');
  const offer = await page.evaluate(() => app.active());
  expect(offer.mine).toMatchObject({ name: 'Mía', kmHome: 30 });
  expect(offer.terms).toMatchObject({ duration: 4, payAmount: 70, housing: 'yes' });
  expect(offer.terms).not.toHaveProperty('kmHome');
  expect(offer.mine).not.toHaveProperty('payAmount');
});

test('the end date sets the duration', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await page.fill('#start', '2026-06-21');
  await page.fill('#end', '2026-09-30');
  await expect(page.locator('#duration')).toHaveValue('102');
  await expect(page.locator('input[name=durationUnit][value=days]')).toBeChecked();
});

test('duplicate and delete', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await page.click('[data-action=duplicate]');
  const names = await offerNames(page);
  expect(names).toHaveLength(2);
  expect(names[1]).toMatch(/\(copia\)$/);
  // Deleting asks for a second tap
  await page.click('#btnDel');
  await expect(page.locator('#btnDel')).toContainText('Toca otra vez');
  await page.click('#btnDel');
  expect(await offerNames(page)).toHaveLength(1);
});

test('compare, and go to an offer from there', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await page.click('#btnAdd');
  await page.locator('.tcard').nth(2).click();
  await fillOffer(page, { duration: '15', hours: '10', pay: '80' });
  await page.click('#btnGoRes');
  await page.click('.tabs [data-tab=compare]');
  const rows = page.locator('#cmpBlk .lr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.v')).toHaveText(/\/día$/); // per day by default
  await page.click("#cmpView label:has-text('total')");
  expect(await page.evaluate(() => app.state.cmpUnit)).toBe('total');
  await expect(rows.first().locator('.v')).not.toContainText('/día');
  await page.locator('#cmpBlk [data-action=view]').nth(1).click();
  await expect(page.locator('.tabs [aria-selected=true]')).toHaveAttribute('data-tab', 'offers');
});

test('head to head', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  await page.click('[data-action=startPair]');
  await page.locator('.lr').nth(0).click();
  await page.locator('.lr').nth(2).click();
  await expect(page.locator('#pairBlk')).toContainText('Cara a cara');
  for (const label of ['Ganas por día', 'Para el ganadero', 'Dinero que pone al mes'])
    await expect(page.locator('#pairBlk')).toContainText(label);
  // What the employer pays a month is the model's own figure; «Le cuestas» appears only with housing or food given
  const check = await page.evaluate(async () => {
    const { fE } = await import('./src/format.js');
    const ids = [...document.querySelectorAll('#pairBlk thead [data-id]')].map((b) => b.dataset.id);
    const results = ids.map((id) => app.calcOffer(app.state.offers.find((o) => o.id === id)));
    const cell = (label) =>
      [...document.querySelectorAll('#pairBlk tbody tr')]
        .find((tr) => tr.querySelector('th')?.textContent === label)
        ?.querySelector('td')
        .textContent.replace(/\s*✔\s*$/, '')
        .trim();
    const r = results[0];
    return {
      shown: cell('Dinero que pone al mes'),
      expected: fE((r.employer.cost - r.inKind.total) / (r.time.months || 1)),
      costRow: cell('Le cuestas al mes') !== undefined,
      inKind: results.some((x) => x.inKind.total > 0.5),
    };
  });
  expect(check.shown).toBe(check.expected);
  expect(check.costRow).toBe(check.inKind);
  await page.click('#pairBlk [data-action=closePair]');
  await expect(page.locator('#pairBlk')).toHaveCount(0);
});

test('Comparar can show the terms alone, without your travel and expenses', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  const rows = () => page.locator('#cmpBlk .lr .v').allTextContents();
  const full = await rows();
  await page.check('input[name=termsOnly]');
  await expect(page.locator('.terms-only .hint')).toContainText('IRPF');
  expect(await page.evaluate(() => app.state.termsOnly)).toBe(true);
  expect(await rows()).not.toEqual(full);
  await page.uncheck('input[name=termsOnly]');
  expect(await rows()).toEqual(full);
});

test('settings apply to every offer', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await page.click('[data-action=openSettingsPage]');
  await page.fill('#cfg_wear', '0.1');
  expect(await page.evaluate(() => app.state.config.wear)).toBe(0.1);
});

test('law figures are not settings: «Cómo se cuenta» has only the two choices', async ({ page }) => {
  await page.click('[data-action=openSettingsPage]');
  await expect(page.locator('#assumptions summary')).toHaveText('Cómo se cuenta');
  await expect(page.locator('#assumptions input[type=text]')).toHaveCount(0);
  await expect(page.locator('#assumptions input[type=radio]')).toHaveCount(4);
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

test('«Hecho» with data missing takes you to it', async ({ page }) => {
  await page.click(".tcard:has-text('Temporada')");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#editBtn');
  await expect(page.locator('#editWrap')).toHaveAttribute('open', '');
  await expect(page.locator('#goMsg')).toHaveText(/^Falta/);
  await expect(page.locator('.fld.missing').first()).toBeVisible();
  await expect(page.locator('.chip[aria-current=true]')).toHaveClass(/incomplete/);
});

test('copy the claim', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=offers]');
  await page.click('[data-action=copyClaim]');
  await expect(page.locator('#claimMsg')).not.toBeEmpty();
  const text = await page.evaluate(() => app.claimText(app.active(), app.calcOffer(app.active())));
  expect(text).toContain('SALARIO');
  expect(text).toContain('Comparador de jornales');
});

// With accounts the reminder gives way to the account button and its tooltip (account.spec.js)
test('without accounts, a backup, downloaded and loaded in another browser', async ({ openApp, browser }) => {
  const page = await openApp({ beforeLoad: withoutProject });
  await page.locator('.tcard').first().click();
  await fillOffer(page, { hours: '10', pay: '60' });
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
  await expect(other.locator('#backupResult')).toContainText('ya la tenías');
});

test('opening a card in «¿Es legal?» does not shrink its title while it animates', async ({ loaded: page }) => {
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
  await page.locator('.tcard').first().click();
  const box = page.locator('#f [name=offerOnly]');
  await page.fill('#start', '');
  await page.locator('#start').dispatchEvent('input');
  await expect(box).toBeVisible();
  await expect(box).toBeChecked();
  await expect(box).toBeDisabled();
  await expect(page.locator('#offerOnlyHint')).toContainText('pon cuándo empezó');
  await page.fill('#start', '2026-06-01');
  await page.locator('#start').dispatchEvent('input');
  await expect(box).toBeEnabled();
  await expect(box).not.toBeChecked();
  await expect(page.locator('#offerOnlyHint')).toBeEmpty();
  await box.check();
  expect(await page.evaluate(() => app.active().mine.offerOnly)).toBe(true);
});
