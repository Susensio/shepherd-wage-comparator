// The ficha: the paro under the headline, what the negro costs, and «Condiciones» as one row at the end.

import { expect, leaveWelcome, loadOffers, sample, test } from './fixtures.js';

test.use({ today: '2025-01-01' });

const OFFER = { puertoA: 0, campanaB: 2, invernadaC: 3, sinContratoD: 4, temporadaF: 6 };

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

test('«Para negociar»: en negro as a lever with both sides, and what it means for the paro', async ({ page }) => {
  const cash = page.locator('#secEmployer .lever[data-lever=cash]');
  await expect(page.locator('#secNegro')).toHaveCount(0); // its own section is gone
  await loadOffers(page, sample, OFFER.temporadaF);
  await expect(cash).toHaveCount(0);

  await loadOffers(page, sample, OFFER.puertoA);
  await expect(cash.locator('.lever-t')).toHaveText('En negro');
  await expect(cash.locator('.save')).toContainText(/[\d.]+\s€/); // what the ganadero saves
  await expect(cash).toContainText('no cuenta para la jubilación ni la baja'); // the paro is already at its maximum

  await loadOffers(page, sample, OFFER.campanaB);
  await expect(cash).toContainText(/Paro unos 30\s€ menos/);

  await loadOffers(page, sample, OFFER.sinContratoD);
  await expect(cash.locator('.lever-t')).toHaveText('Sin contrato');
  await expect(cash).toContainText(/Paro unos 552\s€ menos/);
});

test('The copy icon of a lever copies the neutral text of a lever, impersonal', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loadOffers(page, sample, OFFER.puertoA);
  const lever = page.locator('#secEmployer .lever[data-lever=cash]');
  await lever.getByRole('button', { name: /Copiar texto para hablarlo/ }).click();
  await expect(lever.locator('.copy-msg')).toHaveText('Texto copiado.');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^Van .* en negro .*\. Pasarlos a nómina costaría unos .* de Seguridad Social/);
});

test('«Condiciones» is the first block, under the name, one row that opens the four and hides its own line', async ({
  page,
}) => {
  await loadOffers(page, sample, OFFER.puertoA);
  const conditions = page.locator('.conditions');
  expect(await page.evaluate(() => document.querySelector('#result')?.firstElementChild?.matches('.conditions'))).toBe(
    true,
  );
  await expect(conditions.locator('.cs')).toContainText('21 jun');
  await expect(page.locator('.crow').first()).toBeHidden();
  const title = conditions.locator('summary b');
  const closedTop = (await title.boundingBox())?.y;
  await conditions.locator('summary').click();
  await expect(page.locator('.crow')).toHaveCount(4);
  await expect(page.locator('.crow').first()).toBeVisible();
  await expect(conditions.locator('.cs')).toBeHidden(); // the rows repeat it
  expect((await title.boundingBox())?.y).toBe(closedTop); // anchored at the top: the title does not jump
  const summary = await conditions.locator('summary').boundingBox();
  const titleBox = await title.boundingBox();
  // …and no empty room where the line was: the open summary is the title and its padding
  expect((summary?.height ?? 0) - (titleBox?.height ?? 0)).toBeLessThanOrEqual(24);
  await page.locator('.crow[data-step=pay]').click();
  await expect(page.locator('#entry .step[data-step=pay]')).toBeVisible();
});

test('the ficha has no buttons at its foot: Duplicar, Borrar and the copies are in the menu', async ({
  loaded: page,
}) => {
  await expect(page.locator('#ficha .fichaend, #ficha [data-action=duplicate], #ficha .copies')).toHaveCount(0);
});

test.describe('the «⋯» menu on each card', () => {
  test.use({ today: null }); // the cards are listed by their real dates
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

  test('Duplicar saves once, and so does choosing a template', async ({ loaded: page }) => {
    await page.evaluate(() => app.closeEntry());
    await page.evaluate(async () => {
      const { onSave } = await import('./src/state.js');
      window.saves = 0;
      onSave(() => window.saves++);
    });
    const card = page.locator('#cards .ocwrap', { hasText: 'Temporada E' }).first();
    await card.getByRole('button', { name: 'Más acciones' }).click();
    await page.locator('#offerMenu [data-menu=duplicate]').click();
    expect(await page.evaluate(() => window.saves)).toBe(1);
    await page.evaluate(() => {
      window.saves = 0;
    });
    await page.locator('#btnAdd').click();
    await leaveWelcome(page);
    await page.locator('.tcard').first().click();
    expect(await page.evaluate(() => window.saves)).toBe(1);
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
    const open = async (name) => {
      const more = page
        .locator('#cards .ocwrap', { hasText: name })
        .first()
        .getByRole('button', { name: 'Más acciones' });
      // Scrolled into view first: a scroll after the menu opens would close it
      await more.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      await more.click();
    };
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
