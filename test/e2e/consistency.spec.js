// What the page shows adds up: every «=» row, every bar and the figures repeated in different places.

import { expect, sample, test } from './fixtures.js';

/** Every ledger with signs: the figure after «=» must come out of the rows above it. Bars must not overflow. */
function ledgerProblems() {
  const problems = [];
  const parse = (text) => {
    if (text == null) return null;
    const t = text.replace(/ /g, ' ').trim();
    if (t === 'nada') return 0;
    const m = t.match(/-?[\d.]+(,\d+)?/);
    return m ? Number.parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null;
  };
  for (const rows of document.querySelectorAll('#result .rows')) {
    let sum = null;
    const title = (rows.closest('section,details')?.querySelector('h4,summary,.lev-t')?.textContent || '')
      .trim()
      .slice(0, 40);
    for (const row of rows.querySelectorAll(':scope > .row')) {
      if (row.classList.contains('hd')) continue;
      const figure = row.lastElementChild;
      const op = figure.querySelector('.op')?.textContent;
      const number = figure.querySelector('.nm') || figure;
      const value = parse((number.querySelector('.two > span') || number).textContent);
      const label = row.firstElementChild.firstChild?.textContent?.trim();
      if (value == null) continue;
      if (!op) sum = value;
      else if (op === '+') sum += value;
      else if (op === '−') sum -= value;
      else if (op === '×') sum *= value;
      else if (op === '=') {
        const tolerance = Math.max(1.01, Math.abs(value) * 0.006);
        if (sum != null && Math.abs(sum - value) > tolerance && !(value === 0 && sum < 0))
          problems.push(`[${title}] «${label}» = ${value}, but the rows give ${Math.round(sum * 100) / 100}`);
        sum = value;
      }
    }
  }
  for (const bar of document.querySelectorAll('#result .br')) {
    const width = [...bar.querySelectorAll('.br-b i')].reduce(
      (total, i) => total + Number.parseFloat(i.style.width),
      0,
    );
    if (width > 100.6)
      problems.push(
        `bar «${bar.querySelector('.br-l')?.textContent?.trim()?.slice(0, 40)}»: segments take ${width.toFixed(1)} %`,
      );
  }
  return problems;
}

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
  if (r.savings.days > 1 && !close(r.savings.days, x.daysUnpaid * (1 + r.cfg.ssEmp / 100)))
    problems.push('extra-days savings ≠ unpaid × employer rate');
  const onPayroll = r.pay.net + r.employer.severance;
  const legend = document.querySelector('#secSeason .rc-legend');
  if (legend && !r.noContract) {
    const shown = Number.parseFloat(legend.querySelector('b').textContent.replace(/\./g, '').replace(',', '.'));
    if (Math.abs(shown - onPayroll) > 2)
      problems.push(`season end: on payroll ${shown} ≠ net payroll ${Math.round(onPayroll)}`);
  }
  if (o.terms.start && !r.noContract && !o.terms.offerOnly) {
    const payslips = monthlyPayslips(o.terms, r, r.cfg);
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
    expect([...(await page.evaluate(ledgerProblems)), ...(await page.evaluate(invariantProblems))]).toEqual([]);
  });
}
