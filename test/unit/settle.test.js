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
const payment = (id, date, gross, via = 'payroll') => ({ id, date, amount: gross * NET, via });
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
    // The agreed pay is payroll plus the agreed cash as the gross that brings it net, as `calc` credits it (nothing but
    // cash without a contract, where `calc` brings it to gross through the net factor)
    const agreedSalary = r.noContract ? r.cash.total / r.netFactor : r.pay.salary + r.cash.grossEq;
    near(T.salary.agreed + T.overnight.agreed, cents(agreedSalary), `${name}: agreed salary`);
    near(T.vacation.agreed, cents(r.pay.vacationPay), `${name}: agreed vacation`);
    near(T.salary.minimum, cents(r.min.salary), `${name}: minimum salary`);
    near(T.overnight.minimum, cents(r.min.overnight), `${name}: minimum overnight`);
    // The debt after the cash, as the ficha shows what is owed (`r.debt.owed`), to the cent. By item only where no cash
    // is involved: `calc` has no item split of what the cash covers.
    if (r.cash.total === 0 || r.noContract) {
      near(T.salary.shortfall, cents(r.debt.parts.salary), `${name}: salary debt`);
      near(T.overnight.shortfall, cents(r.debt.parts.overnight), `${name}: overnight debt`);
      near(T.vacation.shortfall, cents(r.debt.parts.vacation), `${name}: vacation debt`);
    }
    near(x.totals.shortfall, cents(r.debt.owed), `${name}: debt after cash`, 0.01);
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
    const x = settle(offer, {}, '2030-01-01', { cfg, offers });
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

test('a closed month: libre days before the first day worked, or after the last, lie outside the job; a wage per day does not change', () => {
  const closed = { ...workOn('2026-01', range(10, 31), true), ...workOn('2026-03', range(1, 20), true) };
  const x = settleOf(offerWith(), { months: closed });
  const pay = (row) => row.items.salary.agreed + row.items.overnight.agreed;
  near(pay(x.rows[0]), (1424.5 * 22) / 30, 'January from the 10th: 22 days', 0.01);
  near(pay(x.rows[1]), 1424.5, 'February follows the offer', 0.01);
  near(pay(x.rows[2]), (1424.5 * 20) / 30, 'March to the 20th: 20 days', 0.01);
  assert.deepEqual([x.job.from, x.job.to], ['2026-01-10', '2026-03-20']);
  // The same days with a wage per day: the days decide, nothing is trimmed
  const perDayPlain = settleOf(perDay(), { months: { '2026-01': { closed: true, days: closed['2026-01'].days } } });
  assert.equal(perDayPlain.rows[0].items.salary.agreed, 2200);
});

test('a job that ends early: closed months after the last worked one are outside it, open ones follow the offer', () => {
  const closedAll = {
    ...workOn('2026-01', range(1, 31), true),
    ...workOn('2026-02', range(1, 10), true),
    '2026-03': { closed: true, days: {} },
  };
  const x = settleOf(offerWith(), { months: closedAll });
  const pay = (row) => row.items.salary.agreed + row.items.overnight.agreed;
  near(pay(x.rows[1]), (1424.5 * 10) / 30, 'February to the 10th', 0.01);
  assert.equal(pay(x.rows[2]), 0);
  // Not closed: the offer is followed
  const open = settleOf(offerWith(), { months: { '2026-03': { days: { '05': 'off' } } } });
  near(pay(open.rows[2]), 1424.5, 'an open month is whole', 0.01);
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
  const offer = withCash({ payAmount: 1424.5, vacation: 'paidAtEnd' });
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
