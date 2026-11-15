// A month kept as counts instead of per-day marks (ADR-0035): one reading for both encodings, in the figures, the
// calendar's marks, the transitions and the law check.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import { lawFromRecord } from '../../src/model/compliance.js';
import {
  closeMonth,
  countsOf,
  enterTotalDays,
  marksOf,
  setMonthCounts,
  startSick,
  toggleDay,
} from '../../src/model/record.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG, emptyRecord } from '../../src/offer.js';
import { offerOf } from './flat-offer.js';

const ctx = { cfg: { ...DEF_CFG }, offers: [] };
// June to August 2026, 60 € a worked day
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
const settleOf = (record, today = '2026-11-12') => settle(OFFER, record, today, calc(OFFER, ctx));
const juneRow = (record) => settleOf(record).rows.find((row) => row.month === '2026-06');

/** June as marks: the first `work` days worked, the rest off. */
const perDayJune = (work) => ({
  closed: true,
  days: Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [String(i + 1).padStart(2, '0'), i < work ? 'work' : 'off']),
  ),
});

describe('settle reads counts like marks', () => {
  test('a month of 20 days worked is worth what the same month marked day by day is', () => {
    const marked = emptyRecord();
    marked.months['2026-06'] = perDayJune(20);
    const counted = emptyRecord();
    counted.months['2026-06'] = { closed: true, count: { work: 20, off: 10, sick: 0 } };
    const a = juneRow(marked);
    const b = juneRow(counted);
    assert.equal(b.due, a.due);
    assert.deepEqual(b.facts, a.facts);
    assert.equal(b.facts.work, 20);
    assert.equal(b.facts.followingOffer, 0);
  });

  test('an open month of counts no longer follows the offer: the count is what happened', () => {
    const record = emptyRecord();
    record.months['2026-06'] = { closed: false, count: { work: 12, off: 18, sick: 0 } };
    const row = juneRow(record);
    assert.equal(row.facts.work, 12);
    assert.equal(row.facts.followingOffer, 0);
    const offerWorked = juneRow(emptyRecord()).facts.work + juneRow(emptyRecord()).facts.followingOffer;
    assert.ok(row.due < juneRow(emptyRecord()).due, `${row.due} vs the offer's ${offerWorked} days`);
  });
});

describe('the marks of a month of counts', () => {
  test('the counts are laid over the days: work first, then sick, then off, all flagged as counted', () => {
    const record = emptyRecord();
    record.months['2026-06'] = { closed: true, count: { work: 3, off: 25, sick: 2 } };
    const marks = marksOf(OFFER, record, JUNE);
    assert.deepEqual(countsOf(marks), { work: 3, off: 25, sick: 2 });
    assert.ok(marks.every((m) => m.counted && m.recorded));
    assert.deepEqual(
      marks.slice(0, 6).map((m) => m.kind),
      ['work', 'work', 'work', 'sick', 'sick', 'off'],
    );
    assert.ok(marksOf(OFFER, emptyRecord(), JUNE).every((m) => !m.counted));
  });

  test('days outside the job take no count', () => {
    const record = emptyRecord();
    record.months['2026-06'] = { closed: true, count: { work: 5, off: 0, sick: 0 } };
    const marks = marksOf(OFFER, record, JUNE, { from: '2026-06-11', to: '2026-06-30' });
    assert.deepEqual(
      marks.filter((m) => m.kind === 'work').map((m) => m.day),
      ['11', '12', '13', '14', '15'],
    );
    assert.ok(marks.filter((m) => m.outside).every((m) => m.kind === 'off'));
  });
});

describe('transitions on counted months', () => {
  test('setMonthCounts replaces the marks, refuses bad counts and closed months', () => {
    const record = emptyRecord();
    record.months['2026-06'] = { closed: false, days: { '01': 'work' } };
    assert.equal(setMonthCounts(record, '2026-06', { work: 20, off: 10 }), true);
    assert.deepEqual(record.months['2026-06'], { closed: false, count: { work: 20, off: 10, sick: 0 } });
    for (const bad of [{ work: -1 }, { work: 32 }, { work: 1.5 }, { work: 'x' }, { work: 5, sick: 40 }])
      assert.equal(setMonthCounts(record, '2026-06', /** @type {any} */ (bad)), false, JSON.stringify(bad));
    closeMonth(OFFER, record, JUNE, '2026-07-01');
    assert.equal(setMonthCounts(record, '2026-06', { work: 1 }), false);
    assert.equal(record.months['2026-06'].count.work, 20);
  });

  test('a counted month has no day to tap, closes keeping its counts and keeps its sick days in the count', () => {
    const record = emptyRecord();
    setMonthCounts(record, '2026-06', { work: 20, off: 10 });
    assert.equal(toggleDay(OFFER, record, JUNE, '05'), false);
    assert.equal(closeMonth(OFFER, record, JUNE, '2026-07-01'), true);
    assert.deepEqual(record.months['2026-06'], {
      closed: true,
      closedAt: '2026-07-01',
      count: { work: 20, off: 10, sick: 0 },
    });
    const other = emptyRecord();
    setMonthCounts(other, '2026-06', { work: 20, off: 10 });
    startSick(other, '2026-06-20', '2026-06-25');
    assert.equal('days' in other.months['2026-06'], false);
    assert.equal(other.months['2026-06'].count.work, 20);
  });

  test('a total for the job is spread into month counts, the rest of each month off; closed months stay', () => {
    const record = emptyRecord();
    record.months['2026-07'] = perDayJune(1);
    const months = [
      { key: '2026-06', days: 30 },
      { key: '2026-07', days: 31 },
      { key: '2026-08', days: 31 },
    ];
    assert.equal(enterTotalDays(record, months, 60), true);
    assert.deepEqual(record.months['2026-07'], perDayJune(1), 'closed: untouched');
    const june = record.months['2026-06'].count;
    const august = record.months['2026-08'].count;
    assert.equal(june.work + june.off, 30);
    assert.equal(august.work + august.off, 31);
    assert.ok(june.work > 0 && august.work > 0);
    assert.equal(enterTotalDays(record, months, -1), false);
    assert.equal(enterTotalDays(record, months, 2.5), false);
  });
});

describe('the law check cannot judge the rest of months kept as counts', () => {
  const restful = offerOf({ ...OFFER.terms, ...OFFER.mine, id: 'r', daysOff: 2, daysOffUnit: 'week' });
  const law = (record) => {
    const r = calc(restful, ctx);
    return lawFromRecord(restful, record, settle(restful, record, '2026-11-12', r), r, []);
  };

  test('a period with a counted month is not judged, and the count of such months is said', () => {
    const marked = emptyRecord();
    const days = {};
    for (let d = 1; d <= 30; d++) days[String(d).padStart(2, '0')] = 'work';
    marked.months['2026-06'] = { closed: true, days };
    assert.equal(law(marked).rest.fails.length, 1, 'the same days worked, marked one by one, fail');
    assert.equal(law(marked).rest.counted, 0);
    const counted = emptyRecord();
    counted.months['2026-06'] = { closed: true, count: { work: 30, off: 0, sick: 0 } };
    const x = law(counted);
    assert.equal(x.rest.periods, 0);
    assert.deepEqual(x.rest.fails, []);
    assert.equal(x.rest.counted, 1);
    assert.equal(x.days.worked, 30, 'the days worked are still counted');
  });
});
