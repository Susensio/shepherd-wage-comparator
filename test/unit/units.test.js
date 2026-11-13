// The unit an offer is shown in: per month, or per day when a month would be an extrapolation or an invention.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offerUnit } from '../../src/units.js';

const time = (over = {}) => ({ noDuration: false, months: 4, ...over });

test('a contract of months is shown per month, one under a month per day', () => {
  assert.equal(offerUnit({ time: time() }, { payUnit: 'month' }), 'month');
  assert.equal(offerUnit({ time: time({ months: 0.5 }) }, { payUnit: 'month' }), 'day');
});

test('without a duration the unit follows the one the pay was written in', () => {
  const r = { time: time({ noDuration: true, months: 1 }) };
  assert.equal(offerUnit(r, { payUnit: 'day', cashMode: 'amount' }), 'day');
  assert.equal(offerUnit(r, { payUnit: 'month', cashMode: 'amount' }), 'month');
  assert.equal(offerUnit(r, { payUnit: 'total', cashMode: 'amount' }), 'month');
  // An agreed total written per day counts too, and the minimum wage as the payroll does not
  assert.equal(offerUnit(r, { payUnit: 'month', cashMode: 'total', totalUnit: 'day', contract: 'temporary' }), 'day');
  assert.equal(offerUnit(r, { payUnit: 'day', payrollMin: true, cashMode: 'amount' }), 'month');
});

test('with a duration the written unit does not change it', () => {
  assert.equal(offerUnit({ time: time() }, { payUnit: 'day' }), 'month');
});
