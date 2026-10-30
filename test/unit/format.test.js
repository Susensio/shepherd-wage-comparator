import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fTyped } from '../../src/format.js';

test('fTyped writes a figure as it was typed, up to two decimals', () => {
  assert.equal(fTyped('78,75'), '78,75');
  assert.equal(fTyped(78.75), '78,75');
  assert.equal(fTyped('7,5'), '7,5');
  assert.equal(fTyped(4), '4');
  assert.equal(fTyped('1.200'), '1.200');
  assert.equal(fTyped(''), '0');
});
