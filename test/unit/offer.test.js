// What an offer still needs before it gives figures. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEF_MINE, DEF_TERMS, implausible, isComplete, makeOffer, missing, payKnown, sideOf } from '../../src/offer.js';

/** Before every start date used here: an offer being weighed, not a job that began. */
const BEFORE = '2000-01-01';

const makeTerms = (changes = {}) => ({
  ...DEF_TERMS,
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
  const o = makeTerms();
  assert.deepEqual(missing(o, BEFORE), []);
  assert.equal(isComplete(o), true);
});

test('without a contract, the cash in hand is what is needed', () => {
  const o = makeTerms({ contract: 'none', payAmount: 0, cashAmount: 0, vacation: '' });
  assert.deepEqual(missing(o, BEFORE), ['cashInHand']);
  assert.equal(isComplete(o), false);
  assert.deepEqual(missing({ ...o, cashAmount: 800 }, BEFORE), []);
});

test('an agreed total needs the total', () => {
  const o = makeTerms({ cashMode: 'total', totalAmount: 0 });
  assert.deepEqual(missing(o, BEFORE), ['agreedTotal']);
  assert.deepEqual(missing({ ...o, totalAmount: 5000, payAmount: 0 }, BEFORE), ['payrollPart']);
  assert.deepEqual(missing({ ...o, totalAmount: 5000, payAmount: 1500 }, BEFORE), []);
  assert.deepEqual(missing({ ...o, totalAmount: 5000, payrollMin: true }, BEFORE), []);
});

test('the pay is the payroll minimum or an amount', () => {
  const o = makeTerms({ payAmount: 0, cashAmount: 0, payrollMin: false });
  assert.deepEqual(missing(o, BEFORE), ['pay']);
  assert.deepEqual(missing({ ...o, payrollMin: true }, BEFORE), []);
  assert.deepEqual(missing({ ...o, payAmount: 1000 }, BEFORE), []);
});

test('an unknown duration is not missing', () => {
  const o = makeTerms({ duration: '', durationUnit: 'unknown' });
  assert.ok(!missing(o).includes('duration'));
  assert.ok(missing({ ...o, durationUnit: 'months' }).includes('duration'));
});

test('vacation is only needed with a contract', () => {
  assert.deepEqual(missing(makeTerms({ vacation: '' }), BEFORE), ['vacation']);
  assert.deepEqual(missing(makeTerms({ contract: 'none', cashAmount: 800, vacation: '' }), BEFORE), []);
});

test('ids come out in form order', () => {
  const o = makeTerms({ duration: '', hoursPerDay: '', payAmount: 0, vacation: '' });
  assert.deepEqual(missing(o, BEFORE), ['duration', 'hoursPerDay', 'pay', 'vacation']);
});

test('terms and mine share no field', () => {
  assert.deepEqual(
    Object.keys(DEF_TERMS).filter((field) => field in DEF_MINE),
    [],
  );
});

test('a field is found on its own side of the offer', () => {
  const offer = makeOffer({ payAmount: 900 }, { kmHome: 20 });
  assert.equal(sideOf(offer, 'payAmount'), offer.terms);
  assert.equal(sideOf(offer, 'kmHome'), offer.mine);
  assert.equal(sideOf(offer, 'name'), offer.mine);
  assert.equal(offer.terms.payAmount, 900);
  assert.equal(offer.mine.kmHome, 20);
});

test('implausible: a day over 24 hours, a duration of zero or less, a negative amount', () => {
  assert.deepEqual([...implausible(makeTerms())], []);
  assert.deepEqual([...implausible(makeTerms({ hoursPerDay: 30 }))], ['hoursPerDay']);
  assert.deepEqual([...implausible(makeTerms({ hoursPerDay: 24 }))], []);
  assert.deepEqual([...implausible(makeTerms({ duration: -5 }))], ['duration']);
  assert.deepEqual([...implausible(makeTerms({ duration: 0 }))], ['duration']);
  assert.deepEqual([...implausible(makeTerms({ duration: '' }))], [], 'empty is missing, not wrong');
  assert.deepEqual([...implausible(makeTerms({ duration: -5, durationUnit: 'unknown' }))], []);
  assert.deepEqual([...implausible(makeTerms({ payAmount: -100 }))], ['pay']);
  assert.deepEqual([...implausible(makeTerms({ cashAmount: -1 }))], ['pay']);
});

test('a job that began needs only a duration: no hours, no pay, no vacation answer', () => {
  const thin = makeTerms({ hoursPerDay: '', payAmount: 0, vacation: '' });
  assert.deepEqual(missing(thin, '2026-06-01'), []);
  assert.equal(payKnown(thin), false);
  assert.equal(isComplete(thin), false);
  assert.deepEqual(missing({ ...thin, duration: '' }, '2026-06-01'), ['duration']);
  // before its start, or only an offer, it is still weighed
  assert.deepEqual(missing(thin, '2025-12-31'), ['hoursPerDay', 'pay', 'vacation']);
  assert.deepEqual(missing({ ...thin, offerOnly: true }, '2026-06-01'), ['hoursPerDay', 'pay', 'vacation']);
});
