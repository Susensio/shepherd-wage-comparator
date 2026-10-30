// The legal figures the page shows come from src/law.js. The data itself is checked in test/unit/law.test.js.

import { expect, test } from './fixtures.js';

test('the Leyes tab is filled in', async ({ page }) => {
  const empty = await page.evaluate(() =>
    [...document.querySelectorAll('[data-law]')].filter((e) => !e.textContent.trim()).map((e) => e.dataset.law),
  );
  expect(empty).toEqual([]);
  const unlinked = await page.evaluate(
    () => [...document.querySelectorAll('a[data-source]')].filter((a) => !a.href.startsWith('https://')).length,
  );
  expect(unlinked).toBe(0);
  await page.evaluate(() => {
    app.closeTemplates();
    app.showTab('laws');
  });
  const year = await page.evaluate(async () => Object.keys((await import('./src/law.js')).MIN_WAGE).at(-1));
  await expect(page.locator('[data-panel=laws]')).toContainText(`en ${year},`);
});
