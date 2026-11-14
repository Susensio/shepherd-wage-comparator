// The legal figures the page shows come from src/law.js. The data itself is checked in test/unit/law.test.js.

import { expect, loadOffers, openCondition, sample, test } from './fixtures.js';

test('the Leyes page is filled in', async ({ page }) => {
  const empty = await page.evaluate(() =>
    [...document.querySelectorAll('[data-law]')].filter((e) => !e.textContent.trim()).map((e) => e.dataset.law),
  );
  expect(empty).toEqual([]);
  const unlinked = await page.evaluate(
    () => [...document.querySelectorAll('a[data-source]')].filter((a) => !a.href.startsWith('https://')).length,
  );
  expect(unlinked).toBe(0);
  await page.evaluate(() => {
    app.openLawsPage();
  });
  const year = await page.evaluate(async () => Object.keys((await import('./src/law.js')).MIN_WAGE).at(-1));
  await expect(page.locator('[data-panel=laws]')).toContainText(`en ${year},`);
});

test("the overnight bonus is the Huesca agreement's alone: cited there, not counted elsewhere, plain text without a link", async ({
  page,
}) => {
  // Puerto A (no province): a night stay, no agreement known
  await loadOffers(page, sample, 0);
  const legal = page.locator('#secLegal');
  await expect(legal).toContainText(
    'Sin provincia, no se conoce ningún convenio que dé un plus de pernocta: no se cuenta',
  );
  await expect(legal).not.toContainText('Convenio colectivo del campo');
  await expect(legal).not.toContainText('con el plus de pernocta');
  // Puerto A, otra cuenta (Huesca): the agreement, with no link to follow yet
  await loadOffers(page, sample, 1);
  await page.evaluate(() => {
    Object.assign(app.active().terms, { payAmount: 1100, cashAmount: 0 }); // salary reached, bonus short: the right is listed
    app.select(app.active().id);
  });
  await expect(legal).toContainText('Plus de pernocta');
  await expect(
    legal.locator('.lawlink', { hasText: 'Convenio colectivo del campo de la provincia de Huesca 2022–2025' }),
  ).toHaveCount(1);
  await expect(legal.locator('a.lawlink', { hasText: 'Convenio colectivo' })).toHaveCount(0);
  // The hint under the question, by province
  await openCondition(page, 'day');
  await expect(page.locator('#overnightHint')).toContainText(
    'sube el mínimo un 25\u00a0% (Convenio colectivo del campo de la provincia de Huesca 2022–2025)',
  );
  await page.evaluate(() => {
    app.active().terms.province = 'Z';
    app.select(app.active().id);
  });
  await expect(page.locator('#overnightHint')).toContainText(
    'Ningún convenio conocido para esta provincia da un plus de pernocta: no se cuenta',
  );
  // The Leyes page names the agreement without a link
  await page.evaluate(() => app.openLawsPage());
  const laws = page.locator('[data-panel=laws]');
  await expect(laws).toContainText('Convenio colectivo del campo de la provincia de Huesca 2022–2025');
  await expect(laws.locator('a', { hasText: 'Huesca' })).toHaveCount(0);
});
