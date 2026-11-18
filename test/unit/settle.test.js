// settle(): what is owed month by month from the offer and the record (ADR-0032). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cents } from '../../src/ledger.js';
import { standingOf } from '../../src/model/accounts.js';
import { calc } from '../../src/model/calc.js';
import { claimSteps } from '../../src/model/claim.js';
import { marksOf } from '../../src/model/record.js';
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
const settleOf = (offer, record, today = '2026-04-15') => settle(offer, record, today, calc(offer, ctx));
// Payments are net: `amount` is the gross the payment is worth, taken off by this contract's withholdings
const NET = calc(offerOf(BASE), ctx).netFactor;
const payment = (id, date, gross, via = 'payroll') => ({ id, date, amount: gross * NET, via });
// A wage «al día» high enough that the monthly minimum never takes over, and vacation paid at the end
const perDay = (changes = {}) =>
  offerWith({ payUnit: 'day', payAmount: 100, vacation: 'paidAtEnd', daysOff: 0, ...changes });

test('vacation accrues pro rata, exactly: 2.5 days a month, no rounding to whole days', () => {
  const offer = offerWith({ contract: 'temporary', payAmount: 1500, duration: 20 });
  const { time } = calc(offer, ctx);
  near(time.vacationDays, (30 * time.months) / 12, 'days accrued', 1e-9);
  assert.ok(Math.abs(time.vacationDays - Math.round(time.vacationDays)) > 0.01, 'not a whole number');
});

test('with an empty record, settle gives the ficha’s figures for every sample offer', () => {
  let checked = 0;
  for (const offer of offers) {
    const { terms } = offer;
    const r = calc(offer, { cfg, offers });
    const x = settle(offer, {}, '2030-01-01', calc(offer, { cfg, offers }));
    // Self-employed has no debts (ADR-0029). Without a contract everything paid is cash: the agreed pay is the cash as
    // the gross that brings it net, and the vacation is owed whatever the cash.
    if (terms.contract === 'selfEmployed') {
      assert.equal(x.totals.due, 0);
      continue;
    }
    assert.ok(x.rows.length, `${offer.mine.name} has no rows`);
    const name = offer.mine.name;
    const T = x.totals.items;
    // The agreed pay is payroll plus the agreed cash as the gross that brings it net, as `calc` credits it (nothing but
    // cash without a contract, where `calc` brings it to gross through the net factor)
    const agreedSalary = r.noContract ? r.cash.total / r.netFactor : r.pay.salary + r.cash.grossEq;
    // (cash above what the minimum needs moves into a vacation valued at the real daily pay, cash included)
    near(
      T.salary.agreed + T.overnight.agreed + T.vacation.agreed,
      cents(agreedSalary + r.pay.vacationPay + r.vacationApart),
      `${name}: agreed salary and vacation`,
      0.02, // each item is rounded to the cent on its own
    );
    near(T.salary.minimum, cents(r.min.salary), `${name}: minimum salary`);
    near(T.overnight.minimum, cents(r.min.overnight), `${name}: minimum overnight`);
    // The debt after the cash, as the ficha shows what is owed (`r.debt.owed`), to the cent. By item only where no cash
    // is involved: `calc` has no item split of what the cash covers.
    if (r.cash.total === 0 || r.noContract) {
      near(T.salary.shortfall, cents(r.debt.parts.salary), `${name}: salary debt`);
      near(T.overnight.shortfall, cents(r.debt.parts.overnight), `${name}: overnight debt`);
      near(T.vacation.shortfall, cents(r.debt.parts.vacation), `${name}: vacation debt`);
    }
    // (the ficha's debt is the pay's; the severance at the end of a temporary contract is due on top, ET 49.1.c)
    near(x.totals.shortfall - T.severance.shortfall, cents(r.debt.owed), `${name}: debt after cash`, 0.01);
    near(T.severance.due, r.noContract ? 0 : cents(r.employer.severance), `${name}: severance`);
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
    { payAmount: 1000, overnight: 'yes', province: 'HU' },
    { payAmount: 1300, overnight: 'yes', province: 'HU' },
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
  assert.equal(february.items.salary.agreed + february.items.overnight.agreed, 2800); // 28 days at 100
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
  // 28 days at 100, the day off unpaid
  near(february.items.salary.agreed, 2700, 'February pay', 0.01);
  // Another day worked instead of off: that one counts in full
  const worked = settleOf(perDay(), { months: { '2026-02': { days: { '03': 'work' } } } }).rows[1];
  near(worked.items.salary.agreed, 2800, 'February pay with a day worked', 0.01);
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
    payments: [payment('b', '2026-02-10', 1000, 'payroll'), payment('a', '2026-01-10', 1424.5, 'cash')],
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

test('cash is received but not declared', () => {
  const offer = offerWith({ payAmount: 1424.5 });
  const x = settleOf(offer, {
    payments: [payment('a', '2026-01-31', 1000, 'payroll'), payment('b', '2026-01-31', 424.5, 'cash')],
  });
  assert.equal(x.rows[0].owed, 0);
  assert.equal(x.rows[0].items.salary.belowMinimumOnPayroll, 424.5);
  near(x.totals.cash, 424.5 * NET, 'cash as handed', 0.01);
  const both = settleOf(offer, {
    payments: [payment('a', '2026-01-31', 100, 'cash'), payment('b', '2026-02-01', 200, 'cash')],
  });
  near(both.totals.cash, 300 * NET, 'cash', 0.01);
});

test('the legality flag compares the gross equivalent of the declared money with the minimum', () => {
  const offer = offerWith({ payAmount: 1424.5 });
  const r = calc(offer, ctx);
  const paid = (net) => settleOf(offer, { payments: [{ id: 'a', date: '2026-01-31', amount: net, via: 'payroll' }] });
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
      ['2026-03', '2026-03-01', '2026-03-10', true], // the month in progress, counted up to today
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
    payments: [payment('a', '2026-01-31', 1000, 'payroll'), payment('b', '2026-01-31', 424.5, 'cash')],
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

// Agreed in cash (en negro): part of the pay the minimum is compared with
const cashGrossOf = (offer) => calc(offer, ctx).cash.grossEq;
const withCash = (changes = {}) => offerWith({ cashMode: 'amount', cashAmount: 500, cashUnit: 'month', ...changes });

test('the cash agreed is part of what is due, as the gross that brings it net, and is exposed net per month', () => {
  const offer = withCash({ payAmount: 1424.5 });
  const x = settleOf(offer, {});
  const plain = settleOf(offerWith({ payAmount: 1424.5 }), {});
  for (const row of x.rows) {
    assert.equal(row.agreedCash, 500);
    near(
      row.due - plain.rows[0].due,
      cents(calc(offer, ctx).cash.grossEq / 3),
      'cash adds its gross equivalent to what is due',
      0.011,
    );
  }
  assert.equal(x.totals.agreedCash, 1500);
});

test('cash and payroll are one pool: together they cover the minimum, and cobros still reduce what is owed', () => {
  const short = settleOf(offerWith({ payAmount: 1000 }), {});
  assert.ok(short.totals.shortfall > 0);
  const covered = settleOf(withCash({ payAmount: 1000 }), {});
  assert.equal(covered.totals.shortfall, 0); // 1000 + 500 / NET is over 1424.50
  const r = calc(withCash({ payAmount: 1000 }), ctx);
  near(covered.totals.shortfall, r.debt.owed, 'what the ficha shows as owed after cash', 0.01);
  // Due with and without cobros: cash received reduces owed as before
  const paid = settleOf(withCash({ payAmount: 1000 }), { payments: [payment('a', '2026-01-31', 1000, 'cash')] });
  near(paid.totals.owed, covered.totals.due - 1000, 'owed', 0.011);
  assert.equal(paid.totals.cash, 1000 * NET);
  // Legality stays on the declared pay alone
  const none = settleOf(withCash({ payAmount: 1000 }), { payments: [payment('a', '2026-01-31', 800, 'payroll')] });
  assert.ok(none.rows[0].items.salary.belowMinimumOnPayroll > 0);
});

test('cash per day worked follows the days of a closed month', () => {
  const offer = perDay({ cashMode: 'amount', cashAmount: 20, cashUnit: 'day', start: '2026-01-01', duration: 31 });
  const open = settleOf(offer, {}, '2026-03-01');
  const days = {};
  for (let d = 1; d <= 31; d++) days[String(d).padStart(2, '0')] = d <= 10 ? 'work' : 'off';
  const closed = settleOf(offer, { months: { '2026-01': { closed: true, days } } }, '2026-03-01');
  near(closed.rows[0].agreedCash, 200, 'ten days at 20 in hand');
  assert.ok(open.rows[0].agreedCash > closed.rows[0].agreedCash);
  assert.ok(closed.rows[0].due < open.rows[0].due);
});

test('the cash of the sample offers is the cash of the ficha, month by month', () => {
  let seen = 0;
  for (const offer of offers) {
    const r = calc(offer, { cfg, offers });
    if (!(r.cash.total > 0)) continue;
    const x = settle(offer, {}, '2030-01-01', calc(offer, { cfg, offers }));
    near(x.totals.agreedCash, cents(r.cash.total), `${offer.mine.name}: agreed cash`, 0.01);
    seen++;
  }
  assert.ok(seen >= 3);
});

test('cash also covers a vacation shortfall, as in calc: the debt after cash agrees with the ficha to the cent', () => {
  // Salary short, vacation short too, and a cash that covers part of both
  const offer = offerWith({
    payAmount: 1000,
    vacation: 'included',
    cashMode: 'amount',
    cashAmount: 400,
    cashUnit: 'month',
  });
  const r = calc(offer, ctx);
  assert.ok(r.debt.vacation > 0 && r.debt.owed > 0 && r.debt.owed < r.debt.total, 'the case has both shortfalls');
  const x = settleOf(offer, {});
  near(x.totals.shortfall, r.debt.owed, 'the debt after cash', 0.01);
  // Nothing but the cash moved between items: what is due is the pay, the cash and what the cash did not cover
  const plain = settleOf(offerWith({ payAmount: 1000, vacation: 'included' }), {});
  near(x.totals.due, plain.totals.due + r.cash.grossEq - (plain.totals.shortfall - x.totals.shortfall), 'due', 0.02);
});

test('paying exactly the cash agreed leaves nothing of it owed', () => {
  const offer = withCash({ payAmount: 1424.5 });
  const x = settleOf(offer, { payments: [{ id: 'a', date: '2026-01-31', amount: 500, via: 'cash' }] });
  const plain = settleOf(withCash({ payAmount: 1424.5 }), {});
  near(plain.rows[0].due - x.rows[0].owed, calc(offer, ctx).cash.grossEq / 3, 'the first month is paid by it', 0.011);
});

// The job as it really was: days beyond the offer's end, and closed months that end early (ADR-0032)
const workOn = (month, days, closed = false) => ({
  [month]: { closed, days: Object.fromEntries(days.map((d) => [String(d).padStart(2, '0'), 'work'])) },
});
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('no extension without a day worked: a month after the offer with nothing worked is ignored', () => {
  const x = settleOf(offerWith(), { months: { '2026-04': { closed: true, days: { '01': 'off', '02': 'off' } } } });
  assert.equal(x.rows.length, 3);
  assert.equal(x.job.differs, false);
});

test('a day worked after the offer’s end extends the job; a wage per day pays the day rate for each day worked', () => {
  const offer = perDay();
  const plain = settleOf(offer, {});
  const x = settleOf(offer, { months: workOn('2026-04', [1, 2]) });
  assert.equal(x.rows.length, 4);
  const april = x.rows[3];
  assert.equal(april.extension, true);
  assert.equal(april.facts.work, 2);
  assert.equal(april.from, '2026-04-01');
  assert.equal(april.to, '2026-04-02');
  assert.equal(april.calendarTo, '2026-04-30'); // the calendar shows the whole month
  assert.equal(april.items.salary.agreed + april.items.overnight.agreed, 200);
  // The months of the offer are as they were
  assert.deepEqual(
    x.rows.slice(0, 3).map((row) => row.items.salary.agreed),
    plain.rows.map((row) => row.items.salary.agreed),
  );
  assert.deepEqual(x.job, {
    from: '2026-01-01',
    to: '2026-04-02',
    offerFrom: '2026-01-01',
    offerTo: '2026-03-31',
    differs: true,
  });
});

test('a monthly wage pays one thirtieth of the month for each day of the period, rest days inside it included', () => {
  const x = settleOf(offerWith(), { months: workOn('2026-04', [1, 10]) }, '2026-11-12');
  const april = x.rows[3];
  assert.equal(april.to, '2026-04-10');
  near(april.items.salary.agreed + april.items.overnight.agreed, (1424.5 * 10) / 30, 'ten days of the period', 0.01);
  // The last day of the period decides it, not how many days were worked
  const later = settleOf(offerWith(), { months: workOn('2026-04', [20]) }, '2026-11-12');
  near(
    later.rows[3].items.salary.agreed + later.rows[3].items.overnight.agreed,
    (1424.5 * 20) / 30,
    'twenty days',
    0.01,
  );
});

test('an extension across two months pays the whole first and the part of the second; the months between are included', () => {
  const x = settleOf(offerWith(), { months: { ...workOn('2026-04', [3]), ...workOn('2026-06', [5]) } }, '2026-11-12');
  assert.deepEqual(
    x.rows.map((row) => row.month),
    ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
  );
  const pay = (row) => row.items.salary.agreed + row.items.overnight.agreed;
  near(pay(x.rows[3]), 1424.5, 'April whole', 0.01);
  near(pay(x.rows[4]), 1424.5, 'May whole, though nothing is marked in it', 0.01);
  near(pay(x.rows[5]), (1424.5 * 5) / 30, 'June to the 5th', 0.01);
  assert.equal(x.job.to, '2026-06-05');
});

test('the offer’s own last month, worked beyond its end, goes on to the day worked', () => {
  const offer = offerWith({ duration: 75 }); // ends on 16 March
  const x = settleOf(offer, { months: workOn('2026-03', [25]) });
  assert.equal(x.rows.length, 3);
  assert.equal(x.rows[2].to, '2026-03-25');
  const plain = settleOf(offer, {});
  assert.ok(x.rows[2].items.salary.agreed > plain.rows[2].items.salary.agreed);
});

test('libre days at the start or the end of a closed month inside the offer’s dates do not cut the pay', () => {
  const pay = (row) => row.items.salary.agreed + row.items.overnight.agreed;
  const February = Object.fromEntries(range(1, 28).map((d) => [String(d).padStart(2, '0'), d >= 27 ? 'off' : 'work']));
  const x = settleOf(offerWith(), { months: { '2026-02': { closed: true, days: February } } });
  near(pay(x.rows[1]), 1424.5, 'two libres on 27–28 Feb leave the month whole', 0.01);
  // The first month starting with rests, and a closed month with no day worked after the last open one: all whole
  const closed = { ...workOn('2026-01', range(10, 31), true), ...workOn('2026-03', range(1, 20), true) };
  const y = settleOf(offerWith(), { months: closed });
  assert.deepEqual(y.rows.map(pay), [1424.5, 1424.5, 1424.5]);
  assert.deepEqual([y.job.from, y.job.to, y.job.differs], ['2026-01-01', '2026-03-31', false]);
});

test('a job ends early only by the end the shepherd said: closed months without a day worked stay in it', () => {
  const closedAll = {
    ...workOn('2026-01', range(1, 31), true),
    ...workOn('2026-02', range(1, 10), true),
    '2026-03': { closed: true, days: {} },
  };
  const pay = (row) => row.items.salary.agreed + row.items.overnight.agreed;
  const x = settleOf(offerWith(), { months: closedAll });
  assert.deepEqual(x.rows.map(pay), [1424.5, 1424.5, 1424.5]);
  const said = settleOf(offerWith(), { months: closedAll, end: { how: 'agreed', date: '2026-02-10' } });
  assert.equal(said.rows.length, 2);
  near(pay(said.rows[1]), (1424.5 * 10) / 30, 'February to the 10th', 0.01);
});

test('an end said after the offer’s end extends the job: the days to it are worked unless marked otherwise', () => {
  const offer = perDay(); // 1 Jan – 31 Mar, 100 € a day, no days off
  const record = { end: { how: 'agreed', date: '2026-04-10' } };
  const x = settleOf(offer, record, '2026-11-12');
  assert.equal(x.rows.length, 4);
  assert.equal(x.rows[3].to, '2026-04-10');
  assert.equal(x.rows[3].items.salary.agreed + x.rows[3].items.overnight.agreed, 1000); // ten days at 100
  assert.equal(x.job.to, '2026-04-10');
  // a day marked libre is not worked
  const off = settleOf(offer, { ...record, months: { '2026-04': { days: { '05': 'off' } } } }, '2026-11-12');
  assert.equal(off.rows[3].items.salary.agreed + off.rows[3].items.overnight.agreed, 900);
  // the calendar shows them as worked
  const marks = marksOf(offer, record, { key: '2026-04', from: '2026-04-01', to: '2026-04-30' });
  assert.deepEqual([marks[9].kind, marks[10].kind], ['work', 'off']);
});

test('the empty-record invariant still holds with the trimming in place: nothing marked, nothing moves', () => {
  const x = settleOf(offerWith(), {});
  assert.equal(x.job.differs, false);
  assert.equal(
    x.rows.every((row) => !row.extension),
    true,
  );
});

// The month in progress counts up to today (Hasta hoy)
test('a wage per day: the month in progress counts the days worked so far, marked or following the offer', () => {
  const offer = perDay();
  const x = settleOf(offer, {}, '2026-02-10');
  assert.equal(x.rows[1].to, '2026-02-10');
  assert.equal(x.rows[1].items.salary.agreed + x.rows[1].items.overnight.agreed, 1000); // ten days at 100
  // A day marked libre in it is one day less; the later days of the month are not counted
  const free = settleOf(offer, { months: { '2026-02': { days: { '04': 'off' } } } }, '2026-02-10');
  assert.equal(free.rows[1].items.salary.agreed + free.rows[1].items.overnight.agreed, 900);
  // The whole month on its last day
  assert.equal(settleOf(offer, {}, '2026-02-28').rows[1].items.salary.agreed, 2800); // February has 28 days
  // The months not started are left whole
  assert.equal(x.rows[2].to, '2026-03-31');
});

test('a monthly wage: one thirtieth of the month for each elapsed day, and the vacation and the cash in proportion', () => {
  const offer = withCash({ payAmount: 1424.5, vacation: 'taken' }); // (paid at the end, the cash would also move into the vacation)
  const x = settleOf(offer, {}, '2026-02-10');
  near(
    x.rows[1].items.salary.agreed + x.rows[1].items.overnight.agreed,
    (1424.5 * 10) / 30 + (cashGrossOf(offer) * 10) / (30 * 3),
    'ten days of February',
    0.02,
  );
  near(x.rows[1].agreedCash, (500 * 10) / 30, 'the cash of ten days', 0.01);
});

test('with an empty record the figures of a finished job are as before: the running month is whole once it has ended', () => {
  const full = settleOf(offerWith(), {}, '2026-04-15');
  const mid = settleOf(offerWith(), {}, '2026-02-10');
  assert.equal(full.totals.due, settleOf(offerWith(), {}, '2030-01-01').totals.due);
  assert.ok(mid.rows[1].due < full.rows[1].due);
});

test('the overnight bonus enters the accounts only in Huesca; the ledgers add up either way', () => {
  for (const [province, counted] of [
    ['HU', true],
    ['Z', false],
    ['', false],
  ]) {
    const offer = offerWith({ payAmount: 1000, overnight: 'yes', province });
    const r = calc(offer, ctx);
    const T = settleOf(offer, {}, '2030-01-01').totals;
    assert.equal(r.min.overnight > 0, counted, province);
    assert.equal(T.items.overnight.minimum > 0, counted, `${province}: minimum`);
    assert.equal(T.items.overnight.shortfall > 0, counted, `${province}: shortfall`);
    near(T.items.overnight.minimum, cents(r.min.overnight), `${province}: minimum overnight`);
    near(T.shortfall, cents(r.debt.total), `${province}: debt`, 0.01);
  }
});

test('the claim dates from the earliest month the cobros dated by its due date did not cover, not from the oldest-first leftover', () => {
  // October never paid, November to March paid at each month's end: the shortfall is October's, lapsed on 31 Oct 2026
  const offer = offerWith({ start: '2025-10-01', duration: 182 });
  const paid = ['2025-11-30', '2025-12-31', '2026-01-31', '2026-02-28', '2026-03-31'].map((date, i) =>
    payment(`p${i}`, date, 1424.5),
  );
  const x = settleOf(offer, { payments: paid }, '2026-11-15');
  assert.equal(x.totals.owed, 1424.5); // the total owed does not change
  assert.deepEqual(
    x.rows.filter((row) => row.owed > 0).map((row) => [row.month, row.deadline, row.lapsed]),
    [['2026-03', '2026-10-31', true]],
  );
  // what the screens say follows it: the nearest claim and the ladder's `by`
  const net = calc(offer, ctx).netFactor;
  const standing = standingOf(x, '2026-11-15', 'finished', paid, net);
  assert.equal(standing.nearest?.deadline, '2026-10-31');
  assert.equal(claimSteps({ today: '2026-11-15', standing, end: undefined, marks: {} }).by, null); // lapsed: none left
  // paid on time, one month short: the deadline is that month's own
  const onTimePaid = ['2025-10-31', '2025-11-30', '2025-12-31', '2026-01-31', '2026-02-28'].map((date, i) =>
    payment(`o${i}`, date, 1424.5),
  );
  const onTime = settleOf(offer, { payments: [...onTimePaid, payment('q', '2026-03-31', 1000)] }, '2026-11-15');
  assert.deepEqual(
    onTime.rows.filter((row) => row.owed > 0).map((row) => [row.month, row.deadline]),
    [['2026-03', '2027-03-31']],
  );
});

test('a temporary contract owes severance at its real end (ET 49.1.c), in proportion when the job ends early', () => {
  const offer = offerWith({ contract: 'temporary', payAmount: 1500 });
  const r = calc(offer, ctx);
  assert.ok(r.employer.severance > 100);
  const x = settleOf(offer, {});
  near(x.totals.items.severance.due, r.employer.severance, 'the model’s figure, whole contract', 0.01);
  assert.deepEqual(
    x.rows.map((row) => row.items.severance.due > 0),
    [false, false, true],
  );
  assert.equal(x.rows[2].items.severance.agreed, 0);
  assert.equal(
    x.totals.due,
    cents(x.totals.items.salary.due + x.totals.items.vacation.due + x.totals.items.severance.due),
  );
  // the job ends at the end of February: two thirds of the contract
  const early = settleOf(offer, { end: { how: 'agreed', date: '2026-02-28' } }, '2026-06-01');
  near(early.totals.items.severance.due, (r.employer.severance * 2) / 3, 'two months of three', 0.01);
  assert.equal(early.rows.at(-1).items.severance.due, early.totals.items.severance.due); // at the real end
  // a quit earns none; a permanent contract has none
  assert.equal(
    settleOf(offer, { end: { how: 'quit', date: '2026-02-28' } }, '2026-06-01').totals.items.severance.due,
    0,
  );
  assert.equal(settleOf(offerWith({ payAmount: 1500 }), {}).totals.items.severance.due, 0);
});

test('severance is covered by what is paid after the pay, and stays in Corresponde and Falta until it is', () => {
  const offer = offerWith({ contract: 'temporary', payAmount: 1500 });
  const r = calc(offer, ctx);
  const done = settleOf(offer, {});
  const pay = (gross) => ({ id: 'a', date: '2026-03-31', amount: gross * r.netFactor, via: 'payroll' });
  const salaryOnly = done.totals.due - done.totals.items.severance.due;
  const unpaid = settleOf(offer, { payments: [pay(salaryOnly)] });
  near(unpaid.totals.owed, r.employer.severance, 'only the severance is owed', 0.02);
  const standing = standingOf(unpaid, '2026-04-15', 'finished', [pay(salaryOnly)], r.netFactor);
  assert.ok(standing.falta > 0);
  assert.ok(standing.lines.some((line) => line.key === 'severance' && line.due > 0));
  // the severance is neither taxed nor contributed on: paid net as it is, the salary through the net factor
  const severance = done.totals.items.severance.due;
  const everything = { ...pay(salaryOnly), amount: salaryOnly * r.netFactor + severance };
  const all = settleOf(offer, { payments: [everything] });
  assert.equal(all.totals.owed, 0);
  const line = standing.lines.find((x) => x.key === 'severance');
  near(line?.due ?? 0, severance, 'net severance = gross severance', 0.01);
  near(standing.falta, severance, 'only the severance is missing, in full', 0.02);
  // under way the contract has not ended: nothing for it yet
  const underway = standingOf(settleOf(offer, {}, '2026-02-10'), '2026-02-10', 'underway', [], r.netFactor);
  assert.ok(!underway.lines.some((line) => line.key === 'severance' && line.due > 0));
});

test('vacation taken is libre on the default calendar, so a record identical to the offer has no days more or less', () => {
  const offer = offerWith({ contract: 'temporary', payAmount: 1500 });
  const x = settleOf(offer, {}, '2026-06-01');
  const days = {};
  let work = 0;
  let vacationOff = 0;
  for (const row of x.rows) {
    const marks = marksOf(offer, undefined, { key: row.month, from: row.calendarFrom, to: row.calendarTo });
    days[row.month] = { closed: true, days: Object.fromEntries(marks.map((m) => [m.day, m.kind])) };
    work += marks.filter((m) => m.kind === 'work').length;
    if (row.month === '2026-03') vacationOff = marks.filter((m) => m.kind === 'off' && m.day >= '24').length;
  }
  const r = calc(offer, ctx);
  assert.ok(Math.abs(work - r.time.daysWorked) <= 1, `${work} worked days against ${r.time.daysWorked}`);
  assert.equal(vacationOff, 8); // the last eight days of the offer are the vacation
  const same = settleOf(offer, { months: days }, '2026-06-01');
  assert.ok(Math.abs(same.totals.due - x.totals.due) < 30);
});

test('vacation taken but the job ends before the days: the days accrued and not taken are owed (ET 38.1)', () => {
  const offer = offerWith({ contract: 'temporary', payAmount: 1500 });
  const r = calc(offer, ctx);
  assert.equal(settleOf(offer, {}, '2026-06-01').totals.items.vacation.due, 0); // the whole job: taken, nothing owed
  const early = settleOf(offer, { end: { how: 'agreed', date: '2026-02-28' } }, '2026-06-01');
  // two months accrue 5 days; none was taken (the last eight days of the offer lie after the end)
  near(early.totals.items.vacation.due, 5 * r.min.vacationDay, 'five days at the minimum wage', 0.01);
  assert.equal(early.rows.at(-1).items.vacation.due, early.totals.items.vacation.due);
});

// Without a contract the vacation follows the same rule in the record as on the ficha (ET 38.1)
test('without a contract, the record owes the vacation unless it was taken or paid apart', () => {
  const none = (vacation) =>
    offerWith({
      contract: 'none',
      payAmount: 0,
      cashAmount: 2000,
      cashUnit: 'month',
      vacation,
    });
  const owed = (vacation, record = {}) => {
    const offer = none(vacation);
    const r = calc(offer, ctx);
    return { r, x: settleOf(offer, record, '2026-04-15'), ficha: r.debt.vacation };
  };
  const inside = owed('included');
  assert.ok(inside.x.totals.items.vacation.shortfall > 0);
  near(inside.x.totals.items.vacation.shortfall, cents(inside.ficha), 'the ficha’s debt');
  // Taken: the days libres of the record change nothing, the answer decides
  const taken = owed('taken', {
    months: { '2026-03': { closed: true, days: { '2026-03-30': 'off', '2026-03-31': 'off' } } },
  });
  assert.equal(taken.x.totals.items.vacation.shortfall, 0);
  // Paid apart: due, but not short; with nothing cobrado it is owed with the rest
  const apart = owed('paidAtEnd');
  assert.equal(apart.x.totals.items.vacation.shortfall, 0);
  near(apart.x.totals.items.vacation.due, cents(apart.r.vacationApart), 'the vacation paid apart is due');
  const standing = (o) => standingOf(o.x, '2026-04-15', 'finished', [], o.r.netFactor, 'none');
  assert.ok(standing(apart).falta > standing(taken).falta, 'nothing cobrado: the vacation apart is owed too');
});

// «The agreed pay is the minimum» (`payrollMin`, no total): the cobros are checked against the law alone
const minimumOffer = (changes = {}) =>
  offerWith({ payrollMin: true, payAmount: '', contract: 'temporary', ...changes });
const netOfMinimum = (offer) => {
  const r = calc(offer, ctx);
  return { r, net: r.min.salary * r.netFactor };
};

test('the agreed minimum, monthly: all on payroll, no cash, and the net payslips that match it leave nothing short', () => {
  const offer = minimumOffer({ contract: 'permanent', duration: 90, vacation: 'taken' });
  const { r, net } = netOfMinimum(offer);
  assert.equal(r.cash.total, 0);
  near(r.pay.gross, r.min.salary, 'payslip is the minimum', 0.01);
  const monthly = net / 3;
  const record = {
    payments: [1, 2, 3].map((n) => ({ id: `p${n}`, date: `2026-0${n}-28`, amount: monthly, via: 'payroll' })),
  };
  const x = settle(offer, record, '2026-04-15', r);
  near(x.totals.owed, 0, 'nothing short', 0.05);
  near(x.totals.items.salary.agreed, x.totals.items.salary.minimum, 'agreed is the minimum', 0.01);
  const short = settle(
    offer,
    { payments: [{ id: 'p1', date: '2026-02-28', amount: net - 100, via: 'payroll' }] },
    '2026-04-15',
    r,
  );
  near(short.totals.owed, 100 / r.netFactor, 'what is short, gross', 0.05);
});

test('the agreed minimum, casual: the monthly minimum with its extra pays prorated, above the daily floor it is judged by', () => {
  const offer = minimumOffer({ start: '2026-02-01', duration: 28, hoursPerDay: 8, daysOff: 2, daysOffUnit: 'week' });
  const r = calc(offer, ctx);
  assert.equal(r.min.casual, true);
  near(r.pay.salary, (r.wage.annual / 12) * r.time.months, 'agreed is the monthly minimum over the months', 0.01);
  assert.ok(r.pay.salary > r.min.salary, 'more than the casual daily minimum');
  const x = settle(offer, { paid: 'asAgreed' }, '2026-04-15', r);
  near(x.totals.items.salary.agreed, r.pay.salary, 'settle agrees the monthly minimum', 0.01);
  near(x.totals.items.salary.minimum, r.min.salary, 'the floor stays the casual one', 0.01);
  assert.equal(x.totals.items.salary.shortfall, 0);
});
