// What the record's views show of a job, from the offer, its settled months and what the page has open.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import {
  cardOf,
  cardsOf,
  cobradoOf,
  isBare,
  monthFlags,
  monthOnCalendar,
  monthStrip,
  nextSeasonStart,
  paymentsNewestFirst,
  pillPhase,
  recallOf,
  recordPhase,
} from '../../src/model/job-view.js';
import { addPayment, setPaid } from '../../src/model/record.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG, emptyRecord } from '../../src/offer.js';
import { offerOf } from './flat-offer.js';

const ctx = { cfg: { ...DEF_CFG }, offers: [] };
const TODAY = '2026-07-15';
const BASE = {
  id: 'j',
  start: '2026-06-01',
  contract: 'permanent',
  duration: 92,
  durationUnit: 'days',
  hoursPerDay: 8,
  daysOff: 4,
  daysOffUnit: 'month',
  payType: 'gross',
  payAmount: 60,
  payUnit: 'day',
  car: 'noCar',
};
const jobOf = (extra = {}, record = emptyRecord()) => {
  const o = offerOf({ ...BASE, ...extra });
  o.mine.record = record;
  return o;
};
const settledOf = (o, today = TODAY) => settle(o, o.mine.record, today, calc(o, ctx));

describe('the phase of a record, and the pill', () => {
  test('a dated, complete offer under way has a record phase; only an offer or an undated one has none', () => {
    assert.equal(recordPhase(jobOf(), TODAY), 'underway');
    assert.equal(recordPhase(jobOf(), '2026-12-01'), 'finished');
    assert.equal(recordPhase(jobOf({ offerOnly: true }), TODAY), null);
    assert.equal(recordPhase(jobOf({ start: '' }), TODAY), null);
    // thin terms: no hours, no pay, still a record
    assert.equal(recordPhase(jobOf({ hoursPerDay: '', payAmount: '', vacation: '' }), TODAY), 'underway');
  });

  test('a job is taken as started on its date: the pill is its phase, never «Por empezar»', () => {
    const o = jobOf();
    assert.equal(pillPhase(o, 'underway'), 'underway');
    assert.equal(pillPhase(o, 'finished'), 'finished');
  });
});

describe('the questions at the turns of a job', () => {
  test('the start date is asked only once «Empezó otro día» was chosen in the menu', () => {
    const o = jobOf();
    const settled = settledOf(o);
    assert.equal(cardsOf(o, 'underway', settled, TODAY, {}), null);
    assert.deepEqual(cardsOf(o, 'underway', settled, TODAY, { startOther: true }).start, {
      date: '2026-06-01',
      other: true,
    });
    assert.equal(cardsOf(o, 'underway', settled, TODAY, { asked: { how: null } }).start, null);
  });

  test('«Cómo acabó» defaults to the agreed end as a line; the ways to end are one tap away; its date is never after today', () => {
    const o = jobOf();
    const day = '2026-12-01';
    const settled = settledOf(o, day);
    // Nothing recorded: nothing is said of the end
    assert.equal(cardsOf(o, 'finished', settled, day, {}), null);
    // Once «No todo» opens the record, it ended as agreed: a line, not a question
    const defaulted = cardsOf(o, 'finished', settled, day, { recording: true });
    assert.equal(defaulted.end, null);
    assert.ok(defaulted.endDefault && defaulted.endDefault.date <= day);
    assert.equal(cardsOf(o, 'finished', settled, day, { recording: true, endLater: true }), null);
    // Asked by hand («Cambiar»): the ways to end
    const end = cardsOf(o, 'finished', settled, day, { asked: { how: null } }).end;
    assert.equal(end.min, '2026-06-01');
    assert.ok(end.agreedDate <= day);
    assert.equal(cardsOf(o, 'finished', settled, day, { endLater: true, asked: { how: 'quit' } }).end.how, 'quit');
    // Something recorded: the same default line
    addPayment(o.mine.record, { date: '2026-09-01', amount: 100, via: 'cash' });
    assert.equal(cardsOf(o, 'finished', settled, day, {}).end, null);
    assert.ok(cardsOf(o, 'finished', settled, day, {}).endDefault);
  });

  test('a job finished with nothing recorded is bare, until «No todo» is answered', () => {
    const o = jobOf();
    assert.equal(isBare(o, 'finished', false), true);
    assert.equal(isBare(o, 'finished', true), false);
    assert.equal(isBare(o, 'underway', false), false);
    o.mine.record.paid = 'asAgreed';
    assert.equal(isBare(o, 'finished', false), false);
  });

  test('a fijo discontinuo that ended at its campaign is asked about the next one, from a year on', () => {
    const o = jobOf({ contract: 'seasonal' }, { months: {}, payments: [], end: { how: 'agreed', date: '2026-08-31' } });
    assert.equal(nextSeasonStart(o), '2027-06-01');
    assert.equal(recallOf(o, '2027-05-31', undefined), null);
    assert.deepEqual(recallOf(o, '2027-06-01', { no: true, error: 'x' }), {
      year: '2027',
      no: true,
      error: 'x',
      min: '2026-08-31',
    });
    o.mine.record.recall = { 2027: 'yes' };
    assert.equal(recallOf(o, '2027-06-01', undefined), null);
  });
});

describe('the months of the job', () => {
  const rows = settledOf(jobOf()).rows;

  test('the calendar shows the month picked if it has started, else the one in progress', () => {
    assert.equal(monthOnCalendar(undefined, rows, TODAY, 'underway', null), '2026-07');
    assert.equal(monthOnCalendar('2026-06', rows, TODAY, 'underway', null), '2026-06');
    assert.equal(monthOnCalendar('2026-08', rows, TODAY, 'underway', null), '2026-07'); // not started yet
    assert.equal(monthOnCalendar('2026-09', rows, TODAY, 'underway', '2026-09'), '2026-09'); // the one that can be added
  });

  test('the strip gives each month its state, marks the one shown and ends with the one that can be added', () => {
    const strip = monthStrip(rows, TODAY, '2026-07', '2026-09');
    assert.deepEqual(
      strip.map((x) => [x.month, x.state, x.selected]),
      [
        ['2026-06', 'due', false],
        ['2026-07', 'now', true],
        ['2026-08', 'later', false],
        ['2026-09', 'add', false],
      ],
    );
  });

  test('a month flags whether it is in the job, in progress, or over', () => {
    assert.deepEqual(monthFlags(rows[1], TODAY), { inJob: true, current: true, canClose: false });
    assert.deepEqual(monthFlags(rows[0], TODAY), { inJob: true, current: false, canClose: true });
    assert.deepEqual(monthFlags(undefined, TODAY), { inJob: false, current: false, canClose: false });
  });
});

test('the cobros come newest first, the later entry first on one day', () => {
  const p = (id, date) => ({ id, date, amount: 1, via: 'cash' });
  assert.deepEqual(
    paymentsNewestFirst([p('a', '2026-06-30'), p('b', '2026-07-10'), p('c', '2026-07-10')]).map((x) => x.id),
    ['c', 'b', 'a'],
  );
});

describe('the card of a job', () => {
  const cardFor = (o, today = TODAY) => cardOf(o, calc(o, ctx), () => settledOf(o, today), today);

  test('an offer only, or one without a date, has no phase and settles nothing', () => {
    let asked = 0;
    const o = jobOf({ offerOnly: true });
    assert.deepEqual(
      cardOf(o, calc(o, ctx), () => asked++, TODAY),
      { phase: null, status: null },
    );
    assert.equal(asked, 0);
  });

  test('a job under way is taken as started on its date: its phase as pill, no «Por empezar»', () => {
    const card = cardFor(jobOf());
    assert.equal(card.phase, 'underway');
    assert.equal(card.pill, 'underway');
  });

  test('a confirmed job under way has a status', () => {
    const o = jobOf({}, { months: {}, payments: [], started: { date: '2026-06-01' } });
    const card = cardFor(o);
    assert.equal(card.pill, 'underway');
    assert.ok('status' in card);
  });

  test('a finished job with Falta changes with what is expected and the clock: Por confirmar, Esperando cobro, Debe', () => {
    const finished = (said) => {
      const o = jobOf({}, emptyRecord());
      addPayment(o.mine.record, { date: '2026-07-05', amount: 100, via: 'payroll' });
      Object.assign(o.mine.record, said);
      return o;
    };
    const text = (o, today) => cardFor(o, today).status?.text;
    assert.equal(text(finished({}), '2026-11-17'), 'Por confirmar');
    assert.equal(text(finished({ expecting: {} }), '2026-11-17'), 'Esperando cobro');
    const promised = finished({ expecting: { by: '2026-12-15' } });
    assert.equal(text(promised, '2026-12-15'), 'Esperando cobro');
    assert.equal(text(promised, '2026-12-16'), 'Debe', 'the promise passed');
    assert.equal(text(finished({ complete: { date: '2026-11-01' } }), '2026-11-17'), 'Debe');
    assert.equal(cardFor(finished({}), '2026-11-17').status?.tone, 'grey');
  });

  test('a finished job with nothing missing is Saldado', () => {
    const o = jobOf({}, emptyRecord());
    addPayment(o.mine.record, { date: '2026-07-05', amount: 100000, via: 'payroll' });
    for (const row of settledOf(o, '2026-11-17').rows) o.mine.record.months[row.month] = { closed: true, days: {} };
    assert.deepEqual(cardFor(o, '2026-11-17').status, { tone: 'green', text: 'Saldado' });
  });
});

describe('cobradoOf: the one reading of «Cobrado»', () => {
  const cardWith = (changes, today) => {
    const o = offerOf({ ...BASE, ...changes });
    changes.setup?.(o);
    const r = calc(o, ctx);
    return { o, card: cardOf(o, r, () => settle(o, o.mine.record, today, r), today), r };
  };

  test('cobros: what arrived, as the Cuentas tile has it', () => {
    const o = offerOf(BASE);
    addPayment(o.mine.record, { date: '2026-08-01', amount: 700, via: 'payroll' });
    const r = calc(o, ctx);
    const card = cardOf(o, r, () => settle(o, o.mine.record, '2026-10-01', r), '2026-10-01');
    assert.deepEqual(card.cobrado, { basis: 'cobros', amount: 700, approx: false });
  });

  test('«Lo pactado» and «Nada» are known; «Lo pactado» is what the terms agreed, net', () => {
    const o = offerOf(BASE);
    setPaid(o.mine.record, 'asAgreed');
    const r = calc(o, ctx);
    const card = cardOf(o, r, () => settle(o, o.mine.record, '2026-10-01', r), '2026-10-01');
    assert.equal(card.cobrado?.basis, 'asAgreed');
    assert.ok((card.cobrado?.amount ?? 0) > 1000);
    const none = offerOf(BASE);
    setPaid(none.mine.record, 'none');
    const card2 = cardOf(none, r, () => settle(none, none.mine.record, '2026-10-01', r), '2026-10-01');
    assert.deepEqual(card2.cobrado, { basis: 'none', amount: 0, approx: false });
  });

  test('unknown: the agreed money, «≈», for a finished job; nothing for one still under way', () => {
    const finished = cardWith({}, '2026-10-01');
    assert.equal(finished.card.cobrado?.basis, 'unknown');
    assert.equal(finished.card.cobrado?.amount, finished.r.earnings.received);
    assert.equal(finished.card.cobrado?.approx, true);
    const underway = cardWith({}, '2026-07-15');
    assert.equal(underway.card.cobrado?.amount, 0);
  });

  test('a function of the record alone: without a standing it is unknown', () => {
    const o = offerOf(BASE);
    assert.equal(cobradoOf(o, calc(o, ctx), 'underway', null).amount, 0);
  });
});
