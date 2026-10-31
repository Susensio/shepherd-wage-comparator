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
  if (o.terms.start && !r.noContract && !o.mine.offerOnly) {
    const payslips = monthlyPayslips(o.terms, r);
    const net = payslips.reduce((sum, p) => sum + p.net, 0);
    if (payslips.length && Math.abs(net - onPayroll) > 3)
      problems.push(`payslip simulator: net sum ${net.toFixed(0)} ≠ net payroll ${onPayroll.toFixed(0)}`);
  }
  // The payslip simulator: each month's totals are the sum of the rows shown, and the net is credits − deductions
  const slip = document.querySelector('#secSeason table.ps-t:not(.ps-emp)');
  const number = (cell) => Number.parseFloat(cell.textContent.replace(/\./g, '').replace(',', '.')) || 0;
  if (slip) {
    const totals = [...slip.querySelectorAll('tfoot tr.tt')];
    const nets = [...slip.querySelectorAll('tfoot tr.net')];
    const months = [];
    for (const row of slip.querySelectorAll('tbody tr')) {
      if (row.querySelector('th').textContent === 'Salario') months.push({ credits: 0, debits: 0 });
      const cells = row.querySelectorAll('td');
      months.at(-1).credits += number(cells[1]);
      months.at(-1).debits += number(cells[2]);
    }
    months.forEach((m, i) => {
      const [credits, debits] = [...totals[i].querySelectorAll('td')].slice(1).map(number);
      const net = number(nets[i].querySelector('td'));
      if (Math.abs(m.credits - credits) > 0.001 || Math.abs(m.debits - debits) > 0.001)
        problems.push(
          `payslip ${i + 1}: rows give ${m.credits.toFixed(2)} / ${m.debits.toFixed(2)}, totals ${credits} / ${debits}`,
        );
      if (Math.abs(credits - debits - net) > 0.001)
        problems.push(`payslip ${i + 1}: net ${net} ≠ ${credits} − ${debits}`);
    });
  }
  const employerSlip = document.querySelector('#secSeason table.ps-emp');
  if (employerSlip) {
    const totals = [...employerSlip.querySelectorAll('tfoot td')].map(number);
    const rows = [...employerSlip.querySelectorAll('tbody tr')];
    const perMonth = rows.length / totals.length;
    totals.forEach((total, i) => {
      const sum = rows.slice(i * perMonth, (i + 1) * perMonth).reduce((s, row) => s + number(row.lastElementChild), 0);
      if (Math.abs(sum - total) > 0.001)
        problems.push(`employer payslip ${i + 1}: rows give ${sum.toFixed(2)}, total ${total}`);
    });
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
