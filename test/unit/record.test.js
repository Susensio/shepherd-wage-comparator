// The record's transitions, the figures the screens read from settle, and the claim text. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { balanceOf, jobStatus, minimumNote, monthAccounts, spanOf, standingOf } from '../../src/model/accounts.js';
import { calc } from '../../src/model/calc.js';
import { lawFromRecord } from '../../src/model/compliance.js';
import {
  addEvidence,
  addPayment,
  answerRecall,
  clearEnd,
  closeMonth,
  completeRecord,
  confirmStart,
  countsOf,
  defaultMarks,
  endSick,
  lastWayOf,
  markStep,
  marksOf,
  removeEvidence,
  removePayment,
  reopenMonth,
  setEnd,
  setPaid,
  setParties,
  setPromise,
  startSick,
  toggleDay,
  unmarkStep,
  updatePayment,
} from '../../src/model/record.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG, emptyRecord } from '../../src/offer.js';
import { createOffers } from '../../src/offers.js';
import { ingestSaved } from '../../src/schema.js';
import { offerOf } from './flat-offer.js';

const ctx = { cfg: { ...DEF_CFG }, offers: [] };
// June to August 2026, 60 € a worked day, 4 days off a month, at 30 days
const OFFER = offerOf({
  id: 't',
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
  payAmount: 60,
  payUnit: 'day',
  extraPays: 'included',
  vacation: 'paidAtEnd',
  housing: 'no',
  car: 'noCar',
  kmHome: 0,
  overnight: 'no',
  irpfMode: 'manual',
  irpfManual: 10,
});
const JUNE = { key: '2026-06', from: '2026-06-01', to: '2026-06-30' };
const NET = calc(OFFER, ctx).netFactor;
const accountsOf = (offer, record, key, today) => {
  const r = calc(offer, ctx);
  return monthAccounts(offer, record, key, today, settle(offer, record, today, r), r);
};

describe('the days of a month', () => {
  test('the offer’s days off are spread over the month, and as many as the offer says', () => {
    const marks = defaultMarks(OFFER, JUNE);
    assert.equal(marks.length, 30);
    assert.equal(countsOf(marks).off, 4);
    assert.ok(marks.every((m) => !m.recorded));
  });

  test('a partial month marks only its own days', () => {
    const marks = defaultMarks(OFFER, { key: '2026-06', from: '2026-06-20', to: '2026-06-30' });
    assert.equal(marks.length, 11);
    assert.equal(marks[0].day, '20');
  });

  test('a recorded day wins over the default', () => {
    const record = { months: { '2026-06': { closed: false, days: { '03': 'sick' } } }, payments: [] };
    const marks = marksOf(OFFER, record, JUNE);
    assert.deepEqual([marks[2].kind, marks[2].recorded], ['sick', true]);
  });
});

describe('tapping a day', () => {
  test('jornada becomes libre and back; the first tap records every day as shown', () => {
    const record = emptyRecord();
    const first = defaultMarks(OFFER, JUNE)[0];
    assert.equal(first.kind, 'work');
    assert.ok(toggleDay(OFFER, record, JUNE, '01'));
    assert.equal(Object.keys(record.months['2026-06'].days).length, 30);
    assert.equal(record.months['2026-06'].days['01'], 'off');
    assert.equal(countsOf(marksOf(OFFER, record, JUNE)).off, 5);
    toggleDay(OFFER, record, JUNE, '01');
    // Back to the offer's own days: the month follows the offer again, holding nothing
    assert.deepEqual(record.months, {});
  });

  test('sick becomes jornada', () => {
    const record = { months: { '2026-06': { closed: false, days: { '01': 'sick' } } }, payments: [] };
    toggleDay(OFFER, record, JUNE, '01');
    assert.equal(marksOf(OFFER, record, JUNE)[0].kind, 'work');
  });

  test('a closed month does not change; neither does a day outside the span', () => {
    const record = emptyRecord();
    closeMonth(OFFER, record, JUNE);
    const before = structuredClone(record);
    assert.equal(toggleDay(OFFER, record, JUNE, '01'), false);
    assert.deepEqual(record, before);
    assert.equal(toggleDay(OFFER, emptyRecord(), JUNE, '31'), false);
  });
});

describe('closing and reopening', () => {
  test('closing freezes every day as shown, so a later change of the offer does not move the month', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    assert.ok(closeMonth(OFFER, record, JUNE));
    const month = record.months['2026-06'];
    assert.equal(month.closed, true);
    assert.equal(Object.keys(month.days).length, 30);
    const before = settle(OFFER, record, '2026-09-10', calc(OFFER, ctx)).rows[0];
    const raised = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 't', daysOff: 8, payAmount: 80 });
    const after = settle(raised, record, '2026-09-10', calc(raised, ctx)).rows[0];
    assert.equal(after.facts.work, before.facts.work);
    assert.equal(after.facts.off, before.facts.off);
    assert.equal(after.closed, true);
    // The days stay as they were; only the daily wage, which is not a day, follows the offer
    assert.equal(after.items.salary.agreed, before.items.salary.agreed * (80 / 60));
  });

  test('closing a closed month, or reopening an open one, changes nothing', () => {
    const record = emptyRecord();
    assert.equal(reopenMonth(record, '2026-06'), false);
    closeMonth(OFFER, record, JUNE);
    assert.equal(closeMonth(OFFER, record, JUNE), false);
  });

  test('reopening keeps the days and lets them change again', () => {
    const record = emptyRecord();
    closeMonth(OFFER, record, JUNE);
    assert.ok(reopenMonth(record, '2026-06'));
    assert.equal(record.months['2026-06'].closed, false);
    assert.equal(Object.keys(record.months['2026-06'].days).length, 30);
    assert.ok(toggleDay(OFFER, record, JUNE, '05'));
  });
});

describe('payments', () => {
  test('a payment is added with an id, trimmed note and its way; removing it by id', () => {
    const record = emptyRecord();
    const p = addPayment(record, { date: '2026-06-30', amount: 500, via: 'cash', note: '  adelanto ' });
    assert.ok(p?.id);
    assert.deepEqual({ ...p, id: 'x' }, { id: 'x', date: '2026-06-30', amount: 500, via: 'cash', note: 'adelanto' });
    assert.equal(addPayment(record, { date: '2026-07-05', amount: 100, via: 'payroll' })?.note, undefined);
    assert.equal(lastWayOf(record), 'payroll');
    assert.ok(removePayment(record, p.id));
    assert.equal(record.payments.length, 1);
    assert.equal(removePayment(record, 'nothing'), false);
  });

  test('a payment is changed in place, keeping its id; a bad change leaves it as it was', () => {
    const record = emptyRecord();
    const p = addPayment(record, { date: '2026-06-30', amount: 500, via: 'cash', note: 'adelanto', approx: true });
    const changed = updatePayment(record, p.id, { date: '2026-07-02', amount: 450, via: 'payroll' });
    assert.deepEqual(changed, { id: p.id, date: '2026-07-02', amount: 450, via: 'payroll' });
    assert.equal(record.payments.length, 1);
    assert.equal(updatePayment(record, p.id, { date: '2026-07-02', amount: 0, via: 'payroll' }), null);
    assert.equal(updatePayment(record, 'nothing', { date: '2026-07-02', amount: 5, via: 'cash' }), null);
    assert.equal(record.payments[0].amount, 450);
  });

  test('no amount, a zero one or no date is not a payment', () => {
    const record = emptyRecord();
    for (const bad of [
      { date: '2026-06-30', amount: 0, via: 'cash' },
      { date: '2026-06-30', amount: Number.NaN, via: 'cash' },
      { date: '', amount: 5, via: 'cash' },
    ])
      assert.equal(addPayment(record, bad), null);
    assert.deepEqual(record.payments, []);
    assert.equal(lastWayOf(record), 'payroll');
  });

  test('the last way used is remembered', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-06-30', amount: 5, via: 'cash' });
    assert.equal(lastWayOf(record), 'cash');
  });
});

describe('saving through the list of offers', () => {
  const state = { offers: [], activeId: '', placeholderId: null, firstRun: false, config: { ...DEF_CFG } };
  let saves = 0;
  const list = createOffers({ state, store: { get: (_k, f) => f, set() {} }, notify: () => saves++ });

  test('a transition that changed something saves once; one that did not, never', () => {
    saves = 0;
    list.toggleDay(OFFER, JUNE, '01');
    assert.equal(saves, 1);
    list.toggleDay(OFFER, { ...JUNE, key: '2026-06', to: '2026-06-30' }, '31');
    assert.equal(saves, 1);
    list.addPayment(OFFER, { date: '2026-06-30', amount: 0, via: 'cash' });
    assert.equal(saves, 1);
    list.addPayment(OFFER, { date: '2026-06-30', amount: 50, via: 'cash' });
    list.closeMonth(OFFER, JUNE);
    list.reopenMonth(OFFER, '2026-06');
    assert.equal(saves, 4);
    list.removePayment(OFFER, OFFER.mine.record.payments[0].id);
    assert.equal(saves, 5);
  });

  test('a record is held back while a step is being changed', () => {
    saves = 0;
    list.hold();
    list.toggleDay(OFFER, JUNE, '10');
    assert.equal(saves, 0);
    list.release(false);
  });
});

describe('a month on its calendar', () => {
  test('untouched: the offer’s days, no difference and an estimate', () => {
    const m = accountsOf(OFFER, emptyRecord(), '2026-06', '2026-09-10');
    assert.equal(m.row.closed, false);
    assert.equal(m.jornadas, 0);
    assert.equal(m.delta, null);
    assert.equal(m.counts.off, 4);
  });

  test('one jornada less is one daily wage less, by counts', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    const m = accountsOf(OFFER, record, '2026-06', '2026-09-10');
    assert.equal(m.jornadas, -1);
    assert.equal(m.delta, Math.round(-60 * NET * 100) / 100);
    assert.equal(m.counts.work, 25);
  });

  test('moving a libranza to another day is no difference', () => {
    const record = emptyRecord();
    const asOffer = defaultMarks(OFFER, JUNE);
    const offDay = asOffer.find((m) => m.kind === 'off').day;
    const workDay = asOffer.find((m) => m.kind === 'work' && m.day !== '01').day;
    toggleDay(OFFER, record, JUNE, offDay);
    toggleDay(OFFER, record, JUNE, workDay);
    const m = accountsOf(OFFER, record, '2026-06', '2026-09-10');
    assert.equal(m.jornadas, 0);
    assert.equal(m.delta, null);
  });

  test('a closed month shows no difference, and an unknown month is null', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    closeMonth(OFFER, record, JUNE);
    assert.equal(accountsOf(OFFER, record, '2026-06', '2026-09-10').delta, null);
    assert.equal(accountsOf(OFFER, record, '2025-01', '2026-09-10'), null);
  });
});

describe('where an offer stands, in net', () => {
  const stand = (record, today, phase) =>
    standingOf(settle(OFFER, record, today, calc(OFFER, ctx)), today, phase, record.payments, NET, record.paid);
  const net = (gross) => Math.round(gross * NET * 100) / 100;

  test('«No se cobró nada» makes the whole of Corresponde what is missing, and dates it, without a payment', () => {
    const asked = stand(emptyRecord(), '2026-11-12', 'finished');
    assert.equal(asked.hasPayments, false);
    assert.equal(asked.deadlines.length, 0);
    const record = emptyRecord();
    setPaid(record, 'none');
    const s = stand(record, '2026-11-12', 'finished');
    assert.equal(s.hasPayments, true);
    assert.equal(s.cobrado, 0);
    assert.equal(s.falta, s.corresponde);
    assert.ok(s.deadlines.length > 0 && s.nearest);
  });

  test('under way: the months that have ended and the one in progress up to today count, with the vacation in proportion', () => {
    const s = stand(emptyRecord(), '2026-07-15', 'underway');
    const settled = settle(OFFER, emptyRecord(), '2026-07-15', calc(OFFER, ctx));
    const rows = settled.rows;
    assert.deepEqual(
      s.ended.map((r) => r.month),
      ['2026-06'],
    );
    assert.equal(s.running?.month, '2026-07');
    assert.equal(rows[1].to, '2026-07-15');
    const salaryAndBonus = (row) => row.items.salary.due + row.items.overnight.due;
    const sofar = net(salaryAndBonus(rows[0]) + salaryAndBonus(rows[1]));
    const vacation = s.lines.find((x) => x.key === 'vacation')?.due ?? 0;
    assert.ok(vacation > 0 && vacation < net(rows[2].items.vacation.due), 'the vacation accrues in proportion');
    assert.ok(Math.abs(s.corresponde - sofar - vacation) < 0.05);
    assert.ok(s.corresponde > net(salaryAndBonus(rows[0])), 'more than the months ended: the running month counts');
    assert.equal(s.hasPayments, false);
    assert.deepEqual(
      s.unclosed.map((r) => r.month),
      ['2026-06'],
    );
  });

  test('Corresponde − Cobrado = Falta, never below 0, and what was cobrado beyond is a note, not a debt', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 1000, via: 'payroll' });
    const s = stand(record, '2026-07-15', 'underway');
    assert.equal(s.cobrado, 1000);
    assert.equal(s.falta, Math.round((s.corresponde - 1000) * 100) / 100);
    assert.equal(s.sobra, 0);
    assert.equal(s.hasPayments, true);
    addPayment(record, { date: '2026-07-06', amount: 100000, via: 'payroll' });
    const over = stand(record, '2026-07-15', 'underway');
    assert.equal(over.falta, 0);
    assert.equal(over.sobra, Math.round((over.cobrado - over.corresponde) * 100) / 100);
    assert.deepEqual(over.deadlines, []);
    assert.equal(over.nearest, null);
  });

  test('finished: the lines add up to Corresponde, and the nearest deadline is the first month with something missing', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 1000, via: 'cash' });
    closeMonth(OFFER, record, JUNE);
    const settled = settle(OFFER, record, '2026-11-12', calc(OFFER, ctx));
    const s = standingOf(settled, '2026-11-12', 'finished', record.payments, NET);
    assert.equal(
      s.lines.reduce((t, x) => t + x.due, 0),
      s.corresponde,
    );
    assert.equal(s.running, null);
    assert.ok((s.lines.find((x) => x.key === 'vacation')?.due ?? 0) > 0);
    assert.equal(s.unclosed.length, 2);
    assert.ok(s.falta > 0 && s.deadlines.length > 0);
    assert.ok(s.deadlines.every((d) => d.owed > 0 && d.daysLeft !== null));
    const first = s.deadlines.map((d) => d.deadline).sort()[0];
    assert.equal(s.nearest?.deadline, first);
    assert.equal(s.cobradoEnMano, settled.totals.cash);
  });

  test('without cobros nothing is dated: no nearest deadline is invented from the accrued alone', () => {
    const s = stand(emptyRecord(), '2026-11-12', 'finished');
    assert.equal(s.hasPayments, false);
    assert.equal(s.cobrado, 0);
    assert.equal(s.cobradoEnMano, 0);
    assert.equal(s.nearest, null);
    assert.deepEqual(s.deadlines, []);
  });
});

describe('a net total agreed is what corresponds, scaled by the days worked', () => {
  const agreed = (changes) =>
    offerOf({
      ...OFFER.terms,
      ...OFFER.mine,
      id: 'n',
      vacation: 'taken',
      payUnit: 'day',
      payType: 'gross',
      payAmount: 40,
      cashMode: 'total',
      totalUnit: 'day',
      totalAmount: 70,
      daysOff: 0,
      ...changes,
    });
  const corresponde = (offer, record) => {
    const r = calc(offer, ctx);
    const settled = settle(offer, record, '2026-11-12', calc(offer, ctx));
    return standingOf(settled, '2026-11-12', 'finished', [], r.netFactor).corresponde;
  };

  test('70 € net a day, every day worked: the total is 70 × the days, with no withholding simulated', () => {
    const offer = agreed({});
    const r = calc(offer, ctx);
    assert.ok(r.cash.total > 0 && r.cash.unit === 'day');
    const days = r.time.daysWorked;
    assert.ok(Math.abs(corresponde(offer, emptyRecord()) - 70 * days) < 0.5);
  });

  test('each day worked less in a closed month takes 70 € net off, payroll and cash together', () => {
    const offer = agreed({});
    const closedWith = (worked) => {
      const record = emptyRecord();
      const days = {};
      for (let d = 1; d <= 30; d++) days[String(d).padStart(2, '0')] = d <= worked ? 'work' : 'off';
      record.months['2026-06'] = { closed: true, days };
      return corresponde(offer, record);
    };
    assert.ok(Math.abs(closedWith(25) - closedWith(22) - 3 * 70) < 0.5, `${closedWith(25)} - ${closedWith(22)}`);
  });
});

describe('the law, from the record: facts only', () => {
  // Two days off a week, over the legal day and a half
  const restful = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'r', daysOff: 2, daysOffUnit: 'week' });
  const settledOf = (offer, record) => settle(offer, record, '2026-11-12', calc(offer, ctx));
  const law = (record, offer = OFFER) =>
    lawFromRecord(offer, record, settledOf(offer, record), calc(offer, ctx), record.payments);
  const closeMonths = (offer, record, months) => {
    for (const row of settledOf(offer, record).rows)
      if (months.includes(row.month)) closeMonth(offer, record, spanOf(row));
  };

  test('with no month closed nothing is judged', () => {
    const x = law(emptyRecord());
    assert.deepEqual(x.months, { closed: 0, total: 3 });
    assert.equal(x.allClosed, false);
    assert.equal(x.rest.periods, 0);
    assert.equal(x.days.worked, 0);
  });

  test('the weekly rest looks at the periods wholly inside closed months', () => {
    const record = emptyRecord();
    closeMonths(restful, record, ['2026-06']);
    const ok = law(record, restful);
    assert.deepEqual(ok.months, { closed: 1, total: 3 });
    assert.equal(ok.rest.periods, 1); // 1 to 28 June; the next one reaches into July, not closed
    assert.deepEqual(ok.rest.fails, []);
    const few = emptyRecord();
    closeMonths(OFFER, few, ['2026-06']);
    assert.equal(law(few).rest.fails.length, 1, 'four days off a month do not reach a day and a half a week');
    // Every day of June worked: the period falls short
    const worked = emptyRecord();
    record.months = {};
    const days = {};
    for (let d = 1; d <= 30; d++) days[String(d).padStart(2, '0')] = 'work';
    worked.months['2026-06'] = { closed: true, days };
    const bad = law(worked, restful);
    assert.equal(bad.rest.fails[0].off, 0);
    assert.ok(bad.rest.fails[0].due >= 5);
  });

  test('only the half day accumulates: 21 days worked in a row and 7 libres at the end do not pass', () => {
    const record = emptyRecord();
    const days = {};
    for (let d = 1; d <= 30; d++) days[String(d).padStart(2, '0')] = d <= 21 ? 'work' : 'off';
    record.months['2026-06'] = { closed: true, days };
    const x = law(record, restful);
    assert.equal(x.rest.fails.length, 1);
    assert.equal(x.rest.fails[0].off, 7); // 7 of 6 due on average, but not a day each week
    assert.equal(x.rest.fails[0].weekly, true);
    // two libres per 14 days, in any place, do pass
    const spread = {};
    for (let d = 1; d <= 30; d++)
      spread[String(d).padStart(2, '0')] = [3, 4, 10, 11, 17, 18, 24, 25].includes(d) ? 'off' : 'work';
    const ok = emptyRecord();
    ok.months['2026-06'] = { closed: true, days: spread };
    assert.deepEqual(law(ok, restful).rest.fails, []);
  });

  test('days worked against those due count closed months alone, in their share of the job', () => {
    const record = emptyRecord();
    closeMonths(OFFER, record, ['2026-06', '2026-07']);
    const two = law(record);
    const all = emptyRecord();
    closeMonths(OFFER, all, ['2026-06', '2026-07', '2026-08']);
    const three = law(all);
    assert.ok(two.days.worked > 0 && two.days.worked < three.days.worked);
    assert.ok(two.days.due < three.days.due);
    assert.equal(three.days.extra, Math.max(0, three.days.worked - three.days.due));
  });

  test('the overnight bonus and the minimum on payroll wait for every month closed and the record closed', () => {
    const offer = offerOf({
      ...OFFER.terms,
      ...OFFER.mine,
      id: 'o',
      overnight: 'yes',
      province: 'HU',
      payUnit: 'month',
      payAmount: 1500,
    });
    const r = calc(offer, ctx);
    assert.ok(r.min.overnight > 0);
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 100, via: 'payroll' });
    closeMonths(offer, record, ['2026-06', '2026-07']);
    const some = law(record, offer);
    assert.equal(some.overnight.known, false);
    assert.equal(some.minimum.known, false);
    // Every month closed, the record still open: more cobros may come
    closeMonths(offer, record, ['2026-08']);
    assert.equal(law(record, offer).overnight.known, false);
    assert.equal(law(record, offer).minimum.known, false);
    completeRecord(record, '2026-11-12');
    const all = law(record, offer);
    assert.equal(all.overnight.known, true);
    assert.ok(all.overnight.missing > 0);
    assert.ok(all.minimum.known && all.minimum.short > 0);
    // The record closed with months still open (a month reopened): nothing to judge
    reopenMonth(record, '2026-08');
    assert.equal('complete' in record, true, 'reopening a month does not take back «no falta ningún cobro»');
    assert.equal(law(record, offer).minimum.known, false, 'but the months are not all closed: nothing to judge');
    // Cash only, the record closed: there is nothing on payroll, and the minimum is short
    const cash = emptyRecord();
    addPayment(cash, { date: '2026-07-05', amount: 100, via: 'cash' });
    closeMonths(offer, cash, ['2026-06', '2026-07', '2026-08']);
    completeRecord(cash, '2026-11-12');
    assert.equal(law(cash, offer).minimum.payroll, 0);
    assert.ok(law(cash, offer).minimum.short > 0);
    // Plenty on payroll: nothing missing and the minimum met
    const rich = emptyRecord();
    addPayment(rich, { date: '2026-07-05', amount: 99999, via: 'payroll' });
    closeMonths(offer, rich, ['2026-06', '2026-07', '2026-08']);
    completeRecord(rich, '2026-11-12');
    const full = law(rich, offer);
    assert.equal(full.overnight.missing, 0);
    assert.equal(full.minimum.short, 0);
    assert.equal(full.minimum.applicable, true);
  });

  test('without a contract the minimum on payroll does not apply', () => {
    const none = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'n', contract: 'none' });
    const record = emptyRecord();
    assert.equal(law(record, none).minimum.applicable, false);
  });

  test('«No, están todos»: said once and dated; the last cobro removed takes it back, an answer keeps it', () => {
    const record = emptyRecord();
    assert.equal(completeRecord(record, '2026-11-12'), true);
    assert.deepEqual(record.complete, { date: '2026-11-12' });
    assert.equal(completeRecord(record, '2026-11-13'), false, 'already said: the first date stays');
    assert.deepEqual(record.complete, { date: '2026-11-12' });
    const first = addPayment(record, { date: '2026-07-05', amount: 100, via: 'payroll' });
    const second = addPayment(record, { date: '2026-11-20', amount: 50, via: 'cash' });
    assert.ok(record.complete, 'adding a cobro afterwards keeps it');
    removePayment(record, second.id);
    assert.ok(record.complete, 'a cobro is still there');
    removePayment(record, first.id);
    assert.equal('complete' in record, false, 'nothing recorded of the money any more');
  });

  test('«Lo pactado» and «Nada» say no cobro is missing; taking the answer back with no cobro takes that away', () => {
    const record = emptyRecord();
    assert.equal(setPaid(record, 'asAgreed', '2026-11-12'), true);
    assert.deepEqual(record.complete, { date: '2026-11-12' });
    assert.equal(setPaid(record, undefined, '2026-11-13'), true);
    assert.equal('complete' in record, false);
    addPayment(record, { date: '2026-07-05', amount: 100, via: 'payroll' });
    completeRecord(record, '2026-11-12');
    setPaid(record, 'none', '2026-11-13');
    setPaid(record, undefined, '2026-11-13');
    assert.ok(record.complete, 'a cobro is recorded: it stays');
  });

  test('the minimum fails only beyond a margin for withholding differences', () => {
    const record = emptyRecord();
    closeMonths(OFFER, record, ['2026-06', '2026-07', '2026-08']);
    const base = law(record, OFFER);
    const { minimumNet } = base.minimum;
    const r = calc(OFFER, ctx);
    const floor = minimumNet - (minimumNet / r.netFactor) * r.pay.irpfPct;
    const pay = (amount) => {
      const rec = emptyRecord();
      addPayment(rec, { date: '2026-07-05', amount, via: 'payroll' });
      closeMonths(OFFER, rec, ['2026-06', '2026-07', '2026-08']);
      return law(rec, OFFER).minimum;
    };
    assert.equal(pay(minimumNet).short, 0);
    assert.equal(pay(Math.ceil(floor)).short, 0);
    assert.ok(Math.abs(pay(Math.floor(floor) - 10).short - (floor - (Math.floor(floor) - 10))) < 1);
  });

  test('an offer without an overnight bonus has no such row', () => {
    const none = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'p', overnight: 'no' });
    const x = lawFromRecord(none, emptyRecord(), settledOf(none, emptyRecord()), calc(none, ctx), []);
    assert.equal(x.overnight.applicable, calc(none, ctx).min.overnight > 0);
  });
});

describe('the public holidays of the offer’s place on the calendar', () => {
  const at = (fields) => offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'h', ...fields });
  const YEBRA = { municipality: '22252', province: 'HU' };
  const JULY = { key: '2026-07', from: '2026-07-01', to: '2026-07-31' };
  const names = (marks) => marks.filter((m) => m.holiday).map((m) => [m.date, m.holiday]);

  test('the days carry the holiday of the place; nowhere without verified data', () => {
    assert.deepEqual(names(defaultMarks(at(YEBRA), JUNE)), [['2026-06-25', 'Santa Orosia']]);
    assert.deepEqual(names(defaultMarks(at({ province: 'M' }), JUNE)), []);
    assert.deepEqual(names(defaultMarks(at({}), JUNE)), []);
    const y2027 = { key: '2027-06', from: '2027-06-01', to: '2027-06-30' };
    assert.deepEqual(names(defaultMarks(at({ ...YEBRA, start: '2027-06-01' }), y2027)), [], 'no data for 2027');
  });

  test('holidays taken off: the dates come libre and the days off are spread over the others', () => {
    const marks = defaultMarks(at({ ...YEBRA, holidays: 'yes' }), JUNE);
    assert.equal(marks.find((m) => m.date === '2026-06-25')?.kind, 'off');
    assert.equal(countsOf(marks).off, 5, 'four days off a month and the holiday');
    assert.ok(marks.every((m) => !m.recorded));
  });

  test('holidays not taken off: still jornada, only marked; the counts are the offer’s', () => {
    const marks = defaultMarks(at({ ...YEBRA, holidays: 'no' }), JUNE);
    assert.equal(marks.find((m) => m.date === '2026-06-25')?.kind, 'work');
    assert.deepEqual(
      marks.map((m) => m.kind),
      defaultMarks(at({ holidays: 'no' }), JUNE).map((m) => m.kind),
      'same days as an offer without a place',
    );
  });

  test('a closed month is frozen as shown, whatever the offer says afterwards', () => {
    const offer = at({ ...YEBRA, holidays: 'no' });
    const record = emptyRecord();
    closeMonth(offer, record, JUNE);
    offer.terms.holidays = 'yes';
    assert.equal(marksOf(offer, record, JUNE).find((m) => m.date === '2026-06-25')?.kind, 'work');
    assert.equal(marksOf(offer, record, JULY).filter((m) => m.holiday).length, 0, 'July has none');
  });

  test('an untouched offer shows no difference: the offer and the marks follow the same days', () => {
    const offer = at({ ...YEBRA, holidays: 'yes' });
    const acc = accountsOf(offer, emptyRecord(), '2026-06', '2026-11-12');
    assert.equal(acc?.delta, null);
    assert.equal(acc?.jornadas, 0);
  });

  describe('«Festivos trabajados» in the law row', () => {
    const settledOf = (offer, record) => settle(offer, record, '2026-11-12', calc(offer, ctx));
    const lawOf = (offer, months) => {
      const record = emptyRecord();
      for (const row of settledOf(offer, record).rows)
        if (months.includes(row.month)) closeMonth(offer, record, spanOf(row));
      return lawFromRecord(offer, record, settledOf(offer, record), calc(offer, ctx), record.payments).holidays;
    };

    test('known place: the holidays worked in closed months, with the agreement where there is one', () => {
      const june = lawOf(at({ ...YEBRA, holidays: 'no' }), ['2026-06']);
      assert.deepEqual([june.known, june.local], [true, true]);
      assert.deepEqual(june.worked, [{ date: '2026-06-25', name: 'Santa Orosia' }]);
      assert.match(june.agreement?.cite ?? '', /provincia de Huesca, art\. 35$/);
      assert.deepEqual(lawOf(at({ ...YEBRA, holidays: 'no' }), ['2026-07']).worked, []);
      assert.deepEqual(lawOf(at({ ...YEBRA, holidays: 'yes' }), ['2026-06']).worked, [], 'taken off: not worked');
    });

    test('Zaragoza has the community’s days only, and no agreement article', () => {
      const x = lawOf(at({ province: 'Z', holidays: 'no' }), ['2026-06', '2026-07', '2026-08']);
      assert.deepEqual([x.known, x.local, x.agreement], [true, false, null]);
      assert.deepEqual(
        x.worked.map((d) => d.date),
        ['2026-08-15'],
      );
    });

    test('no row where there is nothing to judge: unknown place, no closed month, a year without data', () => {
      assert.equal(lawOf(at({ province: 'M' }), ['2026-06']).known, false);
      assert.equal(lawOf(at({}), ['2026-06']).known, false);
      assert.equal(lawOf(at(YEBRA), []).known, false, 'no month closed');
    });
  });
});

describe('what the job left', () => {
  test('firm only with every month closed; the days real in closed months; vacation days among those contributed', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 1000, via: 'payroll' });
    addPayment(record, { date: '2026-07-06', amount: 300, via: 'cash' });
    const settled = settle(OFFER, record, '2026-11-12', calc(OFFER, ctx));
    const r = calc(OFFER, ctx);
    const open = balanceOf(OFFER, record, settled, r);
    assert.equal(open.firm, false);
    assert.equal(open.workedClosed, 0);
    assert.ok(open.worked > 0);
    for (const row of settled.rows) closeMonth(OFFER, record, spanOf(row));
    const s2 = settle(OFFER, record, '2026-11-12', calc(OFFER, ctx));
    const closed = balanceOf(OFFER, record, s2, r);
    assert.equal(closed.firm, true);
    assert.equal(closed.workedClosed, closed.worked);
    assert.equal(closed.contribDays, r.unemployment.contribDays);
    // vacation paid at the end contributes too: the days say so
    assert.ok(closed.contribVacationDays > 0 && closed.contribVacationDays < closed.contribDays);
  });
});

describe('«El mínimo legal» only where the minimum is what applies', () => {
  const linesOfOffer = (offer, today = '2026-11-12') => {
    const record = emptyRecord();
    return standingOf(settle(offer, record, today, calc(offer, ctx)), today, 'finished', [], calc(offer, ctx).netFactor)
      .lines;
  };
  const minimum = (lines) => lines.filter((x) => x.byMinimum).map((x) => x.key);

  test('a pay that covers it says nothing', () => {
    assert.deepEqual(minimum(linesOfOffer(OFFER)), []);
  });

  test('a pay below the minimum says it on the salary', () => {
    const low = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'l', payUnit: 'month', payAmount: 900 });
    assert.ok(minimum(linesOfOffer(low)).includes('salary'));
  });

  test('cash that brings the pay over the minimum takes it away again', () => {
    const base = { ...OFFER.terms, ...OFFER.mine, id: 'l', payUnit: 'month', payAmount: 900 };
    const covered = offerOf({ ...base, cashMode: 'amount', cashAmount: 700, cashUnit: 'month' });
    assert.ok(!minimum(linesOfOffer(covered)).includes('salary'));
  });
});

describe('the agreed cash is a line of its own, inside what corresponds', () => {
  const CASH = offerOf({
    ...OFFER.terms,
    ...OFFER.mine,
    id: 'c',
    cashMode: 'amount',
    cashAmount: 360,
    cashUnit: 'month',
  });
  const netOf = calc(CASH, ctx).netFactor;

  test('the lines add up to what corresponds, and «En negro» is the cash as handed', () => {
    const settled = settle(CASH, emptyRecord(), '2026-11-12', calc(CASH, ctx));
    const s = standingOf(settled, '2026-11-12', 'finished', [], netOf);
    const cash = s.lines.find((x) => x.key === 'cash');
    assert.equal(cash?.due, 1080); // three months at 360 in hand
    assert.equal(
      s.lines.reduce((t, x) => t + x.due, 0),
      s.corresponde,
    );
    // The same offer without the cash corresponds to less, by the cash
    const plain = standingOf(
      settle(OFFER, emptyRecord(), '2026-11-12', calc(OFFER, ctx)),
      '2026-11-12',
      'finished',
      [],
      NET,
    );
    assert.ok(Math.abs(s.corresponde - plain.corresponde - 1080) < 0.05);
  });

  test('the calendar of a month carries it too, and the lines add up to the month', () => {
    const m = accountsOf(CASH, emptyRecord(), '2026-06', '2026-11-12');
    assert.equal(m.lines.find((x) => x.key === 'cash')?.due, 360);
    assert.equal(
      m.lines.reduce((t, x) => t + x.due, 0),
      m.due,
    );
  });

  test('under way it is part of what has fallen due', () => {
    const s = standingOf(
      settle(CASH, emptyRecord(), '2026-07-15', calc(CASH, ctx)),
      '2026-07-15',
      'underway',
      [],
      netOf,
    );
    // June whole and July to the 15th: 360 a month, 15 of 31 days in the second
    assert.ok(Math.abs((s.lines.find((x) => x.key === 'cash')?.due ?? 0) - (360 + (360 * 15) / 30)) < 1);
  });
});

test('spanOf takes a settled row as the helpers need it', () => {
  const row = settle(OFFER, emptyRecord(), '2026-09-10', calc(OFFER, ctx)).rows[2];
  assert.deepEqual(spanOf(row), { key: '2026-08', from: '2026-08-01', to: '2026-08-31' });
});

describe('a net total agreed per day: the screens read exactly the agreed amount', () => {
  // «Molinos»: 70 € a day net en negro, no night stay, vacation inside, 52 days (a permanent contract: no severance on top)
  const MOLINOS = offerOf({
    id: 'm',
    name: 'Molinos',
    start: '2026-09-01',
    contract: 'permanent',
    duration: 52,
    durationUnit: 'days',
    hoursPerDay: 8,
    daysOff: 0,
    daysOffUnit: 'week',
    holidays: 'no',
    payrollMin: true,
    cashMode: 'total',
    totalAmount: 70,
    totalUnit: 'day',
    payType: 'gross',
    payAmount: '',
    payUnit: 'day',
    vacation: 'included',
    housing: 'no',
    car: 'noCar',
    kmHome: 0,
    overnight: 'no',
    irpfMode: 'auto',
  });
  const r = calc(MOLINOS, ctx);
  const record = emptyRecord();

  test('Corresponde is 70 € for each day of the job, vacation included', () => {
    const settled = settle(MOLINOS, record, '2026-12-01', calc(MOLINOS, ctx));
    const s = standingOf(settled, '2026-12-01', 'finished', [], r.netFactor);
    assert.ok(Math.abs(s.corresponde / r.time.daysWorked - 70) < 0.01, `${s.corresponde / r.time.daysWorked}`);
    assert.equal(
      s.lines.some((x) => x.byMinimum),
      false,
    );
  });

  test('each jornada more or less in a month is worth 70 €, as the month panel says it', () => {
    const rec = emptyRecord();
    const settled = settle(MOLINOS, rec, '2026-12-01', calc(MOLINOS, ctx));
    toggleDay(MOLINOS, rec, spanOf(settled.rows[1]), '05');
    const m = accountsOf(MOLINOS, rec, '2026-10', '2026-12-01');
    assert.equal(m.jornadas, -1);
    assert.ok(Math.abs(m.delta + 70) < 0.02, `${m.delta}`);
  });

  test('the month panel: 8 jornadas in the last month read 560 €, and one more jornada +70 €', () => {
    // 52 days from 18 September: the last month is 1 to 8 November
    const nov = offerOf({ ...MOLINOS.terms, ...MOLINOS.mine, id: 'n', start: '2026-09-18' });
    const rec = emptyRecord();
    const today = '2026-11-14';
    const panel = (record) => accountsOf(nov, record, '2026-11', today);
    const m = panel(rec);
    assert.equal(m.counts.work, 8);
    assert.ok(Math.abs(m.due - 560) < 0.05, `${m.due}`);
    const settled = settle(nov, rec, today, calc(nov, ctx));
    toggleDay(nov, rec, spanOf(settled.rows.at(-1)), '12'); // a day after the end: the job goes on to it
    const more = panel(rec);
    assert.equal(more.jornadas, 1);
    assert.ok(Math.abs(more.delta - 70) < 0.02, `${more.delta}`);
    assert.ok(Math.abs(more.due - 630) < 0.05, `${more.due}`);
    // The months before read 70 a jornada too
    const sept = accountsOf(nov, emptyRecord(), '2026-09', today);
    assert.ok(Math.abs(sept.due - 70 * sept.counts.work) < 0.1, `${sept.due} for ${sept.counts.work}`);
  });

  test('no line about the minimum: it does not exceed the pay agreed', () => {
    const settled = settle(MOLINOS, record, '2026-12-01', calc(MOLINOS, ctx));
    assert.equal(minimumNote(MOLINOS, settled, r), null);
  });
});

describe('why Corresponde is more than the pay agreed', () => {
  const below = (changes) =>
    offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'b', payUnit: 'month', payAmount: 900, ...changes });
  const note = (offer) =>
    minimumNote(offer, settle(offer, emptyRecord(), '2026-11-12', calc(offer, ctx)), calc(offer, ctx));

  test('where the minimum exceeds the pay: its components that apply, net, in one unit', () => {
    const x = note(below({}));
    assert.ok(x);
    assert.equal(x.unit, 'mes');
    assert.ok(x.components.some((c) => c.key === 'salary'));
    assert.ok(Math.abs(x.total - x.components.reduce((t, c) => t + c.amount, 0)) < 0.011);
    assert.ok(x.agreed < x.total);
  });

  test('the overnight bonus appears only with a night stay; per day for a wage per day', () => {
    assert.equal(
      note(below({ overnight: 'no' }))?.components.some((c) => c.key === 'overnight'),
      false,
    );
    assert.equal(
      note(below({ overnight: 'yes', province: 'HU' }))?.components.some((c) => c.key === 'overnight'),
      true,
    );
    assert.equal(note(below({ payUnit: 'day', payAmount: 20 }))?.unit, 'día');
  });

  test('an item short while the pay agreed is above the minimum as a whole: the item says so, except vacation without a contract', () => {
    const saved = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
    const offers = ingestSaved(saved, { fallbackCfg: { ...DEF_CFG } }).offers;
    const found = offers.find((o) => o.mine.name === 'Sin contrato D');
    const d = { ...found, terms: { ...found.terms, vacation: 'included' } };
    // «Las vacaciones no se pagan aparte» adds nothing where there is no contract: no line
    assert.equal(note(d), null);
    // The same figures as if there were a contract: the item that falls short is named
    const settled = settle(d, emptyRecord(), '2026-11-12', calc(d, ctx));
    const x = minimumNote(d, settled, { ...calc(d, ctx), noContract: false });
    assert.ok(x);
    assert.equal(x.exceeds, false);
    assert.deepEqual(
      x.short.map((s) => s.key),
      ['vacation'],
    );
    assert.ok(x.short[0].amount > 0);
  });

  test('a pay above the minimum has no line', () => {
    assert.equal(note(below({ payAmount: 5000 })), null);
  });
});

describe('days outside the job are not libranzas', () => {
  const ends = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'e', duration: 75 }); // ends on 14 August
  const monthOf = (rec) => accountsOf(ends, rec, '2026-08', '2026-11-12');

  test('the days after the end are flagged, and neither counted as libranzas nor valued', () => {
    const m = monthOf(emptyRecord());
    const outside = m.marks.filter((x) => x.outside);
    assert.equal(outside.length, 17); // 15 to 31 August
    assert.ok(outside.every((x) => x.kind === 'off'));
    assert.equal(m.counts.work + m.counts.off, 14);
  });

  test('a tap on one marks it jornada and the job goes on to it; the days after stay outside', () => {
    const rec = emptyRecord();
    const settled = settle(ends, rec, '2026-11-12', calc(ends, ctx));
    toggleDay(ends, rec, spanOf(settled.rows.at(-1)), '20');
    const m = monthOf(rec);
    assert.equal(m.marks.find((x) => x.day === '20').outside, false);
    assert.equal(m.marks.find((x) => x.day === '21').outside, true);
    assert.equal(m.marks.find((x) => x.day === '16').outside, false); // between the end and the day worked: part of the job
    assert.equal(m.counts.work + m.counts.off, 20);
  });
});

describe('the claim ladder’s transitions (ADR-0034)', () => {
  test('closeMonth notes when it closed, reopening forgets it, and a call without a date leaves none', () => {
    const record = emptyRecord();
    const span = { key: '2026-06', from: '2026-06-01', to: '2026-06-30' };
    assert.equal(closeMonth(OFFER, record, span, '2026-07-02'), true);
    assert.equal(record.months['2026-06'].closedAt, '2026-07-02');
    assert.equal(reopenMonth(record, '2026-06'), true);
    assert.equal('closedAt' in record.months['2026-06'], false);
    const other = emptyRecord();
    closeMonth(OFFER, other, span);
    assert.equal('closedAt' in other.months['2026-06'], false);
  });

  test('setEnd says the end and records nothing else; an empty date is refused', () => {
    const record = emptyRecord();
    assert.equal(setEnd(record, { how: 'dismissed', date: '2026-07-10' }), true);
    assert.deepEqual(record, { months: {}, payments: [], end: { how: 'dismissed', date: '2026-07-10' } });
    assert.equal(setEnd(record, { how: 'dismissed', date: '' }), false);
  });

  test('the end said ends the job in settle with no month closed: less is due, the last month stops there, its deadline is a year after it', () => {
    const today = '2027-01-15';
    const whole = settle(OFFER, emptyRecord(), today, calc(OFFER, ctx));
    const record = emptyRecord();
    setEnd(record, { how: 'dismissed', date: '2026-08-18' }); // a Tuesday; the offer runs to 31 August
    const cut = settle(OFFER, record, today, calc(OFFER, ctx));
    assert.ok(cut.totals.due < whole.totals.due);
    const august = cut.rows.at(-1);
    assert.equal(august.month, '2026-08');
    assert.equal(august.to, '2026-08-18');
    assert.equal(august.jobTo, '2026-08-18');
    assert.equal(august.dueDate, '2026-08-18');
    assert.equal(august.deadline, '2027-08-18');
    assert.equal(cut.job.to, '2026-08-18');
    assert.equal(cut.job.differs, true);
    // The days after it are outside the job, not libre
    const marks = marksOf(OFFER, record, spanOf(august), { from: august.jobFrom, to: august.jobTo });
    assert.ok(marks.filter((m) => m.date > '2026-08-18').every((m) => m.outside));
    // A month wholly after the end is not part of the job
    setEnd(record, { how: 'dismissed', date: '2026-07-10' });
    const july = settle(OFFER, record, today, calc(OFFER, ctx));
    assert.deepEqual(
      july.rows.map((row) => row.month),
      ['2026-06', '2026-07'],
    );
    assert.equal(july.rows.at(-1).deadline, '2027-07-10');
  });

  test('a day worked after the end said keeps the job going to it', () => {
    const record = emptyRecord();
    setEnd(record, { how: 'quit', date: '2026-08-10' });
    record.months['2026-08'] = { days: { 14: 'work' } };
    assert.equal(settle(OFFER, record, '2027-01-15', calc(OFFER, ctx)).job.to, '2026-08-14');
  });

  test('an offer with no end stops at the end said', () => {
    const open = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'o', durationUnit: 'unknown' });
    const record = emptyRecord();
    setEnd(record, { how: 'dismissed', date: '2026-07-20' });
    const s = settle(open, record, '2027-01-15', calc(open, ctx));
    assert.equal(s.job.to, '2026-07-20');
    assert.deepEqual(
      s.rows.map((row) => row.month),
      ['2026-06', '2026-07'],
    );
  });

  test('setEnd at or after the offer’s end changes only the end', () => {
    const record = emptyRecord();
    setEnd(record, { how: 'agreed', date: '2026-09-01' });
    assert.deepEqual(record, { months: {}, payments: [], end: { how: 'agreed', date: '2026-09-01' } });
    assert.equal(clearEnd(record), true);
    assert.equal(clearEnd(record), false);
  });

  test('sick leave marks the days to today sick in months not closed, the rest is sick by default, and it can be closed', () => {
    const record = emptyRecord();
    closeMonth(OFFER, record, { key: '2026-06', from: '2026-06-01', to: '2026-06-30' });
    assert.equal(startSick(record, '2026-06-29', '2026-07-02'), true);
    assert.deepEqual(record.sick, { from: '2026-06-29' });
    assert.equal(record.months['2026-07'].days['02'], 'sick');
    const july = marksOf(OFFER, record, { key: '2026-07', from: '2026-07-01', to: '2026-07-31' });
    assert.equal(july.find((m) => m.day === '20')?.kind, 'sick', 'the days to come follow the leave');
    assert.equal(endSick(record, '2026-07-10'), true);
    const closed = marksOf(OFFER, record, { key: '2026-07', from: '2026-07-01', to: '2026-07-31' });
    assert.notEqual(closed.find((m) => m.day === '20')?.kind, 'sick');
    assert.equal(endSick(emptyRecord(), '2026-07-10'), false);
    assert.equal(startSick(emptyRecord(), '', '2026-07-10'), false);
  });

  test('a recall answer is kept per year', () => {
    const record = emptyRecord();
    answerRecall(record, '2027', 'yes');
    answerRecall(record, '2028', 'no');
    assert.deepEqual(record.recall, { 2027: 'yes', 2028: 'no' });
  });

  test('«¿Se cobró?» is an answer, not a payment, and a cobro clears it', () => {
    const record = emptyRecord();
    assert.equal(setPaid(record, 'none'), true);
    assert.equal(setPaid(record, 'none'), false);
    assert.deepEqual(record.payments, []);
    addPayment(record, { date: '2026-07-05', amount: 100, via: 'cash' });
    assert.equal('paid' in record, false);
    assert.equal(setPaid(record, undefined), false);
    assert.equal(setPaid(record, 'asAgreed'), true);
    assert.equal(record.paid, 'asAgreed');
    assert.equal(setPaid(record, undefined), true);
    assert.equal('paid' in record, false);
  });

  test('evidence, start, parties and steps', () => {
    const record = emptyRecord();
    assert.equal(addEvidence(record, { date: '2026-09-01', text: '  ' }), false);
    assert.equal(addEvidence(record, { date: '2026-09-01', text: ' Mensaje ' }), true);
    assert.deepEqual(record.evidence, [{ date: '2026-09-01', text: 'Mensaje' }]);
    assert.equal(removeEvidence(record, 3), false);
    assert.equal(removeEvidence(record, 0), true);
    assert.equal(confirmStart(record, '2026-06-02'), true);
    assert.deepEqual(record.started, { date: '2026-06-02' });
    const offer = { mine: { parties: Object.freeze({ employerName: '' }), claim: Object.freeze({ steps: {} }) } };
    setParties(offer, { employerName: ' Casa Pérez ', employerId: '', workerName: 'Ana' });
    assert.deepEqual(offer.mine.parties, { employerName: 'Casa Pérez', workerName: 'Ana' });
    markStep(offer, 'talk', { done: '2026-11-01', note: ' por teléfono ' });
    markStep(offer, 'request', { done: '2026-11-02' });
    assert.deepEqual(offer.mine.claim.steps, {
      talk: { done: '2026-11-01', note: 'por teléfono' },
      request: { done: '2026-11-02' },
    });
    setPromise(offer, '2026-11-20', '2026-11-12');
    assert.deepEqual(offer.mine.claim.steps.talk, { done: '2026-11-01', note: 'por teléfono', promise: '2026-11-20' });
    setPromise(offer, '', '2026-11-12');
    assert.deepEqual(offer.mine.claim.steps.talk, { done: '2026-11-01', note: 'por teléfono' });
    assert.equal(unmarkStep(offer, 'talk'), true);
    assert.equal(unmarkStep(offer, 'talk'), false);
    assert.deepEqual(Object.keys(offer.mine.claim.steps), ['request']);
  });
});

describe('the status of a job on its card', () => {
  const job = (changes) =>
    jobStatus({ phase: 'finished', hasPayments: true, owed: 0, unclosed: 0, complete: true, ...changes });

  test('red where the ganadero owes, in a finished job and under way', () => {
    assert.deepEqual(job({ owed: 120 }), { tone: 'red', text: 'Debe el ganadero', owed: 120 });
    assert.equal(job({ phase: 'underway', owed: 50 })?.text, 'Falta');
    assert.equal(job({ hasPayments: false, owed: 500 })?.tone, 'amber', 'nothing is owed that was not said');
  });

  test('a finished job that owes says until when it can be claimed, or that the deadline passed', () => {
    const claim = { by: '2027-03-31', lapsed: false };
    assert.deepEqual(job({ owed: 120, claim }), { tone: 'red', text: 'Debe el ganadero', owed: 120, claim });
    assert.equal(job({ phase: 'underway', owed: 50, claim })?.claim, undefined);
  });

  test('lapsed is grey «Prescrito», never red; a finished job nobody recorded is grey «Sin registro»', () => {
    const claim = { by: null, lapsed: true };
    assert.deepEqual(job({ owed: 120, claim }), { tone: 'grey', text: 'Prescrito', owed: 120 });
    assert.equal(job({ phase: 'underway', owed: 50, claim })?.tone, 'red', 'under way nothing has lapsed');
    assert.deepEqual(job({ hasPayments: false, bare: true }), { tone: 'grey', text: 'Sin registro' });
    assert.equal(job({ phase: 'underway', hasPayments: false, bare: true }), null);
  });

  test('an approximate cobro marks what is owed', () => {
    assert.equal(job({ owed: 120, approx: true })?.approx, true);
    assert.equal(job({ owed: 120 })?.approx, undefined);
  });

  test('amber only while a claim deadline runs: after it, the job is calm', () => {
    assert.equal(job({ hasPayments: false, window: false }), null);
    assert.equal(job({ unclosed: 2, window: false }), null);
    assert.equal(job({ complete: false, window: false }), null);
    assert.equal(job({ complete: false, window: true })?.tone, 'amber');
  });

  test('amber where something remains to record', () => {
    assert.deepEqual(job({ hasPayments: false }), { tone: 'amber', text: 'Sin cobros apuntados' });
    assert.equal(job({ unclosed: 1 })?.text, '1 mes sin cerrar');
    assert.equal(job({ unclosed: 3 })?.text, '3 meses sin cerrar');
    assert.deepEqual(job({ complete: false }), { tone: 'amber', text: 'Cobros sin confirmar' });
  });

  test('nothing coloured for a job settled and closed, and nothing for one under way with nothing to record', () => {
    assert.deepEqual(job({}), { tone: null, text: 'Todo cobrado' });
    assert.equal(job({ phase: 'underway', hasPayments: false }), null);
    assert.equal(job({ phase: 'underway' }), null);
    assert.equal(job({ phase: 'underway', unclosed: 2 })?.text, '2 meses sin cerrar');
  });
});
