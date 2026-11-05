// The bottom tab bar on phones, and the tabs in the app bar with the list beside the ficha on wide screens (ADR-0021).

import { expect, openCondition, openStep, test } from './fixtures.js';

const box = async (locator) => (await locator.boundingBox()) ?? expect.fail('not on screen');

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  // With scripts off nothing moves them: the HTML itself has them in the phone place, so they do not jump on load
  test.describe('without scripts', () => {
    test('the tabs are outside the app bar, a direct child of the body, from the first paint', async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
        viewport: { width: 375, height: 700 },
      });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.locator('.appbar .tabs')).toHaveCount(0);
      await expect(page.locator('body > .tabs')).toHaveCount(1);
      const bar = await box(page.locator('body > .tabs'));
      expect(bar.y + bar.height).toBeCloseTo(700, 0);
      await context.close();
    });
  });

  test('the tabs are a bar at the bottom, with an icon each and the current one marked', async ({ loaded: page }) => {
    const bar = await box(page.locator('.tabs'));
    expect(bar.y + bar.height).toBeCloseTo(700, 0);
    expect(bar.width).toBeCloseTo(375, 0);
    for (const tab of ['offers', 'compare']) {
      const button = page.locator(`.tabs [data-tab=${tab}]`);
      await expect(button.locator('svg[aria-hidden=true]')).toBeVisible();
      expect((await box(button)).height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('.tabs [data-tab=offers]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('.tabs [data-tab=compare]').click();
    await expect(page.locator('.tabs [data-tab=compare]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.tabs [data-tab=offers]')).toHaveAttribute('aria-selected', 'false');
  });

  test('the bar stays at the bottom while the page scrolls, and nothing ends hidden behind it', async ({
    loaded: page,
  }) => {
    await page.locator('.tabs [data-tab=compare]').click();
    await page.evaluate(() => document.querySelector('#scroller').scrollTo(0, 1e6));
    const bar = await box(page.locator('.tabs'));
    expect(bar.y + bar.height).toBeCloseTo(700, 0);
    const last = await page.evaluate(() => {
      const panel = document.querySelector('.panel[data-panel=compare]');
      return panel.getBoundingClientRect().bottom;
    });
    expect(last).toBeLessThanOrEqual(bar.y);
  });

  // Chrome's overscroll stretch moves the scroller and what is inside it: the bar must be outside
  test('the content scrolls in its own element, with the bar outside it and the window still', async ({
    loaded: page,
  }) => {
    await page.locator('.tabs [data-tab=compare]').click();
    expect(await page.evaluate(() => document.querySelector('#scroller').scrollTop)).toBe(0);
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => document.querySelector('#scroller').scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => !!document.querySelector('#scroller .tabs'))).toBe(false);
    const bar = await box(page.locator('.tabs'));
    expect(bar.y + bar.height).toBeCloseTo(700, 0);
  });

  test('the entry hides the bar', async ({ loaded: page }) => {
    await expect(page.locator('.tabs')).toBeVisible();
    await openStep(page, 'pay');
    await expect(page.locator('.tabs')).toBeHidden();
    await page.locator('#entryClose').click();
    await expect(page.locator('.tabs')).toBeVisible();
  });

  test('the list is the Ofertas tab; a card opens the ficha, with a history entry', async ({ loaded: page }) => {
    await page.locator('.tabs [data-tab=compare]').click();
    await page.locator('.tabs [data-tab=offers]').click();
    await expect(page.locator('#offersList')).toBeVisible();
    await expect(page.locator('#ficha')).toBeHidden();
    await page.evaluate(() => history.replaceState(null, ''));
    await page.locator('.ocard').first().click();
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('#offersList')).toBeHidden();
    expect(await page.evaluate(() => history.state)).toEqual({ ficha: true });
  });

  test('Leyes is a page opened from the app bar, with «Volver» and Back returning to the tab and the ficha', async ({
    loaded: page,
  }) => {
    await expect(page.locator('.tabs [role=tab]')).toHaveCount(2);
    await expect(page.locator('.tabs [data-tab=laws]')).toHaveCount(0);
    await page.locator('.tabs [data-tab=compare]').click();
    const button = page.locator('.appbar').getByRole('button', { name: 'Leyes', exact: true });
    await expect(button).toHaveAttribute('title', 'Leyes');
    expect((await box(button)).x).toBeLessThan(
      (await box(page.getByRole('button', { name: 'Ajustes', exact: true }))).x,
    );
    await button.click();
    await expect(page.locator('[data-panel=laws] h2')).toHaveText('Leyes y fuentes');
    await expect(page.locator('[data-panel=laws]')).toBeVisible();
    await expect(page.locator('[data-panel=compare]')).toBeHidden();
    await expect(page.locator('.tabs')).toBeHidden();
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.locator('[data-panel=compare]')).toBeVisible();
    await expect(page.locator('[data-panel=laws]')).toBeHidden();
    // From a ficha (the «Dónde reclamar» link), the phone's Back returns to the ficha
    await page.locator('.tabs [data-tab=offers]').click();
    await page.locator('.ocard').first().click();
    await page.getByRole('button', { name: 'en «Leyes»' }).first().click();
    await expect(page.locator('[data-panel=laws]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('[data-panel=laws]')).toBeHidden();
    await expect(page.locator('#ficha')).toBeVisible();
  });

  test('a stored «laws» tab from before opens Ofertas', async ({ loaded: page }) => {
    await page.evaluate(() => localStorage.setItem('cj.tab', 'laws'));
    await page.reload();
    await page.waitForFunction(() => window.app);
    await expect(page.locator('.tabs [data-tab=offers]')).toHaveAttribute('aria-selected', 'true');
  });

  test('the app bar keeps its subtitle', async ({ loaded: page }) => {
    await expect(page.locator('.appbar h1')).toHaveText('Zurrón sindical');
    await expect(page.locator('.appbar .kicker')).toHaveText('Por un pastoreo digno');
    await expect(page.locator('.appbar .kicker')).toBeVisible();
  });
});

test.describe('wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the tabs are in the app bar, beside the name, with an underline on the current one', async ({
    loaded: page,
  }) => {
    const [bar, tabs, brand] = await Promise.all([
      box(page.locator('.appbar')),
      box(page.locator('.tabs')),
      box(page.locator('.brand')),
    ]);
    expect(tabs.y).toBeGreaterThanOrEqual(bar.y);
    expect(tabs.y + tabs.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
    expect(tabs.x).toBeGreaterThan(brand.x + brand.width - 1);
    await expect(page.locator('.tabs svg').first()).toBeHidden();
    const underlined = (tab) =>
      page.locator(`.tabs [data-tab=${tab}]`).evaluate((b) => getComputedStyle(b).borderBottomColor);
    expect(await underlined('offers')).not.toBe(await underlined('compare'));
    await page.locator('.tabs [data-tab=compare]').click();
    expect(await underlined('compare')).not.toBe(await underlined('offers'));
  });

  test('the app bar keeps its subtitle', async ({ loaded: page }) => {
    await expect(page.locator('.appbar .kicker')).toBeVisible();
    await expect(page.locator('.appbar .kicker')).toHaveText('Por un pastoreo digno');
  });

  test('Ofertas: list and ficha side by side; a card switches the ficha without a history entry', async ({
    loaded: page,
  }) => {
    await expect(page.locator('#offersList')).toBeVisible();
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('#ficha .back')).toBeHidden();
    const [list, ficha] = await Promise.all([box(page.locator('#offersList')), box(page.locator('#ficha'))]);
    expect(list.x + list.width).toBeLessThanOrEqual(ficha.x);
    expect(list.width).toBeGreaterThanOrEqual(320);
    expect(list.width).toBeLessThanOrEqual(360);
    await expect(page.locator('.ocard[aria-current=true]')).toHaveCount(1);

    await page.evaluate(() => history.replaceState(null, ''));
    const before = await page.evaluate(() => history.length);
    const other = page.locator('.ocard:not([aria-current=true])').first();
    const name = await other.locator('.oc-name').textContent();
    await other.click();
    await expect(page.locator('#fichaName')).toHaveText(name);
    await expect(page.locator('.ocard[aria-current=true] .oc-name')).toHaveText(name);
    await expect(page.locator('#offersList')).toBeVisible();
    expect(await page.evaluate(() => [history.length, history.state])).toEqual([before, null]);
  });

  test('«+ Nueva oferta» tops the list', async ({ loaded: page }) => {
    const [add, card] = await Promise.all([box(page.locator('#btnAdd')), box(page.locator('.ocard').first())]);
    expect(add.y).toBeLessThan(card.y);
  });

  test('opening Ofertas again shows a ficha; a step opens centred and Back returns to list and ficha', async ({
    loaded: page,
  }) => {
    await page.locator('.tabs [data-tab=compare]').click();
    await page.locator('.tabs [data-tab=offers]').click();
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('#offersList')).toBeVisible();

    await page.evaluate(() => history.replaceState(null, '')); // the first visit's entry
    await openCondition(page, 'pay');
    await expect(page.locator('#entry .step[data-step=pay]')).toBeVisible();
    await expect(page.locator('.tabs')).toBeHidden();
    const entry = await box(page.locator('.entry'));
    expect(entry.width).toBeLessThanOrEqual(640);
    expect(entry.x + entry.width / 2).toBeCloseTo(640, 0);

    await page.goBack();
    await expect(page.locator('#entry')).toBeHidden();
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('#offersList')).toBeVisible();
  });

  test('Comparar keeps its column', async ({ loaded: page }) => {
    await page.locator('.tabs [data-tab=compare]').click();
    expect((await box(page.locator('.panel[data-panel=compare]'))).width).toBeLessThanOrEqual(800);
  });

  test('narrowing to a phone shows the list alone again', async ({ loaded: page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator('#offersList')).toBeVisible();
    await expect(page.locator('#ficha')).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#ficha')).toBeVisible();
    await expect(page.locator('#offersList')).toBeVisible();
  });
});
