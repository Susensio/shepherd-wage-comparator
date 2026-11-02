import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cents, dayRounder, extraDaysRounded, fSumE, shownDiff, shownEuros, sum } from '../../src/ledger.js';

const nbsp = ' ';

test('cents rounds to two decimals', () => {
  for (const [x, expected] of [
    [1.004, 1],
    [1.006, 1.01],
    [-2.346, -2.35],
    [10, 10],
  ])
    assert.equal(cents(x), expected, String(x));
});

test('sum adds the plus rows and subtracts the minus rows, without float noise', () => {
  for (const [plus, minus, expected] of [
    [[0.1, 0.2], [], 0.3],
    [[10.5, 2.25], [3.1], 9.65],
    [[], [1.1, 2.2], -3.3],
    [[], [], 0],
  ])
    assert.equal(sum(plus, minus), expected, JSON.stringify([plus, minus]));
});

test('shownEuros reads the figure as written: whole from 10 €, cents below', () => {
  for (const [x, expected] of [
    [1234.5, 1235],
    [12.4, 12],
    [9.994, 9.99],
    [3.4, 3.4],
    [0.001, 0],
  ])
    assert.equal(shownEuros(x), expected, String(x));
});

test('shownDiff subtracts the shown figures, not the exact ones', () => {
  for (const [first, others, expected] of [
    [100.4, [50.4], 50],
    [100.6, [50.4], 51],
    [10.4, [5.6], 4.4],
    [200.5, [100.5, 50.4], 201 - 101 - 50],
    [7.456, [], 7.46],
  ])
    assert.equal(shownDiff(first, ...others), expected, JSON.stringify([first, others]));
});

test('a «=» row comes out of the rows above as they are shown', () => {
  const rows = [1234.4, 56.6, 7.45];
  assert.equal(sum(rows.map(shownEuros)), 1234 + 57 + 7.45);
  assert.equal(shownDiff(rows[0], rows[1], rows[2]), 1234 - 57 - 7.45);
});

test('fSumE shows cents below 10 € or when the sum has them', () => {
  for (const [total, expected] of [
    [1234, `1.234${nbsp}€`],
    [1234.5, `1.234,50${nbsp}€`],
    [3, `3,00${nbsp}€`],
    [3.4, `3,40${nbsp}€`],
    [0.1 + 0.2, `0,30${nbsp}€`],
  ])
    assert.equal(fSumE(total), expected, String(total));
});

test('dayRounder rounds to tenths below 10 days and to whole days above', () => {
  for (const [basis, x, rounded, half] of [
    [4, 2.34, 2.3, 0.05],
    [9.9, 2.36, 2.4, 0.05],
    [10, 2.5, 3, 0.5],
    [120, 41.4, 41, 0.5],
  ]) {
    const day = dayRounder(basis);
    assert.equal(day.round(x), rounded, `${basis}: ${x}`);
    assert.equal(day.half, half, `${basis}: half`);
  }
});

test('extraDaysRounded: the extra days are worked minus due, as shown', () => {
  for (const [daysWorked, due, expected] of [
    [8.26, 5.04, { worked: 8.3, due: 5, extra: 3.3 }],
    [90.4, 70.6, { worked: 90, due: 71, extra: 19 }],
    [5, 7.5, { worked: 5, due: 7.5, extra: 0 }],
  ])
    assert.deepEqual(extraDaysRounded({ daysWorked }, { due }), expected, JSON.stringify([daysWorked, due]));
});
