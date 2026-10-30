// Other shepherds' shared offers in Comparar and their read-only view (ADR-0006), against the fake client.

import { installFake, withoutProject, withProject } from './fake-account.js';
import { expect, loadOffers, sample, test } from './fixtures.js';
import { ledgerProblems } from './ledger.js';

const ME = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
const MINE = '10000000-0000-0000-0000-000000000001';
const PROFILE = { user_id: ME, name: 'Ana Pastora', email: 'ana@example.com', phone: null, sharing: true };
const SHARER = { user_id: OTHER, name: 'Luis Rebaño', email: 'luis@example.com', phone: '611 222 333' };

const byName = (name) => sample.offers.find((o) => o.mine.name === name);
const sharedId = (n) => `20000000-0000-0000-0000-00000000000${n}`;

/** One own account offer (with expenses, so full and terms-only figures differ) and two shared by Luis. */
const tables = ({ sharing = true, others } = {}) => ({
  profiles: [
    { ...PROFILE, sharing },
    { ...SHARER, sharing: true },
  ],
  offers: [
    { id: MINE, user_id: ME, terms: byName('Campaña B').terms },
    ...(others ?? [
      { id: sharedId(1), user_id: OTHER, terms: byName('Puerto A').terms },
      { id: sharedId(2), user_id: OTHER, terms: byName('Invernada C').terms },
    ]),
  ],
  offer_mine: [{ offer_id: MINE, mine: { name: 'Mi oferta', expenses: 400 }, cmp: true }],
});

async function openCompare(openApp, options = {}) {
  const page = await openApp({ init: installFake, arg: { tables: tables(options) }, beforeLoad: withProject });
  await page.evaluate(() => app.showTab('compare'));
  return page;
}

const include = async (page) => {
  await page.getByLabel('Incluir ofertas de otros pastores').check();
  await expect(page.locator('.lr.other')).not.toHaveCount(0);
};

test('with no project configured nothing about other shepherds shows', async ({ openApp }) => {
  const page = await openApp({ beforeLoad: withoutProject });
  await loadOffers(page, sample);
  await page.evaluate(() => app.showTab('compare'));
  await expect(page.locator('input[name=includeOthers]')).toHaveCount(0);
});

test('hidden while sharing is off', async ({ openApp }) => {
  const page = await openCompare(openApp, { sharing: false });
  await expect(page.locator('#cmpBlk')).toBeVisible();
  await expect(page.locator('input[name=includeOthers]')).toHaveCount(0);
  expect(await page.evaluate(() => window.fake.sharedReads)).toBe(0);
});

test('their offers appear with the sharer, and terms-only is forced on', async ({ openApp }) => {
  const page = await openCompare(openApp);
  await expect(page.locator('.lr.other')).toHaveCount(0);
  await include(page);
  await expect(page.locator('.lr.other')).toHaveCount(2);
  await expect(page.locator('.lr.other').first()).toContainText('Luis Rebaño');
  await expect(page.locator('.lr.other').first()).toContainText('otro pastor');
  await expect(page.locator('input[name=termsOnly]')).toBeChecked();
  await expect(page.locator('input[name=termsOnly]')).toBeDisabled();
  await expect(page.locator('.terms-only').nth(1)).toContainText('se comparan solo las condiciones');
  await page.getByLabel('Incluir ofertas de otros pastores').uncheck();
  await expect(page.locator('.lr.other')).toHaveCount(0);
});

test('every row uses the terms-only figures', async ({ openApp }) => {
  const page = await openCompare(openApp);
  await include(page);
  const rows = await page.evaluate(async () => {
    const { calcTermsOnly } = await import('./src/model/calc.js');
    const { fUnit, UNITS } = await import('./src/units.js');
    const shown = (r) => `${fUnit(r.earnings.perHour, 'hour')}${UNITS.hour.suffix}`;
    const figureOf = (name) =>
      [...document.querySelectorAll('#cmpBlk .lr')].find((row) => row.querySelector('b').textContent.includes(name));
    const mine = app.state.offers[0];
    const full = app.calcOffer(mine);
    const termsOnly = calcTermsOnly(mine, { cfg: app.state.config });
    return {
      mine: figureOf('Mi oferta').querySelector('.v').textContent.trim(),
      expectedMine: shown(termsOnly).trim(),
      fullMine: shown(full).trim(),
      others: [...document.querySelectorAll('#cmpBlk .lr.other')].map((row) =>
        row.querySelector('.v').textContent.trim(),
      ),
      expectedOthers: app.state.others.items.map(({ o }) => shown(calcTermsOnly(o, { cfg: app.state.config })).trim()),
    };
  });
  expect(rows.mine).toBe(rows.expectedMine);
  expect(rows.mine).not.toBe(rows.fullMine);
  expect([...rows.others].sort()).toEqual([...rows.expectedOthers].sort());
});

test('a line says when nobody else has shared', async ({ openApp }) => {
  const page = await openCompare(openApp, { others: [] });
  await page.getByLabel('Incluir ofertas de otros pastores').check();
  await expect(page.locator('.others-ctl')).toContainText('Todavía no hay ofertas compartidas por otros pastores.');
  await expect(page.locator('.lr.other')).toHaveCount(0);
});

test('refetched on entering Comparar and on demand, not on repaints', async ({ openApp }) => {
  const page = await openCompare(openApp);
  const reads = () => page.evaluate(() => window.fake.sharedReads);
  expect(await reads()).toBe(0);
  await include(page);
  expect(await reads()).toBe(1);
  await page.getByText('mes', { exact: true }).click();
  expect(await reads()).toBe(1);
  await page.evaluate(() => app.showTab('offers'));
  await page.evaluate(() => app.showTab('compare'));
  await expect.poll(reads).toBe(2);
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect.poll(reads).toBe(3);
});

test('a failed fetch shows a line and can be retried', async ({ openApp }) => {
  const page = await openCompare(openApp);
  await page.evaluate(() => {
    const original = window.fake.data.offers;
    window.fake.data.offers = new Proxy(original, {
      get: (t, k) =>
        k === 'filter' && window.fake.failing
          ? () => {
              throw new Error('network');
            }
          : t[k],
    });
    window.fake.failing = true;
  });
  const logged = [];
  page.on('console', (m) => m.type() === 'error' && logged.push(m.text()));
  await page.getByLabel('Incluir ofertas de otros pastores').check();
  await expect(page.locator('.others-ctl')).toContainText('No se pudieron cargar las ofertas de otros pastores.');
  await page.evaluate(() => {
    window.fake.failing = false;
  });
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('.lr.other')).toHaveCount(2);
});

test('offers of another schema load without crashing', async ({ openApp }) => {
  const odd = [
    { id: sharedId(1), user_id: OTHER, terms: { ...byName('Puerto A').terms, someFutureField: { a: 1 } } },
    { id: sharedId(2), user_id: OTHER, terms: { contract: 'temporary' } }, // older: most fields missing
    { id: sharedId(3), user_id: OTHER, terms: null },
  ];
  const page = await openCompare(openApp, { others: odd });
  await include(page);
  await expect(page.locator('.lr.other')).toHaveCount(1);
});

test.describe('the read-only view', () => {
  test('conditions, figures and contact links, with nothing to edit', async ({ openApp }) => {
    const page = await openCompare(openApp);
    await include(page);
    await page.locator(`.lr.other[data-id="${sharedId(1)}"]`).click();
    const view = page.locator('#sharedBlk');
    await expect(view).toBeVisible();
    await expect(page.locator('#cmpMain')).toBeHidden();
    await expect(view).toContainText('Oferta de Luis Rebaño');
    await expect(view.getByRole('link', { name: 'luis@example.com' })).toHaveAttribute(
      'href',
      'mailto:luis@example.com',
    );
    await expect(view.getByRole('link', { name: '611 222 333' })).toHaveAttribute('href', 'tel:611222333');
    await expect(view.locator('.editinfo')).toContainText('Tiempo');
    await expect(view.locator('#sharedResult .big').first()).toBeVisible();
    await expect(view.locator('input, textarea, select')).toHaveCount(0);
    for (const action of ['edit', 'complete', 'copyCard', 'copyClaim', 'done', 'payslipMonth'])
      await expect(view.locator(`[data-action="${action}"]`)).toHaveCount(0);
    await expect(view).not.toContainText('Para negociar');
    await view.getByRole('button', { name: '← Volver a Comparar' }).click();
    await expect(page.locator('#cmpMain')).toBeVisible();
    await expect(view).toBeHidden();
  });

  test('without contact data it says so', async ({ openApp }) => {
    const page = await openCompare(openApp);
    await page.evaluate(() => {
      const row = window.fake.data.profiles.find((p) => p.user_id === '00000000-0000-0000-0000-00000000000b');
      Object.assign(row, { email: null, phone: null });
    });
    await include(page);
    await page.locator('.lr.other').first().click();
    await expect(page.locator('#sharedBlk')).toContainText('No ha dejado datos de contacto.');
  });

  test('others offers are never saved in the browser', async ({ openApp }) => {
    const page = await openCompare(openApp);
    await include(page);
    await page.locator('.lr.other').first().click();
    await page.getByRole('button', { name: '← Volver a Comparar' }).click();
    const saved = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    for (const secret of [sharedId(1), sharedId(2), SHARER.email, SHARER.phone, 'Luis Rebaño'])
      expect(saved).not.toContain(secret);
    expect(await page.evaluate(() => app.state.offers.map((o) => o.id))).toEqual([MINE]);
  });

  test('signing out forgets them', async ({ openApp }) => {
    const page = await openCompare(openApp);
    await include(page);
    await page.evaluate(() => app.showTab('settings'));
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.evaluate(() => app.showTab('compare'));
    await expect(page.locator('input[name=includeOthers]')).toHaveCount(0);
    expect(await page.evaluate(() => app.state.others.items.length)).toBe(0);
  });
});

// The ledgers of the read-only view add up for every sample offer, shared as it is
for (const offer of sample.offers) {
  test(`${offer.mine.name} shared adds up in the read-only view`, async ({ openApp }) => {
    const others = [{ id: sharedId(1), user_id: OTHER, terms: offer.terms }];
    const own = { id: MINE, user_id: ME, terms: byName('Campaña B').terms };
    const page = await openApp({
      init: installFake,
      arg: { tables: { ...tables({ others }), offers: [own, ...others] } },
      beforeLoad: withProject,
    });
    await page.evaluate(() => app.showTab('compare'));
    await page.getByLabel('Incluir ofertas de otros pastores').check();
    await expect(page.locator('#cmpBlk')).not.toContainText('Cargando');
    const row = page.locator('.lr.other');
    test.skip((await row.count()) === 0, 'offer with missing data');
    await row.click();
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('#sharedBlk details')) d.open = true;
    });
    expect(await page.evaluate(ledgerProblems, '#sharedBlk')).toEqual([]);
  });
}
