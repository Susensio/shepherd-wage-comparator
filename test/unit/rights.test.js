// Verdicts per right, checked by id. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calc } from '../../src/model/calc.js';
import { DEF_CFG, DEF_OFFER } from '../../src/offer.js';
import { failuresOf, rightsOf } from '../../src/rights.js';
import { normalizeOffer } from '../../src/saved.js';
import { legalLine, unpaidTime } from '../../src/text.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const cfg = { ...DEF_CFG, ...sample.cfg };

// A permanent full-time contract at exactly the 2026 minimum wage, with days off and holidays taken
const BASE = {
  ...DEF_OFFER,
  id: 't',
  name: 't',
  start: '2026-01-01',
  contract: 'permanent',
  duration: 12,
  durationUnit: 'months',
  hoursPerDay: 8,
  daysOff: 2,
  daysOffUnit: 'week',
  holidays: 'yes',
  payType: 'gross',
  payAmount: 1221,
  payUnit: 'month',
  extraPays: 'separate',
  vacation: 'taken',
  housing: 'no',
  car: 'noCar',
  kmHome: 0,
  overnight: 'no',
};
const build = (changes = {}) => {
  const o = normalizeOffer({ ...BASE, ...changes });
  return { o, r: calc(o, { cfg, alone: true }) };
};
/** Status of each right, by id. */
const verdicts = (changes) => {
  const { o, r } = build(changes);
  return Object.fromEntries(rightsOf(o, r).map((right) => [right.id, right.status]));
};

test('a compliant offer passes salary, rest and hours', () => {
  const v = verdicts();
  assert.equal(v.salary, true);
  assert.equal(v.rest, true);
  assert.equal(v.hours, true);
  const { o, r } = build();
  assert.deepEqual(failuresOf(o, r), []);
});

test('below the minimum wage fails salary', () => {
  assert.equal(verdicts({ payAmount: 1000 }).salary, false);
});

test('no contract fails contract and salary', () => {
  const { o, r } = build({ contract: 'none' });
  assert.deepEqual(
    failuresOf(o, r).filter((id) => id === 'contract' || id === 'salary'),
    ['contract', 'salary'],
  );
});

test('sleeping out with the salary reached but the bonus short fails overnight only', () => {
  const v = verdicts({ overnight: 'yes' });
  assert.equal(v.salary, true);
  assert.equal(v.overnight, false);
});

test('fewer days off than the law gives fail rest', () => {
  assert.equal(verdicts({ daysOff: 1 }).rest, false);
});

test('hours over the limit fail hours', () => {
  assert.equal(verdicts({ hoursPerDay: 12 }).hours, false);
});

test('failuresOf returns ids, not titles', () => {
  const { o, r } = build({ payAmount: 1000, daysOff: 1 });
  const failures = failuresOf(o, r);
  assert.ok(failures.includes('salary') && failures.includes('rest'));
  assert.ok(failures.every((id) => /^[a-z]+$/.test(id)));
});

test('legalLine is bad when a right fails, warn when only time is unpaid, ok when all is fine', () => {
  const bad = build({ payAmount: 1000 });
  assert.equal(legalLine(bad.o, bad.r).status, 'bad');
  // Compliant rights with unpaid overtime is not reachable from real inputs (same threshold on both sides), so the figures are set by hand
  const { o, r } = build();
  const unpaidOvertime = {
    ...r,
    savings: { ...r.savings, overtime: 50 },
    extra: { ...r.extra, overtimeValue: 100, overtimeUnpaid: 100 },
  };
  assert.equal(legalLine(o, unpaidOvertime).status, 'warn');
  const ok = build();
  assert.equal(legalLine(ok.o, ok.r).status, 'ok');
});

test('unpaidTime is zero when nothing is unpaid', () => {
  const { r } = build();
  assert.deepEqual(unpaidTime(r), { days: 0, hours: 0 });
});

test('unpaidTime counts all the extra days when none is paid', () => {
  const { r } = build({ daysOff: 0 });
  assert.ok(r.extraDays.extra >= 1);
  assert.equal(unpaidTime(r).days, r.extraDays.extra);
});
