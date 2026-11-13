// The record's transitions, the figures the screens read from settle, and the claim text. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { monthAccounts, spanOf, standingOf } from '../../src/model/accounts.js';
import { calc } from '../../src/model/calc.js';
import { lawFromRecord } from '../../src/model/compliance.js';
import {
  addPayment,
  closeMonth,
  countsOf,
  defaultMarks,
  lastWayOf,
  marksOf,
  removePayment,
  reopenMonth,
  toggleDay,
} from '../../src/model/record.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG, emptyRecord } from '../../src/offer.js';
import { createOffers } from '../../src/offers.js';
import { recordClaimText } from '../../src/text.js';
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
    const before = settle(OFFER, record, '2026-09-10', ctx, NET).rows[0];
    const raised = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 't', daysOff: 8, payAmount: 80 });
    const after = settle(raised, record, '2026-09-10', ctx, NET).rows[0];
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
    const m = monthAccounts(OFFER, emptyRecord(), '2026-06', '2026-09-10', ctx, NET);
    assert.equal(m.row.closed, false);
    assert.equal(m.jornadas, 0);
    assert.equal(m.delta, null);
    assert.equal(m.counts.off, 4);
  });

  test('one jornada less is one daily wage less, by counts', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    const m = monthAccounts(OFFER, record, '2026-06', '2026-09-10', ctx, NET);
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
    const m = monthAccounts(OFFER, record, '2026-06', '2026-09-10', ctx, NET);
    assert.equal(m.jornadas, 0);
    assert.equal(m.delta, null);
  });

  test('a closed month shows no difference, and an unknown month is null', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    closeMonth(OFFER, record, JUNE);
    assert.equal(monthAccounts(OFFER, record, '2026-06', '2026-09-10', ctx, NET).delta, null);
    assert.equal(monthAccounts(OFFER, record, '2025-01', '2026-09-10', ctx, NET), null);
  });
});

describe('where an offer stands, in net', () => {
  const stand = (record, today, phase) =>
    standingOf(settle(OFFER, record, today, ctx), today, phase, record.payments, NET);
  const net = (gross) => Math.round(gross * NET * 100) / 100;

  test('under way: months that have ended are accrued, the current one and the vacation are aside', () => {
    const s = stand(emptyRecord(), '2026-07-15', 'underway');
    const rows = settle(OFFER, emptyRecord(), '2026-07-15', ctx).rows;
    assert.deepEqual(
      s.ended.map((r) => r.month),
      ['2026-06'],
    );
    assert.equal(s.corresponde, net(rows[0].items.salary.due + rows[0].items.overnight.due));
    assert.equal(s.hasPayments, false);
    assert.equal(s.running?.month, '2026-07');
    assert.ok(s.running.amount > 0 && s.running.amount < net(rows[1].items.salary.due));
    assert.equal(s.vacation, net(rows[2].items.vacation.due));
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
    const settled = settle(OFFER, record, '2026-11-12', ctx);
    const s = standingOf(settled, '2026-11-12', 'finished', record.payments, NET);
    assert.equal(
      s.lines.reduce((t, x) => t + x.due, 0),
      s.corresponde,
    );
    assert.equal(s.running, null);
    assert.equal(s.vacation, 0);
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
    const settled = settle(offer, record, '2026-11-12', ctx);
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
  const settledOf = (offer, record) => settle(offer, record, '2026-11-12', ctx);
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

  test('the overnight bonus and the minimum on payroll wait for every month closed and a payroll cobro', () => {
    const offer = offerOf({
      ...OFFER.terms,
      ...OFFER.mine,
      id: 'o',
      overnight: 'yes',
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
    closeMonths(offer, record, ['2026-08']);
    const all = law(record, offer);
    assert.equal(all.overnight.known, true);
    assert.ok(all.overnight.missing > 0);
    assert.ok(all.minimum.known && all.minimum.short > 0);
    // All closed but no payroll cobro (cash only): still nothing to judge
    const cash = emptyRecord();
    addPayment(cash, { date: '2026-07-05', amount: 100, via: 'cash' });
    closeMonths(offer, cash, ['2026-06', '2026-07', '2026-08']);
    assert.equal(law(cash, offer).overnight.known, false);
    // Plenty on payroll: nothing missing and the minimum met
    const rich = emptyRecord();
    addPayment(rich, { date: '2026-07-05', amount: 99999, via: 'payroll' });
    closeMonths(offer, rich, ['2026-06', '2026-07', '2026-08']);
    const full = law(rich, offer);
    assert.equal(full.overnight.missing, 0);
    assert.equal(full.minimum.short, 0);
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

describe('«El mínimo legal» only where the minimum is what applies', () => {
  const linesOfOffer = (offer, today = '2026-11-12') => {
    const record = emptyRecord();
    return standingOf(settle(offer, record, today, ctx), today, 'finished', [], calc(offer, ctx).netFactor).lines;
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
    const settled = settle(CASH, emptyRecord(), '2026-11-12', ctx);
    const s = standingOf(settled, '2026-11-12', 'finished', [], netOf);
    const cash = s.lines.find((x) => x.key === 'cash');
    assert.equal(cash?.due, 1080); // three months at 360 in hand
    assert.equal(
      s.lines.reduce((t, x) => t + x.due, 0),
      s.corresponde,
    );
    // The same offer without the cash corresponds to less, by the cash
    const plain = standingOf(settle(OFFER, emptyRecord(), '2026-11-12', ctx), '2026-11-12', 'finished', [], NET);
    assert.ok(Math.abs(s.corresponde - plain.corresponde - 1080) < 0.05);
  });

  test('the calendar of a month carries it too, and the lines add up to the month', () => {
    const m = monthAccounts(CASH, emptyRecord(), '2026-06', '2026-11-12', ctx, netOf);
    assert.equal(m.lines.find((x) => x.key === 'cash')?.due, 360);
    assert.equal(
      m.lines.reduce((t, x) => t + x.due, 0),
      m.due,
    );
  });

  test('under way it is part of what has fallen due', () => {
    const s = standingOf(settle(CASH, emptyRecord(), '2026-07-15', ctx), '2026-07-15', 'underway', [], netOf);
    assert.equal(s.lines.find((x) => x.key === 'cash')?.due, 360);
  });

  test('the claim says what was agreed in hand', () => {
    const text = recordClaimText(CASH, settle(CASH, emptyRecord(), '2026-11-12', ctx), emptyRecord());
    assert.match(text, /1\.080\s€ netos se pactaron en mano, sin declarar: se reclaman como se pactaron/);
  });
});

describe('the claim text', () => {
  const claim = (record, today = '2026-11-12') => recordClaimText(OFFER, settle(OFFER, record, today, ctx), record);

  test('without a cobro it claims nothing, only what is accrued', () => {
    const text = claim(emptyRecord());
    assert.match(text, /No consta ningún cobro/);
    assert.doesNotMatch(text, /Queda por pagar/);
    assert.match(text, /Meses sin cerrar, calculados según la oferta: junio, julio y agosto/);
  });

  test('with cobros it lists them, the cash apart, and what is owed per month and item', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 1000, via: 'payroll', note: 'junio' });
    addPayment(record, { date: '2026-08-05', amount: 300, via: 'cash' });
    closeMonth(OFFER, record, JUNE);
    const text = claim(record);
    assert.match(text, /Cobrado: 1\.300.* netos en 2 cobros, de ellos 300.* en mano, sin declarar/);
    assert.match(text, /5 jul 2026: 1\.000.* en nómina \(junio\)/);
    assert.match(text, /5 ago 2026: 300.* en mano/);
    assert.match(text, /Queda por pagar, bruto: /);
    assert.match(text, /· julio de 2026: salario /);
    assert.match(text, /Plazo para reclamar: un año/);
    assert.match(text, /calculados según la oferta: julio y agosto\./);
    assert.doesNotMatch(text, /sin cerrar.*junio/);
  });

  test('a fully paid job owes nothing', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-11-01', amount: 99999, via: 'payroll' });
    assert.match(claim(record), /No queda nada por pagar/);
  });
});

test('spanOf takes a settled row as the helpers need it', () => {
  const row = settle(OFFER, emptyRecord(), '2026-09-10', ctx, NET).rows[2];
  assert.deepEqual(spanOf(row), { key: '2026-08', from: '2026-08-01', to: '2026-08-31' });
});
