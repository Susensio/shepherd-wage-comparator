// The calculations, checked against figures worked out by hand from the law. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { num } from '../../src/format.js';
import { LAW, MIN_WAGE, minWageOf, ssOf } from '../../src/law.js';
import { calc, calcTermsOnly } from '../../src/model/calc.js';
import { monthlyPayslips } from '../../src/model/payslips.js';
import { irpfTax, unemploymentBenefit } from '../../src/model/tax.js';
import { claimDeadlines, payrollMonths } from '../../src/model/time.js';
import { DEF_CFG, DEF_MINE, missing, parseDate } from '../../src/offer.js';
import { normalizeOffer } from '../../src/schema.js';
import { wageYearNote } from '../../src/text.js';
import { incomeOf } from '../../src/units.js';
import { offerOf } from './flat-offer.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const cfg = { ...DEF_CFG, ...sample.cfg };
const offers = sample.offers.map(normalizeOffer);

/** Within `tolerance` of `expected`. */
const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

// A permanent full-time contract at exactly the 2026 minimum wage, 14 payments, with days off and holidays taken
const BASE = {
  id: 't',
  name: 't',
  start: '2026-01-01',
  contract: 'permanent',
  duration: 12,
  durationUnit: 'months',
  hoursPerDay: 8,
  daysOff: 2,
  daysOffUnit: 'week',
  holidays: 'yes',
  payType: 'gross',
  payAmount: 1221,
  payUnit: 'month',
  extraPays: 'separate',
  vacation: 'taken',
  housing: 'no',
  car: 'noCar',
  kmHome: 0,
  overnight: 'no',
};
const figures = (changes = {}) => calc(offerOf({ ...BASE, ...changes }), { cfg, alone: true });

test('the minimum wage, in 14 payments, complies', () => {
  const r = figures();
  assert.ok(r.debt.total < 1, 'nothing owed');
  near(r.time.hoursPerWeek, 40, 0.01, 'hours a week');
  assert.ok(r.extra.hours < 0.06 * r.extra.normalHours, 'no extra time');
  assert.ok(r.extra.daysUnpaid + r.extra.overtimeUnpaid < 1, 'nothing unpaid');
  near(r.pay.gross, 17094, 1, 'gross a year');
  assert.ok(r.pay.irpf < 0.5, 'no IRPF');
  assert.equal(r.stamp, null);
});

test('the minimum wage, prorated in 12 payments, complies', () => {
  assert.ok(figures({ payAmount: 17094 / 12, extraPays: 'included' }).debt.total < 1);
});

test('one euro short a month is 14 € owed', () => {
  const r = figures({ payAmount: 1220 });
  near(r.debt.total, 14, 0.5, 'owed');
  assert.equal(r.stamp?.code, 'belowMinimum');
});

test('a 100-day temporary contract uses the casual-worker daily minimum', () => {
  const r = figures({
    contract: 'temporary',
    duration: 100,
    durationUnit: 'days',
    payAmount: 57.82,
    payUnit: 'day',
    vacation: 'paidAtEnd',
    extraPays: 'included',
  });
  assert.ok(r.min.casual);
  assert.ok(r.debt.total < 1, 'nothing owed');
});

test('the minimum as the agreed pay is the monthly one, extra pays prorated, even in a casual contract', () => {
  const r = figures({
    contract: 'temporary',
    duration: 30,
    durationUnit: 'days',
    payrollMin: true,
    payAmount: '',
    vacation: 'paidAtEnd',
  });
  assert.ok(r.min.casual);
  near(r.min.monthly, r.wage.annual / 12, 0.001, 'monthly minimum with its pays');
  near(r.pay.salary, r.min.agreed, 0.001, 'agreed pay is the monthly figure over the months');
  assert.ok(r.pay.salary > r.min.salary, 'above the casual per-day figure the job is judged by');
  assert.equal(r.debt.salary, 0);
});

test('a casual contract can take its vacation: paid days off, no vacation owed', () => {
  const casual = { contract: 'temporary', duration: 90, durationUnit: 'days', payAmount: 1500, payUnit: 'month' };
  const taken = figures({ ...casual, vacation: 'taken' });
  const apart = figures({ ...casual, vacation: 'paidAtEnd' });
  assert.ok(taken.min.casual);
  assert.equal(taken.min.vacation, 0);
  assert.equal(taken.debt.vacation, 0);
  assert.ok(taken.time.vacationTaken > 0, 'the days are paid days off');
  assert.ok(apart.min.vacation > 0);
});

test('a net amount asked for is the net calculated', () => {
  const r = figures({ payType: 'net', payAmount: 1500, payUnit: 'month', extraPays: 'included' });
  near(r.pay.net / 12, 1500, 0.5, 'net a month');
});

test('vacation included in the daily wage, or paid at the end', () => {
  const temporary = { contract: 'temporary', duration: 3, payAmount: 80, payUnit: 'day', extraPays: 'included' };
  const included = figures({ ...temporary, vacation: 'included' });
  const atEnd = figures({ ...temporary, vacation: 'paidAtEnd' });
  near(included.pay.gross, 80 * included.time.paidDays, 0.01, 'included: daily wage × paid days');
  near(atEnd.pay.gross, 80 * atEnd.time.paidDays + atEnd.pay.vacationPay, 0.01, 'at the end: plus the vacation');
});

test('a daily wage is paid for the whole days worked, plus the days off that are paid', () => {
  const base = {
    contract: 'seasonal',
    duration: 90,
    durationUnit: 'days',
    payAmount: 75,
    payUnit: 'day',
    payType: 'gross',
    extraPays: 'included',
  };
  // 90 days at 6 a week is 77.14 days: 77 are worked, and 77 are paid
  const nothingOff = figures({ ...base, daysOff: 1, daysOffUnit: 'week', holidays: 'no', vacation: 'included' });
  assert.equal(nothingOff.time.paidDays, nothingOff.time.daysWorked);
  near(nothingOff.pay.gross / nothingOff.time.daysWorked, 75, 0.001, 'exactly the daily wage per day worked');
  // Holidays taken off are paid on top of the days worked
  const holidaysOff = figures({ ...base, daysOff: 1, daysOffUnit: 'week', holidays: 'yes', vacation: 'included' });
  assert.ok(holidaysOff.time.paidDays > holidaysOff.time.daysWorked);
});

test('every sample offer adds up', () => {
  for (const o of offers) {
    const r = calc(o, { cfg, offers });
    near(incomeOf(r) - r.expenses.total, r.earnings.total, 0.01, `breakdown = total (${o.mine.name})`);
    if (!r.time.noDuration)
      near(r.earnings.perMonth * r.time.months, r.earnings.total, 0.01, `per month × months (${o.mine.name})`);
  }
});

const byName = (name) => offers.find((o) => o.mine.name === name);

test('what you earn leaves the unemployment benefit out, which stays apart', () => {
  const r = calc(byName('Puerto A'), { cfg, offers });
  assert.ok(r.unemployment.euros > 0);
  near(
    r.earnings.total,
    r.earnings.received + r.inKind.total + r.earnings.parts.severance - r.expenses.total,
    0.01,
    'total',
  );
  assert.equal('unemployment' in r.earnings.parts, false);
  assert.equal(
    calc(byName('Puerto A'), { cfg: { ...cfg, unemployment: false }, offers }).earnings.total,
    r.earnings.total,
  );
});

test('paro lost to money en negro: no contract, partly en negro below the maximum, and at the maximum', () => {
  const noContract = calc(byName('Sin contrato D'), { cfg, offers });
  assert.equal(noContract.unemployment.euros, 0);
  assert.ok(noContract.unemployment.lost.euros > 100, 'no contract loses the benefit the cash would give');
  const partly = calc(byName('Campaña B'), { cfg, offers });
  near(partly.unemployment.lost.euros, 30, 5, 'Campaña B');
  const maximum = calc(byName('Puerto A'), { cfg, offers });
  assert.ok(maximum.cash.total > 0);
  assert.equal(maximum.unemployment.lost.euros, 0);
  assert.equal(calc(byName('Invernada C'), { cfg, offers }).unemployment.lost.euros, 0);
});

test('unemployment benefit: 360 days contributed give 120 days', () => {
  near(unemploymentBenefit(20000, 360).days, 120, 0.01, 'days');
});

test('IRPF in 2026, with the minimum-wage deduction', () => {
  const ded = MIN_WAGE[2026].ded;
  assert.ok(irpfTax(17094, 6.5, ded) < 0.01, 'none on the minimum wage');
  near(irpfTax(20000, 6.5, ded), 1345, 2, 'on 20,000 €');
  near(Math.max(0, ded.max - (20048.45 - ded.from) * ded.taper), 0, 0.01, 'the deduction ends at 20,048.45 €');
});

test('without a contract: paid the minimum, only the vacation is owed', () => {
  const minimum = figures({ contract: 'none', payAmount: 0, cashAmount: 0, duration: 1 }).debt.minNetNoContract;
  const r = figures({
    contract: 'none',
    payAmount: 0,
    cashAmount: minimum,
    cashUnit: 'total',
    duration: 1,
    vacation: 'included',
  });
  assert.ok(r.debt.salary < 1, 'no salary owed');
  assert.ok(r.debt.vacation > 1, 'vacation owed');
});

test('sleeping out: the 25 % overnight bonus is owed', () => {
  const r = figures({ overnight: 'yes', province: 'HU' });
  near(r.debt.salary, 17094 * 0.25, 1, 'owed');
  assert.equal(r.stamp?.code, 'noOvernight');
});

test('stamp: no contract, all cash, and no stamp', () => {
  assert.equal(
    figures({ contract: 'none', payAmount: 0, cashAmount: 500, cashUnit: 'month' }).stamp?.code,
    'noContract',
  );
  const allCash = figures({ payAmount: 0, cashAmount: 2000, cashUnit: 'month' });
  assert.equal(allCash.stamp?.code, 'allCash');
  assert.equal(allCash.cash.allCash, true);
  assert.equal(figures().stamp, null);
});

test('cash: allCash only when payroll is negligible', () => {
  assert.equal(figures().cash.allCash, false);
  assert.equal(figures({ cashAmount: 300, cashUnit: 'month' }).cash.allCash, false);
});

test('cash: the employer saves the contributions', () => {
  const r = figures({ cashAmount: 300, cashUnit: 'month' });
  near(r.savings.cash, r.cash.grossEq * (1 + r.pay.rates.employerPct / 100) - r.cash.total, 0.01, 'savings');
});

test('63 h a week: extra time', () => {
  const r = figures({ hoursPerDay: 10.5, daysOff: 1, holidays: 'no' });
  near(r.extra.hours, r.time.hours - r.extra.normalHours, 0.01, 'extra = hours − normal');
  assert.ok(
    r.extra.daysUnpaid <= r.extra.daysValue + 0.01 && r.extra.overtimeUnpaid <= r.extra.overtimeValue + 0.01,
    'unpaid ≤ value',
  );
});

test('months as on the payslip: 102 days from 21 June are 3 months and 10 days', () => {
  near(payrollMonths(parseDate('2026-06-21'), 102), 10 / 3, 1e-9, 'months');
  const r = figures({
    start: '2026-06-21',
    duration: 102,
    durationUnit: 'days',
    payAmount: 2100,
    payType: 'net',
    extraPays: 'included',
  });
  near(r.pay.net, 7000, 1, '2,100 € net × 3⅓ months');
});

test('the payslips add up to the gross', () => {
  for (const o of offers) {
    if (!o.terms.start || o.mine.offerOnly) continue;
    const r = calc(o, { cfg, offers });
    const payslips = monthlyPayslips(o.terms, r);
    if (!payslips.length) continue;
    near(
      payslips.reduce((sum, x) => sum + x.gross, 0),
      r.pay.gross,
      0.5,
      `payslips (${o.mine.name})`,
    );
  }
});

test('the payslips split the salary into base and prorated extra pays, as the extra pays are told', () => {
  const split = (changes) => {
    const o = offerOf({ ...BASE, ...changes });
    const [first] = monthlyPayslips(o.terms, calc(o, { cfg, alone: true }));
    near(first.base + first.extraPays, first.salary, 0.001, 'they add up to the salary');
    return first;
  };
  // apart: the monthly pay and two twelfths of it; included: the amount is 14 pagas / 12, so base is 12/14 of it
  near(split({ extraPays: 'separate' }).extraPays, (1221 * 2) / 12, 0.01, 'separate');
  near(split({ extraPays: 'included' }).base, (1221 * 12) / 14, 0.01, 'included');
  assert.equal(split({ payUnit: 'day', payAmount: 50, extraPays: 'included' }).extraPays, 0);
});

// Functions (netOf…) are dropped, so two results compare by their figures
const figuresOf = (r) => JSON.stringify(r);

test('terms-only figures ignore every own field, and work from the terms alone', () => {
  const garbled = {
    name: 'x',
    rentValue: 900,
    car: 'own',
    commute: 'daily',
    tripsHome: 4,
    kmHome: 300,
    kmWorkPerDay: 50,
    expenses: 400,
    irpfMode: 'manual',
    irpfManual: 30,
  };
  for (const o of offers) {
    const expected = figuresOf(calcTermsOnly({ id: o.id, terms: o.terms }, { cfg }));
    assert.equal(figuresOf(calcTermsOnly(o, { cfg })), expected, o.mine.name);
    assert.equal(
      figuresOf(calcTermsOnly({ ...o, mine: { ...o.mine, ...garbled, name: o.mine.name } }, { cfg })),
      expected,
    );
  }
});

test('terms-only figures with no other earnings equal the normal ones for an offer with neutral own figures', () => {
  const neutral = { ...DEF_MINE, car: 'noCar', commute: 'liveIn' };
  for (const o of offers) {
    const own = { ...o, mine: { ...neutral, name: o.mine.name } };
    const plain = calc(own, { cfg: { ...cfg, others: 0 }, alone: true });
    assert.equal(figuresOf(calcTermsOnly(own, { cfg })), figuresOf(plain), o.mine.name);
    assert.equal(plain.car.cost, 0);
    assert.equal(plain.car.km, 0);
  }
});

test('terms-only drops what depends on the worker: travel, expenses and other earnings', () => {
  const o = offers.find((x) => num(x.mine.kmHome) > 0 || num(x.mine.expenses) > 0);
  assert.ok(o, 'a sample offer with own travel or expenses');
  const full = calc(o, { cfg, offers });
  const bare = calcTermsOnly(o, { cfg });
  assert.equal(bare.car.cost, 0);
  assert.ok(full.car.cost > 0 || num(o.mine.expenses) > 0);
});

test('claim deadlines: a year after the first month ends and after the last day', () => {
  const terms = { start: '2026-03-10', duration: 60, durationUnit: 'days' };
  const { from, until } = claimDeadlines(terms);
  assert.equal(from.toDateString(), parseDate('2027-03-31').toDateString());
  assert.equal(until.toDateString(), parseDate('2027-05-08').toDateString());
  assert.equal(claimDeadlines({ ...terms, start: '' }), null);
});

test('yearShares counts whole days, whatever the time zone (a daylight-saving change between the dates)', async () => {
  const { yearShares } = await import('../../src/model/calc.js');
  const zone = process.env.TZ;
  process.env.TZ = 'Europe/Madrid';
  try {
    const { DEF_TERMS } = await import('../../src/offer.js');
    const shares = yearShares({ ...DEF_TERMS, start: '2025-12-01', duration: 200, durationUnit: 'days' });
    assert.deepEqual(shares, { 2025: 31 / 200, 2026: 169 / 200 });
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});

test('sleeping out counts the bonus only where an agreement known for the province gives it', () => {
  const plain = figures();
  const huesca = figures({ overnight: 'yes', province: 'HU' });
  assert.ok(huesca.min.overnight > 0 && huesca.min.overnightAgreement?.pct === 25);
  near(huesca.min.overnight, huesca.min.salary * 0.25, 0.01, 'bonus');
  assert.ok(huesca.debt.total > plain.debt.total + 1, 'owed in Huesca');
  for (const province of ['Z', 'M', '']) {
    const r = figures({ overnight: 'yes', province });
    assert.equal(r.min.overnight, 0, `province «${province}»: no bonus`);
    assert.equal(r.min.overnightRate, 0);
    assert.equal(r.min.overnightAgreement, null);
    assert.equal(r.min.overnightStay, true, 'the night stay stays a fact of the offer');
    assert.equal(r.debt.total, plain.debt.total, 'nothing more owed');
    assert.equal(r.stamp?.code ?? null, plain.stamp?.code ?? null);
    near(r.extra.dayValue, plain.extra.dayValue, 0.001, 'a day is not worth more');
  }
  assert.ok(huesca.extra.dayValue > plain.extra.dayValue);
});

test("Huesca's agreement hours change the hourly figures and nothing else of a job", () => {
  const terms = { hoursPerDay: 10, daysOff: 1, payAmount: 1000 };
  const other = figures({ ...terms, province: 'Z' });
  const huesca = figures({ ...terms, province: 'HU' });
  const differing = [];
  const walk = (a, b, path) => {
    if (a && typeof a === 'object') for (const key of Object.keys(a)) walk(a[key], b?.[key], `${path}.${key}`);
    else if (typeof a !== 'function' && a !== b) differing.push(path);
  };
  walk(other, huesca, '');
  const hourly = [
    '.min.hourly',
    '.extra.dayValue',
    '.extra.daysValue',
    '.extra.overtimeValue',
    '.extra.overtimeUnpaid',
    '.extra.daysUnpaid',
  ];
  const unexpected = differing.filter(
    (path) => !hourly.includes(path) && !/^\.(extra\.overtimeUnpaidPerWeek|savings\.)/.test(path),
  );
  assert.deepEqual(unexpected, [], 'only the figures priced by the hour move');
  assert.ok(differing.includes('.min.hourly') && differing.includes('.extra.overtimeValue'));
  near(huesca.min.hourly, other.min.hourly * (1826 / 1760), 1e-9, 'hourly minimum');
  near(huesca.min.hourly, huesca.wage.annual / 1760, 1e-9, 'annual wage over 1,760 hours');
});

test('without a contract the job is measured as a fixed one (ET 15.4): monthly minimum, SS of «none», no severance', () => {
  // 60 days: a temporary contract this short would be measured against the casual daily figure
  const none = {
    contract: 'none',
    duration: 60,
    durationUnit: 'days',
    payAmount: '',
    cashAmount: 1000,
    cashUnit: 'month',
  };
  const r = figures(none);
  const wage = minWageOf(2026);
  const months = r.time.months;
  assert.equal(r.min.casual, false);
  near(
    r.min.salary,
    ((wage.annual * months) / 12) * Math.min(1, (r.time.workFrac * 7 * 8) / 40),
    0.01,
    'the monthly minimum, not the daily one',
  );
  assert.equal(r.pay.rates.workerPct, ssOf('none').workerPct);
  assert.notEqual(r.pay.rates.workerPct, ssOf('temporary').workerPct);
  assert.equal(r.employer.severance, 0);
  // the same 60 days with a temporary contract: the casual minimum, a severance
  const temporary = figures({ ...none, contract: 'temporary', payAmount: 1000, cashAmount: '', cashUnit: 'month' });
  assert.equal(temporary.min.casual, true);
  assert.ok(temporary.employer.severance > 0);
});

test('jobs of 2022 and 2023 are checked against their own minimum wage (RD 152/2022, RD 99/2023); earlier years say so', () => {
  const year = (y) => figures({ start: `${y}-03-01`, duration: 12, durationUnit: 'months' });
  assert.equal(year(2023).year, 2023);
  near(
    year(2023).min.salary,
    15120 * Math.min(1, (year(2023).time.workFrac * 7 * 8) / 40),
    0.01,
    '2023 monthly minimum',
  );
  assert.equal(year(2022).wage.annual, 14000);
  assert.equal(year(2022).wage.casual, 47.36);
  assert.equal(minWageOf(2023).casual, 51.15);
  assert.equal(year(2023).wageYearAsked, 2023);
  assert.equal(wageYearNote(year(2023)), '');
  assert.equal(
    wageYearNote(year(2021)),
    'La página no tiene el salario mínimo de 2021; se compara con el de 2022, más alto.',
  );
});

test('a vacation day owed or paid is worth the real daily pay, cash included, or the minimum wage’s if higher', () => {
  const wage = minWageOf(2026);
  const smiDay = wage.annual / LAW.smiDaysPerYear; // full time
  // payroll 1.800 a month and 500 en negro: the day is (1.800 + 500) / 30, and the vacation paid at the end is as many of them
  const mixed = figures({ payAmount: 1800, cashAmount: 500, cashUnit: 'month', vacation: 'paidAtEnd', holidays: 'no' });
  near(mixed.min.vacationDay, 2300 / 30, 0.01, 'a vacation day with the cash');
  near(mixed.min.vacation, mixed.time.vacationDays * (2300 / 30), 0.01, 'the vacation owed');
  // the payslip itself stays the payroll's: the cash cannot move it
  near(mixed.pay.vacationPay, mixed.time.vacationDays * (1800 / 30), 0.01, 'the vacation on the payslip');
  // without a contract, the cash is the pay
  const none = figures({
    contract: 'none',
    payAmount: 0,
    cashAmount: 1500,
    cashUnit: 'month',
    duration: 6,
    durationUnit: 'months',
    vacation: 'included',
  });
  near(none.min.vacationDay, 1500 / 30, 0.01, 'no contract: the cash day');
  assert.ok(none.debt.vacation > none.time.vacationDays * smiDay, 'above a day at the minimum wage');
  // never below the minimum wage's day
  const low = figures({ payAmount: 400, vacation: 'paidAtEnd', holidays: 'no' });
  near(low.min.vacationDay, smiDay, 0.01, 'the minimum wage’s day');
});

test('without a duration an offer is counted as one month, as step 2 says', () => {
  const r = figures({
    durationUnit: 'unknown',
    duration: '',
    payAmount: 1500,
    extraPays: 'included',
    vacation: 'taken',
  });
  assert.equal(r.time.noDuration, true);
  assert.equal(r.time.months, 1);
  near(r.pay.base, 1500, 0.01, 'one month of pay');
  assert.deepEqual(missing(offerOf({ ...BASE, durationUnit: 'unknown', duration: '' }).terms), []);
});

// Without a contract the job is measured as a fixed one: its vacation cannot go inside the pay (ET 38.1, 15.4)
test('without a contract, the vacation answer decides whether it is owed', () => {
  const none = (vacation) =>
    figures({
      contract: 'none',
      payAmount: 0,
      cashAmount: 70,
      cashUnit: 'day',
      duration: 40,
      durationUnit: 'days',
      holidays: 'no',
      vacation,
    });
  const included = none('included');
  assert.ok(included.debt.vacation > 100, 'inside the pay: still owed');
  near(none('').debt.vacation, included.debt.vacation, 0.001, 'no answer: owed as inside the pay');
  assert.equal(none('taken').debt.vacation, 0, 'taken: nothing owed');
  assert.equal(none('taken').min.vacation, 0);
  assert.ok(none('taken').time.vacationTaken > 0, 'taken: the days are off');
  const apart = none('paidAtEnd');
  assert.equal(apart.debt.vacation, 0, 'paid apart: nothing owed');
  near(apart.vacationApart, apart.min.vacation, 0.001, 'paid apart: at the minimum vacation');
  assert.ok(apart.earnings.parts.vacationPay > 0, 'paid apart: it is money received');
  assert.equal(apart.pay.gross, 0, 'still no payroll');
  assert.equal(included.vacationApart, 0);
});

// Cash per day pays the vacation days taken too, as the payslip's daily wage does: 7 days with 1 of them vacation = 7 × 70
test('cash per day counts the paid days, the vacation taken included', () => {
  const r = figures({
    contract: 'none',
    payAmount: 0,
    cashAmount: 70,
    cashUnit: 'day',
    start: '2026-11-09',
    duration: 7,
    durationUnit: 'days',
    daysOff: '',
    holidays: 'no',
    vacation: 'taken',
  });
  assert.equal(r.time.vacationTaken, 1);
  assert.equal(r.time.paidDays, 7);
  near(r.cash.total, 490, 0.001, 'cash agreed');
});
