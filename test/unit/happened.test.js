// happenedOf and actualFigures: one job, an agreed side and a happened side that defaults to it (ADR-0035), and
// `record.paid` in settle and in where an offer stands.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { standingOf } from '../../src/model/accounts.js';
import { calc } from '../../src/model/calc.js';
import { actualFigures, happenedOf } from '../../src/model/happened.js';
import { addPayment, completeRecord, enterTotalDays, setPaid } from '../../src/model/record.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG, makeOffer } from '../../src/offer.js';
import { offerOf } from './flat-offer.js';

const ctx = { cfg: { ...DEF_CFG }, offers: [] };
const TODAY = '2026-11-15';
const JOB = {
  id: 'j',
  name: 'Puerto A',
  start: '2026-06-01',
  contract: 'permanent',
  duration: 92,
  durationUnit: 'days',
  hoursPerDay: 8,
  daysOff: 4,
  daysOffUnit: 'month',
  holidays: 'no',
  payType: 'gross',
  payAmount: 90,
  payUnit: 'day',
  extraPays: 'included',
  vacation: 'paidAtEnd',
  housing: 'no',
  car: 'noCar',
  kmHome: 0,
  overnight: 'no',
  irpfMode: 'manual',
  irpfManual: 10,
};
const rOf = (offer) => calc(offer, ctx);
const happened = (offer, today = TODAY) => happenedOf(offer, today, rOf(offer));
const near = (actual, expected, what, tolerance = 0.011) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

describe('record.paid in settle and in where an offer stands', () => {
  const offer = offerOf({ ...JOB, payAmount: 30 }); // under the minimum wage per day: the minimum adds to it
  const r = rOf(offer);
  const settledWith = (paid, payments = []) =>
    settle(offer, { months: {}, payments, ...(paid ? { paid } : {}) }, TODAY, r);

  test('asAgreed: every item received what was agreed, and what is owed is the shortfall under the minimum', () => {
    const settled = settledWith('asAgreed');
    assert.ok(settled.totals.shortfall > 0, 'the offer is under the minimum');
    for (const row of settled.rows)
      for (const x of Object.values(row.items)) {
        assert.equal(x.received, x.agreed);
        assert.equal(x.owed, x.shortfall);
      }
    assert.equal(settled.totals.owed, settled.totals.shortfall);
    assert.ok(
      settled.rows.every((row) => row.owed === 0 || row.deadline),
      'what is owed is dated',
    );
  });

  test('none: nothing was received, payments or not; unknown: the payments speak', () => {
    const cobro = [{ id: 'p', date: '2026-07-05', amount: 500, via: 'payroll' }];
    assert.equal(settledWith('none', cobro).totals.received, 0);
    assert.equal(settledWith('none').totals.owed, settledWith('none').totals.due);
    assert.ok(settledWith(undefined, cobro).totals.received > 0);
    assert.equal(settledWith(undefined).totals.received, 0);
  });

  test('an offer at or above the minimum, as agreed, owes nothing', () => {
    const fine = offerOf({ ...JOB, payAmount: 90 });
    const settled = settle(fine, { months: {}, payments: [], paid: 'asAgreed' }, TODAY, rOf(fine));
    assert.equal(settled.totals.shortfall, 0);
    assert.equal(settled.totals.owed, 0);
    assert.equal(settled.totals.received, settled.totals.due);
  });

  test('standing: asAgreed gives Cobrado = what was agreed and Falta = the minimum’s share only; none gives 0', () => {
    const stand = (paid) => standingOf(settledWith(paid), TODAY, 'finished', [], r.netFactor, paid);
    const agreed = stand('asAgreed');
    near(agreed.falta, settledWith('asAgreed').totals.shortfall * r.netFactor, 'Falta', 0.05);
    near(agreed.cobrado + agreed.falta, agreed.corresponde, 'Cobrado + Falta');
    assert.ok(agreed.cobrado > 0 && agreed.falta > 0);
    assert.equal(agreed.hasPayments, true);
    assert.ok(agreed.deadlines.length > 0, 'a shortfall is dated');
    const none = stand('none');
    assert.equal(none.cobrado, 0);
    assert.equal(none.falta, none.corresponde);
    assert.equal(stand(undefined).hasPayments, false);
  });
});

/** June to August with `worked` days worked in each month, every month closed. */
function recordMonths(record, worked) {
  for (const [month, length, w] of [
    ['2026-06', 30, worked[0]],
    ['2026-07', 31, worked[1]],
    ['2026-08', 31, worked[2]],
  ])
    record.months[month] = {
      closed: true,
      days: Object.fromEntries(
        Array.from({ length }, (_, i) => [String(i + 1).padStart(2, '0'), i < w ? 'work' : 'off']),
      ),
    };
}

describe('use (a): an offer that was worked and recorded', () => {
  const offer = offerOf(JOB);
  recordMonths(offer.mine.record, [20, 22, 24]);
  addPayment(offer.mine.record, { date: '2026-09-05', amount: 4000, via: 'payroll' });
  const r = rOf(offer);

  test('the days come from the record, the dates from the offer, the money from the cobros', () => {
    const h = happened(offer);
    assert.equal(h?.phase, 'finished');
    assert.deepEqual(h?.dates, { from: '2026-06-01', to: '2026-08-31', fromSource: 'agreed', toSource: 'agreed' });
    assert.equal(h?.days.work, 66);
    assert.equal(h?.days.source, 'recorded');
    assert.deepEqual(
      h?.days.months.map((m) => [m.work, m.kept]),
      [
        [20, 'days'],
        [22, 'days'],
        [24, 'days'],
      ],
    );
    assert.equal(h?.money.basis, 'cobros');
    assert.equal(h?.money.received, 4000);
    assert.equal(h?.money.approx, false);
    near((h?.money.due ?? 0) - (h?.money.received ?? 0), h?.money.missing ?? 0, 'Falta');
    assert.ok((h?.money.missing ?? 0) > 0);
  });

  test('an end the shepherd said and a start confirmed are recorded dates', () => {
    const early = offerOf(JOB);
    recordMonths(early.mine.record, [20, 22, 24]);
    early.mine.record.end = { how: 'quit', date: '2026-08-24' };
    early.mine.record.started = { date: '2026-06-01' };
    const h = happened(early);
    assert.equal(h?.dates.to, '2026-08-24');
    assert.equal(h?.dates.toSource, 'recorded');
    assert.equal(h?.dates.fromSource, 'recorded');
  });

  test('a record that is not closed gives the agreed figures; closed, the real ones', () => {
    assert.equal(actualFigures(offer, TODAY, r).real, false);
    const closed = structuredClone(offer);
    completeRecord(closed.mine.record, TODAY);
    const real = actualFigures(closed, TODAY, rOf(closed));
    assert.equal(real.real, true);
    assert.equal(real.time.daysWorked, 66);
    near(real.time.months, 3, 'months', 0.05);
    assert.equal(real.time.hours, 66 * 8);
    // what reached the shepherd, over what was worked (nothing but money here: no housing, meals or expenses)
    near(real.earnings.total, 4000, 'total', 0.01);
    near(real.earnings.perDay, 4000 / 66, 'perDay', 0.01);
    near(real.earnings.perHour, 4000 / 528, 'perHour', 0.01);
    near(real.earnings.perMonth, 4000 / real.time.months, 'perMonth', 0.01);
    const agreed = actualFigures(offer, TODAY, r);
    assert.equal(agreed.earnings.total, r.earnings.total);
    assert.equal(agreed.time.daysWorked, r.time.daysWorked);
  });

  test('a job under way, or one not worked, has no real figures even with the record closed', () => {
    const underway = structuredClone(offer);
    completeRecord(underway.mine.record, '2026-07-10');
    assert.equal(actualFigures(underway, '2026-07-10', rOf(underway)).real, false);
    const only = offerOf({ ...JOB, offerOnly: true });
    completeRecord(only.mine.record, TODAY);
    assert.equal(happened(only), null);
    assert.equal(actualFigures(only, TODAY, rOf(only)).real, false);
    assert.equal(happened(offerOf({ ...JOB, start: '2027-01-10' })), null);
  });
});

describe('use (b): a past job known only by its conditions, paid as agreed', () => {
  test('Cobrado is what was agreed, the days and dates follow the offer, and nothing is missing at or above the minimum', () => {
    const offer = offerOf(JOB);
    setPaid(offer.mine.record, 'asAgreed');
    const h = happened(offer);
    assert.equal(h?.days.source, 'agreed');
    assert.equal(h?.dates.toSource, 'agreed');
    assert.equal(h?.money.basis, 'asAgreed');
    assert.equal(h?.money.received, h?.money.due);
    assert.equal(h?.money.missing, 0);
    assert.equal(h?.money.missingByMinimumOnly, true);
    near(h?.days.work ?? 0, rOf(offer).time.daysWorked, 'days follow the offer', 0.001);
  });

  test('below the legal minimum, Falta is only the minimum’s share, and it is labelled', () => {
    const offer = offerOf({ ...JOB, payAmount: 30 });
    setPaid(offer.mine.record, 'asAgreed');
    const r = rOf(offer);
    const h = happenedOf(offer, TODAY, r);
    const shortfall = h?.settled.totals.shortfall ?? 0;
    assert.ok(shortfall > 0);
    near(h?.money.missing ?? 0, shortfall * r.netFactor, 'Falta', 0.05);
    near((h?.money.received ?? 0) + (h?.money.missing ?? 0), h?.money.due ?? 0, 'Cobrado + Falta', 0.011);
    assert.equal(h?.money.missingByMinimumOnly, true);
  });

  test('as agreed and closed, the real figures are the agreed money over the days of the job', () => {
    const offer = offerOf(JOB);
    setPaid(offer.mine.record, 'asAgreed');
    completeRecord(offer.mine.record, TODAY);
    const r = rOf(offer);
    const real = actualFigures(offer, TODAY, r);
    assert.equal(real.real, true);
    near(real.earnings.total, r.earnings.total, 'total', 0.02);
  });

  test('«No se cobró nada» is nothing received, and everything due is missing', () => {
    const offer = offerOf(JOB);
    setPaid(offer.mine.record, 'none');
    const h = happened(offer);
    assert.equal(h?.money.basis, 'none');
    assert.equal(h?.money.received, 0);
    assert.equal(h?.money.missing, h?.money.due);
  });

  test('with no answer and no cobro the money is unknown: nothing received, to be asked', () => {
    const h = happened(offerOf(JOB));
    assert.equal(h?.money.basis, 'unknown');
    assert.equal(h?.money.received, 0);
  });
});

describe('use (c): a past job known only by what happened, with thin terms', () => {
  // Only a start and a duration: no pay, no hours, no days off
  const thin = () => makeOffer({ start: '2026-06-01', duration: 92, durationUnit: 'days' });
  const months = [
    { key: '2026-06', days: 30 },
    { key: '2026-07', days: 31 },
    { key: '2026-08', days: 31 },
  ];

  test('a total of days and an approximate lump are enough: nothing crashes and the figures are real', () => {
    const offer = thin();
    enterTotalDays(offer.mine.record, months, 60);
    addPayment(offer.mine.record, { date: '2026-09-01', amount: 4000, via: 'cash', approx: true });
    completeRecord(offer.mine.record, TODAY);
    const r = rOf(offer);
    const h = happenedOf(offer, TODAY, r);
    assert.equal(h?.days.work, 60);
    assert.equal(h?.days.source, 'recorded');
    assert.deepEqual(
      h?.days.months.map((m) => m.kept),
      ['count', 'count', 'count'],
    );
    assert.equal(h?.money.basis, 'cobros');
    assert.equal(h?.money.approx, true);
    assert.equal(h?.money.received, 4000);
    // with no pay and no hours nothing is judged: no minimum, no Falta
    assert.equal(h?.money.due, 0);
    assert.equal(h?.money.missing, 0);
    const real = actualFigures(offer, TODAY, r, h);
    assert.equal(real.real, true);
    near(real.earnings.perDay, 4000 / 60, 'perDay', 0.001);
    assert.equal(real.earnings.perHour, 0, 'without hours, nothing per hour');
    assert.equal(real.time.hours, 0);
  });

  test('with no terms at all but a start, the job still computes', () => {
    const offer = makeOffer({ start: '2026-06-01' });
    const r = rOf(offer);
    const h = happenedOf(offer, TODAY, r);
    assert.equal(h?.phase, 'underway');
    assert.equal(actualFigures(offer, TODAY, r).real, false);
    const noEnd = makeOffer({ start: '2026-06-01' });
    addPayment(noEnd.mine.record, { date: '2026-07-01', amount: 100, via: 'payroll', approx: true });
    assert.equal(happenedOf(noEnd, TODAY, rOf(noEnd))?.money.approx, true);
  });

  test('a lump of cobros alone makes Falta only where terms give a pay', () => {
    const offer = makeOffer({ ...JOB, id: undefined, offerOnly: false });
    enterTotalDays(offer.mine.record, months, 60);
    addPayment(offer.mine.record, { date: '2026-09-01', amount: 3000, via: 'payroll', approx: true });
    const h = happened(offer);
    assert.equal(h?.money.approx, true);
    assert.ok((h?.money.due ?? 0) > 3000 && (h?.money.missing ?? 0) > 0);
    near((h?.money.due ?? 0) - 3000, h?.money.missing ?? 0, 'Falta', 0.011);
  });
});
