// What an offer still needs before it gives figures. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEF_OFFER, isComplete, missing } from '../../src/offer.js';
import { normalizeOffer } from '../../src/saved.js';

const makeOffer = (changes = {}) =>
  normalizeOffer({
    ...DEF_OFFER,
    id: 't',
    name: 't',
    start: '2026-01-01',
    contract: 'permanent',
    duration: 12,
    durationUnit: 'months',
    hoursPerDay: 8,
    payType: 'gross',
    payAmount: 1221,
    payUnit: 'month',
    vacation: 'taken',
    ...changes,
  });

test('a complete offer misses nothing', () => {
  const o = makeOffer();
  assert.deepEqual(missing(o), []);
  assert.equal(isComplete(o), true);
});

test('without a contract, the cash in hand is what is needed', () => {
  const o = makeOffer({ contract: 'none', payAmount: 0, cashAmount: 0, vacation: '' });
  assert.deepEqual(missing(o), ['cashInHand']);
  assert.equal(isComplete(o), false);
  assert.deepEqual(missing({ ...o, cashAmount: 800 }), []);
});

test('an agreed total needs the total', () => {
  const o = makeOffer({ cashMode: 'total', totalAmount: 0 });
  assert.deepEqual(missing(o), ['agreedTotal']);
  assert.deepEqual(missing({ ...o, totalAmount: 5000 }), []);
});

test('the pay is the payroll minimum or an amount', () => {
  const o = makeOffer({ payAmount: 0, cashAmount: 0, payrollMin: false });
  assert.deepEqual(missing(o), ['pay']);
  assert.deepEqual(missing({ ...o, payrollMin: true }), []);
  assert.deepEqual(missing({ ...o, payAmount: 1000 }), []);
});

test('an unknown duration is not missing', () => {
  const o = makeOffer({ duration: '', durationUnit: 'unknown' });
  assert.ok(!missing(o).includes('duration'));
  assert.ok(missing({ ...o, durationUnit: 'months' }).includes('duration'));
});

test('vacation is only needed with a contract', () => {
  assert.deepEqual(missing(makeOffer({ vacation: '' })), ['vacation']);
  assert.deepEqual(missing(makeOffer({ contract: 'none', cashAmount: 800, vacation: '' })), []);
});

test('ids come out in form order', () => {
  const o = makeOffer({ duration: '', hoursPerDay: '', payAmount: 0, vacation: '' });
  assert.deepEqual(missing(o), ['duration', 'hoursPerDay', 'pay', 'vacation']);
});
