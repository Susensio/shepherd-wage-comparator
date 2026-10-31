// Spacing and tap sizes: measured on the page, at phone width.

import { expect, test } from './fixtures.js';

test('Comparar: the sticky «Comparar por» row does not cover the checkbox under it', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  const [row, checkbox] = await Promise.all([
    page.locator('#cmpView').boundingBox(),
    page.locator('.terms-only').boundingBox(),
  ]);
  expect(checkbox.y).toBeGreaterThanOrEqual(row.y + row.height - 0.5);
});
