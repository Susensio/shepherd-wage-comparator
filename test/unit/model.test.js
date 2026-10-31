// The calculations, checked against figures worked out by hand from the law. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { num } from '../../src/format.js';
import { MIN_WAGE } from '../../src/law.js';
import { calc, calcTermsOnly } from '../../src/model/calc.js';
import { monthlyPayslips } from '../../src/model/payslips.js';
import { irpfTax, unemploymentBenefit } from '../../src/model/tax.js';
import { payrollMonths } from '../../src/model/time.js';
import { DEF_CFG, DEF_MINE, parseDate } from '../../src/offer.js';
import { normalizeOffer } from '../../src/saved.js';
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

test('a net amount asked for is the net calculated', () => {
  const r = figures({ payType: 'net', payAmount: 1500, payUnit: 'month', extraPays: 'included' });
  near(r.pay.net / 12, 1500, 0.5, 'net a month');
});

test('vacation included in the daily wage, or paid at the end', () => {
  const temporary = { contract: 'temporary', duration: 3, payAmount: 80, payUnit: 'day', extraPays: 'included' };
  const included = figures({ ...temporary, vacation: 'included' });
  const atEnd = figures({ ...temporary, vacation: 'paidAtEnd' });
  near(included.pay.gross, 80 * included.time.natDays * (5 / 7), 1, 'included: daily wage × paid days');
  near(atEnd.pay.gross, 80 * atEnd.time.natDays * (5 / 7) + atEnd.pay.vacationPay, 1, 'at the end: plus the vacation');
});

test('every sample offer adds up', () => {
  for (const o of offers) {
    const r = calc(o, { cfg, offers });
    near(incomeOf(r) - r.expenses.total, r.earnings.total, 0.01, `breakdown = total (${o.mine.name})`);
    if (!r.time.noDuration)
      near(r.earnings.perMonth * r.time.months, r.earnings.total, 0.01, `per month × months (${o.mine.name})`);
  }
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
  const r = figures({ contract: 'none', payAmount: 0, cashAmount: minimum, cashUnit: 'total', duration: 1 });
  assert.ok(r.debt.salary < 1, 'no salary owed');
  assert.ok(r.debt.vacation > 1, 'vacation owed');
});

test('sleeping out: the 25 % overnight bonus is owed', () => {
  const r = figures({ overnight: 'yes' });
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
    if (!o.terms.start || o.terms.offerOnly) continue;
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
