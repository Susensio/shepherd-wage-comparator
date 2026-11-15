// Day counting on ISO dates and month keys.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysBetween, monthDays, monthSpan } from '../../src/model/days.js';

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
