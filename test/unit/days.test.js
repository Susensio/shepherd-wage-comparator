// Day counting on ISO dates and month keys.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysBetween, monthDays, monthFacts, monthSpan, spreadTotal } from '../../src/model/days.js';
import { parseDate } from '../../src/offer.js';

test('days between two ISO dates, signed', () => {
  assert.equal(daysBetween('2026-06-01', '2026-06-11'), 10);
  assert.equal(daysBetween('2026-06-11', '2026-06-01'), -10);
  assert.equal(daysBetween('2026-06-01', '2026-06-01'), 0);
});

test('days of a month, leap years included', () => {
  assert.equal(monthDays(2026, 2), 28);
  assert.equal(monthDays(2028, 2), 29);
  assert.equal(monthDays(2026, 12), 31);
});

test('the span of a month key', () => {
  assert.deepEqual(monthSpan('2026-02'), { key: '2026-02', from: '2026-02-01', to: '2026-02-28' });
});

const d = (iso) => parseDate(iso);

test('a month read per day or as counts gives the same kind of answer', () => {
  const perDay = monthFacts(
    { days: { '01': 'work', '02': 'work', '03': 'off', '04': 'sick', '09': 'work' } },
    d('2026-06-01'),
    d('2026-06-30'),
  );
  assert.deepEqual(perDay, { counts: { work: 3, off: 1, sick: 1 }, touched: 5, counted: false });
  const counted = monthFacts({ count: { work: 20, off: 8, sick: 2 } }, d('2026-06-01'), d('2026-06-30'));
  assert.deepEqual(counted, { counts: { work: 20, off: 8, sick: 2 }, touched: 30, counted: true });
});

test('per-day marks outside the job’s part of the month are not counted', () => {
  const x = monthFacts({ days: { '01': 'work', 15: 'work', 30: 'work' } }, d('2026-06-10'), d('2026-06-20'));
  assert.deepEqual(x.counts, { work: 1, off: 0, sick: 0 });
});

test('counts account for every day of the job’s part: what they leave out is off, and work cannot pass the days', () => {
  assert.deepEqual(monthFacts({ count: { work: 10, off: 0, sick: 0 } }, d('2026-06-01'), d('2026-06-30')).counts, {
    work: 10,
    off: 20,
    sick: 0,
  });
  assert.deepEqual(monthFacts({ count: { work: 25, off: 0, sick: 3 } }, d('2026-06-11'), d('2026-06-20')).counts, {
    work: 10,
    off: 0,
    sick: 0,
  });
  assert.deepEqual(monthFacts(undefined, d('2026-06-01'), d('2026-06-30')).counts, { work: 0, off: 0, sick: 0 });
});

test('a total of days is spread over the months in proportion to their days, whole days adding up to the total', () => {
  const months = [
    { key: '2026-06', days: 30 },
    { key: '2026-07', days: 31 },
    { key: '2026-08', days: 31 },
  ];
  const got = spreadTotal(60, months);
  assert.deepEqual(
    Object.values(got).reduce((t, n) => t + n, 0),
    60,
  );
  assert.deepEqual(got, { '2026-06': 20, '2026-07': 20, '2026-08': 20 });
  const odd = spreadTotal(50, months);
  assert.equal(
    Object.values(odd).reduce((t, n) => t + n, 0),
    50,
  );
  for (const [key, n] of Object.entries(odd))
    assert.ok(Math.abs(n - (50 * months.find((m) => m.key === key).days) / 92) < 1);
});

test('a total never gives a month more days than it has, is cut to the days there are, and a part month weighs less', () => {
  const months = [
    { key: '2026-06', days: 10 },
    { key: '2026-07', days: 31 },
  ];
  assert.deepEqual(spreadTotal(500, months), { '2026-06': 10, '2026-07': 31 });
  assert.deepEqual(spreadTotal(0, months), { '2026-06': 0, '2026-07': 0 });
  assert.deepEqual(spreadTotal(41, months), { '2026-06': 10, '2026-07': 31 });
  const some = spreadTotal(20, months);
  assert.equal(some['2026-06'] + some['2026-07'], 20);
  assert.ok(some['2026-06'] <= 10 && some['2026-06'] >= 4, JSON.stringify(some));
  assert.deepEqual(spreadTotal(5, []), {});
});
