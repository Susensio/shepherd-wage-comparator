// Comparar: ranked by what you earn plus the paro each offer generates; «Ordenar: Sin el paro» ranks by money alone.

import { expect, loadOffers, sample, test } from './fixtures.js';

/** Comparar open on the sample offers, per month. */
async function compareByMonth(page) {
  await loadOffers(page, sample);
  await page.click('.tabs [data-tab=compare]');
  await page.click("#cmpView label:has-text('mes')");
}

const ranked = (page) => page.locator('#cmpBlk .lr .nm b').allTextContents();

test('ranked by money plus paro: each row shows both, or «sin paro»', async ({ page }) => {
  await compareByMonth(page);
  expect(await ranked(page)).toEqual([
    'Puerto A',
    'Puerto A, otra cuenta',
    'Sin contrato G',
    'Campaña B',
    'Temporada F',
    'Sin contrato D',
    'Temporada E',
    'Invernada C',
  ]);
  const first = page.locator('#cmpBlk .lr').first();
  await expect(first.locator('.v')).toContainText(/2\.311\s€\/mes/);
  await expect(first.locator('.paro')).toHaveText(/^\+ 428\s€ de paro$/);
  await expect(first.locator('.paro')).toHaveClass(/ok/);
  const noContract = page.locator('#cmpBlk .lr', { hasText: 'Sin contrato G' });
  await expect(noContract.locator('.paro')).toHaveText('sin paro');
  await expect(noContract.locator('.paro')).toHaveClass(/bad/);
  await expect(page.locator('#cmpBlk')).toContainText(
    'Ordenadas por lo que se gana al mes y el paro que genera cada oferta.',
  );
});

test('«Ordenar: Sin el paro» ranks by money alone and hides the paro lines', async ({ page }) => {
  await compareByMonth(page);
  await expect(page.getByLabel('Con el paro')).toBeChecked();
  const money = page.getByLabel('Sin el paro');
  await expect(money).not.toBeChecked();
  await page.locator('#cmpBlk label', { has: money }).click();
  await expect(money).toBeChecked();
  expect(await ranked(page)).toEqual([
    'Sin contrato G',
    'Puerto A',
    'Campaña B',
    'Puerto A, otra cuenta',
    'Sin contrato D',
    'Temporada F',
    'Temporada E',
    'Invernada C',
  ]);
  await expect(page.locator('#cmpBlk .paro')).toHaveCount(0);
  await expect(page.locator('#cmpBlk')).toContainText('Ordenadas por lo que se gana al mes.');
  await expect(page.locator('#cmpBlk')).not.toContainText('el paro que genera');
  // A way of looking, not saved
  await page.reload();
  await page.waitForFunction(() => window.app);
  expect(await page.evaluate(() => app.state.moneyOnly)).toBe(false);
});

test('the unit changes what the ranking adds: per total, the longer offers lead', async ({ page }) => {
  await compareByMonth(page);
  await page.click("#cmpView label:has-text('total')");
  expect((await ranked(page)).slice(0, 3)).toEqual(['Puerto A', 'Puerto A, otra cuenta', 'Temporada F']);
});

test('head to head compares the paro in the unit Comparar is in', async ({ page }) => {
  await compareByMonth(page);
  await page.click('[data-action=startPair]');
  await page.locator('#cmpBlk .lr', { hasText: 'Puerto A, otra' }).click();
  await page.locator('#cmpBlk .lr', { hasText: 'Temporada F' }).click();
  const pair = page.locator('#pairBlk');
  await expect(pair.locator('tr', { hasText: 'Paro que genera al mes' })).toContainText(/428\s€/);
  await expect(pair.locator('tr', { hasText: 'Paro que genera al mes' })).toContainText(/405\s€/);
});
