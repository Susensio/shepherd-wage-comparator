import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fHalf, fTyped } from '../../src/format.js';

test('fTyped writes a figure as it was typed, up to two decimals', () => {
  assert.equal(fTyped('78,75'), '78,75');
  assert.equal(fTyped(78.75), '78,75');
  assert.equal(fTyped('7,5'), '7,5');
  assert.equal(fTyped(4), '4');
  assert.equal(fTyped('1.200'), '1.200');
  assert.equal(fTyped(''), '0');
});

test('fHalf rounds hours and days to the nearest half: never «7,3»', () => {
  assert.equal(fHalf(7.27), '7,5');
  assert.equal(fHalf(7.2), '7');
  assert.equal(fHalf(50), '50');
  assert.equal(fHalf(1.4), '1,5');
});
