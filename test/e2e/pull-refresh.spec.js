// Pull down to reload on phones, where the content scrolls in #scroller and Chrome's own pull to refresh is off.

import { expect, test } from './fixtures.js';

/** Drags a finger down on #scroller from y = 150 by `distance` px, then lifts it. */
async function pull(page, distance) {
  await page.evaluate((distance) => {
    const pane = document.querySelector('#scroller');
    const at = (y) => new Touch({ identifier: 1, target: pane, clientX: 180, clientY: y });
    const fire = (type, y) =>
      pane.dispatchEvent(
        new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [at(y)],
          changedTouches: [at(y)],
          bubbles: true,
        }),
      );
    fire('touchstart', 150);
    for (let y = 150; y <= 150 + distance; y += 20) fire('touchmove', y);
    fire('touchend', 150 + distance);
  }, distance);
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 700 }, hasTouch: true });

  test('a long pull from the top reloads the page', async ({ loaded: page }) => {
    await page.evaluate(() => {
      window.notReloaded = true;
    });
    await pull(page, 200).catch(() => {}); // the reload may cut the evaluation short
    // A reloaded page has lost the mark set above
    await expect.poll(() => page.evaluate(() => window.notReloaded).catch(() => true)).toBeUndefined();
  });

  test('a short pull does not reload, and the circle goes away', async ({ loaded: page }) => {
    await page.evaluate(() => {
      window.notReloaded = true;
    });
    await pull(page, 60);
    expect(await page.evaluate(() => window.notReloaded)).toBe(true);
    await expect(page.locator('#pullRefresh')).toHaveCSS('opacity', '0');
  });

  test('a pull when the content is not at its top only scrolls', async ({ loaded: page }) => {
    await page.locator('.tabs [data-tab=laws]').click();
    await page.evaluate(() => {
      document.querySelector('#scroller').scrollTo(0, 400);
      window.notReloaded = true;
    });
    await pull(page, 200);
    expect(await page.evaluate(() => window.notReloaded)).toBe(true);
  });
});
