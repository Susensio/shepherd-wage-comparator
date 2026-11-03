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

test('«Dinero en negro»: only with money en negro or no contract, and what each says about the paro', async ({
  page,
}) => {
  const negro = page.locator('#secNegro');
  await loadOffers(page, sample, OFFER.temporadaF);
  await expect(negro).toHaveCount(0);

  await loadOffers(page, sample, OFFER.puertoA);
  await expect(negro.locator('h3')).toHaveText('Dinero en negro');
  await expect(negro).toContainText(/van en negro: no cuentan para tu jubilación ni para una baja/);
  await expect(negro).toContainText('Al paro no le afecta: lo que va en nómina ya da el máximo.');

  await loadOffers(page, sample, OFFER.campanaB);
  await expect(negro).toContainText(/En nómina, generarían unos 30\s€ más de paro/);

  await loadOffers(page, sample, OFFER.sinContratoD);
  await expect(negro).toContainText(
    'Sin contrato, nada de lo que cobras cuenta para la jubilación, una baja o el paro.',
  );
  await expect(negro).toContainText(/Con contrato, este trabajo generaría 14 días de paro: unos 552\s€/);
});

test('«Condiciones» is the first block, under the name, one row that opens the seven', async ({ page }) => {
  await loadOffers(page, sample, OFFER.puertoA);
  const conditions = page.locator('.conditions');
  expect(await page.evaluate(() => document.querySelector('#result')?.firstElementChild?.matches('.conditions'))).toBe(
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

test.describe('the «⋯» menu on each card', () => {
  const names = (page) => page.evaluate(() => app.state.offers.map((o) => o.mine.name));

  test('a button of at least 44 px opens the menu of that offer; the rest of the card opens the ficha', async ({
    loaded: page,
  }) => {
    await page.evaluate(() => app.closeEntry());
    const cards = page.locator('#cards .ocwrap');
    await expect(cards).toHaveCount(sample.offers.length);
    const button = cards.nth(2).getByRole('button', { name: 'Más acciones' });
    await expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const size = await button.boundingBox();
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#offerMenu')).toBeVisible();
    await expect(page.locator('#ficha')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#offerMenu')).toBeHidden();
    await expect(button).toBeFocused();

    await cards.nth(2).locator('.ocard').click();
    await expect(page.locator('#ficha')).toBeVisible();
  });

  test('Duplicar and Borrar act on the card they were opened from, not on the open offer', async ({ loaded: page }) => {
    await page.evaluate(() => app.closeEntry());
    const before = await names(page);
    const card = page.locator('#cards .ocwrap', { hasText: 'Temporada E' }).first();
    await card.getByRole('button', { name: 'Más acciones' }).click();
    await page.locator('#offerMenu [data-menu=duplicate]').click();
    expect(await names(page)).toEqual(expect.arrayContaining([...before, 'Temporada E (copia)']));

    await card.getByRole('button', { name: 'Más acciones' }).click();
    await page.locator('#offerMenu [data-menu=delete]').click();
    await expect(page.locator('#offerMenu [data-menu=delete]')).toHaveText('¿Seguro?');
    await page.locator('#offerMenu [data-menu=delete]').click();
    const after = await names(page);
    expect(after).not.toContain('Temporada E');
    expect(after).toContain('Temporada E (copia)');
    expect(after).toHaveLength(before.length);
  });

  test('copies are only offered for an offer that is complete', async ({ page }) => {
    await loadOffers(page, sample, OFFER.temporadaF);
    await page.evaluate(() => {
      app.state.offers[6].terms.hoursPerDay = '';
      app.closeEntry();
    });
    const menu = page.locator('#offerMenu');
    const open = (name) =>
      page.locator('#cards .ocwrap', { hasText: name }).first().getByRole('button', { name: 'Más acciones' }).click();
    await open('Temporada F');
    await expect(menu.locator('[data-menu=duplicate]')).toBeVisible();
    await expect(menu.locator('[data-menu=copyCard]')).toBeHidden();
    await expect(menu.locator('[data-menu=copyClaim]')).toBeHidden();
    await page.keyboard.press('Escape');
    await open('Temporada E');
    await expect(menu.locator('[data-menu=copyCard]')).toBeVisible();
    await expect(menu.locator('[data-menu=copyClaim]')).toBeVisible();
  });

  test.describe('wide screen', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('a right click on a card opens the same menu', async ({ loaded: page }) => {
      const card = page.locator('#cards .ocard').nth(3);
      await card.click({ button: 'right' });
      await expect(page.locator('#offerMenu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#offerMenu')).toBeHidden();
      await expect(card).toBeFocused();
    });
  });
});
