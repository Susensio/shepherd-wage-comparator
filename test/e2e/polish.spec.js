// «Para negociar» by strata, the chevron of «Condiciones», the hover of the offer cards and the folds of «¿Es legal?».

import { expect, loadOffers, sample, test } from './fixtures.js';

// Before every job: all the sample offers are only offers, with their full analysis
test.use({ today: '2025-01-01' });

const SIN_CONTRATO_D = 4;

test('«Para negociar»: the figure of what cash saves is the largest, then extra days and the minimum, overtime the smallest', async ({
  page,
}) => {
  await loadOffers(page, sample, 1);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('#secEmployer .lever')].map((lever) => ({
      id: lever.dataset.lever,
      stratum: Number(lever.dataset.stratum),
      size: Number.parseFloat(getComputedStyle(lever.querySelector('.save b')).fontSize),
    })),
  );
  expect(sizes.length).toBeGreaterThanOrEqual(2);
  const stratumSize = (n) => sizes.find((x) => x.stratum === n)?.size;
  const present = [1, 2, 3].filter((n) => stratumSize(n));
  expect(present.length).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < present.length - 1; i++)
    expect(stratumSize(present[i]), `stratum ${present[i]} above ${present[i + 1]}`).toBeGreaterThan(
      stratumSize(present[i + 1]),
    );
  // The order of the rows is kept: cash first, overtime last
  const order = sizes.map((x) => x.id);
  if (order.includes('cash')) expect(order[0]).toBe('cash');
  if (order.includes('overtime')) expect(order.at(-1)).toBe('overtime');
  const cash = sizes.find((x) => x.id === 'cash');
  if (cash) expect(cash.size).toBeGreaterThanOrEqual(30);
});

test('the arrow of «Condiciones» sits at the card’s edge and is centred on its row, like the other folds’', async ({
  loaded: page,
}) => {
  const style = await page.evaluate(() => {
    const arrow = (selector) => {
      const summary = document.querySelector(selector);
      const s = getComputedStyle(summary, '::after');
      const c = getComputedStyle(summary);
      return { marginRight: s.marginRight, alignSelf: s.alignSelf, paddingRight: c.paddingRight };
    };
    return { conditions: arrow('details.conditions > summary'), fold: arrow('details.plg > summary') };
  });
  expect(style.conditions.marginRight).toBe(style.fold.marginRight);
  expect(style.conditions.paddingRight).toBe(style.fold.paddingRight);
  expect(style.conditions.alignSelf).toBe('center');
});

test.describe('the offer cards', () => {
  const edge = (page, selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((card) => {
        const s = getComputedStyle(card);
        return { left: s.borderLeftColor, top: s.borderTopColor, leftStyle: s.borderLeftStyle, shadow: s.boxShadow };
      });

  test('hover and focus restyle the whole border, the dashed edge of a card not worked included', async ({
    loaded: page,
  }) => {
    await page.evaluate(() => app.showTab('offers'));
    const card = page.locator('#cards .ocard.offer-only').first();
    await expect(card).toBeVisible();
    const before = await edge(page, '#cards .ocard.offer-only');
    expect(before.leftStyle).toBe('dashed');
    expect(before.left).toBe(before.top); // one colour for the whole border
    await card.hover();
    const hovered = await edge(page, '#cards .ocard.offer-only');
    expect(hovered.leftStyle).toBe('dashed'); // it keeps its dash
    expect(hovered.left).toBe(hovered.top);
    expect(hovered.left).not.toBe(before.left);
    expect(hovered.shadow).not.toBe('none');
    // A card that is worked changes the same way
    await page.mouse.move(0, 0);
    const worked = page.locator('#cards .ocard:not(.offer-only)').first();
    const plain = await edge(page, '#cards .ocard:not(.offer-only)');
    await worked.hover();
    const plainHovered = await edge(page, '#cards .ocard:not(.offer-only)');
    expect(plainHovered.left).toBe(hovered.left);
    expect(plainHovered.left).not.toBe(plain.left);
  });

  test('keyboard focus does the same', async ({ loaded: page }) => {
    await page.evaluate(() => app.showTab('offers'));
    const card = page.locator('#cards .ocard.offer-only').first();
    const before = await edge(page, '#cards .ocard.offer-only');
    await card.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const focused = await edge(page, '#cards .ocard.offer-only');
    expect(focused.left).not.toBe(before.left);
    expect(focused.left).toBe(focused.top);
  });

  test.describe('wide screen', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('the card shown beside the ficha takes the same emphasis, dashed edge included', async ({ loaded: page }) => {
      const shown = page.locator('#cards .ocard[aria-current=true]');
      await expect(shown).toHaveCount(1);
      const style = await shown.evaluate((card) => {
        const s = getComputedStyle(card);
        return { left: s.borderLeftColor, top: s.borderTopColor, shadow: s.boxShadow };
      });
      expect(style.left).toBe(style.top);
      expect(style.shadow).not.toBe('none');
    });
  });
});

test('«¿Es legal?» without a contract: the figure and the stamp in the summary, the reasons in a closed fold; every big card opens the same way', async ({
  page,
}) => {
  await loadOffers(page, sample, SIN_CONTRATO_D);
  const owed = page.locator('#secLegal details.owed[data-fold=owed]');
  await expect(owed).toHaveCount(1);
  await expect(owed).not.toHaveAttribute('open', '');
  await expect(owed.locator(':scope > summary')).toContainText('De paro que no se genera');
  await expect(owed.locator(':scope > summary')).toContainText('Ilegal');
  await expect(owed.locator('.reasons')).toBeHidden();
  await owed.locator(':scope > summary').click();
  await expect(owed.locator('.reasons li').first()).toBeVisible();
  await expect(owed).toContainText('Para que sea legal');
  // The open state survives a repaint
  await page.evaluate(() => app.select(app.active().id));
  await expect(page.locator('#secLegal details.owed[data-fold=owed]')).toHaveAttribute('open', '');
  // Every card of the section is a fold
  await loadOffers(page, sample, 1);
  const cards = await page.evaluate(() => [...document.querySelectorAll('#secLegal .owed')].map((el) => el.tagName));
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.every((tag) => tag === 'DETAILS')).toBe(true);
});
