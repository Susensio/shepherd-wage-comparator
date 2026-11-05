// The Ofertas list: by date, latest first, grouped by year with that year's figures, «Por decidir» first (ADR-0030).

import { expect, loadOffers, sample, test } from './fixtures.js';

/** The sample offers and one without a start date. */
async function withUndecided(page) {
  const undecided = structuredClone(sample.offers[3]);
  undecided.id = 'undecided';
  undecided.mine.name = 'Sin fecha';
  undecided.terms.start = '';
  await loadOffers(page, { ...sample, offers: [...sample.offers, undecided] });
  await page.click('.tabs [data-tab=offers]');
}

test('cards are grouped by year under a header, latest year first, «Por decidir» before them', async ({
  loaded: page,
}) => {
  await withUndecided(page);
  const heads = await page.locator('#cards .year-head').allTextContents();
  expect(heads.map((h) => h.split(' · ')[0])).toEqual(['Por decidir', '2026', '2025']);
  expect(heads[0]).toBe('Por decidir');
  // Cards follow their header, and within a year the latest start comes first
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#cards > .year-head, #cards .ocard')].map((el) =>
      el.matches('.year-head')
        ? el.textContent.split(' · ')[0]
        : app.state.offers.find((o) => o.id === el.dataset.id).terms.start,
    ),
  );
  expect(order[0]).toBe('Por decidir');
  expect(order[1]).toBe('');
  const at2026 = order.indexOf('2026');
  const at2025 = order.indexOf('2025');
  const in2026 = order.slice(at2026 + 1, at2025);
  expect(in2026.length).toBeGreaterThan(3);
  expect(in2026).toEqual([...in2026].sort().reverse());
  expect(order.slice(at2025 + 1)).toEqual(['2025-11-01']);
});

test('a year header says how many were worked, what was received and the days contributed, as «Año a año» does', async ({
  loaded: page,
}) => {
  await withUndecided(page);
  const heads = await page.locator('#cards .year-head').allTextContents();
  const year = (y) => heads.find((h) => h.startsWith(`${y} ·`));
  expect(year(2026)).toMatch(/^2026 · \d+ trabajadas · [\d.]+ € cobrados · [\d.]+ días cotizados$/);
  expect(year(2025)).toMatch(/^2025 · 1 trabajada · [\d.]+ € cobrados · [\d.]+ días cotizados$/);
  // The same figures as the table over time in Comparar
  await page.click('.tabs [data-tab=compare]');
  const cell = (label, column) =>
    page
      .locator('#yearly tr', { has: page.locator('th', { hasText: label }) })
      .locator('td')
      .nth(column)
      .textContent();
  for (const [column, y] of [
    [0, 2026],
    [1, 2025],
  ]) {
    expect(year(y)).toContain(`${await cell('Cobrado', column)} cobrados`);
    expect(year(y)).toContain(`${await cell('Días cotizados', column)} días cotizados`);
  }
});

test('offers of solo oferta stay muted inside their year, and the hint explains the figures', async ({
  loaded: page,
}) => {
  await withUndecided(page);
  await expect(page.locator('#cards .ocard.offer-only')).toHaveCount(3); // two with solo oferta, one undated
  await expect(page.locator('#cards .ocard.offer-only').first()).toContainText('solo oferta');
  await expect(page.locator('#cards > .hint')).toContainText('Cada año cuenta sin las de solo oferta');
  await expect(page.locator('#btnAdd')).toBeVisible();
});

test('without undated offers there is no «Por decidir»', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=offers]');
  await expect(page.locator('#cards .year-head', { hasText: 'Por decidir' })).toHaveCount(0);
});

test('an offer starting after today is «Por decidir» too, and counts in no year', async ({ loaded: page }) => {
  const future = structuredClone(sample.offers[3]);
  future.id = 'future';
  future.mine.name = 'Futura';
  future.terms.start = '2099-05-01';
  await loadOffers(page, { ...sample, offers: [...sample.offers, future] });
  await page.click('.tabs [data-tab=offers]');
  const heads = await page.locator('#cards .year-head').allTextContents();
  expect(heads.map((h) => h.split(' · ')[0])).not.toContain('2099');
  expect(heads[0]).toBe('Por decidir');
  await expect(page.locator('#cards .ocard').first()).toContainText('Futura');
});
