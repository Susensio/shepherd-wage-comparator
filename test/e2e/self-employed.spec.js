// Self-employed (autónomo, ADR-0029): entered from the pay step, its figures in the ficha, and its ledgers adding up.

import { expect, goStep, loadOffers, sample, startOffer, test } from './fixtures.js';
import { ledgerProblems } from './ledger.js';

const terms = (page) => page.evaluate(() => app.active().terms);

/** A new 4-month offer invoiced at 2.000 € a month, as autónomo, on the pay step. */
async function newSelfEmployed(page) {
  await startOffer(page, 'offer');
  await page.fill('#duration', '4');
  await goStep(page, 'day');
  await page.fill('#hoursPerDay', '8');
  await goStep(page, 'pay');
  await page.fill('#payTotal', '2000');
  await page.check('input[name=payPer][value=month]');
  await page.check('input[name=payroll][value=self]');
}

test('«se factura como autónomo» hides the contract questions and asks about the IVA', async ({ page }) => {
  await newSelfEmployed(page);
  expect(await terms(page)).toMatchObject({ contract: 'selfEmployed', payAmount: 2000, payUnit: 'month' });
  await expect(page.locator('input[name=contract]').first()).toBeHidden();
  await expect(page.locator('input[name=vacation]').first()).toBeHidden();
  const vat = page.locator('input[name=vatIncluded]');
  await expect(vat).toBeVisible();
  await expect(page.locator('#payHint')).toContainText('de cuota de autónomos');
  await vat.check();
  expect((await terms(page)).vatIncluded).toBe(true);
  await expect(page.locator('#payHint')).toContainText('Sin el IVA');
  // Back to a payslip: an ordinary contract again
  await page.check('input[name=payroll][value=all]');
  expect((await terms(page)).contract).toBe('temporary');
});

test('the ficha: «Autónomo» stamp, no paro, the quota and IRPF taken off, the falso autónomo warning', async ({
  page,
}) => {
  await newSelfEmployed(page);
  await goStep(page, 'trip');
  await page.locator('#entryNext').click();
  await expect(page.locator('#ficha')).toBeVisible();
  const result = page.locator('#result');
  await expect(result.locator('.stamp')).toContainText('Autónomo');
  await expect(result).toContainText('Como autónomo no genera paro');
  await result.locator('[data-fold=breakdown2] > summary').click();
  const rows = result.locator('[data-fold=breakdown2] .rows');
  for (const label of ['Factura', 'Cuota de autónomos', 'Total']) await expect(rows).toContainText(label);
  await expect(result.locator('#secLegal .verdict')).toHaveText('Como autónomo, puede ser un falso autónomo');
  await expect(result.locator('#secSeason')).toHaveCount(0); // no payslips to simulate
});

/** Sample offers turned self-employed, with and without IVA inside, with and without housing and a car. */
const variants = sample.offers.slice(0, 4).map((offer, i) => ({
  ...offer,
  id: `se${i}`,
  terms: {
    ...offer.terms,
    contract: 'selfEmployed',
    payrollMin: false,
    cashMode: 'amount',
    cashAmount: '',
    payType: 'gross',
    payAmount: 1800 + i * 450,
    payUnit: i === 3 ? 'day' : 'month',
    vatIncluded: i % 2 === 1,
  },
}));

for (const [i, offer] of variants.entries()) {
  test(`self-employed variant ${i + 1} adds up on screen`, async ({ page }) => {
    await loadOffers(page, { ...sample, offers: variants }, i);
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('#result details')) d.open = true;
    });
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
    expect(offer.terms.contract).toBe('selfEmployed');
  });
}
