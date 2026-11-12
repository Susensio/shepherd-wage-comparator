// settle(): what is owed month by month from the offer and the record (ADR-0032). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cents } from '../../src/ledger.js';
import { calc } from '../../src/model/calc.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG } from '../../src/offer.js';
import { normalizeOffer } from '../../src/schema.js';
import { offerOf } from './flat-offer.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const cfg = { ...DEF_CFG, ...sample.cfg };
const offers = sample.offers.map(normalizeOffer);
const ctx = { cfg, offers: [] };

const near = (actual, expected, what, tolerance = 0.005) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

// January to March 2026, whole calendar months (weights 1/3 each), at exactly the 2026 minimum wage when paid 1424.50 a month
const BASE = {
  id: 't',
  name: 't',
  start: '2026-01-01',
  contract: 'permanent',
  duration: 90,
  durationUnit: 'days',
  hoursPerDay: 8,
  daysOff: 2,
  daysOffUnit: 'week',
  holidays: 'no',
  payType: 'gross',
  payAmount: 1424.5,
  payUnit: 'month',
  extraPays: 'included',
  vacation: 'taken',
  housing: 'no',
  car: 'noCar',
  kmHome: 0,
  overnight: 'no',
  irpfMode: 'manual',
  irpfManual: 10,
};
const offerWith = (changes = {}) => offerOf({ ...BASE, ...changes });
const settleOf = (offer, record, today = '2026-04-15') => settle(offer, record, today, ctx);
// Payments are net: `amount` is the gross the payment is worth, taken off by this contract's withholdings
const NET = calc(offerOf(BASE), ctx).netFactor;
const payment = (id, date, gross, via = 'transfer') => ({ id, date, amount: gross * NET, via });
// A wage «al día» high enough that the monthly minimum never takes over, and vacation paid at the end
const perDay = (changes = {}) =>
  offerWith({ payUnit: 'day', payAmount: 100, vacation: 'paidAtEnd', daysOff: 0, ...changes });

test('with an empty record, settle gives the ficha’s figures for every sample offer', () => {
  let checked = 0;
  for (const offer of offers) {
    const { terms } = offer;
    const r = calc(offer, { cfg, offers });
    const x = settle(offer, {}, '2030-01-01', { cfg, offers });
    // Self-employed has no debts (ADR-0029). Without a contract everything paid is cash: the agreed pay is the cash as
    // the gross that brings it net, and the vacation is owed whatever the cash.
    if (terms.contract === 'selfEmployed') {
      assert.equal(x.totals.due, 0);
      continue;
    }
    assert.ok(x.rows.length, `${offer.mine.name} has no rows`);
    const name = offer.mine.name;
    const T = x.totals.items;
    const agreedSalary = r.noContract ? r.cash.total / r.netFactor : r.pay.salary;
    near(T.salary.agreed + T.overnight.agreed, cents(agreedSalary), `${name}: agreed salary`);
    near(T.vacation.agreed, cents(r.pay.vacationPay), `${name}: agreed vacation`);
    near(T.salary.minimum, cents(r.min.salary), `${name}: minimum salary`);
    near(T.overnight.minimum, cents(r.min.overnight), `${name}: minimum overnight`);
    near(T.salary.shortfall, cents(r.debt.parts.salary), `${name}: salary debt`);
    near(T.overnight.shortfall, cents(r.debt.parts.overnight), `${name}: overnight debt`);
    near(T.vacation.shortfall, cents(r.debt.parts.vacation), `${name}: vacation debt`);
    near(x.totals.shortfall, cents(r.debt.total), `${name}: debt`, 0.01);
    // With nothing received, everything due is owed
    near(x.totals.owed, x.totals.due, `${name}: owed`);
    checked++;
  }
  assert.ok(
    offers.some((o) => o.terms.contract === 'none'),
    'the samples include offers without a contract',
  );
  assert.equal(checked, offers.length);
});

test('the invariant also holds when the offer pays below the minimum', () => {
  for (const changes of [
    { payAmount: 1000 },
    { payAmount: 1000, overnight: 'yes' },
    { payAmount: 1300, overnight: 'yes' },
  ]) {
    const offer = offerWith(changes);
    const r = calc(offer, ctx);
    const x = settleOf(offer, {}, '2030-01-01');
    const T = x.totals.items;
    assert.ok(r.debt.total > 0);
    near(T.salary.shortfall, cents(r.debt.parts.salary), 'salary debt');
    near(T.overnight.shortfall, cents(r.debt.parts.overnight), 'overnight debt');
    near(x.totals.shortfall, cents(r.debt.total), 'debt', 0.01);
    near(T.salary.agreed + T.overnight.agreed, cents(r.pay.salary), 'agreed');
  }
});

test('the rows of every column add up to the totals as shown', () => {
  const x = settleOf(offerWith({ payAmount: 1000 }), { payments: [payment('a', '2026-02-01', 1500)] });
  for (const field of ['due', 'shortfall', 'received', 'owed']) {
    near(
      x.rows.reduce((sum, row) => sum + row[field], 0),
      x.totals[field],
      field,
      0.0001,
    );
  }
  for (const row of x.rows) near(row.due - row.received, row.owed, `${row.month} due - received`, 0.0001);
});

test('an offer without a start date has no months', () => {
  assert.deepEqual(settleOf(offerWith({ start: '' })).rows, []);
  assert.equal(settleOf(offerWith({ start: '' })).totals.owed, 0);
});

test('every month is an estimate until it is closed', () => {
  const x = settleOf(offerWith(), { months: { '2026-02': { closed: true, days: {} } } });
  assert.deepEqual(
    x.rows.map((row) => [row.month, row.closed, row.estimate]),
    [
      ['2026-01', false, true],
      ['2026-02', true, false],
      ['2026-03', false, true],
    ],
  );
});

test('a closed month takes its days as given, whatever the offer says', () => {
  const days = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1).padStart(2, '0'), 'work']));
  const x = settleOf(perDay(), { months: { '2026-01': { closed: true, days } } });
  const [january, february] = x.rows;
  assert.equal(january.facts.work, 10);
  assert.equal(january.facts.followingOffer, 0);
  assert.equal(january.items.salary.agreed, 1000); // 10 days at 100, not the 3000 the offer expects
  assert.equal(february.items.salary.agreed + february.items.overnight.agreed, 3000);
  // The legal minimum of a monthly salary does not shrink with the days worked
  assert.equal(january.items.salary.minimum, february.items.salary.minimum);
  assert.equal(january.items.salary.shortfall, cents(january.items.salary.minimum - 1000));
});

test('a closed month with no days listed pays nothing al día', () => {
  const x = settleOf(perDay(), { months: { '2026-03': { closed: true, days: {} } } });
  assert.equal(x.rows[2].items.salary.agreed, 0);
  assert.equal(x.rows[2].items.salary.due, x.rows[2].items.salary.minimum);
});

test('a touched day in an open month is a fact and the rest follows the offer', () => {
  const x = settleOf(perDay(), { months: { '2026-02': { days: { '03': 'off' } } } });
  const february = x.rows[1];
  assert.equal(february.estimate, true);
  assert.equal(february.facts.off, 1);
  near(february.facts.followingOffer, 27 / 28, 'share following the offer', 1e-9);
  // 30 days a month at 100, 27 of 28 days following the offer, the day off unpaid
  near(february.items.salary.agreed, 3000 * (27 / 28), 'February pay', 0.01);
  // Another day worked instead of off: that one counts in full
  const worked = settleOf(perDay(), { months: { '2026-02': { days: { '03': 'work' } } } }).rows[1];
  near(worked.items.salary.agreed, 3000 * (27 / 28) + 100, 'February pay with a day worked', 0.01);
});

test('days outside the offer’s span and unknown kinds are not facts', () => {
  const offer = perDay({ start: '2026-01-10', duration: 60 });
  const x = settleOf(offer, { months: { '2026-01': { days: { '05': 'work', 12: 'rest' } } } });
  assert.equal(x.rows[0].facts.work, 0);
  assert.equal(x.rows[0].facts.followingOffer, 1);
});

test('vacation is not a day mark: «vacation» is not a kind, and vacation taken follows the offer', () => {
  const month = { '2026-01': { closed: true, days: { '01': 'vacation', '02': 'work' } } };
  const taken = perDay({ vacation: 'taken' });
  const r = calc(taken, ctx);
  const x = settleOf(taken, { months: month }).rows[0];
  assert.equal(x.facts.work, 1);
  assert.equal(x.facts.off, 0);
  assert.equal(Object.hasOwn(x.facts, 'vacation'), false);
  // one day worked at 100, plus the month's share of the vacation taken, paid even in a closed month
  near(x.items.salary.agreed, 100 + (100 * r.time.vacationTaken * r.time.workFrac) / 3, 'agreed', 0.01);
  // paid at the end: the vacation is owed from the terms, whatever the days say
  const atEnd = settleOf(perDay(), { months: month });
  near(atEnd.totals.items.vacation.minimum, cents(calc(perDay(), ctx).min.vacation), 'vacation owed');
});

test('days worked above the due workdays are extra days, valued at the minimum wage, apart from what is owed', () => {
  const offer = offerWith();
  const r = calc(offer, ctx);
  const days = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [String(i + 1).padStart(2, '0'), 'work']));
  const x = settleOf(offer, { months: { '2026-01': { closed: true, days } } });
  const extra = x.rows[0].extraDays;
  near(extra.days, 31 - r.extra.due / 3, 'extra days', 0.001);
  near(extra.value, cents(extra.days * r.extra.dayValue), 'their value');
  assert.equal(x.rows[0].owed, settleOf(offer, {}).rows[0].owed);
});

test('payments go to the oldest unpaid month first, whatever the order they are listed in', () => {
  const offer = offerWith({ payAmount: 1000 }); // owed 1424.50 a month (the minimum)
  const x = settleOf(offer, {
    payments: [payment('b', '2026-02-10', 1000, 'payroll'), payment('a', '2026-01-10', 1424.5)],
  });
  assert.deepEqual(
    x.rows.map((row) => [row.received, row.owed]),
    [
      [1424.5, 0],
      [1000, 424.5],
      [0, 1424.5],
    ],
  );
  assert.equal(x.totals.received, 2424.5);
  assert.equal(x.totals.owed, 1849);
  assert.equal(x.totals.unassigned, 0);
});

test('one payment can cover several months, and what is left over is unassigned', () => {
  const offer = offerWith();
  const x = settleOf(offer, { payments: [payment('a', '2026-01-31', 3000)] });
  assert.equal(x.rows[0].owed, 0);
  assert.equal(x.rows[1].owed, 0);
  assert.equal(x.rows[2].owed, 1424.5 * 3 - 3000);
  const more = settleOf(offer, { payments: [payment('a', '2026-01-31', 5000)] });
  assert.equal(more.totals.owed, 0);
  assert.equal(more.totals.unassigned, 5000 - 1424.5 * 3);
});

test('payments are net: they are grossed up like the cash `calc` credits', () => {
  const offer = offerWith({ payAmount: 1000 });
  const r = calc(offer, ctx);
  assert.ok(r.netFactor > 0.8 && r.netFactor < 0.9);
  const net = 1000;
  const x = settleOf(offer, { payments: [{ id: 'a', date: '2026-01-31', amount: net, via: 'payroll' }] });
  near(x.rows[0].received, cents(net / r.netFactor), 'gross equivalent', 0.01);
  near(x.rows[0].items.salary.declared, cents(net / r.netFactor), 'declared', 0.01);
  const cash = settleOf(offer, { payments: [{ id: 'a', date: '2026-01-31', amount: net, via: 'cash' }] });
  assert.equal(cash.totals.cash, net); // cash is reported as handed
  near(cash.totals.received, cents(net / r.netFactor), 'cash grossed up the same', 0.01);
});

test('the legality flag compares the gross equivalent of the declared money with the minimum', () => {
  const offer = offerWith({ payAmount: 1424.5 });
  const r = calc(offer, ctx);
  const paid = (net) => settleOf(offer, { payments: [{ id: 'a', date: '2026-01-31', amount: net, via: 'transfer' }] });
  // Net of exactly the minimum: not below. A cent of gross less: below
  assert.equal(paid(1424.5 * r.netFactor).rows[0].belowMinimumOnPayroll, 0);
  near(paid((1424.5 - 100) * r.netFactor).rows[0].belowMinimumOnPayroll, 100, 'below by', 0.01);
});

test('an underway offer with no known end has a row per month from its start to the month of today', () => {
  const offer = offerWith({ start: '2026-01-20', durationUnit: 'unknown' });
  const r = calc(offer, ctx);
  const x = settleOf(offer, {}, '2026-03-10');
  assert.deepEqual(
    x.rows.map((row) => [row.month, row.from, row.to, row.estimate]),
    [
      ['2026-01', '2026-01-20', '2026-01-31', true],
      ['2026-02', '2026-02-01', '2026-02-28', true],
      ['2026-03', '2026-03-01', '2026-03-31', true], // the month in progress, due at its end
    ],
  );
  // The first month is partial at 1/30 a day: 12 days; the others are whole months of the monthly pay
  near(
    x.rows[0].items.salary.agreed + x.rows[0].items.overnight.agreed,
    cents((r.pay.salary * 12) / 30),
    'first month',
    0.01,
  );
  near(x.rows[1].items.salary.agreed, cents(r.pay.salary), 'a whole month', 0.01);
  assert.equal(settleOf(offer, {}, '2026-01-19').rows.length, 0);
  assert.equal(settleOf(offerWith({ start: '', durationUnit: 'unknown' }), {}, '2026-03-10').rows.length, 0);
  // Closing a month works as for any other
  const closed = settleOf(offer, { months: { '2026-02': { closed: true, days: {} } } }, '2026-03-10');
  assert.equal(closed.rows[1].closed, true);
});

test('cash is reported apart and counts as received like any other payment', () => {
  const offer = offerWith({ payAmount: 1000 });
  const without = settleOf(offer, {});
  const x = settleOf(offer, {
    payments: [payment('a', '2026-01-31', 600, 'cash'), payment('b', '2026-02-05', 400, 'cash')],
  });
  near(x.totals.cash, 1000 * NET, 'cash as handed', 0.01);
  assert.equal(x.totals.received, 1000);
  assert.equal(x.totals.owed, cents(without.totals.owed - 1000));
  assert.equal(x.rows[0].received, 1000); // oldest month first, with the cash too
});

test('cash covers what is owed but the pay on payroll alone can still be below the minimum', () => {
  const offer = offerWith({ payAmount: 1424.5 }); // minimum 1424.50 a month
  const cashOnly = settleOf(offer, { payments: [payment('a', '2026-01-31', 1424.5, 'cash')] });
  assert.equal(cashOnly.rows[0].owed, 0);
  assert.equal(cashOnly.rows[0].belowMinimumOnPayroll, 1424.5);
  const declared = settleOf(offer, { payments: [payment('a', '2026-01-31', 1424.5, 'payroll')] });
  assert.equal(declared.rows[0].owed, 0);
  assert.equal(declared.rows[0].belowMinimumOnPayroll, 0);
  const mixed = settleOf(offer, {
    payments: [payment('a', '2026-01-31', 1000, 'transfer'), payment('b', '2026-01-31', 424.5, 'cash')],
  });
  assert.equal(mixed.rows[0].owed, 0);
  assert.equal(mixed.rows[0].items.salary.belowMinimumOnPayroll, 424.5);
  assert.equal(mixed.totals.belowMinimumOnPayroll, 424.5 + 1424.5 * 2);
});

test('a surplus in one item does not cover a shortfall in another', () => {
  // The salary is agreed well above the minimum; the vacation paid at the end is agreed at nothing
  const offer = offerWith({ payAmount: 3000, vacation: 'paidAtEnd', vacationGross: 0 });
  const r = calc(offer, ctx);
  assert.ok(r.debt.vacation > 0 && r.debt.parts.salary === 0);
  const x = settleOf(offer, {});
  const T = x.totals.items;
  assert.ok(T.salary.agreed > T.salary.minimum * 2 - 1);
  assert.equal(T.salary.shortfall, 0);
  near(T.vacation.shortfall, cents(r.debt.vacation), 'vacation shortfall');
  assert.equal(x.totals.shortfall, T.vacation.shortfall);
  // The vacation falls due in the last month, with the final settlement
  assert.equal(x.rows[0].items.vacation.due, 0);
  assert.equal(x.rows[2].items.vacation.due, T.vacation.minimum);
});

test('a short closed month is owed on its own, whatever the others pay', () => {
  // Paid 3000 a month for January, February and March, but closed months of al día pay below the minimum
  const days = { '01': 'work' };
  const x = settleOf(perDay(), { months: { '2026-02': { closed: true, days } } });
  assert.ok(x.rows[1].items.salary.shortfall > 0);
  assert.equal(x.rows[0].items.salary.shortfall, 0);
  assert.equal(x.rows[1].items.salary.due, x.rows[1].items.salary.minimum);
  assert.equal(x.totals.shortfall, x.rows[1].shortfall);
});

test('each month with something owed carries its claim deadline, a year after it was due', () => {
  const offer = offerWith({ payAmount: 1000 });
  const x = settleOf(offer, { payments: [payment('a', '2026-01-31', 1424.5)] }, '2027-02-15');
  assert.deepEqual(
    x.rows.map((row) => [row.dueDate, row.deadline, row.lapsed]),
    [
      ['2026-01-31', null, false],
      ['2026-02-28', '2027-02-28', false],
      ['2026-03-31', '2027-03-31', false],
    ],
  );
  const late = settleOf(offer, {}, '2027-03-01');
  assert.deepEqual(
    late.rows.map((row) => row.lapsed),
    [true, true, false],
  );
  assert.equal(late.totals.owed, 1424.5 * 3);
  assert.equal(late.totals.claimable, 1424.5);
});

test('the last month is due at the offer’s end, not the end of the calendar month', () => {
  const x = settleOf(offerWith({ start: '2026-01-10', duration: 40 }), {});
  assert.deepEqual(
    x.rows.map((row) => [row.from, row.to, row.dueDate]),
    [
      ['2026-01-10', '2026-01-31', '2026-01-31'],
      ['2026-02-01', '2026-02-18', '2026-02-18'],
    ],
  );
});

test('self-employed work has no labour-law debts', () => {
  const offer = offerWith({ contract: 'selfEmployed' });
  const x = settleOf(offer, {});
  assert.equal(x.totals.due, 0);
  assert.equal(x.totals.owed, 0);
});

test('settle does not change the record or the offer it is given', () => {
  const offer = offerWith({ payAmount: 1000 });
  const record = {
    months: { '2026-01': { closed: true, days: { '01': 'work' } } },
    payments: [payment('a', '2026-02-01', 5)],
  };
  const before = JSON.stringify([offer, record]);
  settleOf(offer, record);
  assert.equal(JSON.stringify([offer, record]), before);
});
