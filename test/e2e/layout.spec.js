// Spacing and tap sizes: measured on the page, at phone width.

import { expect, sample, test } from './fixtures.js';

const TAPPED = 'button:not(.linkbtn), .filebtn, .tabs button, .chip, .barbtn, summary';

/** Visible tapped things under `root` that are shorter than 40 px. */
const tooShort = (page, root = 'body') =>
  page.evaluate(
    ({ root, selector }) =>
      [...document.querySelectorAll(root)]
        .flatMap((r) => [...r.querySelectorAll(selector)])
        .filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 39.5)
        .map(
          (e) =>
            `${e.tagName}.${e.className} «${e.textContent.trim().slice(0, 30)}» ${e.getBoundingClientRect().height}`,
        ),
    { root, selector: TAPPED },
  );

test('buttons, tabs, chips, bar icons and fold titles are at least 40 px tall', async ({ loaded: page }) => {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('#result details')) d.open = true;
  });
  expect(await tooShort(page)).toEqual([]);
  await page.click('.tabs [data-tab=compare]');
  expect(await tooShort(page, '#cmpMain')).toEqual([]);
  await page.evaluate(() => app.openSettingsPage());
  expect(await tooShort(page)).toEqual([]);
  await page.evaluate(() => app.openAccountPage());
  expect(await tooShort(page)).toEqual([]);
});

test('Comparar: the sticky «Comparar por» row does not cover the checkbox under it', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  const [row, checkbox] = await Promise.all([
    page.locator('#cmpView').boundingBox(),
    page.locator('.terms-only').boundingBox(),
  ]);
  expect(checkbox.y).toBeGreaterThanOrEqual(row.y + row.height - 0.5);
});

for (const offer of sample.offers) {
  test(`${offer.mine.name}: the «pagado» marker does not run through a figure of its bar`, async ({ loaded: page }) => {
    await page.evaluate((id) => app.select(id), offer.id);
    const crossed = await page.evaluate(() =>
      [...document.querySelectorAll('.br-mw')].flatMap((bar) => {
        const marker = bar.querySelector('.br-min')?.getBoundingClientRect();
        if (!marker) return [];
        return [...bar.querySelectorAll('.br-b .tx')]
          .filter((tx) => {
            const box = tx.getBoundingClientRect();
            return box.width && marker.left < box.right && marker.right > box.left;
          })
          .map((tx) => tx.textContent);
      }),
    );
    expect(crossed).toEqual([]);
  });
}
