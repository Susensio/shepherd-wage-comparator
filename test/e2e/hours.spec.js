// The weekly-hours chart in Comparar: one typical working week, paid then unpaid.

import { expect, loadOffers, sample, test } from './fixtures.js';

/** Per offer on the chart: the figures of its result and the boxes of its bar and its segments. */
async function chartRows(page) {
  await page.click('.tabs [data-tab=compare]');
  return page.evaluate(() => {
    const box = (e) => {
      const b = e.getBoundingClientRect();
      return { left: b.left, right: b.right, width: b.width };
    };
    return [...document.querySelectorAll('#cmpMore .hours .hr')].map((row) => {
      const x = app.state.offers.find((o) => o.id === row.dataset.id);
      const { extra, time } = app.calcOffer(x);
      const paid = row.querySelector('.hbar i.paid');
      const unpaid = row.querySelector('.hbar i.unpaid');
      return {
        name: row.querySelector('b').textContent,
        days: extra.workDaysWeek,
        perDay: extra.hoursPerDay,
        workday: extra.workday,
        total: time.hoursPerWeek,
        bar: box(row.querySelector('.hbar')),
        paid: box(paid),
        unpaid: unpaid && box(unpaid),
      };
    });
  });
}

test('paid and unpaid hours add up to the total', async ({ loaded: page }) => {
  const rows = await chartRows(page);
  expect(rows.length).toBeGreaterThan(1);
  const cap = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll('#cmpMore .hours .hr .v')].map((v) =>
        Number.parseFloat(v.textContent.replace(',', '.')),
      ),
    ),
  );
  for (const r of rows) {
    const bars = r.paid.width + (r.unpaid?.width ?? 0);
    expect(Math.abs(bars - (r.total / cap) * r.bar.width), r.name).toBeLessThanOrEqual(1);
    if (r.unpaid) expect(Math.abs(r.unpaid.left - r.paid.right), r.name).toBeLessThanOrEqual(1);
  }
});

test('in a full week the unpaid hours start at 40 h or later', async ({ loaded: page }) => {
  const rows = await chartRows(page);
  const full = rows.filter((r) => r.days >= 5.5 && r.perDay >= r.workday);
  expect(full.length).toBeGreaterThan(0);
  for (const r of full) {
    const hoursPaid = (r.paid.width / (r.paid.width + (r.unpaid?.width ?? 0))) * r.total;
    expect(hoursPaid, r.name).toBeGreaterThanOrEqual(40 - 0.5);
  }
});

test('an offer with nothing unpaid shows no «sin pagar» segment', async ({ loaded: page }) => {
  const short = structuredClone(sample.offers[3]);
  short.id = 'short';
  short.mine.name = 'Jornada corta';
  short.terms.hoursPerDay = 6;
  await loadOffers(page, { ...sample, offers: [...sample.offers, short] });
  const rows = await chartRows(page);
  expect(rows.find((r) => r.name === 'Jornada corta').unpaid).toBeNull();
  expect(rows.filter((r) => r.unpaid).length).toBeGreaterThan(0);
  const legend = page.locator('#cmpMore .hours + .legend');
  await expect(legend).toContainText('Horas pagadas');
  await expect(legend).toContainText('Horas sin pagar');
  await expect(legend).not.toContainText('máximo legal');
});
