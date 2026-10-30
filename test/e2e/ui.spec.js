// The main flows, clicked through as a person would.

import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures.js';

async function fillOffer(page, { duration = '4', hours = '11', pay = '70' } = {}) {
  await page.fill('#duration', duration);
  await page.fill('#hoursPerDay', hours);
  await page.check('input[name=vacation][value=included]');
  await page.fill('#payAmount', pay);
}

const offerNames = (page) => page.evaluate(() => app.state.offers.map((o) => o.name));

test('a new offer from a template', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await expect(page.locator('#result .tag .big')).toContainText('€');
  // Changing the unit converts the duration: 4 months are 122 days
  await page.check('input[name=durationUnit][value=days]');
  await expect(page.locator('#duration')).toHaveValue('122');
});

test('the end date sets the duration', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await page.fill('#start', '2026-06-21');
  await page.fill('#end', '2026-09-30');
  await expect(page.locator('#duration')).toHaveValue('102');
  await expect(page.locator('input[name=durationUnit][value=days]')).toBeChecked();
});

test('duplicate and delete', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await page.click('[data-action=duplicate]');
  const names = await offerNames(page);
  expect(names).toHaveLength(2);
  expect(names[1]).toMatch(/\(copia\)$/);
  // Deleting asks for a second tap
  await page.click('#btnDel');
  await expect(page.locator('#btnDel')).toContainText('Toca otra vez');
  await page.click('#btnDel');
  expect(await offerNames(page)).toHaveLength(1);
});

test('compare, and go to an offer from there', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await fillOffer(page);
  await page.click('#btnAdd');
  await page.locator('.tcard').nth(2).click();
  await fillOffer(page, { duration: '15', hours: '10', pay: '80' });
  await page.click('#btnGoRes');
  await page.click('.tabs [data-tab=compare]');
  const rows = page.locator('#cmpBlk .lr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.v')).toHaveText(/\/hora$/);
  await page.click("#cmpView label:has-text('total')");
  expect(await page.evaluate(() => app.state.cmpUnit)).toBe('total');
  await expect(rows.first().locator('.v')).not.toContainText('/hora');
  await page.locator('#cmpBlk [data-action=view]').nth(1).click();
  await expect(page.locator('.tabs [aria-selected=true]')).toHaveAttribute('data-tab', 'offers');
});

test('head to head', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=compare]');
  await page.click('[data-action=startPair]');
  await page.locator('.lr').nth(0).click();
  await page.locator('.lr').nth(2).click();
  await expect(page.locator('#pairBlk')).toContainText('Cara a cara');
  await page.click('#pairBlk [data-action=closePair]');
  await expect(page.locator('#pairBlk')).toHaveCount(0);
});

test('settings apply to every offer', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await page.click('.tabs [data-tab=settings]');
  await page.fill('#cfg_overnight', '30');
  expect(await page.evaluate(() => app.state.config.overnightPct)).toBe(30);
});

test('«Hecho» with data missing takes you to it', async ({ page }) => {
  await page.click(".tcard:has-text('Temporada')");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#editBtn');
  await expect(page.locator('#editWrap')).toHaveAttribute('open', '');
  await expect(page.locator('#goMsg')).toHaveText(/^Falta/);
  await expect(page.locator('.fld.missing').first()).toBeVisible();
  await expect(page.locator('.chip[aria-current=true]')).toHaveClass(/incomplete/);
});

test('copy the claim', async ({ loaded: page }) => {
  await page.click('.tabs [data-tab=offers]');
  await page.click('[data-action=copyClaim]');
  await expect(page.locator('#claimMsg')).not.toBeEmpty();
  const text = await page.evaluate(() => app.claimText(app.active(), app.calcOffer(app.active())));
  expect(text).toContain('SALARIO');
  expect(text).toContain('Comparador de jornales');
});

test('a backup, downloaded and loaded in another browser', async ({ openApp, browser }) => {
  const page = await openApp();
  await page.locator('.tcard').first().click();
  await fillOffer(page, { hours: '10', pay: '60' });
  await expect(page.locator('#backupNotice')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#backupNotice [data-action=download]'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const data = readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(data)).toHaveProperty('offers');

  const other = await openApp({ ctx: await browser.newContext() });
  const backup = { name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(data) };
  await other.setInputFiles('#backupFile', backup);
  await expect(other.locator('#bkMsg2')).toHaveText(/^Añadida 1 oferta/);
  await other.setInputFiles('#backupFile', backup);
  await expect(other.locator('#bkMsg2')).toContainText('ya la tenías');
});
