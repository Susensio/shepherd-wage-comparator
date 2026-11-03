// The ficha: the paro under the headline, what the negro costs, and «Condiciones» as one row at the end.

import { expect, loadOffers, sample, test } from './fixtures.js';

const OFFER = { puertoA: 0, campanaB: 2, sinContratoD: 4, temporadaF: 6 };

test('under the headline: the paro the offer generates, or why it generates none', async ({ page }) => {
  await loadOffers(page, sample, OFFER.puertoA);
  await expect(page.locator('#result .tag .paro')).toHaveText(
    /^Y genera 37 días de paro: unos 1\.427\s€, que se cobran más adelante\.$/,
  );
  await loadOffers(page, sample, OFFER.sinContratoD);
  await expect(page.locator('#result .tag .paro')).toHaveText('Sin contrato no genera paro.');
});

test('the headline and the Desglose leave the paro out', async ({ page }) => {
  await loadOffers(page, sample, OFFER.puertoA);
  await expect(page.locator('#result .tag .big')).toHaveText(/^2\.311\s€$/);
  await page.locator('details[data-fold=breakdown2] > summary').click();
  await expect(page.locator('details[data-fold=breakdown2]')).not.toContainText('Paro');
});

test('«Lo que te cuesta el negro»: only with money en negro or no contract, and what each says about the paro', async ({
  page,
}) => {
  const negro = page.locator('#secNegro');
  await loadOffers(page, sample, OFFER.temporadaF);
  await expect(negro).toHaveCount(0);

  await loadOffers(page, sample, OFFER.puertoA);
  await expect(negro).toContainText('no cotizan');
  await expect(negro).toContainText('Al paro no le resta: con lo que va en nómina ya llega al máximo.');

  await loadOffers(page, sample, OFFER.campanaB);
  await expect(negro).toContainText(/unos 30\s€ más de paro/);

  await loadOffers(page, sample, OFFER.sinContratoD);
  await expect(negro).toContainText('Sin contrato nada cotiza');
  await expect(negro).toContainText(/Con contrato se generarían 14 días de paro: unos 552\s€/);
});

test('«Condiciones» is the last block, one row that opens the seven', async ({ page }) => {
  await loadOffers(page, sample, OFFER.puertoA);
  const conditions = page.locator('.conditions');
  expect(await page.evaluate(() => document.querySelector('#result')?.lastElementChild?.matches('.conditions'))).toBe(
    true,
  );
  await expect(conditions.locator('.cs')).toContainText('21 jun');
  await expect(page.locator('.crow').first()).toBeHidden();
  await conditions.locator('summary').click();
  await expect(page.locator('.crow')).toHaveCount(7);
  await expect(page.locator('.crow').first()).toBeVisible();
  await page.locator('.crow[data-step=pay]').click();
  await expect(page.locator('#entry .step[data-step=pay]')).toBeVisible();
});

test('the ficha has no buttons at its foot: Duplicar, Borrar and the copies are in the menu', async ({
  loaded: page,
}) => {
  await expect(page.locator('#ficha .fichaend, #ficha [data-action=duplicate], #ficha .copies')).toHaveCount(0);
});
