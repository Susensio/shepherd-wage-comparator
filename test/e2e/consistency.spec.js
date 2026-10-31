// What the page shows adds up: every «=» row, every bar and the figures repeated in different places.

import { expect, sample, test } from './fixtures.js';
import { ledgerProblems } from './ledger.js';

/** Model invariants, and the same figure where it appears twice. */
async function invariantProblems() {
  const { monthlyPayslips } = await import('./src/model/payslips.js');
  const o = app.active();
  const r = app.calcOffer(o);
  const { time: t, extra: x, extraDays: days } = r;
  const problems = [];
  const close = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
  const weeks = (t.noDuration ? 365 / 12 : t.natDays - t.vacationTaken) / 7;
  if (!close(x.hours, x.days * x.workday + x.overtime, 0.5))
    problems.push('extra hours ≠ extra days × workday + overtime');
  if (!close(x.normalHours + x.hours, t.hours, 0.5)) problems.push('normal + extra hours ≠ hours worked');
  if (days.worked > days.due && !close(days.worked - days.due, days.extra, 0.11))
    problems.push('worked − due ≠ extra days');
  if (!close(x.workDaysWeek * x.hoursPerDay, t.hoursPerWeek, 1.2))
    problems.push(
      `week in the bar ${(x.workDaysWeek * x.hoursPerDay).toFixed(1)} h ≠ hours per week ${t.hoursPerWeek.toFixed(1)} h`,
    );
  if (x.overtimePerWeek > 0.5 && !close(x.overtimePerWeek * weeks, x.overtime, Math.max(3, x.overtime * 0.08)))
    problems.push('overtime per week × weeks ≠ total overtime');
  if (r.savings.days > 1 && !close(r.savings.days, x.daysUnpaid * (1 + r.pay.rates.employerPct / 100)))
    problems.push('extra-days savings ≠ unpaid × employer rate');
  const onPayroll = r.pay.net + r.employer.severance;
  const legend = document.querySelector('#secSeason .rc-legend');
  if (legend && !r.noContract) {
    const shown = Number.parseFloat(legend.querySelector('b').textContent.replace(/\./g, '').replace(',', '.'));
    if (Math.abs(shown - onPayroll) > 2)
      problems.push(`season end: on payroll ${shown} ≠ net payroll ${Math.round(onPayroll)}`);
  }
  if (o.terms.start && !r.noContract && !o.terms.offerOnly) {
    const payslips = monthlyPayslips(o.terms, r);
    const net = payslips.reduce((sum, p) => sum + p.net, 0);
    if (payslips.length && Math.abs(net - onPayroll) > 3)
      problems.push(`payslip simulator: net sum ${net.toFixed(0)} ≠ net payroll ${onPayroll.toFixed(0)}`);
  }
  const pill = [...document.querySelectorAll('#result .pill')]
    .map((e) => e.textContent)
    .find((s) => /h\/semana/.test(s));
  if (pill && Math.abs(Number.parseFloat(pill.split('·')[1]) - t.hoursPerWeek) > 0.6)
    problems.push(`pill «${pill}» ≠ ${t.hoursPerWeek.toFixed(1)} h`);
  return problems;
}

for (const offer of sample.offers) {
  test(`${offer.mine.name} adds up`, async ({ loaded: page }) => {
    await page.evaluate((id) => app.select(id), offer.id);
    test.skip((await page.locator('#result .empty').count()) > 0, 'offer with missing data');
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('#result details')) d.open = true;
    });
    expect([...(await page.evaluate(ledgerProblems, '#result')), ...(await page.evaluate(invariantProblems))]).toEqual(
      [],
    );
  });
}

// The terms-only figures, laid out by the result view, add up the same way
for (const offer of sample.offers) {
  test(`${offer.mine.name} adds up from its terms alone`, async ({ loaded: page }) => {
    await page.evaluate((id) => app.select(id), offer.id);
    test.skip((await page.locator('#result .empty').count()) > 0, 'offer with missing data');
    await page.evaluate(async () => {
      const { render } = await import('lit-html');
      const { resultView } = await import('./src/views/result.js');
      const { calcTermsOnly } = await import('./src/model/calc.js');
      const { termsOnly } = await import('./src/offer.js');
      const o = app.active();
      render(resultView(termsOnly(o), calcTermsOnly(o, { cfg: app.state.config })), document.querySelector('#result'));
      for (const d of document.querySelectorAll('#result details')) d.open = true;
    });
    expect(await page.evaluate(ledgerProblems, '#result')).toEqual([]);
  });
}
