// What the record's views show of a job, from the offer, its settled months and what the page has open.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import {
  cardOf,
  cardsOf,
  monthFlags,
  monthOnCalendar,
  monthStrip,
  nextSeasonStart,
  paymentsNewestFirst,
  pillPhase,
  recallOf,
  recordPhase,
  unconfirmedStart,
} from '../../src/model/job-view.js';
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

  test('«Por empezar» until the start is confirmed or something is recorded', () => {
    const o = jobOf();
    assert.equal(unconfirmedStart(o, 'underway'), true);
    assert.equal(pillPhase(o, 'underway'), 'toStart');
    assert.equal(pillPhase(o, 'finished'), 'finished');
    o.mine.record.started = { date: '2026-06-01' };
    assert.equal(pillPhase(o, 'underway'), 'underway');
  });
});

describe('the questions at the turns of a job', () => {
  test('«¿Empezó?» only under way with nothing recorded and no other question open', () => {
    const o = jobOf();
    const settled = settledOf(o);
    assert.deepEqual(cardsOf(o, 'underway', settled, TODAY, {}).start, { date: '2026-06-01', other: false });
    assert.equal(cardsOf(o, 'underway', settled, TODAY, { startOther: true }).start.other, true);
    assert.equal(cardsOf(o, 'underway', settled, TODAY, { asked: { how: null } }).start, null);
  });

  test('«¿Cómo acabó?» for a finished job with no end, unless put off; its date is never after today', () => {
    const o = jobOf();
    const day = '2026-12-01';
    const settled = settledOf(o, day);
    const end = cardsOf(o, 'finished', settled, day, {}).end;
    assert.equal(end.min, '2026-06-01');
    assert.ok(end.agreedDate <= day);
    assert.equal(cardsOf(o, 'finished', settled, day, { endLater: true }), null);
    assert.equal(cardsOf(o, 'finished', settled, day, { endLater: true, asked: { how: 'quit' } }).end.how, 'quit');
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

  test('a job not confirmed as started has a pill and no status', () => {
    const card = cardFor(jobOf());
    assert.equal(card.phase, 'underway');
    assert.equal(card.pill, 'toStart');
    assert.equal(card.status, null);
  });

  test('a confirmed job under way has a status', () => {
    const o = jobOf({}, { months: {}, payments: [], started: { date: '2026-06-01' } });
    const card = cardFor(o);
    assert.equal(card.pill, 'underway');
    assert.ok('status' in card);
  });
});
