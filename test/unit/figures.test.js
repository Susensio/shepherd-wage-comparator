// The figures of an offer are worked out once until a save or a paint resets them.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeOffer } from '../../src/offer.js';
import { calcOffer, notifySaved, resetFigures, settleOffer, state } from '../../src/state.js';

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
