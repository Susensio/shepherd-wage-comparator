// The figures of an offer are worked out once until a save or a paint resets them.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeOffer } from '../../src/offer.js';
import { calcOffer, happenedOffer, notifySaved, resetFigures, settleOffer, state } from '../../src/state.js';

test('the figures and the settlement of an offer are computed once until reset', () => {
  const o = makeOffer();
  state.offers = [o];
  const r = calcOffer(o);
  const settled = settleOffer(o);
  assert.equal(calcOffer(o), r);
  assert.equal(settleOffer(o), settled);
  resetFigures();
  assert.notEqual(calcOffer(o), r);
});

test('a save forgets them', () => {
  const o = makeOffer();
  state.offers = [o];
  const r = calcOffer(o);
  notifySaved();
  assert.notEqual(calcOffer(o), r);
});

test('what happened in a job is computed once, from the same figures, and forgotten with them', () => {
  const o = makeOffer({ start: '2020-06-01', duration: 30, durationUnit: 'days' });
  state.offers = [o];
  const happened = happenedOffer(o);
  assert.equal(happened?.phase, 'finished');
  assert.equal(happenedOffer(o), happened);
  assert.equal(happened?.settled, settleOffer(o));
  notifySaved();
  assert.notEqual(happenedOffer(o), happened);
});

test('an offer only offered has nothing that happened, and that answer is kept too', () => {
  const o = makeOffer({ start: '2020-06-01', offerOnly: true });
  state.offers = [o];
  assert.equal(happenedOffer(o), null);
  assert.equal(happenedOffer(o), null);
});
