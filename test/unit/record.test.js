// The record's transitions, the figures the screens read from settle, and the claim text. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { monthAccounts, spanOf, standingOf } from '../../src/model/accounts.js';
import { calc } from '../../src/model/calc.js';
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
    const before = settle(OFFER, record, '2026-09-10', ctx).rows[0];
    const raised = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 't', daysOff: 8, payAmount: 80 });
    const after = settle(raised, record, '2026-09-10', ctx).rows[0];
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
    const m = monthAccounts(OFFER, emptyRecord(), '2026-06', '2026-09-10', ctx);
    assert.equal(m.row.closed, false);
    assert.equal(m.jornadas, 0);
    assert.equal(m.delta, null);
    assert.equal(m.counts.off, 4);
  });

  test('one jornada less is one daily wage less, by counts', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    const m = monthAccounts(OFFER, record, '2026-06', '2026-09-10', ctx);
    assert.equal(m.jornadas, -1);
    assert.equal(m.delta, -60);
    assert.equal(m.counts.work, 25);
  });

  test('moving a libranza to another day is no difference', () => {
    const record = emptyRecord();
    const asOffer = defaultMarks(OFFER, JUNE);
    const offDay = asOffer.find((m) => m.kind === 'off').day;
    const workDay = asOffer.find((m) => m.kind === 'work' && m.day !== '01').day;
    toggleDay(OFFER, record, JUNE, offDay);
    toggleDay(OFFER, record, JUNE, workDay);
    const m = monthAccounts(OFFER, record, '2026-06', '2026-09-10', ctx);
    assert.equal(m.jornadas, 0);
    assert.equal(m.delta, null);
  });

  test('a closed month shows no difference, and an unknown month is null', () => {
    const record = emptyRecord();
    toggleDay(OFFER, record, JUNE, '02');
    closeMonth(OFFER, record, JUNE);
    assert.equal(monthAccounts(OFFER, record, '2026-06', '2026-09-10', ctx).delta, null);
    assert.equal(monthAccounts(OFFER, record, '2025-01', '2026-09-10', ctx), null);
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
    assert.equal(s.accrued, net(rows[0].items.salary.due + rows[0].items.overnight.due));
    assert.equal(s.hasPayments, false);
    assert.equal(s.running?.month, '2026-07');
    assert.ok(s.running.amount > 0 && s.running.amount < net(rows[1].items.salary.due));
    assert.equal(s.vacation, net(rows[2].items.vacation.due));
    assert.deepEqual(
      s.unclosed.map((r) => r.month),
      ['2026-06'],
    );
  });

  test('cobros are what arrived, and the balance is accrued minus them', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 1000, via: 'payroll' });
    const s = stand(record, '2026-07-15', 'underway');
    assert.equal(s.received, 1000);
    assert.equal(s.balance, Math.round((s.accrued - 1000) * 100) / 100);
    assert.equal(s.hasPayments, true);
  });

  test('finished: the items add up to the accrued, and each month has its state, owed amount and deadline', () => {
    const record = emptyRecord();
    addPayment(record, { date: '2026-07-05', amount: 1000, via: 'cash' });
    closeMonth(OFFER, record, JUNE);
    const settled = settle(OFFER, record, '2026-11-12', ctx);
    const s = standingOf(settled, '2026-11-12', 'finished', record.payments, NET);
    assert.equal(
      s.items.reduce((t, x) => t + x.due, 0),
      s.accrued,
    );
    assert.equal(s.running, null);
    assert.equal(s.vacation, 0);
    assert.deepEqual(
      s.months.map((m) => [m.month, m.closed]),
      [
        ['2026-06', true],
        ['2026-07', false],
        ['2026-08', false],
      ],
    );
    assert.equal(s.unclosed.length, 2);
    const owing = s.months.filter((m) => m.owed > 0);
    assert.ok(owing.length > 0 && owing.every((m) => m.deadline && m.daysLeft !== null));
    assert.equal(s.months[0].due, net(settled.rows[0].due));
    assert.equal(s.cash, settled.totals.cash);
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
  const row = settle(OFFER, emptyRecord(), '2026-09-10', ctx).rows[2];
  assert.deepEqual(spanOf(row), { key: '2026-08', from: '2026-08-01', to: '2026-08-31' });
});
