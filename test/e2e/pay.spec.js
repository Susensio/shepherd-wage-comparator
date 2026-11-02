// «Lo que te pagan»: the four answers, the questions that depend on them, and how saved offers read into them.

import { expect, loadOffers, sample, test } from './fixtures.js';

const terms = (page) => page.evaluate(() => app.active().terms);
const answer = (page, name, value) => page.check(`input[name=${name}][value=${value}]`);

/** A new offer with a 4-month contract, the pay section open. */
async function newOffer(page, duration = '4') {
  await page.locator('.tcard').first().click();
  await page.fill('#duration', duration);
  await page.fill('#hoursPerDay', '9');
  await page.fill('#payTotal', '2100');
  await answer(page, 'payPer', 'month');
}

test('«Todo»: the amount is the net payslip', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payroll', 'all');
  expect(await terms(page)).toMatchObject({
    payrollMin: false,
    payType: 'net',
    payAmount: 2100,
    payUnit: 'month',
    cashMode: 'amount',
    cashAmount: '',
  });
  await expect(page.locator('#payCash')).toBeHidden();
  await expect(page.locator('#payTold')).toContainText('Te pagan 2.100 € al mes · todo en nómina · contrato');
});

test('«El salario mínimo»: the amount is the agreed total and en negro is worked out', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payroll', 'min');
  expect(await terms(page)).toMatchObject({
    payrollMin: true,
    cashMode: 'total',
    totalAmount: 2100,
    totalUnit: 'month',
  });
  await expect(page.locator('#payCash')).toContainText(/^Unos [\d.]+\s€ al mes van en negro\.$/);
  await expect(page.locator('#payTold')).toContainText('el salario mínimo en nómina · unos');
  await expect(page.locator('[data-show=payPart]').first()).toBeHidden();
});

for (const [type, label] of [
  ['net', 'neto, lo que llega'],
  ['gross', 'bruto, como en la nómina'],
]) {
  test(`«Una parte», ${type}: the part is asked in the unit of the amount`, async ({ page }) => {
    await newOffer(page);
    await answer(page, 'payroll', 'part');
    await expect(page.locator('#payPartPer')).toHaveText('al mes');
    // Nothing to say about en negro until the part is typed
    await expect(page.locator('#payCash')).toBeHidden();
    await page.fill('#payPart', '1500');
    await page.locator('label', { hasText: label }).click();
    expect(await terms(page)).toMatchObject({
      payrollMin: false,
      payType: type,
      payAmount: 1500,
      payUnit: 'month',
      cashMode: 'total',
      totalAmount: 2100,
      totalUnit: 'month',
    });
    await expect(page.locator('#payCash')).toContainText(/^Unos [\d.]+\s€ al mes van en negro\.$/);
    await expect(page.locator('#payHint')).toContainText(type === 'net' ? 'brutos' : 'netos');
  });
}

test('«Nada, sin contrato»: everything is en negro and the contract questions go', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payroll', 'none');
  expect(await terms(page)).toMatchObject({
    contract: 'none',
    cashMode: 'amount',
    cashAmount: 2100,
    cashUnit: 'month',
  });
  await expect(page.locator('#payCash')).toHaveText('Todo en negro: 2.100 € al mes.');
  await expect(page.locator('input[name=contract]').first()).toBeHidden();
  await expect(page.locator('input[name=vacation]').first()).toBeHidden();
  // Leaving it brings the contract back
  await answer(page, 'payroll', 'all');
  expect((await terms(page)).contract).toBe('temporary');
  await expect(page.locator('input[name=contract][value=temporary]')).toBeChecked();
});

test('changing the unit keeps the amount and the answer', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payroll', 'part');
  await page.fill('#payPart', '1500');
  await answer(page, 'payPer', 'day');
  expect(await terms(page)).toMatchObject({ payAmount: 1500, payUnit: 'day', totalAmount: 2100, totalUnit: 'day' });
  await expect(page.locator('#payPartPer')).toHaveText('al día');
});

test('«en total» only with a duration', async ({ page }) => {
  await newOffer(page);
  const total = page.locator('input[name=payPer][value=total]');
  await expect(total).toBeAttached();
  await expect(page.locator('label', { has: total })).toBeVisible();
  await answer(page, 'durationUnit', 'unknown');
  await expect(page.locator('label', { has: total })).toBeHidden();
});

test('a total with the duration cleared becomes a month of the same amount', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payPer', 'total');
  await answer(page, 'durationUnit', 'unknown');
  expect(await terms(page)).toMatchObject({ payUnit: 'month', payAmount: 2100 });
  await expect(page.locator('input[name=payPer][value=month]')).toBeChecked();
});

test('extra pays are asked only for a monthly amount with a payslip', async ({ page }) => {
  await newOffer(page);
  const extra = page.locator('input[name=extraPays]').first();
  await answer(page, 'payroll', 'all');
  await expect(extra).toBeVisible();
  await answer(page, 'payroll', 'part');
  await expect(extra).toBeVisible();
  await answer(page, 'payroll', 'min');
  await expect(extra).toBeHidden();
  await answer(page, 'payroll', 'none');
  await expect(extra).toBeHidden();
  await answer(page, 'payroll', 'all');
  await answer(page, 'payPer', 'day');
  await expect(extra).toBeHidden();
  await answer(page, 'payPer', 'month');
  await answer(page, 'extraPays', 'separate');
  expect((await terms(page)).extraPays).toBe('separate');
  await expect(page.locator('#payTold')).toContainText('dos pagas extra aparte');
});

test('«Las libro, cobrando» is not offered on a temporary contract of 120 days or less', async ({ page }) => {
  await newOffer(page, '3');
  await answer(page, 'contract', 'temporary');
  const taken = page.locator('input[name=vacation][value=taken]');
  await expect(taken).toBeHidden();
  await expect(page.locator('#vacationHint')).toContainText('En un contrato temporal de hasta 120 días');
  await page.fill('#duration', '5');
  await expect(taken).toBeVisible();
  await answer(page, 'durationUnit', 'days');
  await page.fill('#duration', '120');
  await expect(taken).toBeHidden();
  await page.fill('#duration', '121');
  await expect(taken).toBeVisible();
  // Only temporary contracts have the casual minimum: the others can take their vacation
  await page.fill('#duration', '60');
  await expect(taken).toBeHidden();
  await answer(page, 'contract', 'seasonal');
  await expect(taken).toBeVisible();
});

test('an offer that already takes its vacation keeps it, shown with a hint, when the contract is short', async ({
  page,
}) => {
  await newOffer(page, '6');
  await answer(page, 'contract', 'temporary');
  await answer(page, 'vacation', 'taken');
  await page.fill('#duration', '2');
  expect((await terms(page)).vacation).toBe('taken');
  await expect(page.locator('input[name=vacation][value=taken]')).toBeChecked();
  await expect(page.locator('#vacationHint')).toContainText('cambia a «Me las pagan aparte, al acabar»');
});

test('«Una parte» without the part is missing, and the mark points at it', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payroll', 'part');
  await page.click('[data-action=done]');
  await expect(page.locator('#goMsg')).toHaveText('Falta lo que va en nómina.');
  await expect(page.locator('#payPart')).toBeFocused();
  await expect(page.locator('.fld.missing')).toContainText('¿Cuánto va en nómina?');
});

test('the sentence tells the part as typed', async ({ page }) => {
  await newOffer(page);
  await answer(page, 'payroll', 'part');
  await page.fill('#payPart', '1500');
  await expect(page.locator('#payTold')).toContainText('1.500 € al mes en nómina · unos');
  await answer(page, 'payType', 'gross');
  await expect(page.locator('#payTold')).toContainText('1.500 € brutos al mes en nómina · unos');
});

test('an offer saved with a payslip and en negro money keeps both when an answer changes', async ({ page }) => {
  await page.evaluate(async () => {
    const { ingestSaved } = await import('./src/saved.js');
    const { DEF_CFG } = await import('./src/offer.js');
    app.closeTemplates();
    const { offers } = ingestSaved(
      {
        offers: [
          {
            id: 'x',
            terms: {
              start: '2026-06-01',
              duration: 3,
              hoursPerDay: 9,
              payType: 'net',
              payAmount: 1400,
              cashAmount: 300,
              vacation: 'included',
            },
            mine: { name: 'Vieja' },
          },
        ],
      },
      { fallbackCfg: DEF_CFG },
    );
    app.state.offers = offers;
    app.select('x');
  });
  await expect(page.locator('input[name=payroll][value=part]')).toBeChecked();
  await expect(page.locator('#payPart')).toHaveValue('1400');
  await expect(page.locator('#payCash')).toContainText('Unos 300 € al mes van en negro');
  await answer(page, 'payPer', 'day');
  await answer(page, 'payPer', 'month');
  await expect(page.locator('#payCash')).toContainText('van en negro');
});

test('what is missing points at the amount', async ({ page }) => {
  await page.locator('.tcard').first().click();
  await page.fill('#duration', '4');
  await page.fill('#hoursPerDay', '9');
  await page.click('[data-action=done]');
  await expect(page.locator('#goMsg')).toHaveText('Falta lo que te pagan.');
  await expect(page.locator('#payTotal')).toBeFocused();
  await expect(page.locator('.fld.missing')).toContainText('¿Cuánto te pagan?');
});

const EXPECTED = {
  'Puerto A': { payroll: 'part', total: '2205', per: 'month', part: '1785', type: 'net', contract: 'seasonal' },
  'Puerto A, otra cuenta': {
    payroll: 'part',
    total: '2205',
    per: 'month',
    part: '1785',
    type: 'gross',
    contract: 'seasonal',
  },
  'Campaña B': { payroll: 'min', total: '63', per: 'day', contract: 'seasonal' },
  'Invernada C': { payroll: 'part', per: 'month', part: '1430', type: 'gross', contract: 'temporary' },
  'Sin contrato D': { payroll: 'none', total: '63', per: 'day' },
  'Temporada E': { payroll: 'all', total: '1450', per: 'total', contract: 'seasonal' },
  'Temporada F': { payroll: 'all', total: '78,75', per: 'day', contract: 'seasonal' },
  'Sin contrato G': { payroll: 'none', total: '63', per: 'day' },
};

sample.offers.forEach((offer, index) => {
  test(`${offer.mine.name} loads into its answers`, async ({ page }) => {
    await loadOffers(page, sample, index);
    const want = EXPECTED[offer.mine.name];
    await expect(page.locator(`input[name=payroll][value=${want.payroll}]`)).toBeChecked();
    await expect(page.locator(`input[name=payPer][value=${want.per}]`)).toBeChecked();
    if (want.total) await expect(page.locator('#payTotal')).toHaveValue(want.total);
    if (want.part) {
      await expect(page.locator('#payPart')).toHaveValue(want.part);
      await expect(page.locator(`input[name=payType][value=${want.type}]`)).toBeChecked();
    }
    if (want.contract) await expect(page.locator(`input[name=contract][value=${want.contract}]`)).toBeChecked();
    await expect(page.locator('[data-show=payLegacy]')).toBeHidden();
  });
});
